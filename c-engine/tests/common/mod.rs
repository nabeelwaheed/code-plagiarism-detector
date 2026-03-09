#![allow(dead_code)]

use assert_cmd::Command;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

// - shared test helpers
// - path lookup
// - json io
// - binary launch
pub fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

// - fixture root helper
pub fn testdata_path(rel: &str) -> PathBuf {
    repo_root().join("testdata").join(rel)
}

// - schema root helper
pub fn schema_path(filename: &str) -> PathBuf {
    repo_root().join("schemas").join(filename)
}

// - example root helper
pub fn example_path(filename: &str) -> PathBuf {
    repo_root().join("examples").join(filename)
}

// - utf8 fixture loader
pub fn read_fixture(rel: &str) -> String {
    fs::read_to_string(testdata_path(rel)).expect("failed to read fixture")
}

// - pretty json writer
pub fn write_json(path: &Path, value: &Value) {
    let content = serde_json::to_string_pretty(value).expect("failed to serialize json");
    fs::write(path, content).expect("failed to write json file");
}

// - json file reader
pub fn read_json(path: &Path) -> Value {
    let content = fs::read_to_string(path).expect("failed to read json file");
    serde_json::from_str(&content).expect("failed to parse json file")
}

// - cargo built binary handle
pub fn engine_cmd() -> Command {
    assert_cmd::cargo_bin_cmd!("engine")
}

// - stderr shape check
pub fn assert_single_line(stderr: &[u8]) {
    let text = String::from_utf8_lossy(stderr);
    let line_count = text.trim().lines().count();
    assert_eq!(line_count, 1, "stderr should be a single line, got: {}", text);
}
