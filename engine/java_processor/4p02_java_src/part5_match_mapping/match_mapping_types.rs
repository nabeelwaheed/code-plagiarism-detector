#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GenericCodeToken {
    pub normalized_value: String,
    pub raw_text: String,
    pub byte_start: usize,
    pub byte_end: usize,
    pub source_kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GenericCommentToken {
    pub comment_text: String,
    pub byte_start: usize,
    pub byte_end: usize,
    pub source_kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatchedTile {
    pub start_index_a: usize,
    pub start_index_b: usize,
    pub length: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentMatch {
    pub comment_index_a: usize,
    pub comment_index_b: usize,
    pub matched_text_a: String,
    pub matched_text_b: String,
    pub byte_start_a: usize,
    pub byte_end_a: usize,
    pub byte_start_b: usize,
    pub byte_end_b: usize,
    pub matched_length: usize,
}

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatchMappingResult {
    pub mapped_code_matches: Vec<MappedCodeMatch>,
    pub mapped_comment_matches: Vec<MappedCommentMatch>,
}