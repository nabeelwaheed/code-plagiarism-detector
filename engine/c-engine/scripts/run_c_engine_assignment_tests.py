#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import stat
import subprocess
import sys
import uuid
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

# - assignment fixture harness
# - upload like preprocessing
# - compare mode verification
SCRIPT_DIR = Path(__file__).resolve().parent
PACKAGE_ROOT = SCRIPT_DIR.parent
DEFAULT_FIXTURES_ROOT = PACKAGE_ROOT / "test-data" / "assignment-tests"
CASE_TEMP_ROOT = PACKAGE_ROOT / "target" / "assignment-test-temp"
ALLOWED_SOURCE_SUFFIXES = {".c", ".h"}
DEFAULT_PARAMS = {
    "k_gram": 4,
    "window": 3,
    "gst_min_match": 4,
    "top_k": 1,
}


# - cli surface for local runs and cargo backed tests
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run realistic C-engine assignment fixtures from upload-like artifacts."
    )
    parser.add_argument(
        "--fixtures-root",
        type=Path,
        default=DEFAULT_FIXTURES_ROOT,
        help="Root directory containing Assignment*/test*/manifest.json cases.",
    )
    parser.add_argument(
        "--engine-binary",
        type=Path,
        default=None,
        help="Path to a built engine binary. If omitted, the harness falls back to cargo run.",
    )
    parser.add_argument(
        "--case",
        action="append",
        default=[],
        help="Optional case filter, for example Assignment1/test1. Repeat to run multiple cases.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero when any case fails its expected relation or expected error.",
    )
    parser.add_argument(
        "--summary-json",
        type=Path,
        default=None,
        help="Optional path to write a JSON summary.",
    )
    return parser.parse_args()


# - discover cases
# - run each case
# - emit summary and exit status
def main() -> int:
    args = parse_args()
    fixtures_root = resolve_fixtures_root(args.fixtures_root)
    engine_binary = resolve_engine_binary(args.engine_binary)
    manifests = discover_manifests(fixtures_root, args.case)
    if not manifests:
        print("no assignment manifests found", file=sys.stderr)
        return 2

    results = []
    failures = []
    for manifest_path in manifests:
        result = run_case(manifest_path, fixtures_root, engine_binary)
        results.append(result)
        print(format_result(result))
        if not result["passed"]:
            failures.append(result)

    if args.summary_json is not None:
        args.summary_json.parent.mkdir(parents=True, exist_ok=True)
        args.summary_json.write_text(json.dumps(results, indent=2), encoding="utf-8")

    if failures:
        print("", file=sys.stderr)
        print(f"{len(failures)} case(s) failed expectation.", file=sys.stderr)
        for failure in failures:
            print(
                f" - {failure['case']}: {failure['message']}",
                file=sys.stderr,
            )
        if args.check:
            return 1

    return 0


# - manifest discovery
# - optional case filtering
def discover_manifests(fixtures_root: Path, case_filters: list[str]) -> list[Path]:
    manifests = sorted(fixtures_root.rglob("manifest.json"))
    if not case_filters:
        return manifests

    normalized_filters = {normalize_case_filter(case_filter) for case_filter in case_filters}
    filtered = []
    for manifest in manifests:
        rel_case = normalize_case_filter(manifest.parent.relative_to(fixtures_root).as_posix())
        if rel_case in normalized_filters:
            filtered.append(manifest)
    return filtered


def normalize_case_filter(value: str) -> str:
    return value.replace("\\", "/").strip("/")


def resolve_fixtures_root(fixtures_root: Path) -> Path:
    candidate = fixtures_root.resolve()
    if candidate.is_dir():
        return candidate

    legacy = PACKAGE_ROOT / "assignment-tests"
    if candidate == DEFAULT_FIXTURES_ROOT.resolve() and legacy.is_dir():
        return legacy.resolve()

    return candidate


# - prefer built binary
# - fallback to cargo run
def resolve_engine_binary(engine_binary: Path | None) -> Path | None:
    if engine_binary is not None:
        return engine_binary.resolve()

    for candidate in (
        PACKAGE_ROOT / "target" / "debug" / "engine.exe",
        PACKAGE_ROOT / "target" / "debug" / "engine",
    ):
        if candidate.is_file():
            return candidate.resolve()

    return None


# - one manifest in
# - observed result out
def run_case(manifest_path: Path, fixtures_root: Path, engine_binary: Path | None) -> dict[str, Any]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    case_dir = manifest_path.parent
    case_name = case_dir.relative_to(fixtures_root).as_posix()
    expected = manifest["expected"]

    try:
        observed = execute_case(manifest, case_dir, engine_binary)
        if expected["kind"] != "success":
            return {
                "case": case_name,
                "description": manifest.get("description", ""),
                "passed": False,
                "message": "case succeeded but manifest expected an error",
                "observed": observed,
                "expected": expected,
            }

        passed, message = evaluate_success(expected, observed)
        return {
            "case": case_name,
            "description": manifest.get("description", ""),
            "passed": passed,
            "message": message,
            "observed": observed,
            "expected": expected,
        }
    except Exception as exc:  # noqa: BLE001
        message = str(exc)
        if expected["kind"] == "error":
            passed = expected["message_contains"].lower() in message.lower()
            return {
                "case": case_name,
                "description": manifest.get("description", ""),
                "passed": passed,
                "message": "expected preprocessing error matched" if passed else message,
                "observed": {"error": message},
                "expected": expected,
            }

        return {
            "case": case_name,
            "description": manifest.get("description", ""),
            "passed": False,
            "message": message,
            "observed": {"error": message},
            "expected": expected,
        }


# - upload like inputs
# - concat into engine request
# - compare current pair
def execute_case(manifest: dict[str, Any], case_dir: Path, engine_binary: Path | None) -> dict[str, Any]:
    language = manifest.get("language", "c")
    mode = manifest.get("mode", "compare")
    if mode != "compare":
        raise ValueError(f"unsupported mode: {mode}")

    return compare_pair(
        case_dir=case_dir,
        language=language,
        submissions=manifest["submissions"],
        template_spec=manifest.get("template"),
        params=manifest.get("params"),
        engine_binary=engine_binary,
    )


def compare_pair(
    case_dir: Path,
    language: str,
    submissions: list[dict[str, Any]],
    template_spec: dict[str, Any] | None,
    params: dict[str, Any] | None,
    engine_binary: Path | None,
) -> dict[str, Any]:
    if language != "c":
        raise ValueError("this harness only supports language=c")
    if len(submissions) != 2:
        raise ValueError("compare mode currently requires exactly two submissions")

    effective_params = dict(DEFAULT_PARAMS)
    effective_params.update(params or {})

    CASE_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    temp_dir = CASE_TEMP_ROOT / f"c-engine-case-{uuid.uuid4().hex}"
    temp_dir.mkdir(parents=True, exist_ok=False)

    try:
        prepared_submissions = []
        for submission in submissions:
            prepared_submissions.append(
                prepare_payload(
                    case_dir=case_dir,
                    upload_spec=submission,
                    temp_dir=temp_dir,
                    engine_binary=engine_binary,
                    payload_name=submission["id"],
                )
            )

        request: dict[str, Any] = {
            "schema_version": "1.0",
            "engine_version": "fixture-harness",
            "language": language,
            "submissions": prepared_submissions,
            "params": effective_params,
        }

        if template_spec is not None:
            request["template"] = prepare_payload(
                case_dir=case_dir,
                upload_spec=template_spec,
                temp_dir=temp_dir,
                engine_binary=engine_binary,
                payload_name="template",
                include_submission_id=False,
            )

        request_path = temp_dir / "request.json"
        output_path = temp_dir / "output.json"
        request_path.write_text(json.dumps(request, indent=2), encoding="utf-8")

        run_engine(
            [
                "ccpp",
                "compare",
                "--input",
                str(request_path),
                "--a-id",
                submissions[0]["id"],
                "--b-id",
                submissions[1]["id"],
                "--output",
                str(output_path),
            ],
            engine_binary=engine_binary,
        )

        result = json.loads(output_path.read_text(encoding="utf-8"))
        pair = result["pairs"][0]
        return {
            "score_primary": pair["score_primary"],
            "score_secondary": pair["score_secondary"],
            "match_count": len(pair.get("matches", [])),
            "result": result,
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# - turn one upload spec
# - into engine compare payload
def prepare_payload(
    case_dir: Path,
    upload_spec: dict[str, Any],
    temp_dir: Path,
    engine_binary: Path | None,
    payload_name: str,
    include_submission_id: bool = True,
) -> dict[str, Any]:
    upload_path = materialize_upload(case_dir, upload_spec, temp_dir, payload_name)
    extracted_dir = ingest_upload(upload_path, temp_dir / f"{payload_name}_extracted")
    concat_result = concat_sources(extracted_dir, temp_dir, engine_binary, payload_name)

    payload: dict[str, Any] = {
        "source": concat_result["source"],
        "source_map": concat_result["source_map"],
    }
    if include_submission_id:
        payload["submission_id"] = upload_spec["id"]
    return payload


# - materialize fixture tree
# - as single file or zip upload
def materialize_upload(
    case_dir: Path,
    upload_spec: dict[str, Any],
    temp_dir: Path,
    payload_name: str,
) -> Path:
    source_path, path_kind = resolve_upload_path(case_dir, upload_spec)
    upload_kind = upload_spec["upload_kind"]

    if path_kind == "upload_file":
        if upload_kind == "unsafe_zip":
            raise ValueError("unsafe_zip is only valid for source_dir inputs")
        if not source_path.is_file():
            raise ValueError(f"missing upload file: {source_path}")
        if upload_kind == "single_file" and source_path.suffix.lower() not in ALLOWED_SOURCE_SUFFIXES:
            raise ValueError(f"single_file upload must point to a C source file: {source_path}")
        if upload_kind == "zip" and source_path.suffix.lower() != ".zip":
            raise ValueError(f"zip upload must point to a .zip file: {source_path}")

        target_path = temp_dir / f"{payload_name}{source_path.suffix.lower()}"
        shutil.copy2(source_path, target_path)
        return target_path

    if not source_path.is_dir():
        raise ValueError(f"missing source directory: {source_path}")

    source_files = collect_source_files(source_path)

    if upload_kind == "single_file":
        if len(source_files) != 1:
            raise ValueError(f"{payload_name} single_file upload requires exactly one source file")
        source_file = source_files[0]
        target_path = temp_dir / f"{payload_name}{source_file.suffix.lower()}"
        shutil.copy2(source_file, target_path)
        return target_path

    if upload_kind in {"zip", "unsafe_zip"}:
        target_path = temp_dir / f"{payload_name}.zip"
        with zipfile.ZipFile(target_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for index, source_file in enumerate(source_files):
                archive_name = source_file.relative_to(source_path).as_posix()
                if upload_kind == "unsafe_zip" and index == 0:
                    archive_name = upload_spec.get("unsafe_archive_path", f"../{source_file.name}")
                archive.write(source_file, archive_name)
        return target_path

    raise ValueError(f"unsupported upload_kind: {upload_kind}")


def resolve_upload_path(case_dir: Path, upload_spec: dict[str, Any]) -> tuple[Path, str]:
    relative_path = upload_spec.get("path", upload_spec.get("source_dir"))
    if relative_path is None:
        raise ValueError("upload spec must define path or source_dir")

    path_kind = upload_spec.get("path_kind", "source_dir")
    if path_kind not in {"source_dir", "upload_file"}:
        raise ValueError(f"unsupported path_kind: {path_kind}")

    return (case_dir / relative_path).resolve(), path_kind


# - only C and header sources
# - stable sort for deterministic concat
def collect_source_files(source_dir: Path) -> list[Path]:
    source_files = [
        path
        for path in sorted(source_dir.rglob("*"))
        if path.is_file() and path.suffix.lower() in ALLOWED_SOURCE_SUFFIXES
    ]
    if not source_files:
        raise ValueError(f"no C source files found under {source_dir}")
    return source_files


# - normalize upload input
# - single file copy or safe zip extract
def ingest_upload(upload_path: Path, extraction_dir: Path) -> Path:
    extraction_dir.mkdir(parents=True, exist_ok=True)
    if upload_path.suffix.lower() == ".zip":
        extract_zip_safely(upload_path, extraction_dir)
    else:
        shutil.copy2(upload_path, extraction_dir / upload_path.name)

    collected = collect_source_files(extraction_dir)
    if not collected:
        raise ValueError(f"upload did not produce any C sources: {upload_path}")
    return extraction_dir


# - reject zip slip
# - reject symlink members
def extract_zip_safely(zip_path: Path, extraction_dir: Path) -> None:
    with zipfile.ZipFile(zip_path) as archive:
        if not archive.infolist():
            raise ValueError(f"empty archive: {zip_path.name}")

        for member in archive.infolist():
            if is_unsafe_archive_member(member):
                raise ValueError(f"unsafe archive path: {member.filename}")
            if member.is_dir():
                continue

            relative_path = PurePosixPath(member.filename.replace("\\", "/"))
            target_path = extraction_dir / Path(*relative_path.parts)
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as src, target_path.open("wb") as dst:
                shutil.copyfileobj(src, dst)


# - archive member guard
# - keep extraction inside temp root
def is_unsafe_archive_member(member: zipfile.ZipInfo) -> bool:
    name = member.filename.replace("\\", "/")
    path = PurePosixPath(name)
    if not name:
        return True
    if name.startswith("/") or name.startswith("\\"):
        return True
    if path.parts and path.parts[0].endswith(":"):
        return True
    if any(part == ".." for part in path.parts):
        return True

    mode = (member.external_attr >> 16) & 0xFFFF
    if stat.S_ISLNK(mode):
        return True

    return False


# - reuse engine concat
# - preserve file_path map
def concat_sources(
    source_dir: Path,
    temp_dir: Path,
    engine_binary: Path | None,
    payload_name: str,
) -> dict[str, Any]:
    files = []
    for source_file in collect_source_files(source_dir):
        files.append(
            {
                "file_path": source_file.relative_to(source_dir).as_posix(),
                "source": source_file.read_text(encoding="utf-8"),
            }
        )

    request_path = temp_dir / f"{payload_name}_concat_request.json"
    output_path = temp_dir / f"{payload_name}_concat_output.json"
    request_path.write_text(json.dumps({"files": files}, indent=2), encoding="utf-8")

    run_engine(
        ["ccpp", "concat", "--input", str(request_path), "--output", str(output_path)],
        engine_binary=engine_binary,
    )

    return json.loads(output_path.read_text(encoding="utf-8"))


# - direct binary when available
# - cargo fallback for local dev
def run_engine(args: list[str], engine_binary: Path | None) -> None:
    if engine_binary is not None:
        cmd = [str(engine_binary), *args]
    else:
        cmd = ["cargo", "run", "--quiet", "--", *args]

    completed = subprocess.run(
        cmd,
        cwd=PACKAGE_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        stderr = completed.stderr.strip() or completed.stdout.strip()
        raise RuntimeError(f"engine command failed ({completed.returncode}): {stderr}")


# - threshold checks only
# - manifests own the expectation policy
def evaluate_success(expected: dict[str, Any], observed: dict[str, Any]) -> tuple[bool, str]:
    primary = observed["score_primary"]
    secondary = observed["score_secondary"]
    matches = observed["match_count"]

    if "score_primary_min" in expected and primary < expected["score_primary_min"]:
        return False, f"score_primary {primary:.3f} < {expected['score_primary_min']:.3f}"
    if "score_primary_max" in expected and primary > expected["score_primary_max"]:
        return False, f"score_primary {primary:.3f} > {expected['score_primary_max']:.3f}"
    if "score_secondary_min" in expected and secondary < expected["score_secondary_min"]:
        return False, f"score_secondary {secondary:.3f} < {expected['score_secondary_min']:.3f}"
    if "score_secondary_max" in expected and secondary > expected["score_secondary_max"]:
        return False, f"score_secondary {secondary:.3f} > {expected['score_secondary_max']:.3f}"
    if "match_count_min" in expected and matches < expected["match_count_min"]:
        return False, f"match_count {matches} < {expected['match_count_min']}"
    if "match_count_max" in expected and matches > expected["match_count_max"]:
        return False, f"match_count {matches} > {expected['match_count_max']}"
    return True, "scores within expected range"


# - compact human output
# - one line per case
def format_result(result: dict[str, Any]) -> str:
    prefix = "PASS" if result["passed"] else "FAIL"
    case = result["case"]
    description = result.get("description", "")
    observed = result["observed"]

    if "error" in observed:
        return f"[{prefix}] {case}: {description} -> {observed['error']}"

    return (
        f"[{prefix}] {case}: {description} -> "
        f"primary={observed['score_primary']:.3f} "
        f"secondary={observed['score_secondary']:.3f} "
        f"matches={observed['match_count']}"
    )


if __name__ == "__main__":
    sys.exit(main())
