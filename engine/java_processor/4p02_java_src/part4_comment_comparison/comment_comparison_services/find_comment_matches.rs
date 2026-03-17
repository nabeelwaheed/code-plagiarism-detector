use crate::part4_comment_comparison::comment_comparison_services::comment_meets_minimum_length::comment_meets_minimum_length;
use crate::part4_comment_comparison::comment_comparison_services::comments_are_equal::comments_are_equal;
use crate::part4_comment_comparison::comment_comparison_services::normalize_comment_text::normalize_comment_text;
use crate::part4_comment_comparison::comment_comparison_types::{
    CommentComparisonConfig, CommentMatch, GenericCommentToken,
};

pub fn find_comment_matches(
    comment_token_array_a: &[GenericCommentToken],
    comment_token_array_b: &[GenericCommentToken],
    config: &CommentComparisonConfig,
) -> Vec<CommentMatch> {
    let mut matched_comments = Vec::new();

    for (comment_index_a, comment_token_a) in comment_token_array_a.iter().enumerate() {
        let normalized_comment_a = normalize_comment_text(&comment_token_a.comment_text, config);

        if !comment_meets_minimum_length(
            &normalized_comment_a,
            config.minimum_comment_length,
        ) {
            continue;
        }

        for (comment_index_b, comment_token_b) in comment_token_array_b.iter().enumerate() {
            let normalized_comment_b = normalize_comment_text(&comment_token_b.comment_text, config);

            if !comment_meets_minimum_length(
                &normalized_comment_b,
                config.minimum_comment_length,
            ) {
                continue;
            }

            if comments_are_equal(&normalized_comment_a, &normalized_comment_b) {
                matched_comments.push(CommentMatch {
                    comment_index_a,
                    comment_index_b,
                    matched_text_a: comment_token_a.comment_text.clone(),
                    matched_text_b: comment_token_b.comment_text.clone(),
                    byte_start_a: comment_token_a.byte_start,
                    byte_end_a: comment_token_a.byte_end,
                    byte_start_b: comment_token_b.byte_start,
                    byte_end_b: comment_token_b.byte_end,
                    matched_length: normalized_comment_a.len(),
                });
            }
        }
    }

    matched_comments
}