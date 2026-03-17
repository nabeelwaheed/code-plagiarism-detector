use crate::part2_java_tokenizing::java_preprocessing_types::{CodeToken, JavaSyntaxItem, JavaSyntaxItemKind};

pub fn build_code_token_array(code_items: &[JavaSyntaxItem]) -> Vec<CodeToken> {
    code_items
        .iter()
        .filter(|item| item.kind == JavaSyntaxItemKind::Code)
        .map(|item| CodeToken {
            normalized_value: normalize_single_code_item(item),
            raw_text: item.raw_text.clone(),
            byte_start: item.byte_start,
            byte_end: item.byte_end,
            node_kind: item.node_kind.clone(),
        })
        .collect()
}

fn normalize_single_code_item(item: &JavaSyntaxItem) -> String {
    let node_kind = item.node_kind.as_str();
    let raw_text = item.raw_text.as_str();

    if matches!(node_kind, "identifier" | "type_identifier") {
        return "ID".to_string();
    }

    if matches!(
        node_kind,
        "decimal_integer_literal"
            | "hex_integer_literal"
            | "octal_integer_literal"
            | "binary_integer_literal"
            | "decimal_floating_point_literal"
            | "hex_floating_point_literal"
    ) {
        return "NUM".to_string();
    }

    if node_kind == "string_literal" {
        return "STR".to_string();
    }

    if node_kind == "character_literal" {
        return "CHAR".to_string();
    }

    if matches!(raw_text, "true" | "false") {
        return "BOOL".to_string();
    }

    raw_text.to_string()
}