use crate::part2_java_tokenizing::java_preprocessing_types::{JavaSyntaxItem, JavaSyntaxItemKind};

pub fn normalize_java_code_items(code_items: &[JavaSyntaxItem]) -> Vec<String> {
    code_items
        .iter()
        .filter(|item| item.kind == JavaSyntaxItemKind::Code)
        .map(normalize_single_code_item)
        .collect()
}

fn normalize_single_code_item(item: &JavaSyntaxItem) -> String {
    let node_kind = item.node_kind.as_str();
    let raw_text = item.raw_text.as_str();

    if is_identifier_kind(node_kind) {
        return normalize_identifier(raw_text);
    }

    if is_number_kind(node_kind) {
        return "NUM".to_string();
    }

    if is_string_kind(node_kind) {
        return "STR".to_string();
    }

    if is_character_kind(node_kind) {
        return "CHAR".to_string();
    }

    if is_boolean_literal(raw_text) {
        return "BOOL".to_string();
    }

    raw_text.to_string()
}

fn is_identifier_kind(node_kind: &str) -> bool {
    matches!(node_kind, "identifier" | "type_identifier")
}

fn is_number_kind(node_kind: &str) -> bool {
    matches!(
        node_kind,
        "decimal_integer_literal"
            | "hex_integer_literal"
            | "octal_integer_literal"
            | "binary_integer_literal"
            | "decimal_floating_point_literal"
            | "hex_floating_point_literal"
    )
}

fn is_string_kind(node_kind: &str) -> bool {
    matches!(node_kind, "string_literal")
}

fn is_character_kind(node_kind: &str) -> bool {
    matches!(node_kind, "character_literal")
}

fn is_boolean_literal(raw_text: &str) -> bool {
    matches!(raw_text, "true" | "false")
}

fn normalize_identifier(raw_text: &str) -> String {
    match raw_text {
        "String" => "TYPE_ID".to_string(),
        _ => "ID".to_string(),
    }
}