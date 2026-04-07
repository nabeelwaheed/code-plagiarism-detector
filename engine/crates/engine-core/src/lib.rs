use engine_contracts::{
    AnalysisRequest, AnalysisResponse, MatchKind, MatchSpan, PairAnalysisResult, PairMatch,
    PositionMetadata, SCHEMA_VERSION, SourceMapEntry, TokenMetadata,
};
use engine_gst::{run_gst, Tile};
use engine_language::{parse_submission, CommentToken, ParsedSubmission};
use std::collections::{BTreeMap, HashMap};

const TEMPLATE_MASK_THRESHOLD: usize = 10;
const MIN_CLUSTER_FRAGMENT_LENGTH: usize = 6;
const MAX_CLUSTER_GAP_ASYMMETRY: usize = 4;

pub fn analyze(request: AnalysisRequest) -> Result<AnalysisResponse, String> {
    validate_request(&request)?;

    let AnalysisRequest {
        schema_version: _,
        engine_version,
        language,
        submissions,
        template,
        pairs,
        params,
    } = request;

    let processed_template = match template {
        Some(template) => Some(parse_submission(language, &template.source, template.source_map)?),
        None => None,
    };

    let mut processed_submissions = HashMap::new();
    for submission in submissions {
        let processed = parse_submission(language, &submission.source, submission.source_map)?;
        processed_submissions.insert(submission.submission_id, processed);
    }

    let mut pair_results = Vec::new();
    for pair in pairs {
        let left = processed_submissions
            .get(&pair.left_submission_id)
            .ok_or_else(|| format!("unknown left submission {}", pair.left_submission_id))?;
        let right = processed_submissions
            .get(&pair.right_submission_id)
            .ok_or_else(|| format!("unknown right submission {}", pair.right_submission_id))?;

        let left_mask = build_template_mask(left, processed_template.as_ref());
        let right_mask = build_template_mask(right, processed_template.as_ref());
        let left_active_indices = build_active_token_indices(&left_mask);
        let right_active_indices = build_active_token_indices(&right_mask);
        let left_active_token_count = active_code_token_count(&left_mask);
        let right_active_token_count = active_code_token_count(&right_mask);

        let gst_result = run_gst(
            &left.normalized_tokens,
            &right.normalized_tokens,
            &left_mask,
            &right_mask,
            params.gst_min_match_length,
        );

        let meaningful_regions = build_meaningful_code_regions(
            &gst_result.tiles,
            left_active_token_count,
            right_active_token_count,
            &left_active_indices,
            &right_active_indices,
        );
        let meaningful_matched_token_count = exact_matched_token_count(&meaningful_regions);

        let mut matches = map_code_matches(left, right, &meaningful_regions);
        let comment_matches = compare_comments(
            left,
            right,
            processed_template.as_ref(),
            params.minimum_comment_length,
            matches.len(),
        );
        matches.extend(comment_matches);

        let similarity_score = compute_code_similarity_score_from_regions(
            &meaningful_regions,
            left_active_token_count,
            right_active_token_count,
            params.gst_min_match_length,
        );

        pair_results.push(PairAnalysisResult {
            pair_id: pair.pair_id,
            left_submission_id: pair.left_submission_id,
            right_submission_id: pair.right_submission_id,
            similarity_score,
            matched_token_count: meaningful_matched_token_count,
            matches,
        });
    }

    Ok(AnalysisResponse {
        schema_version: SCHEMA_VERSION.to_string(),
        engine_version,
        language,
        pair_results,
    })
}

fn validate_request(request: &AnalysisRequest) -> Result<(), String> {
    if request.schema_version != SCHEMA_VERSION {
        return Err(format!("schema_version must be {SCHEMA_VERSION}"));
    }

    if request.engine_version.trim().is_empty() {
        return Err("engine_version must be non-empty".to_string());
    }

    if request.submissions.is_empty() {
        return Err("submissions must be non-empty".to_string());
    }

    if request.params.gst_min_match_length == 0 {
        return Err("gst_min_match_length must be greater than zero".to_string());
    }

    if request.params.minimum_comment_length == 0 {
        return Err("minimum_comment_length must be greater than zero".to_string());
    }

    let mut seen = HashMap::new();
    for submission in &request.submissions {
        if submission.submission_id.trim().is_empty() {
            return Err("submission_id must be non-empty".to_string());
        }

        if seen.insert(&submission.submission_id, true).is_some() {
            return Err(format!("duplicate submission_id {}", submission.submission_id));
        }

        validate_source_map(&submission.source, &submission.source_map)?;
    }

    if let Some(template) = &request.template {
        validate_source_map(&template.source, &template.source_map)?;
    }

    for pair in &request.pairs {
        if pair.left_submission_id == pair.right_submission_id {
            return Err(format!("pair {} compares the same submission twice", pair.pair_id));
        }
        if !request
            .submissions
            .iter()
            .any(|submission| submission.submission_id == pair.left_submission_id)
        {
            return Err(format!("pair {} has unknown left submission", pair.pair_id));
        }
        if !request
            .submissions
            .iter()
            .any(|submission| submission.submission_id == pair.right_submission_id)
        {
            return Err(format!("pair {} has unknown right submission", pair.pair_id));
        }
    }

    Ok(())
}

fn validate_source_map(source: &str, entries: &[SourceMapEntry]) -> Result<(), String> {
    let mut previous_end = 0usize;
    for entry in entries {
        if entry.file_path.trim().is_empty() {
            return Err("source_map file_path must be non-empty".to_string());
        }
        if entry.byte_end < entry.byte_start {
            return Err("source_map byte_end must be >= byte_start".to_string());
        }
        if entry.byte_end > source.len() {
            return Err("source_map byte_end exceeds source length".to_string());
        }
        if entry.byte_start < previous_end {
            return Err("source_map entries must not overlap".to_string());
        }
        previous_end = entry.byte_end;
    }
    Ok(())
}

fn build_template_mask(
    submission: &ParsedSubmission,
    template: Option<&ParsedSubmission>,
) -> Vec<bool> {
    let mut mask = vec![false; submission.normalized_tokens.len()];
    let Some(template) = template else {
        return mask;
    };

    let template_mask = vec![false; template.normalized_tokens.len()];
    let gst_result = run_gst(
        &submission.normalized_tokens,
        &template.normalized_tokens,
        &mask,
        &template_mask,
        TEMPLATE_MASK_THRESHOLD,
    );

    for tile in gst_result.tiles {
        if tile.length >= TEMPLATE_MASK_THRESHOLD {
            for offset in 0..tile.length {
                mask[tile.left_start + offset] = true;
            }
        }
    }

    mask
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ActiveTile {
    tile: Tile,
    left_active_start: usize,
    right_active_start: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CodeRegion {
    left_start_token: usize,
    left_end_token: usize,
    right_start_token: usize,
    right_end_token: usize,
    exact_token_count: usize,
    effective_token_count: usize,
    effective_left_token_count: usize,
    effective_right_token_count: usize,
    strongest_anchor_len: usize,
}

#[derive(Debug, Clone)]
struct ClusterCandidate {
    start_index: usize,
    end_index: usize,
    region: CodeRegion,
}

fn map_code_matches(
    left: &ParsedSubmission,
    right: &ParsedSubmission,
    regions: &[CodeRegion],
) -> Vec<PairMatch> {
    let mut matches = Vec::new();

    for (index, region) in regions.iter().enumerate() {
        let left_start_token = region.left_start_token;
        let left_end_token = region.left_end_token;
        let right_start_token = region.right_start_token;
        let right_end_token = region.right_end_token;

        let left_start = left.code_tokens[left_start_token].byte_start;
        let left_end = left.code_tokens[left_end_token].byte_end;
        let right_start = right.code_tokens[right_start_token].byte_start;
        let right_end = right.code_tokens[right_end_token].byte_end;

        matches.push(PairMatch {
            match_id: format!("code-{index}"),
            kind: MatchKind::Code,
            left: build_match_span(
                left_start,
                left_end,
                left_start_token,
                left_end_token,
                &left.line_starts,
                &left.source_map,
            ),
            right: build_match_span(
                right_start,
                right_end,
                right_start_token,
                right_end_token,
                &right.line_starts,
                &right.source_map,
            ),
            matched_token_count: region.exact_token_count,
        });
    }

    matches
}

#[cfg(test)]
fn filter_meaningful_code_tiles(tiles: &[Tile], left_len: usize, right_len: usize) -> Vec<Tile> {
    let threshold = meaningful_tile_threshold(left_len, right_len);

    tiles
        .iter()
        .filter(|tile| tile.length >= threshold)
        .cloned()
        .collect()
}

fn build_active_token_indices(mask: &[bool]) -> Vec<Option<usize>> {
    let mut indices = Vec::with_capacity(mask.len());
    let mut next_active_index = 0usize;

    for masked in mask {
        if *masked {
            indices.push(None);
        } else {
            indices.push(Some(next_active_index));
            next_active_index += 1;
        }
    }

    indices
}

fn build_meaningful_code_regions(
    tiles: &[Tile],
    left_len: usize,
    right_len: usize,
    left_active_indices: &[Option<usize>],
    right_active_indices: &[Option<usize>],
) -> Vec<CodeRegion> {
    let threshold = meaningful_tile_threshold(left_len, right_len);
    let mut active_tiles = tiles
        .iter()
        .filter_map(|tile| {
            Some(ActiveTile {
                tile: tile.clone(),
                left_active_start: left_active_indices.get(tile.left_start).copied().flatten()?,
                right_active_start: right_active_indices.get(tile.right_start).copied().flatten()?,
            })
        })
        .collect::<Vec<_>>();

    active_tiles.sort_by(|a, b| {
        (a.tile.left_start, a.tile.right_start, a.tile.length).cmp(&(
            b.tile.left_start,
            b.tile.right_start,
            b.tile.length,
        ))
    });

    let mut regions = active_tiles
        .iter()
        .filter(|active_tile| active_tile.tile.length >= threshold)
        .map(|active_tile| region_from_tile(&active_tile.tile))
        .collect::<Vec<_>>();

    let clusters = select_cluster_regions(&active_tiles, threshold);
    regions.extend(clusters);
    regions.sort_by(|a, b| {
        (a.left_start_token, a.right_start_token, a.left_end_token, a.right_end_token).cmp(&(
            b.left_start_token,
            b.right_start_token,
            b.left_end_token,
            b.right_end_token,
        ))
    });
    regions
}

fn meaningful_tile_threshold(left_len: usize, right_len: usize) -> usize {
    let smaller_tokens = left_len.min(right_len);
    let scaled_threshold = (3 * smaller_tokens).div_ceil(100);

    scaled_threshold.clamp(10, 15)
}

fn region_from_tile(tile: &Tile) -> CodeRegion {
    CodeRegion {
        left_start_token: tile.left_start,
        left_end_token: tile.left_start + tile.length - 1,
        right_start_token: tile.right_start,
        right_end_token: tile.right_start + tile.length - 1,
        exact_token_count: tile.length,
        effective_token_count: tile.length,
        effective_left_token_count: tile.length,
        effective_right_token_count: tile.length,
        strongest_anchor_len: tile.length,
    }
}

fn exact_matched_token_count(regions: &[CodeRegion]) -> usize {
    regions.iter().map(|region| region.exact_token_count).sum()
}

fn effective_matched_token_count(regions: &[CodeRegion]) -> usize {
    regions.iter().map(|region| region.effective_token_count).sum()
}

fn is_cluster_candidate(tile: &Tile, threshold: usize) -> bool {
    tile.length >= MIN_CLUSTER_FRAGMENT_LENGTH && tile.length < threshold
}

fn select_cluster_regions(active_tiles: &[ActiveTile], threshold: usize) -> Vec<CodeRegion> {
    let mut candidates = Vec::new();

    for start_index in 0..active_tiles.len() {
        for fragment_count in 2..=(active_tiles.len() - start_index) {
            if start_index + fragment_count > active_tiles.len() {
                break;
            }

            let fragment_slice = &active_tiles[start_index..start_index + fragment_count];
            if !fragment_slice
                .iter()
                .all(|active_tile| is_cluster_candidate(&active_tile.tile, threshold))
            {
                continue;
            }

            if let Some(region) = build_cluster_region(fragment_slice, threshold) {
                candidates.push(ClusterCandidate {
                    start_index,
                    end_index: start_index + fragment_count - 1,
                    region,
                });
            }
        }
    }

    choose_non_overlapping_clusters(&candidates)
}

fn build_cluster_region(fragments: &[ActiveTile], threshold: usize) -> Option<CodeRegion> {
    if fragments.len() < 2 {
        return None;
    }

    let first = fragments.first()?;
    let last = fragments.last()?;
    let exact_token_count = fragments.iter().map(|fragment| fragment.tile.length).sum::<usize>();
    if exact_token_count < threshold {
        return None;
    }

    let strongest_anchor_len = fragments
        .iter()
        .map(|fragment| fragment.tile.length)
        .max()
        .unwrap_or(0);

    let mut representative_gap_total = 0usize;
    let mut left_gap_total = 0usize;
    let mut right_gap_total = 0usize;

    for pair in fragments.windows(2) {
        let previous = &pair[0];
        let next = &pair[1];
        if next.tile.right_start <= previous.tile.right_start {
            return None;
        }

        let previous_left_end = previous.tile.left_start + previous.tile.length;
        let previous_right_end = previous.tile.right_start + previous.tile.length;
        let left_original_gap = next.tile.left_start.checked_sub(previous_left_end)?;
        let right_original_gap = next.tile.right_start.checked_sub(previous_right_end)?;
        let left_active_gap = next
            .left_active_start
            .checked_sub(previous.left_active_start + previous.tile.length)?;
        let right_active_gap = next
            .right_active_start
            .checked_sub(previous.right_active_start + previous.tile.length)?;

        if left_original_gap != left_active_gap || right_original_gap != right_active_gap {
            return None;
        }

        if left_active_gap.abs_diff(right_active_gap) > MAX_CLUSTER_GAP_ASYMMETRY {
            return None;
        }

        let gap = left_active_gap.max(right_active_gap);
        let local_reference = previous.tile.length.min(next.tile.length);
        if gap > (local_reference / 2) {
            return None;
        }

        representative_gap_total += gap;
        left_gap_total += left_active_gap;
        right_gap_total += right_active_gap;
    }

    if !gap_burden_is_acceptable(exact_token_count, representative_gap_total) {
        return None;
    }

    Some(CodeRegion {
        left_start_token: first.tile.left_start,
        left_end_token: last.tile.left_start + last.tile.length - 1,
        right_start_token: first.tile.right_start,
        right_end_token: last.tile.right_start + last.tile.length - 1,
        exact_token_count,
        effective_token_count: exact_token_count + representative_gap_total,
        effective_left_token_count: exact_token_count + left_gap_total,
        effective_right_token_count: exact_token_count + right_gap_total,
        strongest_anchor_len,
    })
}

fn gap_burden_is_acceptable(exact_token_count: usize, total_internal_gaps: usize) -> bool {
    total_internal_gaps * 2 <= exact_token_count
}

fn choose_non_overlapping_clusters(candidates: &[ClusterCandidate]) -> Vec<CodeRegion> {
    if candidates.is_empty() {
        return Vec::new();
    }

    let mut sorted = candidates.to_vec();
    sorted.sort_by(|a, b| {
        (a.end_index, a.start_index, a.region.effective_token_count).cmp(&(
            b.end_index,
            b.start_index,
            b.region.effective_token_count,
        ))
    });

    let mut compatible = vec![None; sorted.len()];
    for current_index in 0..sorted.len() {
        for previous_index in (0..current_index).rev() {
            if sorted[previous_index].end_index < sorted[current_index].start_index {
                compatible[current_index] = Some(previous_index);
                break;
            }
        }
    }

    let mut best_score = vec![0usize; sorted.len()];
    let mut take_current = vec![false; sorted.len()];

    for index in 0..sorted.len() {
        let include_score = cluster_weight(&sorted[index])
            + compatible[index].map(|previous| best_score[previous]).unwrap_or(0);
        let exclude_score = if index > 0 { best_score[index - 1] } else { 0 };

        if include_score > exclude_score {
            best_score[index] = include_score;
            take_current[index] = true;
        } else {
            best_score[index] = exclude_score;
        }
    }

    let mut chosen = Vec::new();
    let mut current = Some(sorted.len() - 1);
    while let Some(index) = current {
        if take_current[index] {
            chosen.push(sorted[index].region.clone());
            current = compatible[index];
        } else if index == 0 {
            current = None;
        } else {
            current = Some(index - 1);
        }
    }

    chosen.sort_by(|a, b| {
        (a.left_start_token, a.right_start_token, a.left_end_token, a.right_end_token).cmp(&(
            b.left_start_token,
            b.right_start_token,
            b.left_end_token,
            b.right_end_token,
        ))
    });
    chosen
}

fn cluster_weight(candidate: &ClusterCandidate) -> usize {
    (candidate.region.effective_token_count * 1_000) + candidate.region.exact_token_count
}

fn active_code_token_count(mask: &[bool]) -> usize {
    mask.iter().filter(|masked| !**masked).count()
}

#[derive(Debug, Clone, PartialEq)]
struct CodeSimilarityMetrics {
    coverage_left: f64,
    coverage_right: f64,
    coverage_anchor: f64,
    longest_tile_len: usize,
    tile_count: usize,
    average_tile_len: f64,
    concentration_ratio: f64,
    longest_tile_ratio_of_smaller_submission: f64,
    contiguity_factor: f64,
    fragmentation_factor: f64,
    similarity_score: f64,
}

#[cfg(test)]
fn compute_code_similarity_score(
    tiles: &[Tile],
    _matched_token_count: usize,
    left_len: usize,
    right_len: usize,
    gst_min_match_length: usize,
) -> f64 {
    let left_active_indices = (0..left_len).map(Some).collect::<Vec<_>>();
    let right_active_indices = (0..right_len).map(Some).collect::<Vec<_>>();
    let meaningful_regions = build_meaningful_code_regions(
        tiles,
        left_len,
        right_len,
        &left_active_indices,
        &right_active_indices,
    );
    compute_code_similarity_score_from_regions(
        &meaningful_regions,
        left_len,
        right_len,
        gst_min_match_length,
    )
}

#[cfg(test)]
fn compute_code_similarity_metrics(
    tiles: &[Tile],
    _matched_token_count: usize,
    left_len: usize,
    right_len: usize,
    gst_min_match_length: usize,
) -> CodeSimilarityMetrics {
    let left_active_indices = (0..left_len).map(Some).collect::<Vec<_>>();
    let right_active_indices = (0..right_len).map(Some).collect::<Vec<_>>();
    let meaningful_regions = build_meaningful_code_regions(
        tiles,
        left_len,
        right_len,
        &left_active_indices,
        &right_active_indices,
    );
    compute_code_similarity_metrics_from_regions(
        &meaningful_regions,
        left_len,
        right_len,
        gst_min_match_length,
    )
}

fn progress_above_floor(value: f64, floor: f64) -> f64 {
    if floor <= 0.0 || value <= floor {
        return 0.0;
    }

    ((value - floor) / floor).clamp(0.0, 1.0)
}

fn compute_code_similarity_score_from_regions(
    meaningful_regions: &[CodeRegion],
    left_len: usize,
    right_len: usize,
    gst_min_match_length: usize,
) -> f64 {
    compute_code_similarity_metrics_from_regions(
        meaningful_regions,
        left_len,
        right_len,
        gst_min_match_length,
    )
    .similarity_score
}

fn compute_code_similarity_metrics_from_regions(
    meaningful_regions: &[CodeRegion],
    left_len: usize,
    right_len: usize,
    gst_min_match_length: usize,
) -> CodeSimilarityMetrics {
    if left_len == 0 || right_len == 0 || meaningful_regions.is_empty() {
        return CodeSimilarityMetrics {
            coverage_left: 0.0,
            coverage_right: 0.0,
            coverage_anchor: 0.0,
            longest_tile_len: 0,
            tile_count: meaningful_regions.len(),
            average_tile_len: 0.0,
            concentration_ratio: 0.0,
            longest_tile_ratio_of_smaller_submission: 0.0,
            contiguity_factor: 0.0,
            fragmentation_factor: 0.0,
            similarity_score: 0.0,
        };
    }

    let exact_matched_token_count = exact_matched_token_count(meaningful_regions);
    let effective_matched_token_count = effective_matched_token_count(meaningful_regions);
    let effective_left_token_count = meaningful_regions
        .iter()
        .map(|region| region.effective_left_token_count)
        .sum::<usize>();
    let effective_right_token_count = meaningful_regions
        .iter()
        .map(|region| region.effective_right_token_count)
        .sum::<usize>();
    let coverage_left = effective_left_token_count as f64 / left_len as f64;
    let coverage_right = effective_right_token_count as f64 / right_len as f64;
    let harmonic_coverage = if coverage_left == 0.0 || coverage_right == 0.0 {
        0.0
    } else {
        (2.0 * coverage_left * coverage_right) / (coverage_left + coverage_right)
    };
    let geometric_coverage = (coverage_left * coverage_right).sqrt();
    let coverage_anchor = ((0.75 * harmonic_coverage) + (0.25 * geometric_coverage)).clamp(0.0, 1.0);

    let longest_tile_len = meaningful_regions
        .iter()
        .map(|region| region.strongest_anchor_len)
        .max()
        .unwrap_or(0);
    let tile_count = meaningful_regions.len();
    let average_tile_len = effective_matched_token_count as f64 / tile_count as f64;
    let concentration_ratio =
        (longest_tile_len as f64 / effective_matched_token_count as f64).clamp(0.0, 1.0);
    let smaller_submission_len = left_len.min(right_len).max(1);
    let longest_tile_ratio_of_smaller_submission =
        (longest_tile_len as f64 / smaller_submission_len as f64).clamp(0.0, 1.0);
    let longest_above_floor_ratio =
        progress_above_floor(longest_tile_len as f64, gst_min_match_length as f64);
    let average_tile_above_floor_ratio =
        progress_above_floor(average_tile_len, gst_min_match_length as f64);

    let contiguity_factor = (
        0.9
        + (0.05 * longest_tile_ratio_of_smaller_submission)
        + (0.05 * longest_above_floor_ratio)
    )
        .clamp(0.0, 1.0);
    let fragmentation_factor = (
        0.85
        + (0.10 * concentration_ratio.sqrt())
        + (0.05 * average_tile_above_floor_ratio)
    )
        .clamp(0.0, 1.0);
    let purity_factor = if effective_matched_token_count == 0 {
        0.0
    } else {
        (exact_matched_token_count as f64 / effective_matched_token_count as f64)
            .sqrt()
            .clamp(0.0, 1.0)
    };

    let similarity_score =
        (coverage_anchor * contiguity_factor * fragmentation_factor * purity_factor).clamp(0.0, 1.0);

    CodeSimilarityMetrics {
        coverage_left,
        coverage_right,
        coverage_anchor,
        longest_tile_len,
        tile_count,
        average_tile_len,
        concentration_ratio,
        longest_tile_ratio_of_smaller_submission,
        contiguity_factor,
        fragmentation_factor,
        similarity_score,
    }
}

fn compare_comments(
    left: &ParsedSubmission,
    right: &ParsedSubmission,
    template: Option<&ParsedSubmission>,
    minimum_comment_length: usize,
    starting_index: usize,
) -> Vec<PairMatch> {
    let minimum_meaningful_comment_length =
        minimum_comment_length.max(MEANINGFUL_COMMENT_MATCH_LENGTH);
    let template_counts = template_comment_counts(
        template.map(|parsed| parsed.comment_tokens.as_slice()),
        minimum_meaningful_comment_length,
    );
    let left_comments = prepared_comments(left, minimum_meaningful_comment_length, &template_counts);
    let right_comments = prepared_comments(right, minimum_meaningful_comment_length, &template_counts);

    let mut left_by_text: BTreeMap<String, Vec<OwnedPreparedComment<'_>>> = BTreeMap::new();
    for comment in left_comments {
        left_by_text
            .entry(comment.normalized_text.clone())
            .or_default()
            .push(comment);
    }

    let mut right_by_text: BTreeMap<String, Vec<OwnedPreparedComment<'_>>> = BTreeMap::new();
    for comment in right_comments {
        right_by_text
            .entry(comment.normalized_text.clone())
            .or_default()
            .push(comment);
    }

    let mut matches = Vec::new();
    for (normalized_text, left_group) in left_by_text {
        let Some(right_group) = right_by_text.get(&normalized_text) else {
            continue;
        };

        for (left_comment, right_comment) in left_group.iter().zip(right_group.iter()) {
            let match_index = starting_index + matches.len();
            matches.push(comment_match(
                match_index,
                left_comment.original_index,
                right_comment.original_index,
                left_comment.comment,
                right_comment.comment,
                &left.line_starts,
                &left.source_map,
                &right.line_starts,
                &right.source_map,
            ));
        }
    }

    matches
}

fn template_comment_counts(
    template_comments: Option<&[CommentToken]>,
    minimum_comment_length: usize,
) -> HashMap<String, usize> {
    let mut counts = HashMap::new();

    let Some(template_comments) = template_comments else {
        return counts;
    };

    for comment in template_comments {
        let normalized = normalize_comment(&comment.text);
        if normalized.len() < minimum_comment_length {
            continue;
        }

        *counts.entry(normalized).or_insert(0) += 1;
    }

    counts
}

fn prepared_comments<'a>(
    submission: &'a ParsedSubmission,
    minimum_comment_length: usize,
    template_counts: &HashMap<String, usize>,
) -> Vec<OwnedPreparedComment<'a>> {
    let mut remaining_template_counts = template_counts.clone();
    let mut prepared = Vec::new();

    for (index, comment) in submission.comment_tokens.iter().enumerate() {
        let normalized_text = normalize_comment(&comment.text);
        if normalized_text.len() < minimum_comment_length {
            continue;
        }

        if let Some(remaining) = remaining_template_counts.get_mut(&normalized_text) {
            if *remaining > 0 {
                *remaining -= 1;
                continue;
            }
        }

        prepared.push(OwnedPreparedComment {
            original_index: index,
            comment,
            normalized_text,
        });
    }

    prepared
}

#[derive(Clone)]
struct OwnedPreparedComment<'a> {
    original_index: usize,
    comment: &'a CommentToken,
    normalized_text: String,
}

const MEANINGFUL_COMMENT_MATCH_LENGTH: usize = 35;

fn comment_match(
    match_index: usize,
    left_index: usize,
    right_index: usize,
    left_comment: &CommentToken,
    right_comment: &CommentToken,
    left_line_starts: &[usize],
    left_source_map: &[SourceMapEntry],
    right_line_starts: &[usize],
    right_source_map: &[SourceMapEntry],
) -> PairMatch {
    PairMatch {
        match_id: format!("comment-{match_index}"),
        kind: MatchKind::Comment,
        left: build_match_span(
            left_comment.byte_start,
            left_comment.byte_end,
            left_index,
            left_index,
            left_line_starts,
            left_source_map,
        ),
        right: build_match_span(
            right_comment.byte_start,
            right_comment.byte_end,
            right_index,
            right_index,
            right_line_starts,
            right_source_map,
        ),
        matched_token_count: 1,
    }
}

fn normalize_comment(comment: &str) -> String {
    comment
        .chars()
        .flat_map(char::to_lowercase)
        .map(|character| {
            if character.is_alphanumeric() || character.is_whitespace() {
                character
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn build_match_span(
    byte_start: usize,
    byte_end: usize,
    token_start: usize,
    token_end: usize,
    line_starts: &[usize],
    source_map: &[SourceMapEntry],
) -> MatchSpan {
    MatchSpan {
        byte_start,
        byte_end,
        file_path: lookup_file_path(source_map, byte_start, byte_end),
        position: Some(position_from_bytes(line_starts, byte_start, byte_end)),
        tokens: Some(TokenMetadata {
            token_start,
            token_end,
        }),
    }
}

fn lookup_file_path(source_map: &[SourceMapEntry], byte_start: usize, byte_end: usize) -> Option<String> {
    source_map
        .iter()
        .find(|entry| byte_start >= entry.byte_start && byte_end <= entry.byte_end)
        .map(|entry| entry.file_path.clone())
}

fn position_from_bytes(line_starts: &[usize], byte_start: usize, byte_end: usize) -> PositionMetadata {
    let (line_start, column_start) = line_column(line_starts, byte_start);
    let end_offset = byte_end.saturating_sub(1).max(byte_start);
    let (line_end, column_end) = line_column(line_starts, end_offset);
    PositionMetadata {
        line_start,
        column_start,
        line_end,
        column_end,
    }
}

fn line_column(line_starts: &[usize], byte_offset: usize) -> (usize, usize) {
    let line_index = match line_starts.binary_search(&byte_offset) {
        Ok(index) => index,
        Err(index) => index.saturating_sub(1),
    };
    let line_start = line_starts[line_index];
    (line_index + 1, byte_offset.saturating_sub(line_start) + 1)
}

#[cfg(test)]
mod tests {
    use super::{
        active_code_token_count, analyze, build_cluster_region, build_meaningful_code_regions,
        build_template_mask, compute_code_similarity_metrics, compute_code_similarity_score,
        exact_matched_token_count, filter_meaningful_code_tiles, gap_burden_is_acceptable,
        map_code_matches, meaningful_tile_threshold, ActiveTile, CodeRegion, TEMPLATE_MASK_THRESHOLD,
    };
    use engine_contracts::{
        AnalysisLanguage, AnalysisPair, AnalysisParams, AnalysisRequest, AnalysisSubmission,
        SourceMapEntry, TemplateSource, SCHEMA_VERSION, SubmissionKind,
    };
    use engine_gst::Tile;
    use engine_language::parse_submission;

    fn identity_active_indices(len: usize) -> Vec<Option<usize>> {
        (0..len).map(Some).collect()
    }

    fn meaningful_regions_for_identity_tiles(
        tiles: &[Tile],
        left_len: usize,
        right_len: usize,
    ) -> Vec<CodeRegion> {
        let left_indices = identity_active_indices(left_len);
        let right_indices = identity_active_indices(right_len);
        build_meaningful_code_regions(tiles, left_len, right_len, &left_indices, &right_indices)
    }

    fn active_tile(left_start: usize, right_start: usize, length: usize) -> ActiveTile {
        ActiveTile {
            tile: Tile {
                left_start,
                right_start,
                length,
            },
            left_active_start: left_start,
            right_active_start: right_start,
        }
    }

    #[test]
    fn analyzes_java_pair_and_returns_byte_spans() {
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Java,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "class A { int add(int a, int b) { return a + b; } }\n".to_string(),
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "class B { int sum(int x, int y) { return x + y; } }\n".to_string(),
                    source_map: vec![],
                },
            ],
            template: None,
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 3,
                minimum_comment_length: 5,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        assert_eq!(response.pair_results.len(), 1);
        let pair = &response.pair_results[0];
        assert_eq!(pair.pair_id, "left__right");
        assert!(pair.similarity_score > 0.0);
        assert!(!pair.matches.is_empty());
        assert!(pair.matches[0].left.byte_end > pair.matches[0].left.byte_start);
        assert!(pair.matches[0].right.byte_end > pair.matches[0].right.byte_start);
    }

    #[test]
    fn rejects_invalid_schema_version() {
        let request = AnalysisRequest {
            schema_version: "0.9".to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Java,
            submissions: vec![AnalysisSubmission {
                submission_id: "left".to_string(),
                submission_kind: SubmissionKind::Current,
                source: "class A {}\n".to_string(),
                source_map: vec![],
            }],
            template: None,
            pairs: vec![],
            params: AnalysisParams {
                gst_min_match_length: 3,
                minimum_comment_length: 5,
            },
        };

        let error = analyze(request).expect_err("invalid schema should fail");
        assert!(error.contains("schema_version"));
    }

    #[test]
    fn template_subtraction_removes_template_only_match_signal() {
        let template_source = "class Shared { int helper(int value) { return value + 1; } }\n";
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Java,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: template_source.to_string(),
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: template_source.to_string(),
                    source_map: vec![],
                },
            ],
            template: Some(TemplateSource {
                source: template_source.to_string(),
                source_map: vec![],
            }),
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 3,
                minimum_comment_length: 5,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];
        assert_eq!(pair.similarity_score, 0.0);
        assert!(pair.matches.is_empty());
    }

    #[test]
    fn source_map_file_path_is_returned_for_match_spans() {
        let left_source = "int add(int a, int b) {\n  return a + b;\n}\n";
        let right_source = "int sum(int x, int y) {\n  return x + y;\n}\n";
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::C,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: left_source.to_string(),
                    source_map: vec![SourceMapEntry {
                        file_path: "main.c".to_string(),
                        byte_start: 0,
                        byte_end: left_source.len(),
                    }],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: right_source.to_string(),
                    source_map: vec![SourceMapEntry {
                        file_path: "main.c".to_string(),
                        byte_start: 0,
                        byte_end: right_source.len(),
                    }],
                },
            ],
            template: None,
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 3,
                minimum_comment_length: 5,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];
        assert!(!pair.matches.is_empty());
        assert_eq!(pair.matches[0].left.file_path.as_deref(), Some("main.c"));
        assert_eq!(pair.matches[0].right.file_path.as_deref(), Some("main.c"));
    }

    #[test]
    fn merged_output_span_can_cover_noise_while_matched_token_count_stays_exact_only() {
        let left = parse_submission(
            AnalysisLanguage::C,
            "int f(){ a(); b(); c(); d(); }\n",
            vec![],
        )
        .expect("left should parse");
        let right = parse_submission(
            AnalysisLanguage::C,
            "int g(){ a(); x(); c(); d(); }\n",
            vec![],
        )
        .expect("right should parse");

        let matches = map_code_matches(
            &left,
            &right,
            &[CodeRegion {
                left_start_token: 0,
                left_end_token: 13,
                right_start_token: 0,
                right_end_token: 13,
                exact_token_count: 12,
                effective_token_count: 14,
                effective_left_token_count: 14,
                effective_right_token_count: 14,
                strongest_anchor_len: 6,
            }],
        );

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].matched_token_count, 12);
        assert_eq!(matches[0].left.tokens.as_ref().map(|tokens| tokens.token_start), Some(0));
        assert_eq!(matches[0].left.tokens.as_ref().map(|tokens| tokens.token_end), Some(13));
        assert_eq!(matches[0].right.tokens.as_ref().map(|tokens| tokens.token_start), Some(0));
        assert_eq!(matches[0].right.tokens.as_ref().map(|tokens| tokens.token_end), Some(13));
    }

    #[test]
    fn java_package_and_import_boilerplate_are_excluded() {
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Java,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "package left.example;\nimport java.util.List;\n".to_string(),
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "package right.example;\nimport java.util.List;\n".to_string(),
                    source_map: vec![],
                },
            ],
            template: None,
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 3,
                minimum_comment_length: 5,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];
        assert_eq!(pair.similarity_score, 0.0);
        assert!(pair.matches.is_empty());
    }

    #[test]
    fn c_preprocessor_boilerplate_is_excluded() {
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::C,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "#include <stdio.h>\n".to_string(),
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "#include <stdio.h>\n".to_string(),
                    source_map: vec![],
                },
            ],
            template: None,
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 1,
                minimum_comment_length: 5,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];
        assert_eq!(pair.similarity_score, 0.0);
        assert!(pair.matches.is_empty());
    }

    #[test]
    fn template_comments_are_removed_from_comment_matches() {
        let template_comment = "// starter comment!\n";
        let copied_comment = "// distinctive copied clue that stays meaningful across both submissions!!!\n";
        let left_source = format!("{template_comment}{copied_comment}class A {{}}\n");
        let right_source = format!("{template_comment}{copied_comment}class B {{}}\n");
        let template_source = format!("{template_comment}class Template {{}}\n");
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Java,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: left_source,
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: right_source,
                    source_map: vec![],
                },
            ],
            template: Some(TemplateSource {
                source: template_source,
                source_map: vec![],
            }),
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 3,
                minimum_comment_length: 5,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];
        let comment_matches = pair
            .matches
            .iter()
            .filter(|matched| matched.kind == engine_contracts::MatchKind::Comment)
            .count();

        assert_eq!(comment_matches, 1);
    }

    #[test]
    fn short_comment_matches_below_meaningful_threshold_are_excluded() {
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Java,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "// find top student\nclass A {}\n".to_string(),
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "/* find top student */\nclass B {}\n".to_string(),
                    source_map: vec![],
                },
            ],
            template: None,
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 3,
                minimum_comment_length: 5,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];
        let comment_matches = pair
            .matches
            .iter()
            .filter(|matched| matched.kind == engine_contracts::MatchKind::Comment)
            .count();

        assert_eq!(comment_matches, 0);
    }

    #[test]
    fn comment_normalization_ignores_punctuation_and_case_for_meaningful_comments() {
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Java,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source:
                        "// Hello, WORLD! this distinctive copied comment stays meaningful today.\nclass A {}\n"
                            .to_string(),
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source:
                        "/* hello world this distinctive copied comment stays meaningful today */\nclass B {}\n"
                            .to_string(),
                    source_map: vec![],
                },
            ],
            template: None,
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 3,
                minimum_comment_length: 5,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];
        let comment_matches = pair
            .matches
            .iter()
            .filter(|matched| matched.kind == engine_contracts::MatchKind::Comment)
            .count();

        assert_eq!(comment_matches, 1);
    }

    #[test]
    fn repeated_identical_meaningful_comments_do_not_cross_multiply() {
        let repeated_comment = "// this repeated comment remains long enough to stay meaningful across copies\n";
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Java,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: format!("{repeated_comment}{repeated_comment}class A {{}}\n"),
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: format!("/* {}*/\nclass B {{}}\n", repeated_comment.trim_start_matches("// ").trim()),
                    source_map: vec![],
                },
            ],
            template: None,
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 3,
                minimum_comment_length: 5,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];
        let comment_matches = pair
            .matches
            .iter()
            .filter(|matched| matched.kind == engine_contracts::MatchKind::Comment)
            .count();

        assert_eq!(comment_matches, 1);
    }

    #[test]
    fn meaningful_tile_threshold_scales_and_caps() {
        assert_eq!(meaningful_tile_threshold(20, 50), 10);
        assert_eq!(meaningful_tile_threshold(400, 600), 12);
        assert_eq!(meaningful_tile_threshold(2000, 3000), 15);
    }

    #[test]
    fn weak_code_tiles_are_filtered_from_evidence() {
        let tiles = filter_meaningful_code_tiles(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 9,
                },
                Tile {
                    left_start: 20,
                    right_start: 20,
                    length: 10,
                },
            ],
            20,
            20,
        );

        assert_eq!(tiles.len(), 1);
        assert_eq!(tiles[0].length, 10);
    }

    #[test]
    fn two_short_anchors_with_tiny_gap_merge_into_one_region() {
        let regions = meaningful_regions_for_identity_tiles(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 6,
                },
                Tile {
                    left_start: 8,
                    right_start: 8,
                    length: 6,
                },
            ],
            40,
            40,
        );

        assert_eq!(regions.len(), 1);
        assert_eq!(regions[0].left_start_token, 0);
        assert_eq!(regions[0].left_end_token, 13);
        assert_eq!(regions[0].right_start_token, 0);
        assert_eq!(regions[0].right_end_token, 13);
        assert_eq!(regions[0].exact_token_count, 12);
        assert_eq!(regions[0].effective_token_count, 14);
    }

    #[test]
    fn anchors_with_too_large_gap_do_not_merge() {
        let regions = meaningful_regions_for_identity_tiles(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 6,
                },
                Tile {
                    left_start: 10,
                    right_start: 10,
                    length: 6,
                },
            ],
            40,
            40,
        );

        assert!(regions.is_empty());
    }

    #[test]
    fn anchors_with_asymmetric_gaps_do_not_merge() {
        let regions = meaningful_regions_for_identity_tiles(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 6,
                },
                Tile {
                    left_start: 8,
                    right_start: 13,
                    length: 6,
                },
            ],
            40,
            40,
        );

        assert!(regions.is_empty());
    }

    #[test]
    fn valid_three_fragment_chain_merges_into_one_region() {
        let regions = meaningful_regions_for_identity_tiles(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 6,
                },
                Tile {
                    left_start: 8,
                    right_start: 8,
                    length: 6,
                },
                Tile {
                    left_start: 16,
                    right_start: 16,
                    length: 6,
                },
            ],
            80,
            80,
        );

        assert_eq!(regions.len(), 1);
        assert_eq!(regions[0].left_end_token, 21);
        assert_eq!(regions[0].exact_token_count, 18);
        assert_eq!(regions[0].effective_token_count, 22);
    }

    #[test]
    fn already_meaningful_exact_tile_remains_standalone() {
        let regions = meaningful_regions_for_identity_tiles(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 10,
                },
                Tile {
                    left_start: 12,
                    right_start: 12,
                    length: 6,
                },
            ],
            40,
            40,
        );

        assert_eq!(regions.len(), 1);
        assert_eq!(regions[0].exact_token_count, 10);
        assert_eq!(regions[0].effective_token_count, 10);
        assert_eq!(regions[0].left_start_token, 0);
        assert_eq!(regions[0].left_end_token, 9);
    }

    #[test]
    fn four_fragment_chain_can_merge_when_all_local_joins_pass() {
        let cluster = build_cluster_region(
            &[
                active_tile(0, 0, 6),
                active_tile(8, 8, 6),
                active_tile(16, 16, 6),
                active_tile(24, 24, 6),
            ],
            10,
        );

        let cluster = cluster.expect("four-fragment chain should merge");
        assert_eq!(cluster.left_start_token, 0);
        assert_eq!(cluster.left_end_token, 29);
        assert_eq!(cluster.right_start_token, 0);
        assert_eq!(cluster.right_end_token, 29);
        assert_eq!(cluster.exact_token_count, 24);
        assert_eq!(cluster.effective_token_count, 30);
    }

    #[test]
    fn gap_burden_guard_rejects_holey_cluster_shapes() {
        assert!(gap_burden_is_acceptable(18, 9));
        assert!(!gap_burden_is_acceptable(18, 10));
    }

    #[test]
    fn subthreshold_student_tiles_do_not_contribute_to_final_similarity() {
        let score = compute_code_similarity_score(
            &[Tile {
                left_start: 0,
                right_start: 0,
                length: 9,
            }],
            9,
            20,
            20,
            8,
        );

        assert_eq!(score, 0.0);
    }

    #[test]
    fn merged_region_scoring_counts_absorbed_gap_contribution() {
        let metrics = compute_code_similarity_metrics(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 6,
                },
                Tile {
                    left_start: 8,
                    right_start: 8,
                    length: 6,
                },
            ],
            12,
            40,
            40,
            6,
        );

        assert!(metrics.similarity_score > 0.0);
        assert!(metrics.coverage_left > (12.0 / 40.0));
    }

    #[test]
    fn strongest_run_stays_based_on_exact_anchor_not_merged_span() {
        let metrics = compute_code_similarity_metrics(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 6,
                },
                Tile {
                    left_start: 8,
                    right_start: 8,
                    length: 6,
                },
            ],
            12,
            40,
            40,
            6,
        );

        assert_eq!(metrics.longest_tile_len, 6);
    }

    #[test]
    fn matched_token_count_uses_only_meaningful_tiles() {
        let regions = meaningful_regions_for_identity_tiles(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 9,
                },
                Tile {
                    left_start: 20,
                    right_start: 20,
                    length: 11,
                },
            ],
            40,
            40,
        );

        assert_eq!(exact_matched_token_count(&regions), 11);
    }

    #[test]
    fn tiny_noise_below_gst_floor_does_not_contribute_to_final_similarity() {
        let score = compute_code_similarity_score(
            &[Tile {
                left_start: 0,
                right_start: 0,
                length: 5,
            }],
            5,
            20,
            20,
            6,
        );

        assert_eq!(score, 0.0);
    }

    #[test]
    fn few_long_matches_score_higher_than_many_short_matches() {
        let few_long = compute_code_similarity_score(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 16,
                },
                Tile {
                    left_start: 30,
                    right_start: 30,
                    length: 8,
                },
            ],
            24,
            120,
            120,
            8,
        );
        let many_short = compute_code_similarity_score(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 8,
                },
                Tile {
                    left_start: 20,
                    right_start: 20,
                    length: 8,
                },
                Tile {
                    left_start: 40,
                    right_start: 40,
                    length: 8,
                },
            ],
            24,
            120,
            120,
            8,
        );

        assert!(few_long > many_short);
    }

    #[test]
    fn small_submission_with_real_contiguous_overlap_scores_meaningfully() {
        let score = compute_code_similarity_score(
            &[Tile {
                left_start: 2,
                right_start: 3,
                length: 10,
            }],
            10,
            20,
            20,
            8,
        );

        assert!(score > 0.4);
    }

    #[test]
    fn large_submission_threshold_cap_keeps_meaningful_tiles() {
        let score = compute_code_similarity_score(
            &[Tile {
                left_start: 10,
                right_start: 30,
                length: 25,
            }],
            25,
            1000,
            1000,
            8,
        );

        assert!(score > 0.0);
    }

    #[test]
    fn large_submission_with_tiny_scattered_overlap_scores_low() {
        let score = compute_code_similarity_score(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 6,
                },
                Tile {
                    left_start: 200,
                    right_start: 250,
                    length: 6,
                },
                Tile {
                    left_start: 500,
                    right_start: 600,
                    length: 6,
                },
            ],
            18,
            1000,
            1000,
            6,
        );

        assert_eq!(score, 0.0);
    }

    #[test]
    fn asymmetric_pairs_use_both_sides_but_preserve_small_side_signal() {
        let asymmetric_metrics = compute_code_similarity_metrics(
            &[Tile {
                left_start: 10,
                right_start: 30,
                length: 40,
            }],
            40,
            80,
            400,
            8,
        );
        let symmetric_metrics = compute_code_similarity_metrics(
            &[Tile {
                left_start: 10,
                right_start: 30,
                length: 40,
            }],
            40,
            400,
            400,
            8,
        );

        assert!((asymmetric_metrics.coverage_left - 0.5).abs() < 1e-9);
        assert!((asymmetric_metrics.coverage_right - 0.1).abs() < 1e-9);
        assert!(asymmetric_metrics.similarity_score > symmetric_metrics.similarity_score);
        assert!(asymmetric_metrics.similarity_score < asymmetric_metrics.coverage_left);
    }

    #[test]
    fn zero_matches_produce_zero_code_similarity() {
        let score = compute_code_similarity_score(&[], 0, 120, 160, 8);
        assert_eq!(score, 0.0);
    }

    #[test]
    fn template_mask_threshold_is_fixed_at_ten() {
        assert_eq!(TEMPLATE_MASK_THRESHOLD, 10);
    }

    #[test]
    fn template_masking_is_not_triggered_by_short_common_code() {
        let template = parse_submission(
            AnalysisLanguage::C,
            "int f(){ return 0; }\n",
            vec![],
        )
        .expect("template should parse");
        let submission = parse_submission(
            AnalysisLanguage::C,
            "int g(){ return 0; }\nint own(){ return 1; }\n",
            vec![],
        )
        .expect("submission should parse");

        let mask = build_template_mask(&submission, Some(&template));

        assert_eq!(active_code_token_count(&mask), submission.normalized_tokens.len());
        assert!(mask.iter().all(|masked| !masked));
    }

    #[test]
    fn fragmented_template_spans_are_masked_across_multiple_regions() {
        let template_source =
            "class Template { int first(int x) { return x + 1; } int second(int y) { return y + 2; } }\n";
        let submission_source = "class Student { int first(int n) { return n + 1; } int own(int z) { return z * 3; } int second(int m) { return m + 2; } }\n";
        let template =
            parse_submission(AnalysisLanguage::Java, template_source, vec![]).expect("template should parse");
        let submission = parse_submission(AnalysisLanguage::Java, submission_source, vec![])
            .expect("submission should parse");

        let mask = build_template_mask(&submission, Some(&template));
        let masked_count = mask.iter().filter(|masked| **masked).count();

        assert!(masked_count >= TEMPLATE_MASK_THRESHOLD * 2);
        assert!(active_code_token_count(&mask) > 0);
        assert!(active_code_token_count(&mask) < submission.normalized_tokens.len());
    }

    #[test]
    fn template_heavy_assignment_does_not_inflate_student_similarity() {
        let template_source = "class Template { int helper(int value) { return value + 1; } void menu() { System.out.println(\"menu\"); System.out.println(\"prompt\"); } }\n";
        let left_source = format!(
            "{template_source}class Left {{ int ownLeft(int x) {{ if (x > 0) {{ return x * 2; }} return x; }} }}"
        );
        let right_source = format!(
            "{template_source}class Right {{ void ownRight() {{ System.out.println(\"different\"); System.out.println(\"flow\"); }} }}"
        );
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Java,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: left_source,
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: right_source,
                    source_map: vec![],
                },
            ],
            template: Some(TemplateSource {
                source: template_source.to_string(),
                source_map: vec![],
            }),
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 8,
                minimum_comment_length: 12,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];

        assert_eq!(pair.similarity_score, 0.0);
        assert_eq!(pair.matched_token_count, 0);
        assert!(pair.matches.is_empty());
    }

    #[test]
    fn comments_do_not_affect_code_token_counts_or_thresholding() {
        let with_comments = parse_submission(
            AnalysisLanguage::Java,
            "// lots of comments here\n/* repeated comment block */\nclass A { int add(int a, int b) { return a + b; } }\n",
            vec![],
        )
        .expect("source should parse");
        let without_comments = parse_submission(
            AnalysisLanguage::Java,
            "class A { int add(int a, int b) { return a + b; } }\n",
            vec![],
        )
        .expect("source should parse");

        assert_eq!(with_comments.normalized_tokens.len(), without_comments.normalized_tokens.len());
        assert_eq!(
            meaningful_tile_threshold(
                with_comments.normalized_tokens.len(),
                without_comments.normalized_tokens.len(),
            ),
            meaningful_tile_threshold(
                without_comments.normalized_tokens.len(),
                without_comments.normalized_tokens.len(),
            ),
        );
    }

    #[test]
    fn java_switch_arrow_syntax_still_scores_with_meaningful_tiles() {
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Java,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "class A { void run(int choice) { switch (choice) { case 1 -> createAccount(); case 2 -> withdraw(); default -> showMenu(); } } }\n".to_string(),
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "class B { void run(int option) { switch (option) { case 1 -> createCard(); case 2 -> makePayment(); default -> showMenu(); } } }\n".to_string(),
                    source_map: vec![],
                },
            ],
            template: None,
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 8,
                minimum_comment_length: 12,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];
        let code_match_count = pair
            .matches
            .iter()
            .filter(|matched| matched.kind == engine_contracts::MatchKind::Code)
            .count();

        assert!(pair.similarity_score > 0.0);
        assert!(pair.matched_token_count > 0);
        assert!(code_match_count > 0);
    }

    #[test]
    fn analogous_c_pair_scores_from_meaningful_tiles() {
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::C,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "int add(int a, int b) { return a + b; }\n".to_string(),
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "int sum(int x, int y) { return x + y; }\n".to_string(),
                    source_map: vec![],
                },
            ],
            template: None,
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 8,
                minimum_comment_length: 12,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];

        assert!(pair.similarity_score > 0.0);
        assert!(pair.matched_token_count > 0);
    }

    #[test]
    fn analogous_cpp_pair_scores_from_meaningful_tiles() {
        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::Cpp,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "int add(int a, int b) { return a + b; }\n".to_string(),
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: "int sum(int x, int y) { return x + y; }\n".to_string(),
                    source_map: vec![],
                },
            ],
            template: None,
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 8,
                minimum_comment_length: 12,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];

        assert!(pair.similarity_score > 0.0);
        assert!(pair.matched_token_count > 0);
    }

    #[test]
    fn post_mask_active_token_count_drives_meaningful_threshold() {
        let template_source = (0..40)
            .map(|index| format!("int t{index}(int x) {{ return x + {index}; }}\n"))
            .collect::<String>();
        let left_source = format!(
            "{template_source}int shared(int a) {{ return a + 1; }}\nint own_left(int b) {{ return b * 3; }}\n"
        );
        let right_source = format!(
            "{template_source}int shared(int a) {{ return a + 1; }}\nint own_right(int c) {{ return c - 4; }}\n"
        );

        let template =
            parse_submission(AnalysisLanguage::C, &template_source, vec![]).expect("template should parse");
        let left = parse_submission(AnalysisLanguage::C, &left_source, vec![]).expect("left should parse");
        let right = parse_submission(AnalysisLanguage::C, &right_source, vec![]).expect("right should parse");

        let left_mask = build_template_mask(&left, Some(&template));
        let right_mask = build_template_mask(&right, Some(&template));
        let left_active = active_code_token_count(&left_mask);
        let right_active = active_code_token_count(&right_mask);

        assert!(left.normalized_tokens.len() > left_active);
        assert!(right.normalized_tokens.len() > right_active);
        assert!(meaningful_tile_threshold(left.normalized_tokens.len(), right.normalized_tokens.len()) > 10);
        assert_eq!(meaningful_tile_threshold(left_active, right_active), 10);

        let request = AnalysisRequest {
            schema_version: SCHEMA_VERSION.to_string(),
            engine_version: "test".to_string(),
            language: AnalysisLanguage::C,
            submissions: vec![
                AnalysisSubmission {
                    submission_id: "left".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: left_source,
                    source_map: vec![],
                },
                AnalysisSubmission {
                    submission_id: "right".to_string(),
                    submission_kind: SubmissionKind::Current,
                    source: right_source,
                    source_map: vec![],
                },
            ],
            template: Some(TemplateSource {
                source: template_source,
                source_map: vec![],
            }),
            pairs: vec![AnalysisPair {
                pair_id: "left__right".to_string(),
                left_submission_id: "left".to_string(),
                right_submission_id: "right".to_string(),
            }],
            params: AnalysisParams {
                gst_min_match_length: 8,
                minimum_comment_length: 12,
            },
        };

        let response = analyze(request).expect("analysis should succeed");
        let pair = &response.pair_results[0];

        assert!(pair.similarity_score > 0.0);
        assert!(pair.matched_token_count >= 10);
    }

    #[test]
    fn no_support_rescue_behavior_remains_for_subthreshold_tiles() {
        let score = compute_code_similarity_score(
            &[
                Tile {
                    left_start: 0,
                    right_start: 0,
                    length: 9,
                },
                Tile {
                    left_start: 40,
                    right_start: 40,
                    length: 8,
                },
            ],
            17,
            120,
            120,
            6,
        );

        assert_eq!(score, 0.0);
    }
}
