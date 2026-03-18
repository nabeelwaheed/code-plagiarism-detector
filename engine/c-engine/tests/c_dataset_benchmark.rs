use std::path::PathBuf;
use std::process::Command;

use serde_json::Value;
use tempfile::tempdir;

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

#[test]
fn root_benchmark_runner_produces_metrics_outputs() {
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let script_path = repo_root.join("scripts").join("run_c_engine_benchmark.py");
    let preferred_dataset_root = repo_root
        .join("engine")
        .join("c-engine")
        .join("test-data")
        .join("benchmarks")
        .join("synthetic_c_dataset");
    let legacy_dataset_root = repo_root
        .join("evaluation")
        .join("benchmark_data")
        .join("synthetic_historical_like_c_dataset");
    let dataset_root = if preferred_dataset_root.is_dir() {
        preferred_dataset_root
    } else {
        legacy_dataset_root
    };
    let output_dir = tempdir().unwrap();
    let engine_binary = PathBuf::from(env!("CARGO_BIN_EXE_engine"));

    let output = python_command()
        .arg(&script_path)
        .arg("--dataset-root")
        .arg(&dataset_root)
        .arg("--output-dir")
        .arg(output_dir.path())
        .arg("--engine-binary")
        .arg(&engine_binary)
        .arg("--check")
        .output()
        .expect("failed to run root C benchmark runner");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(
        output.status.success(),
        "benchmark runner failed\nstdout:\n{}\nstderr:\n{}",
        stdout,
        stderr
    );

    let summary_path = output_dir.path().join("summary.json");
    let threshold_path = output_dir.path().join("threshold_sweep.csv");
    let per_assignment_path = output_dir.path().join("per_assignment.json");
    let threshold_graph_path = output_dir.path().join("threshold_sweep.svg");
    let score_distribution_graph_path = output_dir.path().join("score_distribution.svg");
    let per_assignment_graph_path = output_dir.path().join("per_assignment_metrics.svg");

    assert!(summary_path.is_file(), "missing summary.json");
    assert!(threshold_path.is_file(), "missing threshold_sweep.csv");
    assert!(per_assignment_path.is_file(), "missing per_assignment.json");
    assert!(threshold_graph_path.is_file(), "missing threshold_sweep.svg");
    assert!(
        score_distribution_graph_path.is_file(),
        "missing score_distribution.svg"
    );
    assert!(
        per_assignment_graph_path.is_file(),
        "missing per_assignment_metrics.svg"
    );
    assert!(
        stdout.contains("Results saved to:"),
        "benchmark runner stdout should list saved result paths\nstdout:\n{}",
        stdout
    );

    let summary: Value =
        serde_json::from_str(&std::fs::read_to_string(&summary_path).unwrap()).unwrap();

    assert_eq!(summary["execution"]["failed_pairs"].as_u64(), Some(0));
    assert_eq!(
        summary["path_resolution"]["relative_paths_resolved_from_dataset_root"].as_bool(),
        Some(true)
    );
    assert_eq!(
        summary["path_resolution"]["runner_uses_temporary_extraction"].as_bool(),
        Some(true)
    );
    assert!(
        summary["artifacts"]["threshold_sweep_graph"].is_string(),
        "summary.json should expose graph artifact paths"
    );
}
