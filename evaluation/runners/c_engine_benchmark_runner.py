#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import sys
import uuid
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET_ROOT = (
    REPO_ROOT / "evaluation" / "benchmark_data" / "synthetic_historical_like_c_dataset"
)
DEFAULT_OUTPUT_DIR = REPO_ROOT / "evaluation" / "output"
ENGINE_HARNESS_PATH = (
    REPO_ROOT / "engine" / "c-engine" / "scripts" / "run_c_engine_assignment_tests.py"
)
SCORE_FIELDS = ("score_primary", "score_secondary")
ENGINE_PRIMARY_SCORE_FIELD = "score_primary"


def load_upload_harness() -> Any:
    spec = importlib.util.spec_from_file_location("c_engine_upload_harness", ENGINE_HARNESS_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"failed to load upload harness from {ENGINE_HARNESS_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


upload_harness = load_upload_harness()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the synthetic historical-like C benchmark against the C engine."
    )
    parser.add_argument(
        "--dataset-root",
        type=Path,
        default=DEFAULT_DATASET_ROOT,
        help="Path to the extracted dataset root.",
    )
    parser.add_argument(
        "--engine-binary",
        type=Path,
        default=None,
        help="Optional path to a built engine binary. Defaults to the existing build if found.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory where benchmark outputs will be written.",
    )
    parser.add_argument(
        "--threshold-step",
        type=float,
        default=0.02,
        help="Threshold sweep increment between 0.0 and 1.0.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero if validation or pair execution fails.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    dataset_root = args.dataset_root.resolve()
    output_dir = args.output_dir.resolve()
    engine_binary = upload_harness.resolve_engine_binary(args.engine_binary)

    try:
        dataset = load_dataset(dataset_root)
        pair_results = run_pairs(dataset_root, dataset["pairs"], engine_binary)
        summary = build_summary(dataset_root, dataset, pair_results, args.threshold_step)
        write_outputs(output_dir, pair_results, summary)
        print(render_summary(summary))
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        return 1 if args.check else 0

    if args.check and summary["execution"]["failed_pairs"]:
        return 1
    return 0


def load_dataset(dataset_root: Path) -> dict[str, Any]:
    if not dataset_root.is_dir():
        raise ValueError(f"dataset root not found: {dataset_root}")

    pairs_path = dataset_root / "benchmark_pairs.json"
    submissions_manifest_path = dataset_root / "submissions_manifest.json"

    for required_path in (pairs_path, submissions_manifest_path):
        if not required_path.is_file():
            raise ValueError(f"dataset is missing required file: {required_path}")

    pairs = json.loads(pairs_path.read_text(encoding="utf-8"))
    submissions = json.loads(submissions_manifest_path.read_text(encoding="utf-8"))
    validate_pairs(pairs)

    submissions_by_id = {entry["submission_id"]: entry for entry in submissions}
    return {
        "pairs": pairs,
        "submissions_manifest": submissions,
        "submissions_by_id": submissions_by_id,
    }


def validate_pairs(pairs: list[dict[str, Any]]) -> None:
    if not isinstance(pairs, list) or not pairs:
        raise ValueError("benchmark_pairs.json must contain a non-empty array")

    required = {
        "pair_id",
        "assignment_id",
        "language",
        "submission_a_id",
        "submission_b_id",
        "submission_a_archive",
        "submission_b_archive",
        "should_flag_for_review",
        "label_meaning",
        "source_type",
    }
    seen_pair_ids = set()
    for pair in pairs:
        missing = sorted(required - pair.keys())
        if missing:
            raise ValueError(
                f"pair {pair.get('pair_id', '<missing>')} missing required keys: {', '.join(missing)}"
            )
        if pair["pair_id"] in seen_pair_ids:
            raise ValueError(f"duplicate pair_id in benchmark: {pair['pair_id']}")
        seen_pair_ids.add(pair["pair_id"])
        if pair["language"] != "c":
            raise ValueError(f"pair {pair['pair_id']} uses unsupported language: {pair['language']}")
        if not isinstance(pair["should_flag_for_review"], bool):
            raise ValueError(f"pair {pair['pair_id']} should_flag_for_review must be boolean")


def run_pairs(
    dataset_root: Path,
    pairs: list[dict[str, Any]],
    engine_binary: Path | None,
) -> list[dict[str, Any]]:
    results = []
    for pair in pairs:
        result = {
            "pair_id": pair["pair_id"],
            "assignment_id": pair["assignment_id"],
            "submission_a_id": pair["submission_a_id"],
            "submission_b_id": pair["submission_b_id"],
            "should_flag_for_review": pair["should_flag_for_review"],
            "label_meaning": pair["label_meaning"],
            "source_type": pair["source_type"],
            "notes": pair.get("notes", ""),
        }
        try:
            observed = run_pair(dataset_root, pair, engine_binary)
            result.update(observed)
            result["passed_execution"] = True
        except Exception as exc:  # noqa: BLE001
            result["passed_execution"] = False
            result["error"] = str(exc)
        results.append(result)
    return results


def run_pair(
    dataset_root: Path,
    pair: dict[str, Any],
    engine_binary: Path | None,
) -> dict[str, Any]:
    template_spec = build_template_spec(dataset_root, pair)
    observed = upload_harness.compare_pair(
        case_dir=dataset_root,
        language=pair["language"],
        submissions=[
            {
                "id": pair["submission_a_id"],
                "path": pair["submission_a_archive"],
                "path_kind": "upload_file",
                "upload_kind": "zip",
            },
            {
                "id": pair["submission_b_id"],
                "path": pair["submission_b_archive"],
                "path_kind": "upload_file",
                "upload_kind": "zip",
            },
        ],
        template_spec=template_spec,
        params=None,
        engine_binary=engine_binary,
    )

    return {
        "score_primary": observed["score_primary"],
        "score_secondary": observed["score_secondary"],
        "match_count": observed["match_count"],
    }


def build_template_spec(dataset_root: Path, pair: dict[str, Any]) -> dict[str, Any] | None:
    template_a = pair.get("template_a_archive")
    template_b = pair.get("template_b_archive")
    if not template_a and not template_b:
        return None
    if template_a != template_b and template_a and template_b:
        combined_dir = combine_template_archives(dataset_root, template_a, template_b, pair["pair_id"])
        return {
            "path": str(combined_dir),
            "path_kind": "source_dir",
            "upload_kind": "zip",
        }

    template_path = template_a or template_b
    return {
        "path": template_path,
        "path_kind": "upload_file",
        "upload_kind": "zip",
    }


def combine_template_archives(
    dataset_root: Path,
    template_a_archive: str,
    template_b_archive: str,
    pair_id: str,
) -> Path:
    upload_harness.CASE_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    combined_root = upload_harness.CASE_TEMP_ROOT / f"benchmark-template-{pair_id}-{uuid.uuid4().hex}"
    template_a_dir = combined_root / "template_a"
    template_b_dir = combined_root / "template_b"
    template_a_dir.mkdir(parents=True, exist_ok=False)
    template_b_dir.mkdir(parents=True, exist_ok=False)

    upload_harness.extract_zip_safely(dataset_root / template_a_archive, template_a_dir)
    upload_harness.extract_zip_safely(dataset_root / template_b_archive, template_b_dir)
    return combined_root


def build_summary(
    dataset_root: Path,
    dataset: dict[str, Any],
    pair_results: list[dict[str, Any]],
    threshold_step: float,
) -> dict[str, Any]:
    if threshold_step <= 0 or threshold_step > 1:
        raise ValueError("threshold_step must be > 0 and <= 1")

    scored_pairs = [pair for pair in pair_results if pair["passed_execution"]]
    failed_pairs = [pair for pair in pair_results if not pair["passed_execution"]]
    if not scored_pairs:
        raise ValueError("benchmark produced no scored pairs")

    label_counts = Counter(pair["should_flag_for_review"] for pair in scored_pairs)
    if not label_counts.get(True) or not label_counts.get(False):
        raise ValueError("benchmark must contain at least one positive and one negative pair")

    thresholds = build_thresholds(threshold_step)
    score_field_summaries = {}
    threshold_sweeps = {}
    for score_field in SCORE_FIELDS:
        sweep = [compute_metrics(scored_pairs, score_field, threshold) for threshold in thresholds]
        threshold_sweeps[score_field] = sweep
        score_field_summaries[score_field] = summarize_score_field(scored_pairs, sweep, score_field)

    preferred_score_field = choose_preferred_score_field(score_field_summaries)
    preferred_threshold = score_field_summaries[preferred_score_field]["recommended_review_threshold"]

    return {
        "dataset": {
            "root": str(dataset_root),
            "pair_count": len(dataset["pairs"]),
            "submission_count": len(dataset["submissions_manifest"]),
            "source_type_counts": Counter(pair["source_type"] for pair in scored_pairs),
        },
        "path_resolution": {
            "relative_paths_resolved_from_dataset_root": True,
            "dataset_root": str(dataset_root),
            "submission_archives_are_first_class_inputs": True,
            "template_archives_are_first_class_inputs": True,
            "engine_consumes_zips_directly": False,
            "runner_uses_temporary_extraction": True,
            "different_template_archives_combined_for_single_engine_template_payload": True,
        },
        "execution": {
            "total_pairs": len(pair_results),
            "scored_pairs": len(scored_pairs),
            "failed_pairs": len(failed_pairs),
            "failed_pair_ids": [pair["pair_id"] for pair in failed_pairs],
        },
        "score_fields": score_field_summaries,
        "preferred_review_signal": {
            "score_field": preferred_score_field,
            "engine_primary_score_field": ENGINE_PRIMARY_SCORE_FIELD,
            "recommended_review_threshold": preferred_threshold,
        },
        "per_assignment": build_per_assignment(scored_pairs, preferred_score_field, preferred_threshold["threshold"]),
        "label_semantics": {
            "field": "should_flag_for_review",
            "meaning": "true means the pair should be surfaced to a human reviewer; false means it should not be flagged on this benchmark",
        },
        "limitations": [
            "This dataset is synthetic historical-like data, not real historical student work.",
            "Metrics are benchmark-relative and do not establish field validity.",
            "Any threshold reported here is provisional and for human review triage only.",
            "Real anonymized historical submissions with vetted labels are still required for stronger calibration.",
        ],
        "_threshold_sweeps": threshold_sweeps,
        "_pair_results": scored_pairs,
        "_failed_pairs": failed_pairs,
    }


def build_thresholds(step: float) -> list[float]:
    thresholds = []
    current = 0.0
    while current < 1.0:
        thresholds.append(round(current, 6))
        current += step
    thresholds.append(1.0)
    return thresholds


def compute_metrics(
    pairs: list[dict[str, Any]],
    score_field: str,
    threshold: float,
) -> dict[str, Any]:
    tp = fp = tn = fn = 0
    for pair in pairs:
        actual = pair["should_flag_for_review"]
        predicted = pair[score_field] >= threshold
        if actual and predicted:
            tp += 1
        elif actual and not predicted:
            fn += 1
        elif not actual and predicted:
            fp += 1
        else:
            tn += 1

    precision = safe_divide(tp, tp + fp)
    recall = safe_divide(tp, tp + fn)
    fpr = safe_divide(fp, fp + tn)
    fnr = safe_divide(fn, fn + tp)
    specificity = safe_divide(tn, tn + fp)
    accuracy = safe_divide(tp + tn, tp + fp + tn + fn)
    balanced_accuracy = mean_defined(recall, specificity)
    f1 = safe_divide(2 * tp, (2 * tp) + fp + fn)

    return {
        "score_field": score_field,
        "threshold": threshold,
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "fpr": fpr,
        "fnr": fnr,
        "specificity": specificity,
        "accuracy": accuracy,
        "balanced_accuracy": balanced_accuracy,
        "f1": f1,
    }


def summarize_score_field(
    pairs: list[dict[str, Any]],
    sweep: list[dict[str, Any]],
    score_field: str,
) -> dict[str, Any]:
    best_balanced = pick_best_threshold(
        sweep,
        key_order=("balanced_accuracy", "recall", "specificity", "f1"),
    )
    best_f1 = pick_best_threshold(
        sweep,
        key_order=("f1", "balanced_accuracy", "recall", "specificity"),
    )
    high_recall = pick_high_recall_threshold(sweep, target_recall=0.8)

    recommended = dict(best_balanced)
    recommended["policy"] = (
        "provisional review-threshold candidate chosen by best balanced accuracy, "
        "with recall and specificity used as tie-breakers"
    )
    recommended["provisional"] = True
    recommended["validity"] = (
        "synthetic historical-like benchmark only; threshold is for human review triage, not guilt"
    )
    recommended["score_field_is_engine_primary"] = score_field == ENGINE_PRIMARY_SCORE_FIELD
    recommended["pair_count"] = len(pairs)

    return {
        "observed_score_range": {
            "min": min(pair[score_field] for pair in pairs),
            "max": max(pair[score_field] for pair in pairs),
        },
        "candidate_thresholds": {
            "best_balanced_accuracy": best_balanced,
            "best_f1": best_f1,
            "high_recall": high_recall,
        },
        "recommended_review_threshold": recommended,
    }


def pick_best_threshold(
    sweep: list[dict[str, Any]],
    key_order: tuple[str, ...],
) -> dict[str, Any]:
    return max(
        sweep,
        key=lambda row: tuple(metric_sort_value(row[key]) for key in key_order) + (-row["threshold"],),
    )


def pick_high_recall_threshold(
    sweep: list[dict[str, Any]],
    target_recall: float,
) -> dict[str, Any] | None:
    eligible = [row for row in sweep if row["recall"] is not None and row["recall"] >= target_recall]
    if not eligible:
        return None
    return max(
        eligible,
        key=lambda row: (
            metric_sort_value(row["specificity"]),
            metric_sort_value(row["precision"]),
            row["threshold"],
        ),
    )


def choose_preferred_score_field(score_field_summaries: dict[str, dict[str, Any]]) -> str:
    return max(
        score_field_summaries,
        key=lambda field: (
            metric_sort_value(
                score_field_summaries[field]["recommended_review_threshold"]["balanced_accuracy"]
            ),
            metric_sort_value(score_field_summaries[field]["recommended_review_threshold"]["recall"]),
            metric_sort_value(
                score_field_summaries[field]["recommended_review_threshold"]["specificity"]
            ),
            1 if field == ENGINE_PRIMARY_SCORE_FIELD else 0,
        ),
    )


def build_per_assignment(
    pairs: list[dict[str, Any]],
    score_field: str,
    threshold: float,
) -> dict[str, Any]:
    by_assignment: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for pair in pairs:
        by_assignment[pair["assignment_id"]].append(pair)

    result = {}
    for assignment_id, assignment_pairs in sorted(by_assignment.items()):
        result[assignment_id] = {
            "score_field": score_field,
            "threshold": threshold,
            "metrics": compute_metrics(assignment_pairs, score_field, threshold),
            "pair_ids": [pair["pair_id"] for pair in assignment_pairs],
        }
    return result


def write_outputs(output_dir: Path, pair_results: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = output_dir / "summary.json"
    summary_text_path = output_dir / "summary.txt"
    threshold_sweep_path = output_dir / "threshold_sweep.csv"
    per_assignment_path = output_dir / "per_assignment.json"
    confusion_matrix_path = output_dir / "confusion_matrix.json"
    pair_results_path = output_dir / "pair_results.json"

    summary_json = {key: value for key, value in summary.items() if not key.startswith("_")}
    summary_path.write_text(json.dumps(summary_json, indent=2), encoding="utf-8")
    summary_text_path.write_text(render_summary(summary), encoding="utf-8")
    per_assignment_path.write_text(json.dumps(summary["per_assignment"], indent=2), encoding="utf-8")
    pair_results_path.write_text(json.dumps(pair_results, indent=2), encoding="utf-8")

    confusion_payload = {
        "score_field": summary["preferred_review_signal"]["score_field"],
        "recommended_review_threshold": summary["preferred_review_signal"][
            "recommended_review_threshold"
        ],
    }
    confusion_matrix_path.write_text(json.dumps(confusion_payload, indent=2), encoding="utf-8")

    with threshold_sweep_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "score_field",
                "threshold",
                "tp",
                "fp",
                "tn",
                "fn",
                "precision",
                "recall",
                "fpr",
                "fnr",
                "specificity",
                "accuracy",
                "balanced_accuracy",
                "f1",
            ],
        )
        writer.writeheader()
        for score_field in SCORE_FIELDS:
            for row in summary["_threshold_sweeps"][score_field]:
                writer.writerow(row)


def render_summary(summary: dict[str, Any]) -> str:
    preferred = summary["preferred_review_signal"]
    threshold = preferred["recommended_review_threshold"]
    return "\n".join(
        [
            "C Engine Benchmark Summary",
            f"Dataset root: {summary['dataset']['root']}",
            (
                "Pairs: "
                f"{summary['execution']['scored_pairs']} scored / "
                f"{summary['execution']['total_pairs']} total"
            ),
            (
                "Preferred review signal: "
                f"{preferred['score_field']} (engine primary is {preferred['engine_primary_score_field']})"
            ),
            (
                "Recommended provisional review threshold: "
                f"{threshold['threshold']:.2f} on {preferred['score_field']}"
            ),
            (
                "At that threshold: "
                f"precision={format_metric(threshold['precision'])} "
                f"recall={format_metric(threshold['recall'])} "
                f"fpr={format_metric(threshold['fpr'])} "
                f"fnr={format_metric(threshold['fnr'])}"
            ),
            "Validity: synthetic historical-like benchmark only; threshold is for human review triage, not guilt.",
        ]
    )


def safe_divide(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def mean_defined(left: float | None, right: float | None) -> float | None:
    if left is None or right is None:
        return None
    return (left + right) / 2.0


def metric_sort_value(value: float | None) -> float:
    return -1.0 if value is None else value


def format_metric(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value:.3f}"


if __name__ == "__main__":
    sys.exit(main())
