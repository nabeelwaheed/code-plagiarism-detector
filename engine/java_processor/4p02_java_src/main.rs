mod part1_input;
mod part2_java_tokenizing;
mod part3_GST;
mod part4_comment_comparison;
mod part5_match_mapping;
mod part6_final_output;

use part1_input::submission_input_pipeline::process_submission_input;
use part2_java_tokenizing::java_preprocessing::preprocess_java_submission;
use part3_GST::gst_comparison::run_gst_comparison;
use part3_GST::gst_types::GstConfig;
use part4_comment_comparison::comment_comparison::run_comment_comparison;
use part4_comment_comparison::comment_comparison_types::{
    CommentComparisonConfig,
    GenericCommentToken as Part4GenericCommentToken,
};
use part5_match_mapping::match_mapping::map_all_matches;
use part5_match_mapping::match_mapping_types::{
    CommentMatch as Part5CommentMatch,
    GenericCodeToken as Part5GenericCodeToken,
    GenericCommentToken as Part5GenericCommentToken,
    MatchedTile as Part5MatchedTile,
};
use part6_final_output::final_output::build_final_comparison_output;
use part6_final_output::final_output_types::{
    MappedCodeMatch as Part6MappedCodeMatch,
    MappedCommentMatch as Part6MappedCommentMatch,
};

fn main() {
    let submission_a = process_submission_input(
        "sub_001".to_string(),
        "java".to_string(),
        r#"
public class ProgramA {
    public static void main(String[] args) {
        // greeting comment
        int count = 5;
        int total = count + 10;

        if (total > 10) {
            System.out.println("Hello");
        }

        for (int i = 0; i < 3; i++) {
            System.out.println(i);
        }
    }
}
"#
        .to_string(),
    );

    let submission_b = process_submission_input(
        "sub_002".to_string(),
        "java".to_string(),
        r#"
public class ProgramB {
    public static void main(String[] args) {
        // greeting comment
        int number = 7;
        int sum = number + 10;

        if (sum > 10) {
            System.out.println("Hello");
        }

        for (int j = 0; j < 3; j++) {
            System.out.println(j);
        }
    }
}
"#
        .to_string(),
    );

    if submission_a.language != "java" || submission_b.language != "java" {
        eprintln!("This demo currently runs only for Java submissions.");
        return;
    }

    let part_2_result_a = match preprocess_java_submission(&submission_a.content) {
        Ok(result) => result,
        Err(error) => {
            eprintln!("Java preprocessing failed for submission A: {error}");
            return;
        }
    };

    let part_2_result_b = match preprocess_java_submission(&submission_b.content) {
        Ok(result) => result,
        Err(error) => {
            eprintln!("Java preprocessing failed for submission B: {error}");
            return;
        }
    };

    println!(
        "Submission A normalized array: {:?}",
        part_2_result_a.normalized_array
    );
    println!(
        "Submission B normalized array: {:?}",
        part_2_result_b.normalized_array
    );

    let gst_config = GstConfig {
        minimum_match_length: 3,
        maximum_match_length: None,
    };

    let gst_result = match run_gst_comparison(
        &part_2_result_a.normalized_array,
        &part_2_result_b.normalized_array,
        &gst_config,
    ) {
        Ok(result) => result,
        Err(error) => {
            eprintln!("GST comparison failed: {error}");
            return;
        }
    };

    println!("GST result: {:#?}", gst_result);

    let part4_comment_tokens_a: Vec<Part4GenericCommentToken> = part_2_result_a
        .comment_token_array
        .iter()
        .map(|comment_token| Part4GenericCommentToken {
            comment_text: comment_token.comment_text.clone(),
            byte_start: comment_token.byte_start,
            byte_end: comment_token.byte_end,
            source_kind: comment_token.node_kind.clone(),
        })
        .collect();

    let part4_comment_tokens_b: Vec<Part4GenericCommentToken> = part_2_result_b
        .comment_token_array
        .iter()
        .map(|comment_token| Part4GenericCommentToken {
            comment_text: comment_token.comment_text.clone(),
            byte_start: comment_token.byte_start,
            byte_end: comment_token.byte_end,
            source_kind: comment_token.node_kind.clone(),
        })
        .collect();

    let comment_config = CommentComparisonConfig {
        minimum_comment_length: 5,
        normalize_whitespace: true,
        case_sensitive: false,
    };

    let comment_result = match run_comment_comparison(
        &part4_comment_tokens_a,
        &part4_comment_tokens_b,
        &comment_config,
    ) {
        Ok(result) => result,
        Err(error) => {
            eprintln!("Comment comparison failed: {error}");
            return;
        }
    };

    println!("Comment comparison result: {:#?}", comment_result);

    let part5_code_tokens_a: Vec<Part5GenericCodeToken> = part_2_result_a
        .token_array
        .iter()
        .map(|code_token| Part5GenericCodeToken {
            normalized_value: code_token.normalized_value.clone(),
            raw_text: code_token.raw_text.clone(),
            byte_start: code_token.byte_start,
            byte_end: code_token.byte_end,
            source_kind: code_token.node_kind.clone(),
        })
        .collect();

    let part5_code_tokens_b: Vec<Part5GenericCodeToken> = part_2_result_b
        .token_array
        .iter()
        .map(|code_token| Part5GenericCodeToken {
            normalized_value: code_token.normalized_value.clone(),
            raw_text: code_token.raw_text.clone(),
            byte_start: code_token.byte_start,
            byte_end: code_token.byte_end,
            source_kind: code_token.node_kind.clone(),
        })
        .collect();

    let part5_comment_tokens_a: Vec<Part5GenericCommentToken> = part_2_result_a
        .comment_token_array
        .iter()
        .map(|comment_token| Part5GenericCommentToken {
            comment_text: comment_token.comment_text.clone(),
            byte_start: comment_token.byte_start,
            byte_end: comment_token.byte_end,
            source_kind: comment_token.node_kind.clone(),
        })
        .collect();

    let part5_comment_tokens_b: Vec<Part5GenericCommentToken> = part_2_result_b
        .comment_token_array
        .iter()
        .map(|comment_token| Part5GenericCommentToken {
            comment_text: comment_token.comment_text.clone(),
            byte_start: comment_token.byte_start,
            byte_end: comment_token.byte_end,
            source_kind: comment_token.node_kind.clone(),
        })
        .collect();

    let part5_tiles: Vec<Part5MatchedTile> = gst_result
        .matched_tiles
        .iter()
        .map(|tile| Part5MatchedTile {
            start_index_a: tile.start_index_a,
            start_index_b: tile.start_index_b,
            length: tile.length,
        })
        .collect();

    let part5_comment_matches: Vec<Part5CommentMatch> = comment_result
        .matched_comments
        .iter()
        .map(|comment_match| Part5CommentMatch {
            comment_index_a: comment_match.comment_index_a,
            comment_index_b: comment_match.comment_index_b,
            matched_text_a: comment_match.matched_text_a.clone(),
            matched_text_b: comment_match.matched_text_b.clone(),
            byte_start_a: comment_match.byte_start_a,
            byte_end_a: comment_match.byte_end_a,
            byte_start_b: comment_match.byte_start_b,
            byte_end_b: comment_match.byte_end_b,
            matched_length: comment_match.matched_length,
        })
        .collect();

    let mapping_result = match map_all_matches(
        &part5_code_tokens_a,
        &part5_code_tokens_b,
        &part5_tiles,
        &part5_comment_tokens_a,
        &part5_comment_tokens_b,
        &part5_comment_matches,
    ) {
        Ok(result) => result,
        Err(error) => {
            eprintln!("Match mapping failed: {error}");
            return;
        }
    };

    println!("Match mapping result: {:#?}", mapping_result);

    let final_code_matches: Vec<Part6MappedCodeMatch> = mapping_result
        .mapped_code_matches
        .iter()
        .map(|mapped_match| Part6MappedCodeMatch {
            start_token_index_a: mapped_match.start_token_index_a,
            end_token_index_a: mapped_match.end_token_index_a,
            start_token_index_b: mapped_match.start_token_index_b,
            end_token_index_b: mapped_match.end_token_index_b,
            byte_start_a: mapped_match.byte_start_a,
            byte_end_a: mapped_match.byte_end_a,
            byte_start_b: mapped_match.byte_start_b,
            byte_end_b: mapped_match.byte_end_b,
            matched_length: mapped_match.matched_length,
        })
        .collect();

    let final_comment_matches: Vec<Part6MappedCommentMatch> = mapping_result
        .mapped_comment_matches
        .iter()
        .map(|mapped_match| Part6MappedCommentMatch {
            comment_index_a: mapped_match.comment_index_a,
            comment_index_b: mapped_match.comment_index_b,
            byte_start_a: mapped_match.byte_start_a,
            byte_end_a: mapped_match.byte_end_a,
            byte_start_b: mapped_match.byte_start_b,
            byte_end_b: mapped_match.byte_end_b,
            matched_text_a: mapped_match.matched_text_a.clone(),
            matched_text_b: mapped_match.matched_text_b.clone(),
            matched_length: mapped_match.matched_length,
        })
        .collect();

    let final_output = match build_final_comparison_output(
        &submission_a.submission_id,
        &submission_b.submission_id,
        gst_result.similarity_score_percent,
        final_code_matches,
        final_comment_matches,
    ) {
        Ok(output) => output,
        Err(error) => {
            eprintln!("Final output build failed: {error}");
            return;
        }
    };

    println!("Final comparison output: {:#?}", final_output);
}