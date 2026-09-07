"""Strict allowlist for repository and release-archive contents."""

from __future__ import annotations

import hashlib
import pathlib
import struct
import zlib


root = pathlib.Path(__file__).resolve().parent.parent
root_files = {
    "UPGRADING.md",
    "FEATURE_GUIDE.md",
    "IMPROVEMENT_PLAN.md",
    ".gitignore", "ARCHITECTURE.md", "CHANGELOG.md", "CONTRIBUTING.md",
    "FIRST_TIME_SETUP.md", "LICENSE", "README.md", "RELEASE_CHECKLIST.md",
    "ACCESSIBILITY.md", "SECURITY.md", "SUPPORT.md", "TESTING.md", "VALIDATION_REPORT.md", "hacs.json", "package.json",
}
component_files = {
    "__init__.py", "audio.py", "config_flow.py", "const.py", "manifest.json",
    "media_upload.py", "services.yaml", "store.py", "strings.json", "websocket.py",
    "frontend/hassenger-card.js", "translations/en.json",
    "brand/icon.png", "brand/icon@2x.png",
}
branding_files = {
    "branding/README.md",
    "branding/hassenger-original-mark.png", "branding/hassenger-original-wordmark-wide.png",
    "branding/hassenger-original-wordmark-banner.png",
}
blueprint_files = {
    "blueprints/automation/hassenger/legacy_input_text_message.yaml",
    "blueprints/automation/hassenger/mobile_actionable_reply.yaml",
}
workflow_files = {
    ".github/workflows/tests.yml", ".github/workflows/validate.yml",
    ".github/ISSUE_TEMPLATE/bug_report.yml", ".github/ISSUE_TEMPLATE/feature_request.yml",
    ".github/ISSUE_TEMPLATE/config.yml", ".github/pull_request_template.md",
}
documentation_images = {
    "docs/screenshots/contact-profile-rgb.png", "docs/screenshots/contact-profile-retro.png",
    "docs/screenshots/ICON-LICENSE.txt",
    "docs/screenshots/desktop-modern.png", "docs/screenshots/desktop-rgb-contacts.png",
    "docs/screenshots/mobile-rgb.png", "docs/screenshots/mobile-retro-contacts.png",
}
test_files = {
    "test-contact-profile-browser.js",
    "test-menu-bounds-browser.js",
    "test-input-focus-browser.js",
    "test-session-soak-browser.js",
    "test-roadmap-completion-browser.js",
    "test-roadmap-browser.js",
    "test-typing-browser.js",
    "test-audio.py", "test-backend.py", "test-blueprint.py",
    "test-card-actions-browser.js", "test-editor-voice-performance-browser.js",
    "test-contacts-browser.js",
    "test-header-brand-browser.js",
    "test-follow-latest-browser.js", "test-hardening-browser.js",
    "test-integration-contract.py", "test-media-upload-browser.js",
    "test-media-upload.py", "test-message-spacing-browser.js", "test-mobile-browser.js",
    "test-pagination-browser.js", "test-performance-browser.js",
    "test-regressions-browser.js",
    "test-release-layout.py", "test-release-privacy.py",
    "test-selection-stability-browser.js",
    "test-release-polish-browser.js", "test-visual-snapshots-browser.js",
    "cross-browser-smoke.js",
}
expected = root_files | blueprint_files | workflow_files | branding_files | documentation_images | {"dist/hassenger-card.js", "scripts/build-release.py"}
expected |= {f"custom_components/hassenger/{path}" for path in component_files}
expected |= {f"tests/{path}" for path in test_files}
actual = {
    path.relative_to(root).as_posix()
    for path in root.rglob("*")
    if path.is_file() and "__pycache__" not in path.parts
}
missing, unexpected = sorted(expected - actual), sorted(actual - expected)
if missing or unexpected:
    raise SystemExit(f"Release allowlist mismatch. Missing={missing}; unexpected={unexpected}")
for path in root.rglob("*"):
    if path.is_file() and (path.suffix.lower() in {".zip", ".pyc", ".pyo"} or "__pycache__" in path.parts):
        raise SystemExit(f"Generated/stale artifact is forbidden: {path.relative_to(root)}")


def png_pixels(path: pathlib.Path) -> tuple[int, int, list[int]]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"Brand asset is not a PNG: {path.relative_to(root)}")
    offset, width, height, bit_depth, color_type, interlace = 8, 0, 0, 0, 0, 0
    compressed = bytearray()
    while offset < len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        kind, payload = data[offset + 4:offset + 8], data[offset + 8:offset + 8 + length]
        offset += 12 + length
        if kind == b"IHDR":
            width, height, bit_depth, color_type, _compression, _filter, interlace = struct.unpack(">IIBBBBB", payload)
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            break
    if bit_depth != 8 or color_type != 6 or interlace != 0:
        raise SystemExit(f"Brand PNG must be non-interlaced 8-bit RGBA: {path.relative_to(root)}")
    raw, stride, previous, alpha = zlib.decompress(bytes(compressed)), width * 4, bytearray(width * 4), []
    cursor = 0
    for _row in range(height):
        filter_type, scanline = raw[cursor], bytearray(raw[cursor + 1:cursor + 1 + stride]); cursor += stride + 1
        for index in range(stride):
            left = scanline[index - 4] if index >= 4 else 0
            up = previous[index]
            upper_left = previous[index - 4] if index >= 4 else 0
            if filter_type == 1:
                scanline[index] = (scanline[index] + left) & 255
            elif filter_type == 2:
                scanline[index] = (scanline[index] + up) & 255
            elif filter_type == 3:
                scanline[index] = (scanline[index] + ((left + up) // 2)) & 255
            elif filter_type == 4:
                estimate = left + up - upper_left
                distances = (abs(estimate - left), abs(estimate - up), abs(estimate - upper_left))
                predictor = left if distances[0] <= distances[1] and distances[0] <= distances[2] else up if distances[1] <= distances[2] else upper_left
                scanline[index] = (scanline[index] + predictor) & 255
            elif filter_type != 0:
                raise SystemExit(f"Unsupported PNG filter {filter_type}: {path.relative_to(root)}")
        alpha.extend(scanline[3::4]); previous = scanline
    return width, height, alpha


brand_dimensions = {
    "icon.png": (256, 256), "icon@2x.png": (512, 512),
}
brand_root = root / "custom_components" / "hassenger" / "brand"
original_brand_hashes = {
    "hassenger-original-mark.png": "aa44841184cc7c100ef61ee4132213dcd3c6deb810f22a03d58571afb8323867",
    "hassenger-original-wordmark-wide.png": "89bf6c7c5e7ac95e1287e5294b57fb1e92c8d1fcc2c6a2cf657f6636d2f8182e",
    "hassenger-original-wordmark-banner.png": "fdfb59340d19aa5c8fa20008970511e74bffe50bddb2a27e18b1359c0c20653d",
}
for filename, expected_hash in original_brand_hashes.items():
    actual_hash = hashlib.sha256((root / "branding" / filename).read_bytes()).hexdigest()
    if actual_hash != expected_hash:
        raise SystemExit(f"Original branding changed: {filename}")
for filename, expected_size in brand_dimensions.items():
    size = png_pixels(brand_root / filename)
    if size[:2] != expected_size:
        raise SystemExit(f"Wrong brand dimensions for {filename}: {size[:2]} != {expected_size}")
    if min(size[2]) != 0 or max(size[2]) != 255:
        raise SystemExit(f"Brand asset must contain transparent and opaque pixels: {filename}")

print(f"Release layout allowlist passed: {len(actual)} intentional files, exact original branding hashes, required HACS icon sizes, and real alpha transparency.")
