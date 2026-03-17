# C Engine Benchmarking

## Scope

This document covers the isolated benchmark path for the C comparison engine only.

It does not change:

- frontend pages
- backend routes or controllers
- database schema
- production upload flow
- production analysis job flow

## Dataset Location

The provided benchmark archive is extracted to:

- `evaluation/benchmark_data/synthetic_historical_like_c_dataset/`

That location was chosen because:

- the repo already has top-level `docs/` and `scripts/`
- the benchmark is repo-level evaluation material, not product-path data
- the folder stays obvious for a newcomer
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
7. computes metrics and writes outputs to `evaluation/output/`

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

- `evaluation/output/summary.json`
- `evaluation/output/summary.txt`
- `evaluation/output/threshold_sweep.csv`
- `evaluation/output/per_assignment.json`
- `evaluation/output/confusion_matrix.json`
- `evaluation/output/pair_results.json`
