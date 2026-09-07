"""Validate and create a deterministic candidate ZIP without modifying source files."""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path, help="New ZIP outside the repository; existing files are never replaced.")
    parser.add_argument("--engines", default="chromium,firefox,webkit", help="Smoke engines; partial coverage remains a release gate.")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    checksum = output.with_suffix(output.suffix + ".sha256")
    if output == root or root in output.parents or output.exists() or checksum.exists() or output.suffix.lower() != ".zip":
        parser.error("Choose a new .zip outside the source repository.")
    engines = set(args.engines.split(","))
    if not engines or not engines <= {"chromium", "firefox", "webkit"}:
        parser.error("Unknown or empty browser engine selection.")
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", HASSENGER_ENGINES=args.engines)
    with tempfile.TemporaryDirectory(prefix="hassenger-validation-") as temporary:
        env["HASSENGER_SCREENSHOT_DIR"] = temporary
        def run(command: list[str]) -> None:
            print("Validating:", " ".join(command), flush=True)
            subprocess.run(command, cwd=root, env=env, check=True, timeout=300)
        for test in sorted((root / "tests").glob("test-*.py")):
            run([sys.executable, str(test), str(root)])
        for test in sorted((root / "tests").glob("test-*-browser.js")):
            run(["node", str(test), "dist/hassenger-card.js"])
        run(["node", "tests/cross-browser-smoke.js", "dist/hassenger-card.js"])
        # Repeat the allowlist after tests to reject accidental generated source content.
        run([sys.executable, "tests/test-release-layout.py"])
    output.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(path for path in root.rglob("*") if path.is_file())
    expected = {path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            entry = zipfile.ZipInfo(path.relative_to(root).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, path.read_bytes())
    with zipfile.ZipFile(output) as archive:
        actual = {entry.filename: hashlib.sha256(archive.read(entry)).hexdigest() for entry in archive.infolist()}
        if actual != expected or archive.testzip() is not None:
            raise RuntimeError("Archive verification failed; do not distribute the output.")
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    with checksum.open("x", encoding="utf-8") as stream:
        stream.write(digest + "  " + output.name + "\n")
    print(f"Verified {len(files)} files: {output}\nSHA-256: {digest}")
    print("Candidate only: live Home Assistant, real devices and repository validation remain separate gates.")
    if engines != {"chromium", "firefox", "webkit"}:
        print("Not all browser engines were tested:", ", ".join(sorted(engines)))


if __name__ == "__main__":
    main()
