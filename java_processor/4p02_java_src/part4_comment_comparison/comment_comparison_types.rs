#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GenericCommentToken {
    pub comment_text: String,
    pub byte_start: usize,
    pub byte_end: usize,
    pub source_kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentComparisonConfig {
    pub minimum_comment_length: usize,
    pub normalize_whitespace: bool,
    pub case_sensitive: bool,
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
pub struct CommentComparisonResult {
    pub matched_comments: Vec<CommentMatch>,
    pub matched_comment_count: usize,
}