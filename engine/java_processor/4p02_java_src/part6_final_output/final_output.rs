use crate::part6_final_output::final_output_types::{
    FinalComparisonOutput, MappedCodeMatch, MappedCommentMatch,
};

pub fn build_final_comparison_output(
    submission_id_a: &str,
    submission_id_b: &str,
    similarity_score_percent: f64,
    mapped_code_matches: Vec<MappedCodeMatch>,
    mapped_comment_matches: Vec<MappedCommentMatch>,
) -> Result<FinalComparisonOutput, String> {
    validate_submission_id(submission_id_a, "submission_id_a")?;
    validate_submission_id(submission_id_b, "submission_id_b")?;
    validate_similarity_score(similarity_score_percent)?;

    Ok(FinalComparisonOutput {
        submission_id_a: submission_id_a.to_string(),
        submission_id_b: submission_id_b.to_string(),
        similarity_score_percent,
        output_tiles_for_code_matches: mapped_code_matches,
        output_comment_matches: mapped_comment_matches,
    })
}

pub fn validate_submission_id(submission_id: &str, field_name: &str) -> Result<(), String> {
    if submission_id.trim().is_empty() {
        return Err(format!("{field_name} cannot be empty"));
    }

    Ok(())
}

pub fn validate_similarity_score(similarity_score_percent: f64) -> Result<(), String> {
    if !(0.0..=100.0).contains(&similarity_score_percent) {
        return Err("similarity_score_percent must be between 0 and 100".to_string());
    }

    Ok(())
}