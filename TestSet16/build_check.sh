#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUB_DIR="$ROOT_DIR/submissions"
BUILD_DIR="$ROOT_DIR/dist/_build_check"

pass_count=0
fail_count=0

mkdir -p "$BUILD_DIR"
rm -f "$BUILD_DIR"/*.bin "$BUILD_DIR"/*.log 2>/dev/null || true

rough_loc() {
  local folder="$1"
  local lang="$2"
  local pattern

  if [[ "$lang" == "C" ]]; then
    pattern='*.c'
  else
    pattern='*.cpp'
  fi

  find "$folder" -maxdepth 1 -type f -name "$pattern" -print0 \
    | xargs -0 grep -hEv '^[[:space:]]*$|^[[:space:]]*//|^[[:space:]]*/\*|^[[:space:]]*\*|^[[:space:]]*\*/' \
    | wc -l
}

has_only_allowed_files() {
  local folder="$1"
  local lang="$2"
  local bad=0

  for file in "$folder"/*; do
    [[ -e "$file" ]] || continue
    if [[ -d "$file" ]]; then
      bad=1
      echo "    invalid: nested directory found -> $(basename "$file")"
      continue
    fi

    local base
    base="$(basename "$file")"

    if [[ "$base" == "METADATA.txt" ]]; then
      continue
    fi

    if [[ "$lang" == "C" ]]; then
      case "$base" in
        *.c|*.h) ;;
        *)
          bad=1
          echo "    invalid: disallowed file in C submission -> $base"
          ;;
      esac
    else
      case "$base" in
        *.cpp|*.hpp|*.h) ;;
        *)
          bad=1
          echo "    invalid: disallowed file in C++ submission -> $base"
          ;;
      esac
    fi
  done

  return $bad
}

compile_submission() {
  local folder="$1"
  local name="$2"
  local lang="$3"
  local bin="$BUILD_DIR/${name}.bin"
  local log="$BUILD_DIR/${name}.log"
  local loc

  echo "==> $name [$lang]"

  if ! has_only_allowed_files "$folder" "$lang"; then
    echo "    build: FAIL (structure/extension check)"
    fail_count=$((fail_count + 1))
    echo
    return
  fi

  loc="$(rough_loc "$folder" "$lang" | tr -d ' ')"
  echo "    rough_code_loc: $loc"
  if [[ "$loc" -lt 100 ]]; then
    echo "    build: FAIL (LOC below 100)"
    fail_count=$((fail_count + 1))
    echo
    return
  fi

  if [[ "$lang" == "C" ]]; then
    if ! compgen -G "$folder/*.c" >/dev/null; then
      echo "    build: FAIL (no .c files)"
      fail_count=$((fail_count + 1))
      echo
      return
    fi
    if gcc -std=c11 -Wall -Wextra "$folder"/*.c -o "$bin" >"$log" 2>&1; then
      echo "    build: PASS"
      pass_count=$((pass_count + 1))
    else
      echo "    build: FAIL"
      sed -n '1,120p' "$log"
      fail_count=$((fail_count + 1))
    fi
  else
    if ! compgen -G "$folder/*.cpp" >/dev/null; then
      echo "    build: FAIL (no .cpp files)"
      fail_count=$((fail_count + 1))
      echo
      return
    fi
    if g++ -std=c++17 -Wall -Wextra "$folder"/*.cpp -o "$bin" >"$log" 2>&1; then
      echo "    build: PASS"
      pass_count=$((pass_count + 1))
    else
      echo "    build: FAIL"
      sed -n '1,120p' "$log"
      fail_count=$((fail_count + 1))
    fi
  fi

  rm -f "$log" "$bin"
  echo
}

echo "Running mixed-language build checks for TestSet16"
echo

for folder in "$SUB_DIR"/c_submission_*; do
  [[ -d "$folder" ]] || continue
  compile_submission "$folder" "$(basename "$folder")" "C"
done

for folder in "$SUB_DIR"/cpp_submission_*; do
  [[ -d "$folder" ]] || continue
  compile_submission "$folder" "$(basename "$folder")" "C++"
done

echo "Summary: PASS=$pass_count FAIL=$fail_count"

if [[ "$fail_count" -gt 0 ]]; then
  exit 1
fi

exit 0
