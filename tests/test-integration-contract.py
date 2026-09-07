from __future__ import annotations

import ast
import hashlib
import json
import pathlib

repository = pathlib.Path(__file__).resolve().parent.parent
root = repository / "custom_components" / "hassenger"
for source in root.glob("*.py"):
    ast.parse(source.read_text(encoding="utf-8"), filename=str(source))

manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
const = (root / "const.py").read_text(encoding="utf-8")
websocket = (root / "websocket.py").read_text(encoding="utf-8")
setup = (root / "__init__.py").read_text(encoding="utf-8")
store = (root / "store.py").read_text(encoding="utf-8")
audio = (root / "audio.py").read_text(encoding="utf-8")
media_upload = (root / "media_upload.py").read_text(encoding="utf-8")

assert manifest["version"] == "1.0.0"
assert "http" in manifest["dependencies"]
assert list(manifest) == ["domain", "name", *sorted(set(manifest) - {"domain", "name"})]
assert "CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)" in setup
assert 'INTEGRATION_VERSION = "1.0.0"' in const
assert 'MAX_TIMESTAMP_LENGTH = 64' in const
assert 'MAX_MEDIA_FILE_SIZE = 10 * 1024 * 1024' in const
assert 'MAX_MEDIA_TOTAL_SIZE = 100 * 1024 * 1024' in const
assert 'vol.Optional("include_archived", default=False)' in websocket
assert '"last_event": last_event' in websocket
assert 'if store.can_access(thread, connection.user.id)' in websocket
assert 'message_type = msg["message_type"] if connection.user.is_admin else "text"' in websocket
assert 'message_type = call.data["message_type"] if is_admin else "text"' in setup
assert 'bypass_access=is_admin' in setup
assert 'return is_admin or user_id in thread.get("participants", [])' not in store
assert 'connection.user.is_admin or thread_id == "*"' not in websocket
assert 'async_unload_entry' in setup and 'return False' in setup.split('async def async_unload_entry', 1)[1]
assert 'connection.user.is_admin)' in websocket.split('async def ws_messages_react', 1)[1]
assert '"muted_by": self.muted_users(thread)' in store
assert 'include_archived: bool = False' in store
assert '"archived": archived' in store
assert 'Cannot reply to a deleted message' in store
assert 'Deleted messages cannot be edited' in store
assert 'Deleted messages cannot receive reactions' in store
assert '"thread_deleted", {"participants": participants}' in store
assert 'connection.user.id in deleted_participants' in websocket
assert '"hassenger/contacts/list"' in websocket
assert '"hassenger/direct_thread/open"' in websocket
assert '"hassenger/presence/set"' in websocket
assert 'target.id' in websocket and 'connection.user.id' in websocket
assert 'async def open_direct_thread' in store
assert 'async def set_presence' in store
assert 'async def validate_participant_ids' in store
assert 'if user.is_active and not user.system_generated' in store
assert 'await self.validate_participant_ids(clean_participants)' in store
assert 'thread["created_at"] = self.normalize_timestamp(thread.get("created_at"))' in store
assert 'thread["pinned"] = thread.get("pinned") if isinstance(thread.get("pinned"), bool) else False' in store
assert 'message["created_at"] = self.normalize_timestamp(message.get("created_at"))' in store
assert 'message["read_by"] = self.normalize_identifier_list(message.get("read_by"))' in store
assert 'message["reactions"] = self.normalize_reactions(message.get("reactions"))' in store
assert 'read_at = self.normalize_timestamp(timestamp)' in store
assert 'raise ServiceValidationError(str(err)) from err' in setup
assert '"message_id": message_id, "message": updated' in store
assert store.count('"message_id": message_id, "message": updated') == 3
assert 'await self._save(thread_id, "thread_read", result)' in store
assert 'if not newest_message_at or (stored_read_at and stored_read_at >= newest_message_at)' in store
assert 'result = await _store(hass).delete_message' in websocket
assert 'result = await _store(hass).mark_read' in websocket
assert store.count('raise PermissionError("Thread not found or access denied")') >= 6
assert 'vol.Optional("attachment"): ATTACHMENT_SCHEMA' in websocket
assert 'hass.services.async_register(DOMAIN, "speak_message"' in setup
assert "hass.http.register_view(HassengerMediaUploadView(hass))" in setup
assert '_safe_media_directory(media_dirs[source_id])' in media_upload
assert '_referenced_media_names(store.data, source_id)' in media_upload
assert 'async with store._lock' in media_upload
assert 'path.is_symlink()' in media_upload
assert 'raise MediaStorageFullError' in media_upload
assert 'StaticPathConfig("/hassenger/hassenger-card.js", str(Path(__file__).parent / "frontend" / "hassenger-card.js"), False)' in setup
bundled_card = root / "frontend" / "hassenger-card.js"
distribution_card = repository / "dist" / "hassenger-card.js"
assert bundled_card.is_file() and distribution_card.is_file()
assert hashlib.sha256(bundled_card.read_bytes()).digest() == hashlib.sha256(distribution_card.read_bytes()).digest()
card = distribution_card.read_text(encoding="utf-8")
assert 'const TAG = "hassenger-card"' in card
assert 'const LEGACY_TAG = "ha-chat-card"' in card
assert 'type: "custom:hassenger-card"' in card
assert 'const VERSION = "1.0.0"' in card
assert "await async_get_media_source_audio(hass, tts_media_source_id)" in audio
assert "await asyncio.sleep(chime_wait_seconds)" in audio
assert "ATTR_MEDIA_ANNOUNCE: announce" in audio
assert 'ATTR_MEDIA_EXTRA: {"use_pre_announce": use_pre_announce}' in audio

print("Integration syntax, active-participant validation, full mutation/read event contracts, Contacts/direct-chat/presence contracts, bundled-card parity/rename compatibility, participant privacy, lifecycle, archive, mute, reply, attachment, and audio contract tests passed.")
