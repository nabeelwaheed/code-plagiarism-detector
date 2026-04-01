#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUB_DIR="$ROOT_DIR/submissions"

pass_count=0
fail_count=0

rough_loc() {
  local dir="$1"
  if [[ ! -d "$dir/src" ]]; then
    echo 0
    return
  fi

  find "$dir/src" -type f -name '*.c' -print0 \
    | xargs -0 grep -hEv '^[[:space:]]*$|^[[:space:]]*//|^[[:space:]]*/\*|^[[:space:]]*\*|^[[:space:]]*\*/' \
    | wc -l
}

echo "Running build checks for TestSet16 submissions"
echo

for submission in "$SUB_DIR"/submission_*; do
  [[ -d "$submission" ]] || continue
  name="$(basename "$submission")"
  log_file="$submission/build_check.log"
  loc="$(rough_loc "$submission" | tr -d ' ')"

  echo "==> $name"
  echo "    rough_code_loc: $loc"

  make -C "$submission" clean >/dev/null 2>&1 || true

  if make -C "$submission" >"$log_file" 2>&1; then
    echo "    build: PASS"
    pass_count=$((pass_count + 1))
  else
    echo "    build: FAIL"
    echo "    ---- compiler output ----"
    sed -n '1,120p' "$log_file"
    echo "    -------------------------"
    fail_count=$((fail_count + 1))
  fi

  rm -f "$log_file"
  echo

done

echo "Summary: PASS=$pass_count FAIL=$fail_count"

if [[ "$fail_count" -gt 0 ]]; then
  exit 1
fi

exit 0
