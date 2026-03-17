use crate::part2_java_tokenizing::java_preprocessing_types::{CommentToken, JavaSyntaxItem, JavaSyntaxItemKind};

pub fn build_comment_token_array(all_items: &[JavaSyntaxItem]) -> Vec<CommentToken> {
    all_items
        .iter()
        .filter(|item| item.kind == JavaSyntaxItemKind::Comment)
        .map(|item| CommentToken {
            comment_text: item.raw_text.clone(),
            byte_start: item.byte_start,
            byte_end: item.byte_end,
            node_kind: item.node_kind.clone(),
        })
        .collect()
}