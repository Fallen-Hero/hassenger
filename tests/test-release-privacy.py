"""Fail when a release tree contains common secret or workstation artifacts."""

from __future__ import annotations

import pathlib
import re
import sys


root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).parent)
text_suffixes = {".js", ".json", ".md", ".py", ".yaml", ".yml", ".txt"}
excluded_parts = {".git", "node_modules", "__pycache__"}
patterns = {
    "Windows user profile path": re.compile(r"[A-Za-z]:[\\/]Users[\\/][^\\/\s]+", re.I),
    "Unix home profile path": re.compile(r"/(?:home|Users)/[^/\s]+/"),
    "private key": re.compile(r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY"),
    "bearer credential": re.compile(r"Bearer\s+[A-Za-z0-9._~+/=-]{16,}", re.I),
    "long token assignment": re.compile(r"(?:access[_-]?token|api[_-]?key|secret)\s*[:=]\s*['\"][A-Za-z0-9._~+/=-]{16,}", re.I),
    "Home Assistant signed URL": re.compile(r"authSig=|token=[A-Za-z0-9._~-]{16,}", re.I),
}
failures = []
for path in root.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in text_suffixes or excluded_parts.intersection(path.parts):
        continue
    if path.resolve() == pathlib.Path(__file__).resolve():
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    for label, pattern in patterns.items():
        if match := pattern.search(text):
            failures.append(f"{path.relative_to(root)}: {label} near character {match.start()}")

if failures:
    raise SystemExit("Release privacy scan failed:\n" + "\n".join(failures))
print("Release privacy scan passed: no workstation paths, private keys, credentials, or signed URLs found.")
