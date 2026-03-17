#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MappedCodeMatch {
    pub start_token_index_a: usize,
    pub end_token_index_a: usize,
    pub start_token_index_b: usize,
    pub end_token_index_b: usize,
    pub byte_start_a: usize,
    pub byte_end_a: usize,
    pub byte_start_b: usize,
    pub byte_end_b: usize,
    pub matched_length: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MappedCommentMatch {
    pub comment_index_a: usize,
    pub comment_index_b: usize,
    pub byte_start_a: usize,
    pub byte_end_a: usize,
    pub byte_start_b: usize,
    pub byte_end_b: usize,
    pub matched_text_a: String,
    pub matched_text_b: String,
    pub matched_length: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FinalComparisonOutput {
    pub submission_id_a: String,
    pub submission_id_b: String,
    pub similarity_score_percent: f64,
    pub output_tiles_for_code_matches: Vec<MappedCodeMatch>,
    pub output_comment_matches: Vec<MappedCommentMatch>,
}