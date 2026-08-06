#!/usr/bin/env python3
"""Assemble the PACWATCH student zip.

Copies only what students need, injects the burner API key from the environment,
and refuses to produce a zip that is too big or that contains instructor
material.

Usage:  PACWATCH_API_KEY=sk-... python3 tools/build_zip.py
"""
import os
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
STAGE = DIST / "pacwatch"
ZIP_PATH = DIST / "pacwatch.zip"

# Everything the students get, and nothing else.
PAYLOAD_FILES = ["START-HERE.html", "index.html", "README.md", "AGENTS.md"]
PAYLOAD_DIRS = ["css", "js", "data", "vendor", "docs"]

# Never ship these, whatever else changes.
FORBIDDEN = ["instructor", "tools", "tests", ".git", "superpowers", "dist", ".verify"]

MAX_UNZIPPED = 1_048_576      # 1 MB
MAX_ZIPPED = 400_000


def fail(message):
    print(f"BUILD FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)


def build_config(api_key):
    """config.example.js with the key filled in."""
    source = (ROOT / "config.example.js").read_text()
    marker = 'apiKey: "",'
    if marker not in source:
        fail("config.example.js no longer contains the apiKey placeholder")
    return source.replace(marker, f'apiKey: "{api_key}",', 1)


def stage_payload(api_key):
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)

    for name in PAYLOAD_FILES:
        source = ROOT / name
        if not source.exists():
            fail(f"missing required file: {name}")
        shutil.copy2(source, STAGE / name)

    for name in PAYLOAD_DIRS:
        source = ROOT / name
        if not source.is_dir():
            fail(f"missing required directory: {name}/")
        shutil.copytree(source, STAGE / name,
                        ignore=shutil.ignore_patterns(
                            "superpowers", ".DS_Store", "__pycache__", "*.pyc"))

    (STAGE / "config.js").write_text(build_config(api_key))


def check_no_leaks():
    """Nothing instructor-side may reach the students."""
    for path in STAGE.rglob("*"):
        relative = path.relative_to(STAGE).as_posix()
        for banned in FORBIDDEN:
            if relative == banned or relative.startswith(banned + "/"):
                fail(f"{relative} would ship to students")

    # The answer key must not appear anywhere in the payload, including as text
    # accidentally pasted into a doc.
    for path in STAGE.rglob("*"):
        if path.suffix not in (".js", ".md", ".html", ".css"):
            continue
        text = path.read_text(errors="ignore")
        for phrase in ("ANSWER-KEY", "RUN-OF-SHOW", "DEMO-SCRIPT"):
            if phrase in text:
                fail(f"{path.relative_to(STAGE)} references {phrase}")


def report_sizes():
    by_dir = {}
    total = 0
    for path in STAGE.rglob("*"):
        if path.is_file():
            size = path.stat().st_size
            total += size
            key = path.relative_to(STAGE).parts[0] if len(
                path.relative_to(STAGE).parts) > 1 else "(root)"
            by_dir[key] = by_dir.get(key, 0) + size

    print("Unzipped payload:")
    for key, size in sorted(by_dir.items(), key=lambda kv: -kv[1]):
        print(f"  {key:<14} {size / 1024:8.1f} KB")
    print(f"  {'TOTAL':<14} {total / 1024:8.1f} KB")
    return total


def main():
    api_key = os.environ.get("PACWATCH_API_KEY", "").strip()
    if not api_key:
        fail("PACWATCH_API_KEY is not set.\n"
             "  Refusing to build a zip whose chat panel cannot work.\n"
             "  Run: PACWATCH_API_KEY=sk-... python3 tools/build_zip.py")

    stage_payload(api_key)
    check_no_leaks()
    total = report_sizes()

    if total > MAX_UNZIPPED:
        fail(f"payload is {total} bytes, over the {MAX_UNZIPPED} byte budget")

    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(STAGE.rglob("*")):
            if path.is_file():
                archive.write(path, Path("pacwatch") / path.relative_to(STAGE))

    zipped = ZIP_PATH.stat().st_size
    print(f"\nWrote {ZIP_PATH.relative_to(ROOT)}  {zipped / 1024:.1f} KB")
    if zipped > MAX_ZIPPED:
        fail(f"zip is {zipped} bytes, over the {MAX_ZIPPED} byte budget")

    print("Ready for the USB sticks.")


if __name__ == "__main__":
    main()
