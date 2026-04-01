# TestSet16 - COSC 4P02 Group 16 Stage 3 C Test Repository

This repository is a Stage 3 submission test set in designated language **C**.
It is structured so each student submission can be zipped independently, and then
packaged into a top-level `TestSet16.zip` as a zip-of-zips.

## Layout

- `submissions/` - 12 student-style submission folders (`submission_01` to `submission_12`)
- `boilerplate/` - reusable instructor starter packages for template subtraction tests
- `MANIFEST.md` - relationship mapping, compile commands, and rough LOC table
- `build_check.sh` - build and LOC sanity script for all submissions
- `package_testset.sh` - creates per-submission zips and top-level deliverable zips
- `dist/` - generated packaging artifacts

## Build Verification

From `TestSet16/`:

```bash
bash build_check.sh
```

The script will:
- compile each submission with its own `Makefile`
- print pass/fail per submission
- report rough code-only LOC per submission (from `.c` files)
- return non-zero if any build fails

## Packaging

From `TestSet16/`:

```bash
bash package_testset.sh
```

Generated artifacts:
- `dist/TestSet16.zip` - zip containing per-submission zip files
- `dist/BoilerplateSet16.zip` - zip containing boilerplate package zip files
- `dist/submission_zips/*.zip` - individual submission archives
- `dist/boilerplate_zips/*.zip` - individual boilerplate archives

## Notes

- All projects are intended to compile with standard GCC on Linux using C11.
- No external libraries beyond the standard C library are required.
- Metadata uses placeholders only; no personal information or encryption logic is included.
