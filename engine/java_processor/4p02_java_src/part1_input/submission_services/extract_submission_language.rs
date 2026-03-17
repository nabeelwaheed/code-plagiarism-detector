use crate::part1_input::submission::Submission;

pub fn extract_submission_language(submission: &Submission) -> &str {
    &submission.language
}