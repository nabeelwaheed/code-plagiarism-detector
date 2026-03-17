use crate::part3_GST::gst_types::MatchedTile;

pub fn calculate_similarity_score(
    matched_tiles: &[MatchedTile],
    token_count_a: usize,
    token_count_b: usize,
) -> f64 {
    let matched_token_count: usize = matched_tiles.iter().map(|tile| tile.length).sum();

    let total_token_count = token_count_a + token_count_b;

    if total_token_count == 0 {
        return 0.0;
    }

    (2.0 * matched_token_count as f64 / total_token_count as f64) * 100.0
}