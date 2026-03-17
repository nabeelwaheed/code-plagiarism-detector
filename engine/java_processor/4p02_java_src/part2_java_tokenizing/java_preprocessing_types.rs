#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JavaSyntaxItemKind {
    Code,
    Comment,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JavaSyntaxItem {
    pub raw_text: String,
    pub kind: JavaSyntaxItemKind,
    pub byte_start: usize,
    pub byte_end: usize,
    pub node_kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodeToken {
    pub normalized_value: String,
    pub raw_text: String,
    pub byte_start: usize,
    pub byte_end: usize,
    pub node_kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentToken {
    pub comment_text: String,
    pub byte_start: usize,
    pub byte_end: usize,
    pub node_kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JavaPreprocessingResult {
    pub normalized_array: Vec<String>,
    pub token_array: Vec<CodeToken>,
    pub comment_token_array: Vec<CommentToken>,
}