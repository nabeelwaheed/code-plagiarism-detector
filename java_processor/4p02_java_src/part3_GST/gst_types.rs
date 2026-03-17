#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GstConfig {
    pub minimum_match_length: usize,
    pub maximum_match_length: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatchedTile {
    pub start_index_a: usize,
    pub start_index_b: usize,
    pub length: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GstComparisonResult {
    pub matched_tiles: Vec<MatchedTile>,
    pub matched_token_count: usize,
    pub similarity_score_percent: f64,
}