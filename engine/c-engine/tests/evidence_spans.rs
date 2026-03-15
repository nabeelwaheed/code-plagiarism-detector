use serde_json::{json, Value};
use tempfile::tempdir;

mod common;

// - evidence span coverage
// - helper builds concat payloads
fn run_concat(files: &[(&str, &str)], dir: &std::path::Path) -> Value {
    let input = dir.join("concat.json");
    let output = dir.join("concat_out.json");

    let files_json: Vec<Value> = files
        .iter()
        .map(|(path, source)| json!({"file_path": path, "source": source}))
        .collect();

    let req = json!({"files": files_json});
    common::write_json(&input, &req);

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("concat")
        .arg("--input")
        .arg(&input)
        .arg("--output")
        .arg(&output);
    cmd.assert().success();

    common::read_json(&output)
}

// - tiny controlled fixture
// - validate byte bounds
// - validate line and col fields
// - validate file path mapping
#[test]
fn evidence_spans_are_well_formed_and_mapped() {
    let dir = tempdir().expect("tempdir");

    let concat_a = run_concat(
        &[
            ("shared.c", "int shared(){return 1;}\n"),
            ("only_a.c", "int only_a(){return 2;}\n"),
        ],
        dir.path(),
    );

    let concat_b = run_concat(
        &[
            ("shared.c", "int shared(){return 1;}\n"),
            ("only_b.c", "struct OnlyB { int x; };\n"),
        ],
        dir.path(),
    );

    let input = dir.path().join("req.json");
    let output = dir.path().join("out.json");

    let req = json!({
        "schema_version": "1.0",
        "engine_version": "0.1.0",
        "language": "c",
        "submissions": [
            {
                "submission_id": "A",
                "source": concat_a["source"],
                "source_map": concat_a["source_map"]
            },
            {
                "submission_id": "B",
                "source": concat_b["source"],
                "source_map": concat_b["source_map"]
            }
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

    let out_json = common::read_json(&output);
    let pairs = out_json["pairs"].as_array().unwrap();
    assert!(!pairs.is_empty(), "expected at least one pair");

    let matches = pairs[0]["matches"].as_array().unwrap();
    assert!(!matches.is_empty(), "expected evidence matches");

    let source_a = out_json["pairs"][0]["a_id"].as_str().unwrap();
    let source_b = out_json["pairs"][0]["b_id"].as_str().unwrap();
    assert_eq!(source_a, "A");
    assert_eq!(source_b, "B");

    let len_a = concat_a["source"].as_str().unwrap().as_bytes().len();
    let len_b = concat_b["source"].as_str().unwrap().as_bytes().len();

    let mut saw_line_one = false;

    for m in matches {
        for side in ["a", "b"] {
            let span = &m[side];
            let byte_start = span["byte_start"].as_u64().unwrap() as usize;
            let byte_end = span["byte_end"].as_u64().unwrap() as usize;
            let line_start = span["line_start"].as_u64().unwrap();
            let line_end = span["line_end"].as_u64().unwrap();
            let col_start = span["col_start"].as_u64().unwrap();
            let col_end = span["col_end"].as_u64().unwrap();
            let file_path = span["file_path"].as_str().expect("file_path missing");

            assert!(byte_start < byte_end);
            assert!(line_start >= 1);
            assert!(line_end >= line_start);
            assert!(col_start >= 1);
            assert!(col_end >= 1);

            if side == "a" {
                assert!(byte_end <= len_a);
            } else {
                assert!(byte_end <= len_b);
            }

            assert!(
                file_path == "shared.c" || file_path == "only_a.c" || file_path == "only_b.c"
            );

            if line_start == 1 && line_end == 1 {
                saw_line_one = true;
            }
        }
    }

    assert!(saw_line_one, "expected at least one match on line 1");
}
