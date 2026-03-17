# C Engine Repo Analysis

## Feasibility

Yes, the repository can support generating C-engine tests now, but only at the engine layer and only after adding a small upload-to-engine harness.

## Already Present

- A callable Rust CLI engine in `engine/c-engine` with `ccpp rank`, `ccpp compare`, and `ccpp concat`.
- Token-based similarity for C and C++ using tree-sitter tokenization, normalization, k-grams, winnowing, and GST-style evidence spans.
- Template subtraction support in the engine request and scoring path.
- JSON schemas and example request/response payloads.
- Existing automated Rust integration tests for CLI behavior, schema validation, normalization, template subtraction, evidence spans, and determinism.

## Missing Before This Support Layer

- No archive ingestion for student uploads.
- No direct interface that starts from a student-style single-file upload or zip archive.
- No assignment-organized realistic fixture corpus for C submissions.
- No manifest format describing expected qualitative similarity between realistic submission variants.
- No Java engine implementation, despite the SRS minimum-language requirement.
- No backend job queue, repository selection, persistence, or async job status path in the codebase.

## Grounded Conclusions

- The current repo is strong enough for engine-only C testing because the core comparison pipeline already exists and produces scores plus evidence spans.
- The current repo is not complete enough to test the full Brock project flow end to end, because upload handling, job orchestration, persistence, and repository management are not implemented here.
- Zip handling had to be added in the test harness rather than the engine itself because the engine currently consumes JSON requests containing concatenated source and optional source maps, not raw uploads.
- Current template-subtraction behavior is testable, but the new realistic fixtures show that some template-heavy cases still keep a high primary score, so the harness is best used to characterize current behavior rather than prove production-grade accuracy.

## Assumptions Used

- The engine-only harness is allowed to act as the preprocessing layer that turns uploads into the engine's existing JSON request format.
- For C assignment fixtures, `.c` and `.h` files are the relevant source artifacts.
- Archive validation for zip-slip and unsafe archive paths belongs in this harness because no other upload-preprocessing layer exists in this repo.
