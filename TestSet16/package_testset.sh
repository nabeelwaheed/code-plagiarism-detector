#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUB_DIR="$ROOT_DIR/submissions"
BOILER_DIR="$ROOT_DIR/boilerplate"
DIST_DIR="$ROOT_DIR/dist"
SUB_ZIP_DIR="$DIST_DIR/submission_zips"
BOILER_ZIP_DIR="$DIST_DIR/boilerplate_zips"

EXCLUDES=(
  '*.o'
  '*.obj'
  '*.exe'
  '*.out'
  '*.log'
  '.DS_Store'
  '__pycache__/*'
  '*.pyc'
)

mkdir -p "$DIST_DIR"
rm -rf "$SUB_ZIP_DIR" "$BOILER_ZIP_DIR"
mkdir -p "$SUB_ZIP_DIR" "$BOILER_ZIP_DIR"

zip_submission() {
  local path="$1"
  local folder_name
  local label
  local output_zip
  folder_name="$(basename "$path")"
  label="$(awk -F': ' '/^submission_label:/ {print $2}' "$path/METADATA.txt")"
  [[ -n "$label" ]] || label="$folder_name"

  output_zip="$SUB_ZIP_DIR/${label}.zip"

  (
    cd "$SUB_DIR"
    zip -rq "$output_zip" "$folder_name" -x "${EXCLUDES[@]}"
  )

  echo "Created $output_zip"
}

zip_boilerplate() {
  local path="$1"
  local folder_name
  local output_zip
  folder_name="$(basename "$path")"
  output_zip="$BOILER_ZIP_DIR/${folder_name}.zip"

  (
    cd "$BOILER_DIR"
    zip -rq "$output_zip" "$folder_name" -x "${EXCLUDES[@]}"
  )

  echo "Created $output_zip"
}

echo "Packaging submission zips..."
for submission in "$SUB_DIR"/submission_*; do
  [[ -d "$submission" ]] || continue
  zip_submission "$submission"
done

echo
echo "Packaging top-level TestSet16.zip..."
rm -f "$DIST_DIR/TestSet16.zip"
(
  cd "$SUB_ZIP_DIR"
  zip -rq "$DIST_DIR/TestSet16.zip" . -i '*.zip'
)
echo "Created $DIST_DIR/TestSet16.zip"

echo
echo "Packaging boilerplate zips..."
for boiler in "$BOILER_DIR"/boilerplate_*; do
  [[ -d "$boiler" ]] || continue
  zip_boilerplate "$boiler"
done

echo
echo "Packaging top-level BoilerplateSet16.zip..."
rm -f "$DIST_DIR/BoilerplateSet16.zip"
(
  cd "$BOILER_ZIP_DIR"
  zip -rq "$DIST_DIR/BoilerplateSet16.zip" . -i '*.zip'
)
echo "Created $DIST_DIR/BoilerplateSet16.zip"

echo
echo "Packaging complete."
