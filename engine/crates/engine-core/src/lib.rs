use engine_contracts::{
    AnalysisRequest, AnalysisResponse, MatchKind, MatchSpan, PairAnalysisResult, PairMatch,
    PositionMetadata, SCHEMA_VERSION, SourceMapEntry, TokenMetadata,
};
use engine_gst::{run_gst, symmetric_coverage_score, Tile};
use engine_language::{parse_submission, CommentToken, ParsedSubmission};
use std::collections::{BTreeMap, HashMap};

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

        let left_mask = build_template_mask(left, processed_template.as_ref(), params.gst_min_match_length);
        let right_mask = build_template_mask(right, processed_template.as_ref(), params.gst_min_match_length);

        let gst_result = run_gst(
            &left.normalized_tokens,
            &right.normalized_tokens,
            &left_mask,
            &right_mask,
            params.gst_min_match_length,
        );

        let meaningful_tiles = filter_meaningful_code_tiles(
            &gst_result.tiles,
            left.normalized_tokens.len(),
            right.normalized_tokens.len(),
        );
        let meaningful_matched_token_count = matched_token_count(&meaningful_tiles);

        let mut matches = map_code_matches(left, right, &meaningful_tiles);
        let comment_matches = compare_comments(
            left,
            right,
            processed_template.as_ref(),
            params.minimum_comment_length,
            matches.len(),
        );
        matches.extend(comment_matches);

        let similarity_score = compute_code_similarity_score(
            &meaningful_tiles,
            meaningful_matched_token_count,
            left.normalized_tokens.len(),
            right.normalized_tokens.len(),
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
    min_match_length: usize,
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
        min_match_length,
    );

    for tile in gst_result.tiles {
        for offset in 0..tile.length {
            mask[tile.left_start + offset] = true;
        }
    }

    mask
}

fn map_code_matches(left: &ParsedSubmission, right: &ParsedSubmission, tiles: &[Tile]) -> Vec<PairMatch> {
    let mut matches = Vec::new();

    for (index, tile) in tiles.iter().enumerate() {
        let left_start_token = tile.left_start;
        let left_end_token = tile.left_start + tile.length - 1;
        let right_start_token = tile.right_start;
        let right_end_token = tile.right_start + tile.length - 1;

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
            matched_token_count: tile.length,
        });
    }

    matches
}

fn filter_meaningful_code_tiles(tiles: &[Tile], left_len: usize, right_len: usize) -> Vec<Tile> {
    let threshold = meaningful_tile_threshold(left_len, right_len);

    tiles
        .iter()
        .filter(|tile| tile.length >= threshold)
        .cloned()
        .collect()
}

fn meaningful_tile_threshold(left_len: usize, right_len: usize) -> usize {
    let smaller_tokens = left_len.min(right_len);
    let scaled_threshold = (3 * smaller_tokens).div_ceil(100);

    scaled_threshold.clamp(10, 25)
}

fn matched_token_count(tiles: &[Tile]) -> usize {
    tiles.iter().map(|tile| tile.length).sum()
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

fn compute_code_similarity_score(
    tiles: &[Tile],
    _matched_token_count: usize,
    left_len: usize,
    right_len: usize,
    gst_min_match_length: usize,
) -> f64 {
    compute_code_similarity_metrics(
        tiles,
        0,
        left_len,
        right_len,
        gst_min_match_length,
    )
    .similarity_score
}

fn compute_code_similarity_metrics(
    tiles: &[Tile],
    _matched_token_count: usize,
    left_len: usize,
    right_len: usize,
    gst_min_match_length: usize,
) -> CodeSimilarityMetrics {
    let meaningful_tiles = filter_meaningful_code_tiles(tiles, left_len, right_len);
    let meaningful_matched_token_count = matched_token_count(&meaningful_tiles);

    if meaningful_matched_token_count == 0 || meaningful_tiles.is_empty() || left_len == 0 || right_len == 0 {
        return CodeSimilarityMetrics {
            coverage_left: 0.0,
            coverage_right: 0.0,
            coverage_anchor: 0.0,
            longest_tile_len: 0,
            tile_count: meaningful_tiles.len(),
            average_tile_len: 0.0,
            concentration_ratio: 0.0,
            longest_tile_ratio_of_smaller_submission: 0.0,
            contiguity_factor: 0.0,
            fragmentation_factor: 0.0,
            similarity_score: 0.0,
        };
    }

    let coverage_left = meaningful_matched_token_count as f64 / left_len as f64;
    let coverage_right = meaningful_matched_token_count as f64 / right_len as f64;
    let harmonic_coverage =
        symmetric_coverage_score(meaningful_matched_token_count, left_len, right_len);
    let geometric_coverage = (coverage_left * coverage_right).sqrt();
    let coverage_anchor = ((0.75 * harmonic_coverage) + (0.25 * geometric_coverage)).clamp(0.0, 1.0);

    let longest_tile_len = meaningful_tiles.iter().map(|tile| tile.length).max().unwrap_or(0);
    let tile_count = meaningful_tiles.len();
    let average_tile_len = meaningful_matched_token_count as f64 / tile_count as f64;
    let concentration_ratio =
        (longest_tile_len as f64 / meaningful_matched_token_count as f64).clamp(0.0, 1.0);
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

    let similarity_score = (coverage_anchor * contiguity_factor * fragmentation_factor).clamp(0.0, 1.0);

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

fn progress_above_floor(value: f64, floor: f64) -> f64 {
    if floor <= 0.0 || value <= floor {
        return 0.0;
    }

    ((value - floor) / floor).clamp(0.0, 1.0)
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
        analyze, compute_code_similarity_metrics, compute_code_similarity_score,
        filter_meaningful_code_tiles, matched_token_count, meaningful_tile_threshold,
    };
    use engine_contracts::{
        AnalysisLanguage, AnalysisPair, AnalysisParams, AnalysisRequest, AnalysisSubmission,
        SourceMapEntry, TemplateSource, SCHEMA_VERSION, SubmissionKind,
    };
    use engine_gst::Tile;

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
        assert_eq!(meaningful_tile_threshold(2000, 3000), 25);
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
    fn weak_code_tiles_do_not_contribute_to_final_similarity() {
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
    fn matched_token_count_uses_only_meaningful_tiles() {
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
                    length: 11,
                },
            ],
            40,
            40,
        );

        assert_eq!(matched_token_count(&tiles), 11);
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
                    length: 8,
                },
                Tile {
                    left_start: 200,
                    right_start: 250,
                    length: 8,
                },
                Tile {
                    left_start: 500,
                    right_start: 600,
                    length: 8,
                },
            ],
            24,
            1000,
            1000,
            8,
        );

        assert!(score < 0.03);
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
}
