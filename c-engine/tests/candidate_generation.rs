use serde_json::json;
use tempfile::tempdir;

mod common;

// - inverted index behavior
// - no shared fingerprints means no candidate pair
#[test]
fn disjoint_fingerprints_do_not_produce_candidates() {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("req.json");
    let output = dir.path().join("out.json");

    // - k gram too large
    // - fingerprint sets stay empty
    let req = json!({
        "schema_version": "1.0",
        "engine_version": "0.1.0",
        "language": "c",
        "submissions": [
            {"submission_id": "A", "source": "int alpha(){return 1;}\n"},
            {"submission_id": "B", "source": "int beta(){return 2;}\n"}
        ],
        "params": {
            "k_gram": 50,
            "window": 4,
            "gst_min_match": 3,
            "top_k": 10,
            "threshold_primary": 0.0
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

    let out_json = common::read_json(&output);
    let pairs = out_json["pairs"].as_array().unwrap();
    assert!(pairs.is_empty(), "expected no candidate pairs");
}
