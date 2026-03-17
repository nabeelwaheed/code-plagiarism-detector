use crate::part1_input::submission::Submission;

pub fn create_submission(
    submission_id: String,
    language: String,
    content: String,
) -> Submission {
    Submission {
        submission_id,
        language,
        content,
    }
}