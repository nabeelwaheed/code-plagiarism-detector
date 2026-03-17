use crate::part1_input::submission::Submission;

pub fn extract_submission_content(submission: &Submission) -> &str {
    &submission.content
}