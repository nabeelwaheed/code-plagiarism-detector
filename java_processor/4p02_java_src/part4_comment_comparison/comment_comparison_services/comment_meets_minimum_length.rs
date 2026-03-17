pub fn comment_meets_minimum_length(comment_text: &str, minimum_comment_length: usize) -> bool {
    comment_text.len() >= minimum_comment_length
}