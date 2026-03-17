use crate::part2_java_tokenizing::java_preprocessing_types::{JavaSyntaxItem, JavaSyntaxItemKind};
use tree_sitter::{Node, TreeCursor};

pub fn collect_java_syntax_items(source_code: &str, root_node: Node) -> Vec<JavaSyntaxItem> {
    let mut collected_items = Vec::new();
    let mut cursor = root_node.walk();

    collect_recursively(source_code, &mut cursor, &mut collected_items);

    collected_items.sort_by_key(|item| item.byte_start);
    collected_items
}

fn collect_recursively(
    source_code: &str,
    cursor: &mut TreeCursor,
    collected_items: &mut Vec<JavaSyntaxItem>,
) {
    let current_node = cursor.node();

    if current_node.child_count() == 0 {
        let node_kind = current_node.kind();

        if let Some(item_kind) = classify_leaf_kind(node_kind) {
            let byte_start = current_node.start_byte();
            let byte_end = current_node.end_byte();

            if byte_end <= source_code.len() && byte_start <= byte_end {
                let raw_text = source_code[byte_start..byte_end].to_string();

                if !raw_text.trim().is_empty() {
                    collected_items.push(JavaSyntaxItem {
                        raw_text,
                        kind: item_kind,
                        byte_start,
                        byte_end,
                        node_kind: node_kind.to_string(),
                    });
                }
            }
        }
    }

    if cursor.goto_first_child() {
        loop {
            collect_recursively(source_code, cursor, collected_items);
            if !cursor.goto_next_sibling() {
                break;
            }
        }
        cursor.goto_parent();
    }
}

fn classify_leaf_kind(node_kind: &str) -> Option<JavaSyntaxItemKind> {
    if is_comment_kind(node_kind) {
        return Some(JavaSyntaxItemKind::Comment);
    }

    if is_ignored_leaf_kind(node_kind) {
        return None;
    }

    Some(JavaSyntaxItemKind::Code)
}

fn is_comment_kind(node_kind: &str) -> bool {
    matches!(node_kind, "line_comment" | "block_comment")
}

fn is_ignored_leaf_kind(node_kind: &str) -> bool {
    matches!(
        node_kind,
        "\n" | "\r\n" | "\t" | " "
    )
}