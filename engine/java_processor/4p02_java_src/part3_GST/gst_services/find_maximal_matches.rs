use crate::part3_GST::gst_types::{GstConfig, MatchedTile};

pub fn find_maximal_matches(
    token_sequence_a: &[String],
    token_sequence_b: &[String],
    marked_tokens_a: &[bool],
    marked_tokens_b: &[bool],
    config: &GstConfig,
) -> Vec<MatchedTile> {
    let mut longest_match_length_found = 0usize;
    let mut maximal_matches = Vec::new();

    for start_index_a in 0..token_sequence_a.len() {
        if marked_tokens_a[start_index_a] {
            continue;
        }

        for start_index_b in 0..token_sequence_b.len() {
            if marked_tokens_b[start_index_b] {
                continue;
            }

            let raw_match_length = measure_match_length(
                token_sequence_a,
                token_sequence_b,
                marked_tokens_a,
                marked_tokens_b,
                start_index_a,
                start_index_b,
            );

            if raw_match_length < config.minimum_match_length {
                continue;
            }

            let effective_match_length = apply_maximum_match_length_cap(raw_match_length, config);

            if effective_match_length < config.minimum_match_length {
                continue;
            }

            let candidate_tile = MatchedTile {
                start_index_a,
                start_index_b,
                length: effective_match_length,
            };

            if effective_match_length > longest_match_length_found {
                longest_match_length_found = effective_match_length;
                maximal_matches.clear();
                maximal_matches.push(candidate_tile);
            } else if effective_match_length == longest_match_length_found {
                maximal_matches.push(candidate_tile);
            }
        }
    }

    maximal_matches
}

fn measure_match_length(
    token_sequence_a: &[String],
    token_sequence_b: &[String],
    marked_tokens_a: &[bool],
    marked_tokens_b: &[bool],
    start_index_a: usize,
    start_index_b: usize,
) -> usize {
    let mut match_length = 0usize;

    while start_index_a + match_length < token_sequence_a.len()
        && start_index_b + match_length < token_sequence_b.len()
    {
        let current_index_a = start_index_a + match_length;
        let current_index_b = start_index_b + match_length;

        if marked_tokens_a[current_index_a] || marked_tokens_b[current_index_b] {
            break;
        }

        if token_sequence_a[current_index_a] != token_sequence_b[current_index_b] {
            break;
        }

        match_length += 1;
    }

    match_length
}

fn apply_maximum_match_length_cap(raw_match_length: usize, config: &GstConfig) -> usize {
    match config.maximum_match_length {
        Some(maximum_match_length) => raw_match_length.min(maximum_match_length),
        None => raw_match_length,
    }
}