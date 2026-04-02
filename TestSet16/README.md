# TestSet16 - COSC 4P02 Stage 3 Mixed-Language Submission Set

This repository is a Stage 3 test repository with a zip-of-zips submission format.
It contains 20 student-style submissions:

- 10 C submissions (`c_submission_01` to `c_submission_10`)
- 10 C++ submissions (`cpp_submission_01` to `cpp_submission_10`)

## Student Submission Format Rules (Applied)

Each submission folder is flattened and contains only:

- source files (`.c/.h` for C, `.cpp/.hpp/.h` for C++)
- `METADATA.txt`

Student folders do not contain `src/`, `include/`, `build/`, Makefiles, binaries, object files, logs, or extra docs.

## Repository Layout

- `submissions/` - 20 flattened student submission folders
- `boilerplate/` - separate boilerplate packages for template subtraction testing
- `MANIFEST.md` - relationship mapping, language split, LOC, and compile commands
- `build_check.sh` - compiles all submissions and enforces structure/extension/LOC checks
- `package_testset.sh` - creates per-submission zips and top-level `dist/TestSet16.zip`
- `dist/` - packaging outputs

## Validate Build and Structure

Run from `TestSet16/`:

```bash
bash build_check.sh
```

`build_check.sh` checks:
- folder flattening (no nested directories in submissions)
- allowed file extensions by language
- per-submission LOC floor (`>= 100` code lines in `.c` or `.cpp`)
- compilation with:
  - C: `gcc -std=c11 -Wall -Wextra`
  - C++: `g++ -std=c++17 -Wall -Wextra`

## Package for Submission

Run from `TestSet16/`:

```bash
bash package_testset.sh
```

Outputs:
- `dist/submission_zips/*.zip` (20 submission zip files)
- `dist/TestSet16.zip` (zip containing only submission zip files)
- `dist/BoilerplateSet16.zip` (separate boilerplate artifact)

## Notes

- Metadata uses placeholder assignment key and labels only.
- No malicious payloads or crash-oriented test content are included.
- Programs are student-style and compile with standard Linux toolchains.
