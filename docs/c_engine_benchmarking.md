# C Engine Benchmarking

## Scope

This document covers the isolated benchmark path for the C comparison engine only.

It does not change:

- frontend pages
- backend routes or controllers
- database schema
- production upload flow
- production analysis job flow

The repo now also contains a backend prototype with zip upload handling and a bundled engine binary, but this benchmark intentionally bypasses that path and exercises the maintained Rust C-engine source tree through the engine-side adapter.

## Dataset Location

The provided benchmark archive is extracted to:

- `engine/c-engine/test-data/benchmarks/synthetic_c_dataset/`

That location was chosen because:

- the benchmark remains isolated from frontend and backend product paths
- the folder now sits beside the maintained Rust C engine
- fixture data, benchmark data, and generated outputs stay in one engine-local home
- the dataset can remain self-contained without touching frontend or backend code

## Engine Interface

The Rust engine entry points are:

- `engine ccpp rank --input req.json --output out.json`
- `engine ccpp compare --input req.json --a-id A --b-id B --output out.json`
- `engine ccpp concat --input concat.json --output out.concat.json`

The engine itself does **not** accept zip archives directly.

It accepts JSON requests built from source content.

## Benchmark Runner Behavior

Run from the repository root:

```powershell
python scripts/run_c_engine_benchmark.py --check
```

The runner:

1. loads `benchmark_pairs.json`
2. resolves submission and template paths relative to the dataset root
3. treats submission zip archives as first-class inputs
4. treats template zip archives as first-class inputs
5. extracts archives safely in temporary working space
6. invokes the existing C engine through the engine-side adapter
7. computes metrics and writes outputs to `engine/c-engine/test-data/output/benchmark/`
8. prints a `Results saved to:` block with the generated file paths

## Template Handling

The dataset supports template archives per side of a pair:

- `template_a_archive`
- `template_b_archive`

The current engine compare request supports one template payload.

So the runner uses this adapter rule:

- if both template archives are the same, it passes that template directly
- if they differ, it safely extracts both and builds a temporary combined template payload for the current engine request

That is an evaluation-only adapter layer. It does not change production engine behavior.

## Metrics

The runner computes:

- confusion matrix
- precision
- recall
- false positive rate
- false negative rate
- threshold sweep
- per-assignment breakdown
- provisional recommended review threshold

The threshold framing is always:

- threshold for `flag for human review`

It is not:

- a plagiarism guilt threshold

## Validity

This dataset is synthetic historical-like data, not real historical student submissions.

That means the current outputs are useful for:

- regression testing
- evaluation pipeline development
- initial review-threshold exploration

They are not enough for:

- real-world deployment claims
- field-calibrated false positive / false negative rates
- final threshold calibration without anonymized historical data

## Output Files

The runner writes:

- `engine/c-engine/test-data/output/benchmark/summary.json`
- `engine/c-engine/test-data/output/benchmark/summary.txt`
- `engine/c-engine/test-data/output/benchmark/threshold_sweep.csv`
- `engine/c-engine/test-data/output/benchmark/per_assignment.json`
- `engine/c-engine/test-data/output/benchmark/confusion_matrix.json`
- `engine/c-engine/test-data/output/benchmark/pair_results.json`
- `engine/c-engine/test-data/output/benchmark/threshold_sweep.svg`
- `engine/c-engine/test-data/output/benchmark/score_distribution.svg`
- `engine/c-engine/test-data/output/benchmark/per_assignment_metrics.svg`
