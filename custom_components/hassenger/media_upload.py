"""Authenticated image uploads for Hassenger conversations."""

from __future__ import annotations

import asyncio
from pathlib import Path
import re
import shutil
import uuid

from aiohttp import web
from aiohttp.web_request import FileField

from homeassistant.components import http
from homeassistant.core import HomeAssistant

from .const import (
    DATA_STORE,
    DOMAIN,
    MAX_MEDIA_FILE_SIZE,
    MAX_MEDIA_TOTAL_SIZE,
    MEDIA_SUBDIRECTORY,
)


MAX_UPLOAD_SIZE = MAX_MEDIA_FILE_SIZE
REQUEST_SIZE_LIMIT = MAX_UPLOAD_SIZE + 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "application/pdf": ".pdf",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "image/avif": ".avif",
    "image/bmp": ".bmp",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MANAGED_MEDIA_NAME = re.compile(r"[0-9a-f]{32}\.(?:avif|bmp|gif|jpe?g|png|webp|pdf|mp3|wav)", re.IGNORECASE)
PRIVATE_MEDIA_PREFIX = "/api/hassenger/media/file/"


class UploadTooLargeError(Exception):
    """Raised when an upload exceeds Hassenger's size limit."""


class InvalidImageError(Exception):
    """Raised when file bytes do not match the declared image type."""


class UnsafeMediaDirectoryError(Exception):
    """Raised when Hassenger's media directory escapes the configured root."""


class MediaStorageFullError(Exception):
    """Raised when referenced Hassenger media leaves no safe upload capacity."""


def _safe_media_directory(media_root: str | Path) -> Path:
    """Resolve only the dedicated Hassenger directory below a media root."""
    root = Path(media_root).expanduser().resolve()
    directory = root / MEDIA_SUBDIRECTORY
    resolved = directory.resolve()
    try:
        resolved.relative_to(root)
    except ValueError as err:
        raise UnsafeMediaDirectoryError(
            "Hassenger media directory must remain inside the configured media root"
        ) from err
    return resolved


def _referenced_media_names(store_data: dict, source_id: str | None = None) -> set[str]:
    """Collect managed filenames still referenced by threads or messages."""
    prefix = PRIVATE_MEDIA_PREFIX if source_id is None else f"media-source://media_source/{source_id}/{MEDIA_SUBDIRECTORY}/"
    references: set[str] = set()

    def add(reference: object) -> None:
        value = str(reference or "")
        if not value.startswith(prefix):
            return
        name = value[len(prefix):]
        if MANAGED_MEDIA_NAME.fullmatch(name):
            references.add(name)

    for thread in store_data.get("threads", {}).values():
        if isinstance(thread, dict):
            add(thread.get("image"))
    for messages in store_data.get("messages", {}).values():
        if not isinstance(messages, list):
            continue
        for message in messages:
            if not isinstance(message, dict):
                continue
            attachment = message.get("attachment")
            if isinstance(attachment, dict):
                add(attachment.get("url"))
    return references


def _private_directory(hass: HomeAssistant) -> Path:
    """Keep private files outside every media root and the public www tree.

    Called in the executor because resolving paths can touch the filesystem.
    """
    directory = _safe_media_directory(hass.config.path())
    for public in [*hass.config.media_dirs.values(), hass.config.path("www")]:
        root = Path(public).resolve()
        if directory == root or root in directory.parents:
            raise UnsafeMediaDirectoryError("Private Hassenger storage overlaps a public media directory")
    return directory


def _private_file(hass: HomeAssistant, filename: str) -> Path:
    if not MANAGED_MEDIA_NAME.fullmatch(filename):
        raise FileNotFoundError
    directory = _private_directory(hass)
    path = directory / filename
    if path.is_symlink() or not path.is_file() or path.resolve().parent != directory:
        raise FileNotFoundError
    return path


def _stage_legacy_media(hass: HomeAssistant) -> list[tuple[str, str, Path]]:
    """Copy managed legacy uploads before committing rewritten references.

    Deterministic destination names make retries safe after an interrupted save.
    Unreferenced files are quarantined too, without granting anyone access.
    """
    target = _private_directory(hass)
    target.mkdir(parents=True, exist_ok=True)
    staged = []
    for source_id, root in hass.config.media_dirs.items():
        directory = _safe_media_directory(root)
        for path, _size, _mtime in _managed_media_files(directory):
            reference = f"media-source://media_source/{source_id}/{MEDIA_SUBDIRECTORY}/{path.name}"
            filename = uuid.uuid5(uuid.NAMESPACE_URL, reference).hex + path.suffix.lower()
            destination = target / filename
            if destination.is_symlink():
                raise UnsafeMediaDirectoryError("Legacy media destination is a symlink")
            temporary = target / (filename + ".migrating")
            if temporary.is_symlink():
                raise UnsafeMediaDirectoryError("Legacy media staging path is a symlink")
            shutil.copyfile(path, temporary)
            temporary.replace(destination)
            staged.append((reference, filename, path))
    return staged


def _remove_legacy_media(staged: list[tuple[str, str, Path]]) -> None:
    for _reference, _filename, path in staged:
        path.unlink(missing_ok=True)


async def async_migrate_media(hass: HomeAssistant, store) -> None:
    """Secure old files and preserve conversation pictures and attachments."""
    staged = await hass.async_add_executor_job(_stage_legacy_media, hass)
    if not staged:
        return
    async with store._lock:  # noqa: SLF001
        for reference, filename, _path in staged:
            owners = set(store.data.setdefault("media", {}).get(filename, []))
            for thread_id, thread in store.data["threads"].items():
                if thread.get("image") == reference:
                    thread["image"] = PRIVATE_MEDIA_PREFIX + filename
                    owners.add(thread_id)
                for message in store.data["messages"].get(thread_id, []):
                    attachment = message.get("attachment")
                    if isinstance(attachment, dict) and attachment.get("url") == reference:
                        attachment["url"] = PRIVATE_MEDIA_PREFIX + filename
                        owners.add(thread_id)
            store.data["media"][filename] = sorted(owners)
        await store._store.async_save(store.data)  # noqa: SLF001
    # Never remove originals until the private references are durably saved.
    await hass.async_add_executor_job(_remove_legacy_media, staged)


class HassengerMediaDownloadView(http.HomeAssistantView):
    """Authorize every download against the file's persisted conversation owners."""

    url = PRIVATE_MEDIA_PREFIX + "{filename}"
    name = "api:hassenger:media:download"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request, filename: str) -> web.StreamResponse:
        user = request.get("hass_user")
        store = self.hass.data[DOMAIN][DATA_STORE]
        owners = store.data.get("media", {}).get(filename, [])
        if user is None or not isinstance(owners, list) or not any(
            store.can_access(store.data["threads"].get(thread_id, {}), user.id)
            for thread_id in owners if isinstance(thread_id, str)
        ):
            raise web.HTTPForbidden(text="Attachment not found or access denied")
        try:
            path = await self.hass.async_add_executor_job(_private_file, self.hass, filename)
        except (OSError, UnsafeMediaDirectoryError) as err:
            raise web.HTTPNotFound from err
        return web.FileResponse(path, headers={
            "Cache-Control": "no-store, private",
            "X-Content-Type-Options": "nosniff",
            "Content-Type": next((kind for kind, suffix in ALLOWED_IMAGE_TYPES.items() if filename.lower().endswith(suffix)), "application/octet-stream"),
            "Content-Disposition": "attachment",
        })


def _managed_media_files(directory: Path) -> list[tuple[Path, int, int]]:
    """List direct, regular Hassenger files without following symlinks."""
    if not directory.is_dir():
        return []
    files = []
    for path in directory.iterdir():
        try:
            if path.is_symlink() or not MANAGED_MEDIA_NAME.fullmatch(path.name) or not path.is_file():
                continue
            stat = path.stat()
        except OSError:
            continue
        files.append((path, stat.st_size, stat.st_mtime_ns))
    return files


def _enforce_media_storage(
    directory: Path,
    referenced_names: set[str],
    protected_name: str,
    total_limit: int = MAX_MEDIA_TOTAL_SIZE,
) -> list[str]:
    """Delete oldest unreferenced managed files until storage is within quota."""
    files = _managed_media_files(directory)
    total = sum(size for _path, size, _mtime in files)
    removed: list[str] = []
    if total <= total_limit:
        return removed

    candidates = sorted(
        (
            item
            for item in files
            if item[0].name not in referenced_names and item[0].name != protected_name
        ),
        key=lambda item: (item[2], item[0].name),
    )
    for path, size, _mtime in candidates:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            continue
        else:
            removed.append(path.name)
            total -= size
        if total <= total_limit:
            return removed

    protected = directory / protected_name
    if protected.parent == directory and MANAGED_MEDIA_NAME.fullmatch(protected.name):
        protected.unlink(missing_ok=True)
    raise MediaStorageFullError(
        f"Hassenger media storage is full ({MAX_MEDIA_TOTAL_SIZE // (1024 * 1024)} MiB limit); referenced files were preserved"
    )


def _matches_image_signature(content_type: str, header: bytes) -> bool:
    """Reject renamed or forged files before exposing them through Media."""
    if content_type == "application/pdf":
        return header.startswith(b"%PDF-")
    if content_type == "audio/wav":
        return len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WAVE"
    if content_type == "audio/mpeg":
        return header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 255 and header[1] & 224 == 224)
    if content_type == "image/png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/jpeg":
        return header.startswith(b"\xff\xd8\xff")
    if content_type == "image/gif":
        return header.startswith((b"GIF87a", b"GIF89a"))
    if content_type == "image/webp":
        return len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP"
    if content_type == "image/bmp":
        return header.startswith(b"BM")
    if content_type == "image/avif":
        return len(header) >= 12 and header[4:8] == b"ftyp" and header[8:12] in (b"avif", b"avis")
    return False


def _write_limited_upload(source, target: Path, content_type: str) -> None:
    """Copy an upload without trusting its reported size."""
    target.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    try:
        source.seek(0)
        with target.open("xb") as destination:
            while chunk := source.read(64 * 1024):
                written += len(chunk)
                if written > MAX_UPLOAD_SIZE:
                    raise UploadTooLargeError
                destination.write(chunk)
        if written == 0:
            raise ValueError("The selected file is empty")
        with target.open("rb") as saved:
            if not _matches_image_signature(content_type, saved.read(32)):
                raise InvalidImageError
    except Exception:
        target.unlink(missing_ok=True)
        raise


class HassengerMediaUploadView(http.HomeAssistantView):
    """Upload a conversation image for an authenticated thread participant."""

    url = "/api/hassenger/media/upload"
    name = "api:hassenger:media:upload"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._upload_lock = asyncio.Lock()

    async def post(self, request: web.Request) -> web.Response:
        """Validate and store an attachment in private Hassenger storage."""
        request._client_max_size = REQUEST_SIZE_LIMIT  # noqa: SLF001
        try:
            data = await request.post()
        except web.HTTPRequestEntityTooLarge:
            raise
        except Exception as err:
            raise web.HTTPBadRequest(text="Invalid multipart upload") from err

        uploaded = data.get("file")
        thread_id = str(data.get("thread_id", "")).strip()
        if not isinstance(uploaded, FileField) or not thread_id:
            raise web.HTTPBadRequest(text="A conversation and attachment file are required")

        content_type = str(uploaded.content_type or "").split(";", 1)[0].lower()
        content_type = {"audio/x-wav": "audio/wav", "audio/wave": "audio/wav"}.get(content_type, content_type)
        extension = ALLOWED_IMAGE_TYPES.get(content_type)
        if extension is None:
            raise web.HTTPUnsupportedMediaType(text="Supported uploads: PNG, JPEG, GIF, WebP, AVIF, BMP, PDF, MP3 and WAV")

        user = request.get("hass_user")
        store = self.hass.data[DOMAIN][DATA_STORE]
        thread = store.data.get("threads", {}).get(thread_id)
        if user is None or thread is None or not store.can_access(thread, user.id):
            raise web.HTTPForbidden(text="Conversation not found or access denied")

        filename = f"{uuid.uuid4().hex}{extension}"
        try:
            media_directory = await self.hass.async_add_executor_job(_private_directory, self.hass)
        except (OSError, UnsafeMediaDirectoryError) as err:
            raise web.HTTPInternalServerError(text="Hassenger's media directory is not safely contained") from err
        target = media_directory / filename

        try:
            async with self._upload_lock:
                await self.hass.async_add_executor_job(_write_limited_upload, uploaded.file, target, content_type)
                # Hold the store mutation lock through the reference snapshot and
                # cleanup so a message cannot begin referencing a candidate file
                # between those operations.
                async with store._lock:  # noqa: SLF001
                    # Membership can change while the upload is being written.
                    thread = store.data["threads"].get(thread_id, {})
                    if not store.can_access(thread, user.id):
                        await self.hass.async_add_executor_job(target.unlink)
                        raise web.HTTPForbidden(text="Conversation not found or access denied")
                    referenced_names = _referenced_media_names(store.data)
                    removed = await self.hass.async_add_executor_job(
                        _enforce_media_storage,
                        media_directory,
                        referenced_names,
                        filename,
                    )
                    for removed_name in removed:
                        store.data.setdefault("media", {}).pop(removed_name, None)
                    store.data.setdefault("media", {})[filename] = [thread_id]
                    await store._store.async_save(store.data)  # noqa: SLF001
        except UploadTooLargeError as err:
            raise web.HTTPRequestEntityTooLarge(max_size=MAX_UPLOAD_SIZE, actual_size=MAX_UPLOAD_SIZE + 1) from err
        except ValueError as err:
            raise web.HTTPBadRequest(text=str(err)) from err
        except InvalidImageError as err:
            raise web.HTTPUnsupportedMediaType(text="The file contents do not match the selected image format") from err
        except MediaStorageFullError as err:
            raise web.HTTPInsufficientStorage(text=str(err)) from err
        except OSError as err:
            raise web.HTTPInternalServerError(text="Home Assistant could not write to its media directory") from err

        return self.json(
            {
                "media_content_id": PRIVATE_MEDIA_PREFIX + filename,
                "name": str(uploaded.filename or "Shared image")[:255],
                "content_type": content_type,
            }
        )
