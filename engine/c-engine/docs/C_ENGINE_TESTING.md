# C Engine Testing Design

## Scope

This design tests only the Rust C comparison engine portion of the project. The repo now includes backend upload and extraction code plus a separate Java processor prototype, but this harness does not validate those paths end to end. It does not test the web UI, backend storage, async job status, or repository persistence path from the SRS.

## Engine Input Format

The engine CLI accepts JSON requests, not uploads directly.

- `ccpp concat` input: a JSON object with `files`, where each file has `file_path` and `source`.
- `ccpp compare` input: a JSON object with `schema_version`, `engine_version`, `language`, `submissions`, optional `template`, and `params`.
- Each submission passed to `compare` contains `submission_id`, `source`, and optional `source_map`.

## Engine Output Format

The engine returns JSON containing:

- `schema_version`
- `engine_version`
- `language`
- `params_used`
- `pairs`

Each `pairs` entry includes:

- `a_id`
- `b_id`
- `score_primary`
- `score_secondary`
- `matches`

Each match contains `a` and `b` spans with byte, line, column, and optional file path details.

## Harness Design

The harness starts from realistic upload-like artifacts:

- single-file submissions
- zip archive submissions
- zip archive templates

The harness then:

1. materializes the upload artifact from fixture source trees
2. validates and extracts zip uploads safely
3. collects `.c` and `.h` files
4. calls `ccpp concat` to build `source` plus `source_map`
5. builds a `ccpp compare` request
6. executes the engine binary directly
7. evaluates observed scores against manifest expectations

This remains the authoritative evaluation path for the C engine because it targets the Rust source tree directly. The backend prototype currently shells out to a bundled `engine.exe` with a simpler request-building path.

## Fixture Layout

Assignment realism is preserved through fixture folders:

- `test-data/assignment-tests/Assignment1/test1`
- `test-data/assignment-tests/Assignment1/test2`
- `test-data/assignment-tests/Assignment2/test1`

Each case contains:

- `manifest.json`
- one or more submission source directories
- an optional template source directory

The harness generates zip uploads from those directories when the manifest marks the upload kind as `zip`.

## Manifest Format

Each case manifest describes:

- `assignment`
- `case_id`
- `description`
- `language`
- `mode`
- `params`
- `submissions`
- optional `template`
- `expected`

Each submission or template entry declares:

- `upload_kind`
- `source_dir`
- submission `id` for submissions

Supported upload kinds:

- `single_file`
- `zip`
- `unsafe_zip`

## Realism Policy

The fixture source trees are written to resemble actual student submissions for the same assignment topic rather than arbitrary unrelated code. Similar cases preserve assignment semantics while changing naming, formatting, helper order, or file layout.

## Accuracy Evaluation

These tests can give the team an idea how accurate the current engine is by checking whether:

- clearly related submissions score high
- template-heavy comparisons change in a measurable way after subtraction
- unrelated assignment variants stay low enough
- evidence spans appear when expected
- unsafe archives are rejected before engine execution

The current fixture results should be interpreted carefully:

- some template-heavy cases still retain a relatively high primary score after subtraction
- the current harness thresholds therefore describe current engine behavior, not an ideal plagiarism-detection target
- these cases are still useful because they expose where subtraction and scoring appear stronger or weaker

These tests do not measure:

- production precision or recall on real historical submissions
- cross-offering repository behavior
- job queue correctness
- persistence and reporting behavior outside the engine
