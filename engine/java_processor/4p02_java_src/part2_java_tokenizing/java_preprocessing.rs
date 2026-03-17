use crate::part2_java_tokenizing::java_preprocessing_services::build_code_token_array::build_code_token_array;
use crate::part2_java_tokenizing::java_preprocessing_services::build_comment_token_array::build_comment_token_array;
use crate::part2_java_tokenizing::java_preprocessing_services::collect_java_syntax_items::collect_java_syntax_items;
use crate::part2_java_tokenizing::java_preprocessing_services::normalize_java_code_items::normalize_java_code_items;
use crate::part2_java_tokenizing::java_preprocessing_services::parse_java_source::parse_java_source;
use crate::part2_java_tokenizing::java_preprocessing_types::JavaPreprocessingResult;

pub fn preprocess_java_submission(source_code: &str) -> Result<JavaPreprocessingResult, String> {
    let tree = parse_java_source(source_code)?;
    let root_node = tree.root_node();

    let all_items = collect_java_syntax_items(source_code, root_node);
    let normalized_array = normalize_java_code_items(&all_items);
    let token_array = build_code_token_array(&all_items);
    let comment_token_array = build_comment_token_array(&all_items);

    Ok(JavaPreprocessingResult {
        normalized_array,
        token_array,
        comment_token_array,
    })
}