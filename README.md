# Anti-Vibe-Coder

Academic Integrity Submission & Similarity Analysis System for Brock University COSC 4P02.

This repository is for a web-based system where students submit programming assignments, instructors run similarity analysis, and instructors review flagged pairs in support of academic integrity investigations. The project must protect student privacy, support template subtraction, and include a team-built comparison engine rather than outsourcing code comparison to AI.

## Team
**Group 16**

**Group name**: Last Minute Warriors
- Muhammad Nabeel Waheed
- Thomas Neal
- Ghassan Balouze
- Kev Akpinar
- Abdel Zahran
- Ty Mabee

## What The Project Is For

The intended product is:

- a web application for student submission upload
- instructor tools for assignment and template management
- repository-aware similarity analysis across the current offering and optional secondary repositories
- anonymized reporting and comparison views
- minimum language support for C, C++, and Java

The intended system flow is:

1. accept a student submission upload
2. store the submission and metadata
3. extract source files
4. normalize and tokenize code
5. subtract shared template or starter code
6. compare submissions and compute similarity scores
7. generate evidence spans
8. persist job status and results
9. show instructors the review output in a web interface

## Current Repository Status

The repository does **not** yet implement the full product described above.

What is currently most complete:

- the Rust-based C/C++ comparison engine in `engine/c-engine`
- a realistic C-engine upload-style test harness
- a synthetic historical-like benchmark runner for the C engine
- a frontend source prototype

What is currently incomplete or placeholder:

- the main backend API and persistence layer
- production upload orchestration
- async job processing outside the engine test/evaluation path
- Java support in the engine
- a documented frontend runtime setup


## What You Can Run Today

### C Engine CLI

The implemented engine commands are:

- `engine ccpp rank --input req.json --output out.json`
- `engine ccpp compare --input req.json --a-id A --b-id B --output out.json`
- `engine ccpp concat --input concat.json --output out.concat.json`

These commands live in:

- `engine/c-engine/src/main.rs`

### Full Engine Test Suite

From the repository root:

```powershell
cd engine/c-engine
cargo test
```

What this runs:

- Rust integration tests for CLI behavior
- schema validation
- normalization behavior
- template subtraction
- evidence spans
- determinism
- realistic assignment-style upload fixtures
- root benchmark runner smoke coverage

### Realistic Assignment-Style C Engine Tests

From the repository root:

```powershell
cd engine/c-engine
python scripts/run_c_engine_assignment_tests.py --check
```

What this does:

- simulates single-file student uploads
- simulates multi-file zip uploads
- simulates template zip uploads
- safely extracts archives
- runs the C engine in isolation
- checks expected score ranges for curated assignment cases

Optional output:

```powershell
cd engine/c-engine
python scripts/run_c_engine_assignment_tests.py --check --summary-json target/assignment-summary.json
```

### Synthetic Historical-Like Benchmark

From the repository root:

```powershell
python scripts/run_c_engine_benchmark.py --check
```

What this does:

- loads labeled benchmark pairs from the extracted dataset
- resolves all manifest paths relative to the dataset root
- treats submission and template zip archives as first-class benchmark inputs
- safely extracts archives to temporary working space
- invokes the existing C engine through the engine-side adapter
- computes metrics and threshold sweeps
- writes outputs to `evaluation/output/`

Generated outputs:

- `evaluation/output/summary.json`
- `evaluation/output/summary.txt`
- `evaluation/output/threshold_sweep.csv`
- `evaluation/output/per_assignment.json`
- `evaluation/output/confusion_matrix.json`
- `evaluation/output/pair_results.json`

## What The Engine Accepts

The Rust engine itself does **not** take zip archives directly.

Direct engine input:

- `rank` and `compare`
  - JSON request files containing source text, submission ids, parameters, and optional template data
- `concat`
  - JSON request files containing file paths plus raw source text

Zip uploads are handled by the Python adapter layer in:

- `engine/c-engine/scripts/run_c_engine_assignment_tests.py`

That adapter:

1. accepts a file upload or zip archive as test input
2. extracts zip archives safely
3. collects `.c` and `.h` files
4. calls `ccpp concat`
5. builds the final `ccpp compare` request

## Top-Level Directory Guide

### Source Of Truth Areas

- `engine/c-engine/`
  - Rust C/C++ similarity engine
  - contains the real engine implementation, schemas, examples, fixtures, and tests
- `frontend/`
  - frontend source prototype
  - currently source-only; no committed package manifest was found in the repo
- `backend/`
  - placeholder only at the moment

### Evaluation And Benchmarking

- `evaluation/`
  - repo-level benchmark data, benchmark runners, and output directory
- `evaluation/benchmark_data/synthetic_historical_like_c_dataset/`
  - synthetic historical-like benchmark dataset
- `scripts/run_c_engine_benchmark.py`
  - easiest entry point for the benchmark runner
- `docs/c_engine_benchmarking.md`
  - focused benchmark notes and output details

### Engine Testing Data

- `engine/c-engine/assignment-tests/`
  - curated assignment-style C fixtures for realistic upload-path testing
- `engine/c-engine/testdata/`
  - small fixture programs for normalization, template subtraction, and parser behavior

### Other Top-Level Folders

- `docs/`
  - project-level notes outside the engine package
- `scripts/`
  - repo-level scripts
- `test-data/`
  - currently a placeholder

## Key Files And What They Tell You

If you are new to the repo, these are the fastest files to read:

- `README.md`
  - the overall project, current repo state, directory layout, and how to run the main test paths
- `docs/c_engine_benchmarking.md`
  - how the synthetic historical-like benchmark works and what its outputs mean
- `engine/c-engine/docs/C_ENGINE_REPO_ANALYSIS.md`
  - what the C-engine portion can and cannot support right now
- `engine/c-engine/docs/C_ENGINE_TESTING.md`
  - how the assignment-style C-engine test harness works
- `engine/c-engine/schemas/analysis-request.schema.json`
  - the engine request contract
- `engine/c-engine/schemas/analysis-result.schema.json`
  - the engine output contract
- `engine/c-engine/examples/req.rank.json`
  - example input for ranking
- `engine/c-engine/examples/req.compare.json`
  - example input for pairwise comparison
- `evaluation/benchmark_data/synthetic_historical_like_c_dataset/benchmark_pairs.json`
  - the source of truth for labeled benchmark comparisons
- `evaluation/benchmark_data/synthetic_historical_like_c_dataset/submissions_manifest.json`
  - metadata for the benchmark submissions
- `evaluation/benchmark_data/synthetic_historical_like_c_dataset/schema/benchmark_pair.schema.json`
  - schema for the pair entries in the dataset

## C Engine Test Inventory

The current Rust integration tests under `engine/c-engine/tests` cover:

- CLI success and error handling
- concat output and source-map generation
- normalization behavior
- template subtraction
- candidate generation
- determinism
- evidence span correctness
- request/result schema validation
- assignment-style upload-path cases
- synthetic historical-like benchmark runner coverage

The easiest command to run all of that is still:

```powershell
cd engine/c-engine
cargo test
```

## Benchmark Labels And Validity

The benchmark label is:

- `should_flag_for_review`

This means:

- `true`
  - the pair should be surfaced to a human reviewer
- `false`
  - the pair should not be flagged on this benchmark

This repository does **not** define a plagiarism guilt threshold.

Benchmark claims that are valid now:

- benchmark-relative precision
- benchmark-relative recall
- benchmark-relative false positive and false negative rates
- threshold sweeps on the synthetic historical-like dataset
- provisional review-threshold candidates

Benchmark claims that are **not** supportable yet:

- real-world field validity
- historical-course validity
- deployment-ready accuracy claims
- automatic guilt thresholds

## Practical Environment Notes

What the repo clearly supports right now:

- Rust for the engine
- Python 3 for the test and benchmark harnesses

What the repo does **not** currently provide as a clean committed setup:

- frontend package manager metadata such as `package.json`
- backend service runtime configuration

So the reliable commands today are the engine and benchmark commands listed above.

## Current Gaps Against The SRS

The SRS expects:

- student and instructor web flows
- backend API and storage
- submission upload and storage
- template management
- repository selection
- async similarity jobs
- anonymized reporting
- minimum language support for C, C++, and Java

The repo currently provides:

- a concrete C/C++ engine implementation
- a frontend prototype
- benchmark and test harnesses around the engine

The biggest missing pieces are:

- backend implementation
- production orchestration
- Java engine support
- full privacy/anonymization workflow integration

## External Project Context Used For This README

This README was aligned to:

- the project statement PDF
- the SRS PDF for Group 16

Those documents describe the intended product and requirements. This README describes both:

- the intended project
- the actual current repository state

## License

See `LICENSE`.
