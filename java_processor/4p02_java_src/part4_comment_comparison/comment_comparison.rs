use crate::part4_comment_comparison::comment_comparison_services::find_comment_matches::find_comment_matches;
use crate::part4_comment_comparison::comment_comparison_types::{
    CommentComparisonConfig, CommentComparisonResult, GenericCommentToken,
};

pub fn run_comment_comparison(
    comment_token_array_a: &[GenericCommentToken],
    comment_token_array_b: &[GenericCommentToken],
    config: &CommentComparisonConfig,
) -> Result<CommentComparisonResult, String> {
    validate_comment_comparison_config(config)?;

    let matched_comments = find_comment_matches(
        comment_token_array_a,
        comment_token_array_b,
        config,
    );

    Ok(CommentComparisonResult {
        matched_comment_count: matched_comments.len(),
        matched_comments,
    })
}

fn validate_comment_comparison_config(
    config: &CommentComparisonConfig,
) -> Result<(), String> {
    if config.minimum_comment_length == 0 {
        return Err("minimum_comment_length must be greater than 0".to_string());
    }

    Ok(())
}