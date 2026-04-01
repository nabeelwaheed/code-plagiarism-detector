use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: &str = "1.0";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisLanguage {
    Java,
    C,
    Cpp,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubmissionKind {
    Current,
    Historical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchKind {
    Code,
    Comment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMapEntry {
    pub file_path: String,
    pub byte_start: usize,
    pub byte_end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisSubmission {
    pub submission_id: String,
    pub submission_kind: SubmissionKind,
    pub source: String,
    #[serde(default)]
    pub source_map: Vec<SourceMapEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateSource {
    pub source: String,
    #[serde(default)]
    pub source_map: Vec<SourceMapEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisPair {
    pub pair_id: String,
    pub left_submission_id: String,
    pub right_submission_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisParams {
    pub gst_min_match_length: usize,
    pub minimum_comment_length: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisRequest {
    pub schema_version: String,
    pub engine_version: String,
    pub language: AnalysisLanguage,
    pub submissions: Vec<AnalysisSubmission>,
    #[serde(default)]
    pub template: Option<TemplateSource>,
    pub pairs: Vec<AnalysisPair>,
    pub params: AnalysisParams,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionMetadata {
    pub line_start: usize,
    pub column_start: usize,
    pub line_end: usize,
    pub column_end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenMetadata {
    pub token_start: usize,
    pub token_end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchSpan {
    pub byte_start: usize,
    pub byte_end: usize,
    #[serde(default)]
    pub file_path: Option<String>,
    #[serde(default)]
    pub position: Option<PositionMetadata>,
    #[serde(default)]
    pub tokens: Option<TokenMetadata>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairMatch {
    pub match_id: String,
    pub kind: MatchKind,
    pub left: MatchSpan,
    pub right: MatchSpan,
    pub matched_token_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairAnalysisResult {
    pub pair_id: String,
    pub left_submission_id: String,
    pub right_submission_id: String,
    pub similarity_score: f64,
    #[serde(default)]
    pub comment_score: Option<f64>,
    pub matched_token_count: usize,
    pub matches: Vec<PairMatch>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResponse {
    pub schema_version: String,
    pub engine_version: String,
    pub language: AnalysisLanguage,
    pub pair_results: Vec<PairAnalysisResult>,
}
