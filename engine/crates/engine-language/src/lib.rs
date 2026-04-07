use engine_contracts::{AnalysisLanguage, SourceMapEntry};
use tree_sitter::{Node, Parser, Tree};

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
    pub text: String,
    pub byte_start: usize,
    pub byte_end: usize,
    pub node_kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedSubmission {
    pub normalized_tokens: Vec<String>,
    pub code_tokens: Vec<CodeToken>,
    pub comment_tokens: Vec<CommentToken>,
    pub line_starts: Vec<usize>,
    pub source_map: Vec<SourceMapEntry>,
}

pub fn parse_submission(
    language: AnalysisLanguage,
    source: &str,
    source_map: Vec<SourceMapEntry>,
) -> Result<ParsedSubmission, String> {
    match language {
        AnalysisLanguage::Java => parse_with_adapter(source, source_map, &JavaAdapter),
        AnalysisLanguage::C => parse_with_adapter(source, source_map, &CAdapter),
        AnalysisLanguage::Cpp => parse_with_adapter(source, source_map, &CppAdapter),
    }
}

trait LanguageAdapter {
    fn build_tree(&self, source: &str) -> Result<Tree, String>;
    fn is_comment_kind(&self, node_kind: &str) -> bool;
    fn should_skip_subtree(&self, node_kind: &str) -> bool;
    fn normalize_subtree_token(&self, node_kind: &str) -> Option<String>;
    fn should_skip_leaf(&self, node_kind: &str, raw_text: &str) -> bool;
    fn normalize_code_token(&self, node_kind: &str, raw_text: &str) -> String;
}

fn parse_with_adapter(
    source: &str,
    source_map: Vec<SourceMapEntry>,
    adapter: &dyn LanguageAdapter,
) -> Result<ParsedSubmission, String> {
    let tree = adapter.build_tree(source)?;
    let mut code_tokens = Vec::new();
    let mut comment_tokens = Vec::new();

    collect_tokens(
        tree.root_node(),
        source,
        adapter,
        &mut code_tokens,
        &mut comment_tokens,
    );

    let normalized_tokens = code_tokens
        .iter()
        .map(|token| token.normalized_value.clone())
        .collect();

    Ok(ParsedSubmission {
        normalized_tokens,
        code_tokens,
        comment_tokens,
        line_starts: compute_line_starts(source),
        source_map,
    })
}

fn collect_tokens(
    node: Node,
    source: &str,
    adapter: &dyn LanguageAdapter,
    code_tokens: &mut Vec<CodeToken>,
    comment_tokens: &mut Vec<CommentToken>,
) {
    let node_kind = node.kind();
    if adapter.should_skip_subtree(node_kind) {
        return;
    }

    if let Some(normalized_value) = adapter.normalize_subtree_token(node_kind) {
        let start = node.start_byte();
        let end = node.end_byte();

        if end <= start || end > source.len() {
            return;
        }

        let raw_text = &source[start..end];
        code_tokens.push(CodeToken {
            normalized_value,
            raw_text: raw_text.to_string(),
            byte_start: start,
            byte_end: end,
            node_kind: node_kind.to_string(),
        });
        return;
    }

    if node.child_count() == 0 {
        let start = node.start_byte();
        let end = node.end_byte();

        if end <= start || end > source.len() {
            return;
        }

        let raw_text = &source[start..end];

        if adapter.should_skip_leaf(node_kind, raw_text) {
            return;
        }

        if adapter.is_comment_kind(node_kind) {
            comment_tokens.push(CommentToken {
                text: raw_text.to_string(),
                byte_start: start,
                byte_end: end,
                node_kind: node_kind.to_string(),
            });
            return;
        }

        code_tokens.push(CodeToken {
            normalized_value: adapter.normalize_code_token(node_kind, raw_text),
            raw_text: raw_text.to_string(),
            byte_start: start,
            byte_end: end,
            node_kind: node_kind.to_string(),
        });
        return;
    }

    for index in 0..node.child_count() {
        if let Some(child) = node.child(index) {
            collect_tokens(
                child,
                source,
                adapter,
                code_tokens,
                comment_tokens,
            );
        }
    }
}

fn compute_line_starts(source: &str) -> Vec<usize> {
    let mut starts = vec![0];
    for (index, byte) in source.as_bytes().iter().enumerate() {
        if *byte == b'\n' {
            starts.push(index + 1);
        }
    }
    starts
}

struct JavaAdapter;

impl LanguageAdapter for JavaAdapter {
    fn build_tree(&self, source: &str) -> Result<Tree, String> {
        let mut parser = Parser::new();
        let language = tree_sitter_java::LANGUAGE.into();
        parser
            .set_language(&language)
            .map_err(|error| format!("failed to initialize Java parser: {error}"))?;
        parser
            .parse(source, None)
            .ok_or_else(|| "failed to parse Java source".to_string())
    }

    fn is_comment_kind(&self, node_kind: &str) -> bool {
        matches!(node_kind, "line_comment" | "block_comment")
    }

    fn should_skip_subtree(&self, node_kind: &str) -> bool {
        matches!(node_kind, "package_declaration" | "import_declaration")
    }

    fn normalize_subtree_token(&self, node_kind: &str) -> Option<String> {
        match node_kind {
            "string_literal" => Some("STR".to_string()),
            "character_literal" => Some("CHAR".to_string()),
            _ => None,
        }
    }

    fn should_skip_leaf(&self, _node_kind: &str, raw_text: &str) -> bool {
        raw_text.trim().is_empty()
    }

    fn normalize_code_token(&self, node_kind: &str, raw_text: &str) -> String {
        if node_kind == "identifier" {
            return "ID".to_string();
        }

        if node_kind == "type_identifier" {
            return "TYPE_ID".to_string();
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
}

struct CAdapter;
struct CppAdapter;

impl LanguageAdapter for CAdapter {
    fn build_tree(&self, source: &str) -> Result<Tree, String> {
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_c::language())
            .map_err(|error| format!("failed to initialize C parser: {error}"))?;
        parser
            .parse(source, None)
            .ok_or_else(|| "failed to parse C source".to_string())
    }

    fn is_comment_kind(&self, node_kind: &str) -> bool {
        node_kind.contains("comment")
    }

    fn should_skip_subtree(&self, node_kind: &str) -> bool {
        node_kind.starts_with("preproc_")
    }

    fn normalize_subtree_token(&self, node_kind: &str) -> Option<String> {
        match node_kind {
            "string_literal" | "concatenated_string" => Some("STR_LIT".to_string()),
            "char_literal" | "character_literal" => Some("CHAR_LIT".to_string()),
            _ => None,
        }
    }

    fn should_skip_leaf(&self, node_kind: &str, raw_text: &str) -> bool {
        raw_text.trim().is_empty() || node_kind.starts_with("preproc_")
    }

    fn normalize_code_token(&self, node_kind: &str, raw_text: &str) -> String {
        normalize_cfamily_token(node_kind, raw_text, LanguageFlavor::C)
    }
}

impl LanguageAdapter for CppAdapter {
    fn build_tree(&self, source: &str) -> Result<Tree, String> {
        let mut parser = Parser::new();
        let language = tree_sitter_cpp::LANGUAGE.into();
        parser
            .set_language(&language)
            .map_err(|error| format!("failed to initialize C++ parser: {error}"))?;
        parser
            .parse(source, None)
            .ok_or_else(|| "failed to parse C++ source".to_string())
    }

    fn is_comment_kind(&self, node_kind: &str) -> bool {
        node_kind.contains("comment")
    }

    fn should_skip_subtree(&self, node_kind: &str) -> bool {
        node_kind.starts_with("preproc_")
    }

    fn normalize_subtree_token(&self, node_kind: &str) -> Option<String> {
        match node_kind {
            "string_literal" | "concatenated_string" | "raw_string_literal" => {
                Some("STR_LIT".to_string())
            }
            "char_literal" | "character_literal" => Some("CHAR_LIT".to_string()),
            _ => None,
        }
    }

    fn should_skip_leaf(&self, node_kind: &str, raw_text: &str) -> bool {
        raw_text.trim().is_empty() || node_kind.starts_with("preproc_")
    }

    fn normalize_code_token(&self, node_kind: &str, raw_text: &str) -> String {
        normalize_cfamily_token(node_kind, raw_text, LanguageFlavor::Cpp)
    }
}

#[derive(Clone, Copy)]
enum LanguageFlavor {
    C,
    Cpp,
}

fn normalize_cfamily_token(
    node_kind: &str,
    raw_text: &str,
    language: LanguageFlavor,
) -> String {
    if node_kind == "identifier" {
        return "ID".to_string();
    }

    if node_kind == "type_identifier" {
        return "TYPE_ID".to_string();
    }

    if node_kind == "field_identifier" {
        return "FIELD_ID".to_string();
    }

    if matches!(language, LanguageFlavor::Cpp) && node_kind == "namespace_identifier" {
        return "NS_ID".to_string();
    }

    if node_kind == "number_literal" {
        if raw_text.contains('.') || raw_text.contains('e') || raw_text.contains('E') {
            return "FLOAT_LIT".to_string();
        }
        return "INT_LIT".to_string();
    }

    if node_kind == "string_literal" {
        return "STR_LIT".to_string();
    }

    if matches!(node_kind, "char_literal" | "character_literal") {
        return "CHAR_LIT".to_string();
    }

    raw_text.to_string()
}

#[cfg(test)]
mod tests {
    use super::parse_submission;
    use engine_contracts::AnalysisLanguage;

    #[test]
    fn java_string_and_char_literals_collapse_to_placeholders() {
        let parsed = parse_submission(
            AnalysisLanguage::Java,
            "class Demo { void run() { String label = \"menu text\"; char initial = 'x'; } }\n",
            vec![],
        )
        .expect("Java source should parse");

        assert!(parsed.normalized_tokens.iter().any(|token| token == "STR"));
        assert!(parsed.normalized_tokens.iter().any(|token| token == "CHAR"));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.contains("menu")));
        assert!(!parsed.normalized_tokens.iter().any(|token| token == "\""));
        assert!(!parsed.normalized_tokens.iter().any(|token| token == "'x'"));
    }

    #[test]
    fn c_string_and_char_literals_collapse_to_placeholders() {
        let parsed = parse_submission(
            AnalysisLanguage::C,
            "const char *label = \"menu\" \" text\"; char initial = 'x';\n",
            vec![],
        )
        .expect("C source should parse");

        assert_eq!(
            parsed
                .normalized_tokens
                .iter()
                .filter(|token| token.as_str() == "STR_LIT")
                .count(),
            1
        );
        assert_eq!(
            parsed
                .normalized_tokens
                .iter()
                .filter(|token| token.as_str() == "CHAR_LIT")
                .count(),
            1
        );
        assert!(!parsed.normalized_tokens.iter().any(|token| token.contains("menu")));
        assert!(!parsed.normalized_tokens.iter().any(|token| token == "\""));
    }

    #[test]
    fn cpp_string_and_char_literals_collapse_to_placeholders() {
        let parsed = parse_submission(
            AnalysisLanguage::Cpp,
            "std::string label = R\"(menu text)\"; char initial = 'x';\n",
            vec![],
        )
        .expect("C++ source should parse");

        assert_eq!(
            parsed
                .normalized_tokens
                .iter()
                .filter(|token| token.as_str() == "STR_LIT")
                .count(),
            1
        );
        assert_eq!(
            parsed
                .normalized_tokens
                .iter()
                .filter(|token| token.as_str() == "CHAR_LIT")
                .count(),
            1
        );
        assert!(!parsed.normalized_tokens.iter().any(|token| token.contains("menu")));
        assert!(!parsed.normalized_tokens.iter().any(|token| token == "\""));
    }

    #[test]
    fn java_identifiers_use_fixed_categories_without_numbering() {
        let parsed = parse_submission(
            AnalysisLanguage::Java,
            "class Demo { Helper helper; void run(Helper value) { Helper local = value; helper = local; } }\n",
            vec![],
        )
        .expect("Java source should parse");

        assert!(parsed.normalized_tokens.iter().any(|token| token == "ID"));
        assert!(parsed.normalized_tokens.iter().any(|token| token == "TYPE_ID"));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.starts_with("ID1")));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.starts_with("ID2")));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.contains("Demo")));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.contains("Helper")));
    }

    #[test]
    fn c_identifiers_use_fixed_categories_without_numbering() {
        let parsed = parse_submission(
            AnalysisLanguage::C,
            "struct Item { int value; }; int main(void) { struct Item item; item.value = 1; return item.value; }\n",
            vec![],
        )
        .expect("C source should parse");

        assert!(parsed.normalized_tokens.iter().any(|token| token == "ID"));
        assert!(parsed.normalized_tokens.iter().any(|token| token == "TYPE_ID"));
        assert!(parsed.normalized_tokens.iter().any(|token| token == "FIELD_ID"));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.starts_with("ID1")));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.contains("Item")));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.contains("value")));
    }

    #[test]
    fn cpp_identifiers_use_fixed_categories_without_numbering() {
        let parsed = parse_submission(
            AnalysisLanguage::Cpp,
            "namespace demo { struct Item { int value; }; }\nint main() { demo::Item item; item.value = 1; return item.value; }\n",
            vec![],
        )
        .expect("C++ source should parse");

        assert!(parsed.normalized_tokens.iter().any(|token| token == "ID"));
        assert!(parsed.normalized_tokens.iter().any(|token| token == "TYPE_ID"));
        assert!(parsed.normalized_tokens.iter().any(|token| token == "FIELD_ID"));
        assert!(parsed.normalized_tokens.iter().any(|token| token == "NS_ID"));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.starts_with("ID1")));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.contains("demo")));
        assert!(!parsed.normalized_tokens.iter().any(|token| token.contains("Item")));
    }
}
