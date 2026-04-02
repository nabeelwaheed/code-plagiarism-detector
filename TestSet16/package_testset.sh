#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUB_DIR="$ROOT_DIR/submissions"
BOILER_DIR="$ROOT_DIR/boilerplate"
DIST_DIR="$ROOT_DIR/dist"
SUB_ZIP_DIR="$DIST_DIR/submission_zips"
BOILER_ZIP_DIR="$DIST_DIR/boilerplate_zips"

mkdir -p "$DIST_DIR"
rm -rf "$SUB_ZIP_DIR" "$BOILER_ZIP_DIR"
mkdir -p "$SUB_ZIP_DIR" "$BOILER_ZIP_DIR"

JUNK_EXCLUDES=(
  '.DS_Store'
  '__pycache__/*'
  '*.o'
  '*.obj'
  '*.exe'
  '*.out'
  '*.log'
  '*.tmp'
  '*.swp'
)

zip_submission() {
  local submission="$1"
  local label
  local out

  label="$(awk -F': ' '/^submission_label:/ {print $2}' "$submission/METADATA.txt")"
  [[ -n "$label" ]] || label="$(basename "$submission")"
  out="$SUB_ZIP_DIR/${label}.zip"

  (
    cd "$submission"
    zip -rq "$out" . \
      -i '*.c' '*.h' '*.cpp' '*.hpp' 'METADATA.txt' \
      -x "${JUNK_EXCLUDES[@]}"
  )

  echo "Created $out"
}

zip_boilerplate() {
  local folder="$1"
  local name
  local out

  name="$(basename "$folder")"
  out="$BOILER_ZIP_DIR/${name}.zip"

  (
    cd "$BOILER_DIR"
    zip -rq "$out" "$name" -x "${JUNK_EXCLUDES[@]}"
  )

  echo "Created $out"
}

echo "Packaging student submissions..."
for submission in "$SUB_DIR"/c_submission_* "$SUB_DIR"/cpp_submission_*; do
  [[ -d "$submission" ]] || continue
  zip_submission "$submission"
done

echo
rm -f "$DIST_DIR/TestSet16.zip"
(
  cd "$SUB_ZIP_DIR"
  zip -rq "$DIST_DIR/TestSet16.zip" . -i '*.zip'
)
echo "Created $DIST_DIR/TestSet16.zip"

echo
echo "Packaging boilerplate artifacts..."
for b in "$BOILER_DIR"/boilerplate_*; do
  [[ -d "$b" ]] || continue
  zip_boilerplate "$b"
done

echo
rm -f "$DIST_DIR/BoilerplateSet16.zip"
(
  cd "$BOILER_ZIP_DIR"
  zip -rq "$DIST_DIR/BoilerplateSet16.zip" . -i '*.zip'
)
echo "Created $DIST_DIR/BoilerplateSet16.zip"

echo
echo "Packaging complete."
