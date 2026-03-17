use crate::part4_comment_comparison::comment_comparison_types::CommentComparisonConfig;

pub fn normalize_comment_text(
    original_comment_text: &str,
    config: &CommentComparisonConfig,
) -> String {
    let mut normalized_text = original_comment_text.to_string();

    if config.normalize_whitespace {
        normalized_text = normalized_text.split_whitespace().collect::<Vec<_>>().join(" ");
    }

    if !config.case_sensitive {
        normalized_text = normalized_text.to_lowercase();
    }

    normalized_text.trim().to_string()
}