use serde_json::json;
use std::path::PathBuf;
use tempfile::tempdir;

mod common;

// - cli contract coverage
// - exit code mapping
// - success path
// - output file exists
// - output json shape
#[test]
fn rank_success_creates_output() {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("req.json");
    let output = dir.path().join("out.json");

    let req = json!({
        "schema_version": "1.0",
        "engine_version": "0.1.0",
        "language": "c",
        "submissions": [
            {"submission_id": "A", "source": "int add(int a,int b){return a+b;}\n"},
            {"submission_id": "B", "source": "int sum(int x,int y){return x+y;}\n"}
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
        .arg(&output);

    cmd.assert().success();
    assert!(output.exists(), "output file should be created");

    let out_json = common::read_json(&output);
    assert_eq!(out_json["schema_version"], "1.0");
    assert_eq!(out_json["language"], "c");
    assert!(out_json["pairs"].is_array());
}

// - invalid schema version
// - expect request error code
#[test]
fn invalid_schema_version_exits_2() {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("req.json");
    let output = dir.path().join("out.json");

    let req = json!({
        "schema_version": "0.9",
        "engine_version": "0.1.0",
        "language": "c",
        "submissions": [
            {"submission_id": "A", "source": "int x=1;\n"},
            {"submission_id": "B", "source": "int y=2;\n"}
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
        .arg(&output);

    let assert = cmd.assert().failure().code(2);
    common::assert_single_line(&assert.get_output().stderr);
}

// - missing fields
// - serde parse failure becomes request error
#[test]
fn missing_required_fields_exits_2() {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("req.json");
    let output = dir.path().join("out.json");

    // - missing submissions
    // - missing params
    let req = json!({
        "schema_version": "1.0",
        "engine_version": "0.1.0",
        "language": "c"
    });

    common::write_json(&input, &req);

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("rank")
        .arg("--input")
        .arg(&input)
        .arg("--output")
        .arg(&output);

    let assert = cmd.assert().failure().code(2);
    common::assert_single_line(&assert.get_output().stderr);
}

// - unsupported language
// - expect parser or language error code
#[test]
fn unsupported_language_exits_3() {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("req.json");
    let output = dir.path().join("out.json");

    let req = json!({
        "schema_version": "1.0",
        "engine_version": "0.1.0",
        "language": "java",
        "submissions": [
            {"submission_id": "A", "source": "int x=1;\n"},
            {"submission_id": "B", "source": "int y=2;\n"}
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
        .arg(&output);

    let assert = cmd.assert().failure().code(3);
    common::assert_single_line(&assert.get_output().stderr);
}

// - output path is a directory
// - write must fail as internal error
#[test]
fn internal_error_write_failure_exits_4() {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("req.json");

    let req = json!({
        "schema_version": "1.0",
        "engine_version": "0.1.0",
        "language": "c",
        "submissions": [
            {"submission_id": "A", "source": "int x=1;\n"},
            {"submission_id": "B", "source": "int y=2;\n"}
        ],
        "params": {
            "k_gram": 3,
            "window": 2,
            "gst_min_match": 3,
            "top_k": 10
        }
    });

    common::write_json(&input, &req);

    // - directory cannot be overwritten by file write
    let output_dir: PathBuf = dir.path().to_path_buf();

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("rank")
        .arg("--input")
        .arg(&input)
        .arg("--output")
        .arg(&output_dir);

    let assert = cmd.assert().failure().code(4);
    common::assert_single_line(&assert.get_output().stderr);
}
