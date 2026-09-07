"""Hassenger media upload size, type, and authorization contract checks."""

from __future__ import annotations

import importlib.util
import io
import os
import pathlib
import sys
import tempfile
import types


aiohttp = types.ModuleType("aiohttp")
web = types.ModuleType("aiohttp.web")
web_request = types.ModuleType("aiohttp.web_request")
for name in (
    "HTTPBadRequest",
    "HTTPForbidden",
    "HTTPInternalServerError",
    "HTTPInsufficientStorage",
    "HTTPRequestEntityTooLarge",
    "HTTPServiceUnavailable",
    "HTTPUnsupportedMediaType",
):
    setattr(web, name, type(name, (Exception,), {}))
web.Request = object
web.Response = object
web_request.FileField = type("FileField", (), {})
aiohttp.web = web

homeassistant = types.ModuleType("homeassistant")
components = types.ModuleType("homeassistant.components")
http = types.ModuleType("homeassistant.components.http")
http.HomeAssistantView = type("HomeAssistantView", (), {"json": staticmethod(lambda value: value)})
components.http = http
core = types.ModuleType("homeassistant.core")
core.HomeAssistant = object
sys.modules.update(
    {
        "aiohttp": aiohttp,
        "aiohttp.web": web,
        "aiohttp.web_request": web_request,
        "homeassistant": homeassistant,
        "homeassistant.components": components,
        "homeassistant.components.http": http,
        "homeassistant.core": core,
    }
)

package = types.ModuleType("hassenger")
package.__path__ = []
const = types.ModuleType("hassenger.const")
const.DATA_STORE = "store"
const.DOMAIN = "hassenger"
const.MAX_MEDIA_FILE_SIZE = 10 * 1024 * 1024
const.MAX_MEDIA_TOTAL_SIZE = 100 * 1024 * 1024
const.MEDIA_SUBDIRECTORY = "hassenger"
sys.modules.update({"hassenger": package, "hassenger.const": const})

source_path = pathlib.Path(__file__).resolve().parent.parent / "custom_components" / "hassenger" / "media_upload.py"
spec = importlib.util.spec_from_file_location("hassenger.media_upload", source_path)
module = importlib.util.module_from_spec(spec)
sys.modules["hassenger.media_upload"] = module
spec.loader.exec_module(module)

assert module.HassengerMediaUploadView.requires_auth is True
assert module.HassengerMediaUploadView.url == "/api/hassenger/media/upload"
assert "image/gif" in module.ALLOWED_IMAGE_TYPES
assert "image/svg+xml" not in module.ALLOWED_IMAGE_TYPES
for media_type, header in (("application/pdf", b"%PDF-1.7"), ("audio/mpeg", b"ID3"), ("audio/wav", b"RIFF0000WAVE")):
    assert media_type in module.ALLOWED_IMAGE_TYPES
    assert module._matches_image_signature(media_type, header)
    assert not module._matches_image_signature(media_type, b"<script>not a file</script>")

with tempfile.TemporaryDirectory() as temporary:
    root = pathlib.Path(temporary)
    exact = root / "exact.gif"
    module._write_limited_upload(io.BytesIO(b"GIF89a" + b"x" * (module.MAX_UPLOAD_SIZE - 6)), exact, "image/gif")
    assert exact.stat().st_size == module.MAX_UPLOAD_SIZE

    oversized = root / "oversized.gif"
    try:
        module._write_limited_upload(io.BytesIO(b"GIF89a" + b"x" * (module.MAX_UPLOAD_SIZE - 5)), oversized, "image/gif")
    except module.UploadTooLargeError:
        pass
    else:
        raise AssertionError("An oversized attachment was accepted")
    assert not oversized.exists()

    empty = root / "empty.png"
    try:
        module._write_limited_upload(io.BytesIO(b""), empty, "image/png")
    except ValueError:
        pass
    else:
        raise AssertionError("An empty attachment was accepted")
    assert not empty.exists()

    forged = root / "forged.gif"
    try:
        module._write_limited_upload(io.BytesIO(b"this is not a GIF"), forged, "image/gif")
    except module.InvalidImageError:
        pass
    else:
        raise AssertionError("A renamed non-image was accepted")
    assert not forged.exists()

    media = module._safe_media_directory(root)
    media.mkdir()
    referenced = f"{'a' * 32}.png"
    oldest = f"{'b' * 32}.png"
    newer = f"{'c' * 32}.png"
    protected = f"{'d' * 32}.png"
    for index, name in enumerate((referenced, oldest, newer, protected), start=1):
        path = media / name
        path.write_bytes(b"x" * 30)
        os.utime(path, (index, index))
    foreign = media / "do-not-touch.txt"
    foreign.write_bytes(b"foreign")
    removed = module._enforce_media_storage(media, {referenced}, protected, total_limit=90)
    assert removed == [oldest]
    assert (media / referenced).exists()
    assert (media / newer).exists()
    assert (media / protected).exists()
    assert foreign.exists()

    full = root / "full" / const.MEDIA_SUBDIRECTORY
    full.mkdir(parents=True)
    full_reference = f"{'e' * 32}.gif"
    rejected = f"{'f' * 32}.gif"
    (full / full_reference).write_bytes(b"x" * 80)
    (full / rejected).write_bytes(b"x" * 30)
    try:
        module._enforce_media_storage(full, {full_reference}, rejected, total_limit=100)
    except module.MediaStorageFullError as err:
        assert "referenced files were preserved" in str(err)
    else:
        raise AssertionError("An upload exceeded the total Hassenger media quota")
    assert (full / full_reference).exists()
    assert not (full / rejected).exists()

    references = module._referenced_media_names(
        {
            "threads": {
                "one": {"image": f"media-source://media_source/local/hassenger/{referenced}"},
                "ignored": {"image": f"media-source://media_source/other/hassenger/{oldest}"},
            },
            "messages": {
                "one": [
                    {"attachment": {"url": f"media-source://media_source/local/hassenger/{newer}"}},
                    {"attachment": {"url": "media-source://media_source/local/hassenger/../outside.png"}},
                ]
            },
        },
        "local",
    )
    assert references == {referenced, newer}

    symlink_root = root / "symlink-root"
    symlink_root.mkdir()
    outside = root / "outside"
    outside.mkdir()
    try:
        (symlink_root / const.MEDIA_SUBDIRECTORY).symlink_to(outside, target_is_directory=True)
    except OSError:
        pass  # Creating directory symlinks can require an OS-specific privilege.
    else:
        try:
            module._safe_media_directory(symlink_root)
        except module.UnsafeMediaDirectoryError:
            pass
        else:
            raise AssertionError("A Hassenger media symlink escaped its configured root")

source = source_path.read_text(encoding="utf-8")
assert 'thread_id = str(data.get("thread_id", "")).strip()' in source
assert "store.can_access(thread, user.id)" in source
assert "uuid.uuid4().hex" in source
assert "_safe_media_directory(media_dirs[source_id])" in source
assert "MAX_MEDIA_TOTAL_SIZE" in source
assert "_referenced_media_names(store.data, source_id)" in source
assert "async with store._lock" in source
assert "path.is_symlink()" in source

print("Authenticated participant-only upload, safe image types, randomized filenames, exact-size, oversized, empty-file, bounded storage, oldest-unreferenced cleanup, and referenced-media preservation tests passed.")
