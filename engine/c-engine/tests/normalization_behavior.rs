use serde_json::json;
use tempfile::tempdir;

mod common;

// - normalization behavior coverage
// - black box via compare command
fn run_compare(language: &str, source_a: &str, source_b: &str) -> serde_json::Value {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("req.json");
    let output = dir.path().join("out.json");

    let req = json!({
        "schema_version": "1.0",
        "engine_version": "0.1.0",
        "language": language,
        "submissions": [
            {"submission_id": "A", "source": source_a},
            {"submission_id": "B", "source": source_b}
        ],
        "params": {
            "k_gram": 3,
            "window": 2,
            "gst_min_match": 3,
            "top_k": 5
        }
    });

    common::write_json(&input, &req);

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("compare")
        .arg("--input")
        .arg(&input)
        .arg("--a-id")
        .arg("A")
        .arg("--b-id")
        .arg("B")
        .arg("--output")
        .arg(&output);
    cmd.assert().success();

    common::read_json(&output)
}

// - primary score helper
fn score_primary(result: &serde_json::Value) -> f64 {
    result["pairs"][0]["score_primary"].as_f64().unwrap()
}

// - evidence count helper
fn matches_len(result: &serde_json::Value) -> usize {
    result["pairs"][0]["matches"].as_array().unwrap().len()
}

// - renamed identifiers should still match
#[test]
fn identifier_renaming_keeps_similarity_high() {
    let a = common::read_fixture("c/ident_a.c");
    let b = common::read_fixture("c/ident_b.c");

    let result = run_compare("c", &a, &b);
    assert!(score_primary(&result) >= 0.8, "expected high similarity");
    assert!(matches_len(&result) > 0, "expected evidence matches");
}

// - changed literals should still match
#[test]
fn literal_anonymization_keeps_similarity_high() {
    let a = common::read_fixture("c/literal_a.c");
    let b = common::read_fixture("c/literal_b.c");

    let result = run_compare("c", &a, &b);
    assert!(score_primary(&result) >= 0.8, "expected high similarity");
    assert!(matches_len(&result) > 0, "expected evidence matches");
}

// - comments ignored by default
#[test]
fn comments_do_not_reduce_similarity() {
    let a = common::read_fixture("c/comment_a.c");
    let b = common::read_fixture("c/comment_b.c");

    let result = run_compare("c", &a, &b);
    assert!(score_primary(&result) >= 0.8, "expected high similarity");
    assert!(matches_len(&result) > 0, "expected evidence matches");
}

// - preproc changes ignored by default
#[test]
fn preprocessor_directives_are_ignored() {
    let a = common::read_fixture("c/preproc_a.c");
    let b = common::read_fixture("c/preproc_b.c");

    let result = run_compare("c", &a, &b);
    assert!(score_primary(&result) >= 0.8, "expected high similarity");
    assert!(matches_len(&result) > 0, "expected evidence matches");
}

// - cpp parser path
// - normalization parity with c path
#[test]
fn cpp_parser_and_normalization_work() {
    let a = common::read_fixture("cpp/vector_a.cpp");
    let b = common::read_fixture("cpp/vector_b.cpp");

    let result = run_compare("cpp", &a, &b);
    assert!(score_primary(&result) >= 0.8, "expected high similarity");
    assert!(matches_len(&result) > 0, "expected evidence matches");
}
