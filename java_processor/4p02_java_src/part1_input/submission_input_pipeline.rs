use crate::part1_input::submission::Submission;
use crate::part1_input::submission_services::create_submission::create_submission;
use crate::part1_input::submission_services::extract_submission_content::extract_submission_content;
use crate::part1_input::submission_services::extract_submission_id::extract_submission_id;
use crate::part1_input::submission_services::extract_submission_language::extract_submission_language;

#[derive(Debug)]
pub struct SubmissionInputResult {
    pub submission: Submission,
    pub submission_id: String,
    pub language: String,
    pub content: String,
}

pub fn process_submission_input(
    submission_id: String,
    language: String,
    content: String,
) -> SubmissionInputResult {
    let submission = create_submission(submission_id, language, content);

    let extracted_submission_id = extract_submission_id(&submission).to_string();
    let extracted_language = extract_submission_language(&submission).to_string();
    let extracted_content = extract_submission_content(&submission).to_string();

    SubmissionInputResult {
        submission,
        submission_id: extracted_submission_id,
        language: extracted_language,
        content: extracted_content,
    }
}