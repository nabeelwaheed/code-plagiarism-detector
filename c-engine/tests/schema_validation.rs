use jsonschema::{Draft, JSONSchema};
use serde_json::Value;
use tempfile::tempdir;

mod common;

// - schema validation coverage
// - example requests
// - real engine output
fn compile_schema(path: &std::path::Path) -> JSONSchema {
    let schema_json: Value = common::read_json(path);
    JSONSchema::options()
        .with_draft(Draft::Draft202012)
        .compile(&schema_json)
        .expect("failed to compile schema")
}

// - request fixtures match schema contract
#[test]
fn example_requests_validate_against_schema() {
    let schema_path = common::schema_path("analysis-request.schema.json");
    let schema = compile_schema(&schema_path);

    for example in ["req.rank.json", "req.compare.json"] {
        let example_path = common::example_path(example);
        let instance: Value = common::read_json(&example_path);
        if !schema.is_valid(&instance) {
            let msgs: Vec<String> = schema
                .validate(&instance)
                .expect_err("expected validation errors")
                .map(|e| e.to_string())
                .collect();
            panic!("schema validation failed for {}: {:?}", example, msgs);
        }
    }
}

// - engine output matches result schema
#[test]
fn engine_output_validates_against_schema() {
    let schema_path = common::schema_path("analysis-result.schema.json");
    let schema = compile_schema(&schema_path);

    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("req.json");
    let output = dir.path().join("out.json");

    // - bundled request keeps test stable
    let example_req = common::read_json(&common::example_path("req.rank.json"));
    common::write_json(&input, &example_req);

    let mut cmd = common::engine_cmd();
    cmd.arg("ccpp")
        .arg("rank")
        .arg("--input")
        .arg(&input)
        .arg("--output")
        .arg(&output);
    cmd.assert().success();

    let output_json: Value = common::read_json(&output);
    if !schema.is_valid(&output_json) {
        let msgs: Vec<String> = schema
            .validate(&output_json)
            .expect_err("expected validation errors")
            .map(|e| e.to_string())
            .collect();
        panic!("output schema validation failed: {:?}", msgs);
    }
}
