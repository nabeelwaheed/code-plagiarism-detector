use serde_json::json;
use std::fs;
use tempfile::tempdir;

mod common;

// - deterministic output check
// - same request
// - same bytes
#[test]
fn rank_is_deterministic() {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("req.json");
    let output_one = dir.path().join("out1.json");
    let output_two = dir.path().join("out2.json");

    let req = json!({
        "schema_version": "1.0",
        "engine_version": "0.1.0",
        "language": "c",
        "submissions": [
            {"submission_id": "A", "source": "int add(int a,int b){return a+b;}\n"},
            {"submission_id": "B", "source": "int sum(int x,int y){return x+y;}\n"},
            {"submission_id": "C", "source": "int mul(int a,int b){return a*b;}\n"}
        ],
        "params": {
            "k_gram": 3,
            "window": 2,
            "gst_min_match": 3,
            "top_k": 10
        }
    });

    common::write_json(&input, &req);

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("rank")
        .arg("--input")
        .arg(&input)
        .arg("--output")
        .arg(&output_one);
    cmd.assert().success();

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("rank")
        .arg("--input")
        .arg(&input)
        .arg("--output")
        .arg(&output_two);
    cmd.assert().success();

    let out_one = fs::read_to_string(&output_one).expect("read output one");
    let out_two = fs::read_to_string(&output_two).expect("read output two");
    assert_eq!(out_one, out_two, "expected deterministic output");
}
