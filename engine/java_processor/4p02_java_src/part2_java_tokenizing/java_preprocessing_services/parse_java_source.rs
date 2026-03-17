use tree_sitter::{Parser, Tree};

pub fn parse_java_source(source_code: &str) -> Result<Tree, String> {
    let mut parser = Parser::new();
    let language = tree_sitter_java::LANGUAGE.into();

    parser
        .set_language(&language)
        .map_err(|error| format!("Failed to set Java parser language: {error}"))?;

    parser
        .parse(source_code, None)
        .ok_or_else(|| "Failed to parse Java source code".to_string())
}