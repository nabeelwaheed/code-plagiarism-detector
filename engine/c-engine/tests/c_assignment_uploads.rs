use std::path::PathBuf;
use std::process::Command;

// - assignment fixture harness coverage
// - python wrapper selection
// - end to end upload style cases
fn python_command() -> Command {
    let python_ok = Command::new("python")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);

    if python_ok {
        return Command::new("python");
    }

    let mut cmd = Command::new("py");
    cmd.arg("-3");
    cmd
}

// - realistic upload flow
// - manifest driven cases
// - fail fast on harness stderr
#[test]
fn c_assignment_upload_cases_pass() {
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let preferred_manifest_root = repo_root.join("test-data").join("assignment-tests");
    let legacy_manifest_root = repo_root.join("assignment-tests");
    let manifest_root = if preferred_manifest_root.is_dir() {
        preferred_manifest_root
    } else {
        legacy_manifest_root
    };
    let script_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("scripts")
        .join("run_c_engine_assignment_tests.py");
    let engine_binary = PathBuf::from(env!("CARGO_BIN_EXE_engine"));

    let output = python_command()
        .arg(&script_path)
        .arg("--fixtures-root")
        .arg(&manifest_root)
        .arg("--engine-binary")
        .arg(&engine_binary)
        .arg("--check")
        .output()
        .expect("failed to run C assignment fixture harness");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !stdout.trim().is_empty() {
        println!("{}", stdout);
    }

    assert!(
        output.status.success(),
        "fixture harness failed\nstdout:\n{}\nstderr:\n{}",
        stdout,
        stderr
    );
}
