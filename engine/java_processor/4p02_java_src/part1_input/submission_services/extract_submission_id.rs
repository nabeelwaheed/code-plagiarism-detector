use crate::part1_input::submission::Submission;

pub fn extract_submission_id(submission: &Submission) -> &str {
    &submission.submission_id
}