use serde_json::json;
use tempfile::tempdir;

mod common;

// - concat helper coverage
// - ordering
// - newline policy
// - source map ranges
#[test]
fn concat_produces_source_and_map() {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("concat.json");
    let output = dir.path().join("out.json");

    let req = json!({
        "files": [
            {"file_path": "a.c", "source": "int a=1;"},
            {"file_path": "b.c", "source": "int b=2;\n"}
        ]
    });
    common::write_json(&input, &req);

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("concat")
        .arg("--input")
        .arg(&input)
        .arg("--output")
        .arg(&output);
    cmd.assert().success();

    let out_json = common::read_json(&output);
    let source = out_json["source"].as_str().expect("source missing");
    let map = out_json["source_map"].as_array().expect("source_map missing");

    let expected_first = "int a=1;\n";
    let expected_second = "int b=2;\n";
    let expected_source = format!("{}{}", expected_first, expected_second);
    assert_eq!(source, expected_source);
    assert_eq!(map.len(), 2);

    let first = &map[0];
    let second = &map[1];

    let first_start = first["byte_start"].as_u64().unwrap() as usize;
    let first_end = first["byte_end"].as_u64().unwrap() as usize;
    let second_start = second["byte_start"].as_u64().unwrap() as usize;
    let second_end = second["byte_end"].as_u64().unwrap() as usize;

    assert_eq!(first_start, 0);
    assert_eq!(first_end, expected_first.as_bytes().len());
    assert_eq!(second_start, first_end);
    assert_eq!(second_end, source.as_bytes().len());

    let first_slice = &source.as_bytes()[first_start..first_end];
    let second_slice = &source.as_bytes()[second_start..second_end];
    assert_eq!(first_slice, expected_first.as_bytes());
    assert_eq!(second_slice, expected_second.as_bytes());
}

// - concat output feeds compare path
// - evidence spans should carry file paths
#[test]
fn concat_output_can_drive_evidence_with_file_paths() {
    let dir = tempdir().expect("tempdir");
    let concat_input_a = dir.path().join("concat_a.json");
    let concat_output_a = dir.path().join("concat_a_out.json");
    let concat_input_b = dir.path().join("concat_b.json");
    let concat_output_b = dir.path().join("concat_b_out.json");

    let req_a = json!({
        "files": [
            {"file_path": "shared.c", "source": "int shared(){return 1;}\n"},
            {"file_path": "only_a.c", "source": "int only_a(){return 2;}\n"}
        ]
    });
    let req_b = json!({
        "files": [
            {"file_path": "shared.c", "source": "int shared(){return 1;}\n"},
            {"file_path": "only_b.c", "source": "struct OnlyB { int x; };\n"}
        ]
    });

    common::write_json(&concat_input_a, &req_a);
    common::write_json(&concat_input_b, &req_b);

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("concat")
        .arg("--input")
        .arg(&concat_input_a)
        .arg("--output")
        .arg(&concat_output_a);
    cmd.assert().success();

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("concat")
        .arg("--input")
        .arg(&concat_input_b)
        .arg("--output")
        .arg(&concat_output_b);
    cmd.assert().success();

    let concat_a = common::read_json(&concat_output_a);
    let concat_b = common::read_json(&concat_output_b);

    let compare_input = dir.path().join("req.json");
    let compare_output = dir.path().join("out.json");

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

    common::write_json(&compare_input, &req);

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("compare")
        .arg("--input")
        .arg(&compare_input)
        .arg("--a-id")
        .arg("A")
        .arg("--b-id")
        .arg("B")
        .arg("--output")
        .arg(&compare_output);
    cmd.assert().success();

    let out_json = common::read_json(&compare_output);
    let matches = out_json["pairs"][0]["matches"].as_array().unwrap();
    assert!(!matches.is_empty(), "expected evidence spans");

    for m in matches {
        let file_a = m["a"]["file_path"].as_str().expect("file_path missing");
        let file_b = m["b"]["file_path"].as_str().expect("file_path missing");
        assert!(file_a == "shared.c" || file_a == "only_a.c");
        assert!(file_b == "shared.c" || file_b == "only_a.c");
    }
}
