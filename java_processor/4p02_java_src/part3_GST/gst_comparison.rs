use crate::part3_GST::gst_services::calculate_similarity_score::calculate_similarity_score;
use crate::part3_GST::gst_services::find_maximal_matches::find_maximal_matches;
use crate::part3_GST::gst_services::initialize_marked_tokens::initialize_marked_tokens;
use crate::part3_GST::gst_services::mark_matched_tiles::mark_matched_tiles;
use crate::part3_GST::gst_types::{GstComparisonResult, GstConfig, MatchedTile};

pub fn run_gst_comparison(
    token_sequence_a: &[String],
    token_sequence_b: &[String],
    config: &GstConfig,
) -> Result<GstComparisonResult, String> {
    validate_gst_config(config)?;

    let mut marked_tokens_a = initialize_marked_tokens(token_sequence_a.len());
    let mut marked_tokens_b = initialize_marked_tokens(token_sequence_b.len());
    let mut all_accepted_tiles: Vec<MatchedTile> = Vec::new();

    loop {
        let maximal_matches = find_maximal_matches(
            token_sequence_a,
            token_sequence_b,
            &marked_tokens_a,
            &marked_tokens_b,
            config,
        );

        if maximal_matches.is_empty() {
            break;
        }

        let accepted_tiles =
            mark_matched_tiles(&maximal_matches, &mut marked_tokens_a, &mut marked_tokens_b);

        if accepted_tiles.is_empty() {
            break;
        }

        all_accepted_tiles.extend(accepted_tiles);
    }

    let matched_token_count: usize = all_accepted_tiles.iter().map(|tile| tile.length).sum();

    let similarity_score_percent = calculate_similarity_score(
        &all_accepted_tiles,
        token_sequence_a.len(),
        token_sequence_b.len(),
    );

    Ok(GstComparisonResult {
        matched_tiles: all_accepted_tiles,
        matched_token_count,
        similarity_score_percent,
    })
}

fn validate_gst_config(config: &GstConfig) -> Result<(), String> {
    if config.minimum_match_length == 0 {
        return Err("minimum_match_length must be greater than 0".to_string());
    }

    if let Some(maximum_match_length) = config.maximum_match_length {
        if maximum_match_length == 0 {
            return Err("maximum_match_length must be greater than 0 when provided".to_string());
        }

        if maximum_match_length < config.minimum_match_length {
            return Err(
                "maximum_match_length cannot be smaller than minimum_match_length".to_string(),
            );
        }
    }

    Ok(())
}