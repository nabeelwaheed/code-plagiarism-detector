# Anti-Vibe-Coder

Academic Integrity Submission & Similarity Analysis System for Brock University COSC 4P02.

This repository is for a web-based system where students submit programming assignments, instructors manage courses and assignments, the system runs similarity analysis, and instructors review flagged pairs in support of academic integrity investigations. The project must protect student privacy, support template subtraction, and include team-built comparison engines rather than outsourcing code comparison to AI.

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
- instructor tools for course, assignment, and template management
- similarity analysis across the current offering and optional secondary repositories
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

The repository still does **not** implement the full product described above, but it is no longer just an engine-only skeleton.

What is currently most complete:

- the Rust-based C/C++ comparison engine in `engine/c-engine`
- the isolated C-engine assignment harness and synthetic benchmark runner
- a Node/Express backend prototype with routes, controllers, repositories, zip upload storage, and a bundled Windows engine binary
- a separate Rust Java processor prototype in `engine/java_processor`
- a frontend source prototype

What is currently still incomplete or only partially wired:

- a single end-to-end production path that ties frontend, backend, and both engines together cleanly
- automated tests for the backend and frontend
- unified engine orchestration across the Rust C engine and the Java processor
- production-ready async job processing, anonymized reporting, and repository-selection flow
- a clean frontend runtime/package setup in the committed repo

## What You Can Run Today

### Verified C Engine Paths

The C-engine paths below were revalidated against the current repo state after the latest pull.

#### C Engine CLI

The implemented Rust engine commands are:

- `engine ccpp rank --input req.json --output out.json`
- `engine ccpp compare --input req.json --a-id A --b-id B --output out.json`
- `engine ccpp concat --input concat.json --output out.concat.json`

These commands live in:

- `engine/c-engine/src/main.rs`

#### Full C Engine Test Suite

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

#### Realistic Assignment-Style C Engine Tests

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
- runs the Rust C engine in isolation
- checks expected score ranges for curated assignment cases

Optional output:

```powershell
cd engine/c-engine
python scripts/run_c_engine_assignment_tests.py --check --summary-json target/assignment-summary.json
```

#### Synthetic C Benchmark

From the repository root:

```powershell
python scripts/run_c_engine_benchmark.py --check
```

What this does:

- loads labeled benchmark pairs from the extracted dataset
- resolves all manifest paths relative to the dataset root
- treats submission and template zip archives as first-class benchmark inputs
- safely extracts archives to temporary working space
- invokes the existing Rust C engine through the engine-side adapter
- computes metrics and threshold sweeps
- writes outputs to `engine/c-engine/test-data/output/benchmark/`

Generated outputs:

- `engine/c-engine/test-data/output/benchmark/summary.json`
- `engine/c-engine/test-data/output/benchmark/summary.txt`
- `engine/c-engine/test-data/output/benchmark/threshold_sweep.csv`
- `engine/c-engine/test-data/output/benchmark/per_assignment.json`
- `engine/c-engine/test-data/output/benchmark/confusion_matrix.json`
- `engine/c-engine/test-data/output/benchmark/pair_results.json`
- `engine/c-engine/test-data/output/benchmark/threshold_sweep.svg`
- `engine/c-engine/test-data/output/benchmark/score_distribution.svg`
- `engine/c-engine/test-data/output/benchmark/per_assignment_metrics.svg`

The benchmark console output also prints a `Results saved to:` block with the full paths of the generated files.

### Backend Prototype

The backend now contains an actual Express application with API routes, PostgreSQL access, upload handling, assignment/template storage, and a prototype analysis path.

From the repository root:

```powershell
cd backend
node app.js
```

What this starts:

- an Express server on `http://localhost:3000`
- API routes mounted under `/api`
- a static mock page from `backend/public/index.html`

Important backend notes:

- the backend depends on PostgreSQL through `backend/src/database/db.js`
- it looks for `DB_USER`, `DB_HOST`, and `DB_PORT`, with local defaults
- its analysis service currently shells out to `backend/src/services/engine.exe`
- its current comparison path is still partial and is not the same verified path as the Rust source-tree test harness

### Java Processor Prototype

The repo now also contains:

- `engine/java_processor/`

That is a separate Rust crate for Java-processing work. It exists in the repo and documents a multi-part Java pipeline, but it is not yet integrated into the backend or the benchmark/test harnesses described above.

## What The Engines Accept

There are now two different comparison-related paths in the repo.

### Rust C Engine Source Of Truth

The Rust C engine itself does **not** take zip archives directly.

Direct engine input:

- `rank` and `compare`
  - JSON request files containing source text, submission ids, parameters, and optional template data
- `concat`
  - JSON request files containing file paths plus raw source text

Zip uploads for this path are handled by the Python adapter layer in:

- `engine/c-engine/scripts/run_c_engine_assignment_tests.py`

That adapter:

1. accepts a file upload or zip archive as test input
2. extracts zip archives safely
3. collects `.c` and `.h` files
4. calls `ccpp concat`
5. builds the final `ccpp compare` request

### Backend Prototype Path

The backend accepts `.zip` files at the service layer for:

- assignment uploads
- template uploads
- student submissions

Relevant files:

- `backend/src/services/assignmentService.js`
- `backend/src/services/zipExtractorService.js`
- `backend/src/services/analysisService.js`

Current backend engine-path behavior:

- uploaded zip files are stored under `backend/AssignmentRepository/`
- archives are read in memory with `adm-zip`
- extracted file contents are concatenated in JavaScript
- the backend shells out to a checked-in `engine.exe`

This means the backend prototype does have upload handling now, but it is still a different execution path from the Rust source-tree harness and benchmark runner.

## Top-Level Directory Guide

### Source Of Truth Areas

- `engine/c-engine/`
  - Rust C/C++ similarity engine
  - schemas, examples, assignment fixtures, integration tests, and engine-only evaluation support
- `engine/java_processor/`
  - separate Rust Java processor prototype
  - currently not integrated into the shared benchmark or backend flow
- `backend/`
  - Node/Express backend prototype
  - routes, controllers, services, PostgreSQL access, zip upload storage, and a bundled `engine.exe`
- `frontend/`
  - frontend source prototype
  - still missing a clean committed runtime/package setup

### Evaluation And Benchmarking

- `engine/c-engine/test-data/`
  - C-engine-local home for fixture data, assignment-style cases, benchmark datasets, and generated benchmark output
- `engine/c-engine/test-data/benchmarks/synthetic_c_dataset/`
  - synthetic C benchmark dataset used by the runner
- `engine/c-engine/test-data/output/benchmark/`
  - generated benchmark metrics, JSON summaries, CSV sweeps, and SVG graphs
- `scripts/run_c_engine_benchmark.py`
  - easiest entry point for the C benchmark runner
- `docs/c_engine_benchmarking.md`
  - focused benchmark notes and output details

### Engine Testing Data

- `engine/c-engine/test-data/assignment-tests/`
  - curated assignment-style C fixtures for realistic upload-path testing
- `engine/c-engine/test-data/c/`
  - small C fixture programs for normalization, template subtraction, and parser behavior
- `engine/c-engine/test-data/cpp/`
  - small fixture programs for normalization, template subtraction, and parser behavior

## Key Files And What They Tell You

If you are new to the repo, these are the fastest files to read:

- `README.md`
  - the overall project, current repo state, main runnable paths, and directory layout
- `backend/app.js`
  - backend server entry point
- `backend/src/routes.js`
  - the current API surface area
- `backend/src/services/analysisService.js`
  - how the backend currently invokes the bundled comparison engine
- `backend/src/services/zipExtractorService.js`
  - how the backend currently reads uploaded zip archives
- `backend/src/database/db.js`
  - backend database connection expectations
- `docs/c_engine_benchmarking.md`
  - how the synthetic C benchmark works and what its outputs mean
- `engine/c-engine/docs/C_ENGINE_TESTING.md`
  - how the assignment-style C-engine test harness works
- `engine/c-engine/schemas/analysis-request.schema.json`
  - the Rust C-engine request contract
- `engine/c-engine/schemas/analysis-result.schema.json`
  - the Rust C-engine output contract
- `engine/c-engine/examples/req.rank.json`
  - example input for ranking
- `engine/c-engine/examples/req.compare.json`
  - example input for pairwise comparison
- `engine/java_processor/4p02_java_src/main.rs`
  - the current Java processor prototype entry point
- `engine/c-engine/test-data/benchmarks/synthetic_c_dataset/benchmark_pairs.json`
  - the source of truth for labeled benchmark comparisons
- `engine/c-engine/test-data/benchmarks/synthetic_c_dataset/submissions_manifest.json`
  - metadata for the benchmark submissions
- `engine/c-engine/test-data/benchmarks/synthetic_c_dataset/schema/benchmark_pair.schema.json`
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
- synthetic C benchmark runner coverage

The easiest command to run all of that is:

```powershell
cd engine/c-engine
cargo test
```

What was revalidated in this pass:

- `cargo test`
- `python engine/c-engine/scripts/run_c_engine_assignment_tests.py --check`
- `python scripts/run_c_engine_benchmark.py --check`

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
- threshold sweeps on the synthetic C dataset
- provisional review-threshold candidates

Benchmark claims that are **not** supportable yet:

- real-world field validity
- historical-course validity
- deployment-ready accuracy claims
- automatic guilt thresholds

## Practical Environment Notes

What the repo clearly supports right now:

- Rust for the C engine
- Python 3 for the test and benchmark harnesses
- Node.js for the backend prototype
- PostgreSQL-backed backend development when local database settings are available

What the repo does **not** currently provide as a clean committed setup:

- automated backend tests
- automated frontend tests beyond the small React utility test file already present
- a committed frontend package manifest or lockfile
- one unified root-level build/run workflow for all subsystems

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

- a concrete Rust C/C++ engine implementation
- a separate Java processor prototype
- a backend prototype with routes, storage layout, and zip upload handling
- a frontend prototype
- benchmark and test harnesses around the Rust C engine

The biggest remaining gaps are:

- one cohesive end-to-end flow across frontend, backend, and engines
- production-grade async analysis orchestration
- unified Java integration
- stronger backend validation and automated tests
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
