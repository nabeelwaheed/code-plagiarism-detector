use serde_json::json;
use tempfile::tempdir;

mod common;

// - template subtraction coverage
// - compare helper with optional template
fn run_compare_with_template(template: Option<&str>) -> serde_json::Value {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("req.json");
    let output = dir.path().join("out.json");

    let source = common::read_fixture("c/template.c");

    let mut req = json!({
        "schema_version": "1.0",
        "engine_version": "0.1.0",
        "language": "c",
        "submissions": [
            {"submission_id": "A", "source": source},
            {"submission_id": "B", "source": source}
        ],
        "params": {
            "k_gram": 3,
            "window": 2,
            "gst_min_match": 3,
            "top_k": 5
        }
    });

    if let Some(template_source) = template {
        req["template"] = json!({"source": template_source});
    }

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

// - template only overlap
// - score should collapse
// - evidence should disappear
#[test]
fn template_subtraction_reduces_similarity() {
    let template = common::read_fixture("c/template.c");

    let no_template = run_compare_with_template(None);
    let with_template = run_compare_with_template(Some(&template));

    let score_no_template = no_template["pairs"][0]["score_primary"].as_f64().unwrap();
    let score_with_template = with_template["pairs"][0]["score_primary"].as_f64().unwrap();

    assert!(score_no_template >= 0.8, "expected high similarity without template");
    assert!(score_with_template <= 0.1, "expected low similarity with template subtraction");

    let matches_with_template = with_template["pairs"][0]["matches"].as_array().unwrap();
    assert!(
        matches_with_template.is_empty(),
        "template-only overlap should yield no evidence tiles"
    );
}
