"""Persistent, permission-aware message storage for Hassenger."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import re
import uuid

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    DEFAULT_RETENTION_DAYS,
    EVENT_MESSAGE_SENT,
    EVENT_UPDATED,
    MAX_ATTACHMENT_NAME_LENGTH,
    MAX_ATTACHMENT_REFERENCE_LENGTH,
    MAX_COLOR_LENGTH,
    MAX_ICON_LENGTH,
    MAX_MESSAGE_LENGTH,
    MAX_PARTICIPANTS,
    MAX_PRESENCE_MESSAGE_LENGTH,
    MAX_SENDER_NAME_LENGTH,
    MAX_TIMESTAMP_LENGTH,
    MAX_THREAD_ID_LENGTH,
    MAX_THREAD_TITLE_LENGTH,
    STORAGE_KEY,
    STORAGE_VERSION,
)


def utcnow() -> str:
    """Return an ISO UTC timestamp."""
    return datetime.now(UTC).isoformat()


class HassengerStore:
    """Manage Hassenger threads and messages in .storage."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._lock = asyncio.Lock()
        self.data: dict = {"threads": {}, "messages": {}, "reads": {}, "presence": {}, "scheduled": {}, "bookmarks": {}, "favorites": {}, "reminders": {}, "version": 1}
        self.last_event: dict | None = None
        self._scheduled_in_flight: set[str] = set()

    async def async_load(self) -> None:
        """Load stored data, discarding malformed containers safely."""
        loaded = await self._store.async_load()
        if not isinstance(loaded, dict):
            return
        threads = loaded.get("threads") if isinstance(loaded.get("threads"), dict) else {}
        messages = loaded.get("messages") if isinstance(loaded.get("messages"), dict) else {}
        reads = loaded.get("reads") if isinstance(loaded.get("reads"), dict) else {}
        presence = loaded.get("presence") if isinstance(loaded.get("presence"), dict) else {}
        self.data = {
            "threads": {key: value for key, value in threads.items() if isinstance(key, str) and isinstance(value, dict)},
            "messages": {key: [item for item in value if isinstance(item, dict)] for key, value in messages.items() if isinstance(key, str) and isinstance(value, list)},
            "reads": {key: value for key, value in reads.items() if isinstance(key, str) and isinstance(value, dict)},
            "presence": {},
            "scheduled": {},
            "reminders": {},
            "favorites": {user: self.normalize_identifier_list(items)[:500] for user, items in loaded.get("favorites", {}).items() if isinstance(user, str)} if isinstance(loaded.get("favorites"), dict) else {},
            "bookmarks": {user: [item for item in items[:1000] if isinstance(item, str) and len(item) <= MAX_THREAD_ID_LENGTH] for user, items in (loaded.get("bookmarks") or {}).items() if isinstance(user, str) and isinstance(items, list)} if isinstance(loaded.get("bookmarks"), dict) else {},
            "version": loaded.get("version", 1),
        }
        for key, item in (loaded.get("scheduled") or {}).items() if isinstance(loaded.get("scheduled"), dict) else []:
            try:
                if not isinstance(item, dict) or not isinstance(key, str) or not re.fullmatch(r"[a-f0-9]{32}", key) or len(self.data["scheduled"]) >= 1000:
                    continue
                if not self.normalize_timestamp(item.get("due_at")):
                    continue
                self.data["scheduled"][key] = {"id": key, "thread_id": self._limited(item.get("thread_id"), MAX_THREAD_ID_LENGTH, "Thread ID", required=True), "sender_id": self._limited(item.get("sender_id"), MAX_THREAD_ID_LENGTH, "Sender ID", required=True), "text": self._limited(item.get("text"), MAX_MESSAGE_LENGTH, "Message", required=True), "due_at": self.normalize_timestamp(item.get("due_at")), "error": str(item.get("error", ""))[:200]}
            except ValueError:
                continue
        for key, item in (loaded.get("reminders") or {}).items() if isinstance(loaded.get("reminders"), dict) else []:
            try:
                if not isinstance(item, dict) or not isinstance(key, str) or not re.fullmatch(r"[a-f0-9]{32}", key) or len(self.data["reminders"]) >= 1000:
                    continue
                due = self.normalize_timestamp(item.get("due_at"))
                if not due:
                    continue
                self.data["reminders"][key] = {"id": key, "user_id": self._limited(item.get("user_id"), MAX_THREAD_ID_LENGTH, "User", required=True), "text": self._limited(item.get("text"), MAX_MESSAGE_LENGTH, "Reminder", required=True), "due_at": due, "state": "due" if item.get("state") == "due" else "pending", "repeat_minutes": item.get("repeat_minutes") if type(item.get("repeat_minutes")) is int and item["repeat_minutes"] in {0, 60, 1440, 10080} else 0}
            except ValueError:
                continue
        for user_id, value in presence.items():
            if not isinstance(user_id, str) or not isinstance(value, dict):
                continue
            try:
                self.data["presence"][user_id] = self.normalize_presence(value)
            except ValueError:
                continue
        for thread_id, thread in list(self.data["threads"].items()):
            if thread.get("id") != thread_id or not isinstance(thread.get("participants"), list):
                self.data["threads"].pop(thread_id, None)
                self.data["messages"].pop(thread_id, None)
                self.data["reads"].pop(thread_id, None)
                continue
            try:
                thread["title"] = self._limited(thread.get("title"), MAX_THREAD_TITLE_LENGTH, "Thread title", required=True)
                thread["participants"] = list(
                    dict.fromkeys(
                        self._limited(item, MAX_THREAD_ID_LENGTH, "Participant ID", required=True)
                        for item in thread["participants"][:MAX_PARTICIPANTS]
                    )
                )
                if not thread["participants"]:
                    raise ValueError("Choose at least one participant")
                thread["icon"] = self._limited(thread.get("icon") or "mdi:message", MAX_ICON_LENGTH, "Thread icon")
                thread["image"] = self.normalize_image_reference(thread.get("image"))
                color = self._limited(thread.get("color"), MAX_COLOR_LENGTH, "Thread color")
                thread["color"] = color if not color or re.fullmatch(r"#[0-9a-fA-F]{3,8}", color) else ""
                thread["created_at"] = self.normalize_timestamp(thread.get("created_at"))
                thread["pinned"] = thread.get("pinned") if isinstance(thread.get("pinned"), bool) else False
            except ValueError:
                self.data["threads"].pop(thread_id, None)
                self.data["messages"].pop(thread_id, None)
                self.data["reads"].pop(thread_id, None)
                continue
            for key in ("archived_by", "muted_by", "pinned_by"):
                thread[key] = [item for item in thread.get(key, []) if isinstance(item, str)] if isinstance(thread.get(key, []), list) else []
            normalized_messages = []
            for message in self.data["messages"].setdefault(thread_id, []):
                if not isinstance(message.get("id"), str) or not isinstance(message.get("sender_id"), str):
                    continue
                try:
                    message["id"] = self._limited(message.get("id"), MAX_THREAD_ID_LENGTH, "Message ID", required=True)
                    message["sender_id"] = self._limited(message.get("sender_id"), MAX_THREAD_ID_LENGTH, "Sender ID", required=True)
                    message["sender_name"] = self._limited(message.get("sender_name") or "Home Assistant", MAX_SENDER_NAME_LENGTH, "Sender name", required=True)
                    message["text"] = self._limited(message.get("text"), MAX_MESSAGE_LENGTH, "Message")
                    message["attachment"] = self.normalize_attachment(message.get("attachment"))
                except ValueError:
                    continue
                message["thread_id"] = thread_id
                message["created_at"] = self.normalize_timestamp(message.get("created_at"))
                edited_at = self.normalize_timestamp(message.get("edited_at"))
                message["edited_at"] = edited_at or None
                message["type"] = message.get("type") if message.get("type") in {"text", "system", "success", "warning", "error", "deleted"} else "text"
                reply_to = message.get("reply_to")
                if isinstance(reply_to, str):
                    try:
                        message["reply_to"] = self._limited(reply_to, MAX_THREAD_ID_LENGTH, "Reply message ID") or None
                    except ValueError:
                        message["reply_to"] = None
                else:
                    message["reply_to"] = None
                message["read_by"] = self.normalize_identifier_list(message.get("read_by"))
                message["reactions"] = self.normalize_reactions(message.get("reactions"))
                normalized_messages.append(message)
            self.data["messages"][thread_id] = normalized_messages
            valid_messages = {message["id"] for message in normalized_messages if not message.get("deleted")}
            thread["pinned_message_ids"] = [key for key in self.normalize_identifier_list(thread.get("pinned_message_ids")) if key in valid_messages][:50]
            read_values = self.data["reads"].setdefault(thread_id, {})
            clean_reads = {}
            for user, timestamp in read_values.items():
                if not isinstance(user, str):
                    continue
                try:
                    clean_user = self._limited(user, MAX_THREAD_ID_LENGTH, "Read user ID", required=True)
                except ValueError:
                    continue
                read_at = self.normalize_timestamp(timestamp)
                if read_at:
                    clean_reads[clean_user] = read_at
            self.data["reads"][thread_id] = clean_reads
        self.data["messages"] = {key: value for key, value in self.data["messages"].items() if key in self.data["threads"]}
        self.data["reads"] = {key: value for key, value in self.data["reads"].items() if key in self.data["threads"]}

    async def _save(self, thread_id: str, kind: str, details: dict | None = None, emit_message_event: bool = True) -> None:
        await self._store.async_save(self.data)
        payload = {"thread_id": thread_id, "kind": kind, **(details or {})}
        self.last_event = deepcopy(payload)
        self.hass.bus.async_fire(EVENT_UPDATED, payload)
        if kind == "message_sent" and emit_message_event:
            # A dedicated public event gives notification automations a simple,
            # stable trigger while hassenger_updated remains the card refresh bus.
            self.hass.bus.async_fire(EVENT_MESSAGE_SENT, payload)

    def person_entity_for_user(self, user_id: str) -> str:
        """Return the Person entity linked to a Home Assistant user ID."""
        states = getattr(self.hass, "states", None)
        if states is None:
            return ""
        for state in states.async_all():
            if state.entity_id.startswith("person.") and state.attributes.get("user_id") == user_id:
                return state.entity_id
        return ""

    def person_state_for_user(self, user_id: str) -> dict:
        """Return a privacy-safe snapshot of the Person linked to a user."""
        entity_id = self.person_entity_for_user(user_id)
        state = self.hass.states.get(entity_id) if entity_id and getattr(self.hass, "states", None) else None
        return {
            "person_entity_id": entity_id,
            "person_state": str(getattr(state, "state", "") or ""),
            "entity_picture": str(getattr(state, "attributes", {}).get("entity_picture", "") or ""),
        }

    @staticmethod
    def normalize_timestamp(value: object) -> str:
        """Return a bounded ISO-like timestamp or an empty sorting fallback."""
        if not isinstance(value, str):
            return ""
        clean = value.strip()
        if not clean or len(clean) > MAX_TIMESTAMP_LENGTH or any(ord(char) < 32 for char in clean):
            return ""
        try:
            parsed = datetime.fromisoformat(clean.replace("Z", "+00:00"))
        except (ValueError, OverflowError):
            return ""
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC).isoformat()

    @classmethod
    def normalize_identifier_list(cls, value: object) -> list[str]:
        """Return unique, bounded Home Assistant user/message identifiers."""
        if not isinstance(value, list):
            return []
        result = []
        for item in value:
            if not isinstance(item, str):
                continue
            try:
                clean = cls._limited(item, MAX_THREAD_ID_LENGTH, "Identifier", required=True)
            except ValueError:
                continue
            if clean not in result:
                result.append(clean)
        return result

    @classmethod
    def normalize_reactions(cls, value: object) -> dict[str, list[str]]:
        """Normalize restored reactions and their user ID lists."""
        if not isinstance(value, dict):
            return {}
        result = {}
        for emoji, users in value.items():
            if not isinstance(emoji, str):
                continue
            try:
                clean_emoji = cls._limited(emoji, 16, "Reaction", required=True)
            except ValueError:
                continue
            clean_users = cls.normalize_identifier_list(users)
            if clean_users:
                result[clean_emoji] = clean_users
        return result

    async def validate_participant_ids(self, participants: list[str]) -> None:
        """Require every participant to be an active, non-system HA user."""
        users = await self.hass.auth.async_get_users()
        active_ids = {
            user.id
            for user in users
            if user.is_active and not user.system_generated
        }
        if any(participant not in active_ids for participant in participants):
            raise ValueError(
                "Every participant must be an active, non-system Home Assistant user"
            )

    @staticmethod
    def can_access(thread: dict, user_id: str, _is_admin: bool = False) -> bool:
        """Return whether a user is an explicit thread participant.

        Administrator status grants thread-management privileges, but it must
        never silently add an administrator to a private conversation.
        """
        return user_id in thread.get("participants", [])

    @staticmethod
    def _limited(value: object, maximum: int, label: str, *, required: bool = False) -> str:
        clean = str(value or "").strip()
        if required and not clean:
            raise ValueError(f"{label} cannot be empty")
        if len(clean) > maximum or any(ord(char) < 32 for char in clean):
            raise ValueError(f"{label} is invalid or too long")
        return clean

    @classmethod
    def normalize_image_reference(cls, value: object) -> str:
        """Validate an optional conversation picture reference."""
        image = cls._limited(value, MAX_ATTACHMENT_REFERENCE_LENGTH, "Conversation picture")
        if image and not image.startswith(("http://", "https://", "/local/", "/api/", "media-source://")):
            raise ValueError("Conversation picture must use Home Assistant media, /local/, /api/, http, or https")
        return image

    @classmethod
    def normalize_presence(cls, value: dict | None) -> dict:
        """Validate a user's shared Contacts presence preferences."""
        raw = value if isinstance(value, dict) else {}
        mode = str(raw.get("mode", "automatic")).strip().lower()
        if mode not in {"automatic", "available", "away", "busy", "offline"}:
            raise ValueError("Presence mode is invalid")
        quiet_start, quiet_end = str(raw.get("quiet_start", "")), str(raw.get("quiet_end", ""))
        for clock_value in (quiet_start, quiet_end):
            if clock_value and not re.fullmatch(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]", clock_value):
                raise ValueError("Quiet hours must use HH:MM")
        quiet_timezone = str(raw.get("quiet_timezone", "UTC"))[:128]
        try:
            if quiet_timezone != "UTC":
                ZoneInfo(quiet_timezone)
        except (ZoneInfoNotFoundError, ValueError) as err:
            raise ValueError("Choose a supported timezone for quiet hours") from err
        clean = {
            "mode": mode,
            "home_message": cls._limited(raw.get("home_message"), MAX_PRESENCE_MESSAGE_LENGTH, "Home status message"),
            "away_message": cls._limited(raw.get("away_message"), MAX_PRESENCE_MESSAGE_LENGTH, "Away status message"),
            "available_message": cls._limited(raw.get("available_message"), MAX_PRESENCE_MESSAGE_LENGTH, "Available status message"),
            "busy_message": cls._limited(raw.get("busy_message"), MAX_PRESENCE_MESSAGE_LENGTH, "Busy status message"),
            "offline_message": cls._limited(raw.get("offline_message"), MAX_PRESENCE_MESSAGE_LENGTH, "Offline status message"),
            "updated_at": str(raw.get("updated_at", "") or ""),
            "share_typing": raw.get("share_typing", True) is not False,
            "share_last_active": raw.get("share_last_active") is True,
            "last_active_at": cls.normalize_timestamp(raw.get("last_active_at")) if raw.get("share_last_active") is True else "",
            "quiet_start": quiet_start,
            "quiet_end": quiet_end,
            "quiet_timezone": quiet_timezone,
            "expires_at": cls.normalize_timestamp(raw.get("expires_at")) if raw.get("expires_at") else "",
            "return_mode": str(raw.get("return_mode", "automatic")) if raw.get("return_mode") in {"automatic", "available", "away", "busy", "offline"} else "automatic",
        }
        return clean

    def list_presence(self) -> dict[str, dict]:
        """Return shared presence preferences without exposing other stored data."""
        result = deepcopy(self.data.get("presence", {}))
        now = utcnow()
        for value in result.values():
            if value.get("expires_at") and value["expires_at"] <= now:
                value["mode"] = value.get("return_mode", "automatic")
                value["expires_at"] = ""
        return result

    async def set_presence(self, user_id: str, value: dict) -> dict:
        """Persist presence preferences for the signed-in user only."""
        async with self._lock:
            previous = self.list_presence().get(user_id, {})
            clean = self.normalize_presence({**previous, **value})
            if "duration_minutes" in value:
                minutes = value["duration_minutes"]
                if not isinstance(minutes, int) or isinstance(minutes, bool) or not 0 <= minutes <= 1440:
                    raise ValueError("Duration must be between 0 and 1440 minutes")
                clean["return_mode"] = previous.get("return_mode", "automatic") if previous.get("expires_at") else previous.get("mode", "automatic")
                clean["expires_at"] = (datetime.now(UTC) + timedelta(minutes=minutes)).isoformat() if minutes else ""
            clean["updated_at"] = utcnow()
            self.data.setdefault("presence", {})[user_id] = clean
            await self._save("*", "presence_updated", {"user_id": user_id, "presence": deepcopy(clean)})
            return deepcopy(clean)

    def muted_users(self, thread: dict) -> list[str]:
        """Combine explicit conversation mute with personal quiet hours."""
        muted = set(thread.get("muted_by", []))
        for user_id in thread.get("participants", []):
            preferences = self.data.get("presence", {}).get(user_id, {})
            start, end = preferences.get("quiet_start", ""), preferences.get("quiet_end", "")
            if not start or not end or start == end:
                continue
            timezone = preferences.get("quiet_timezone", "UTC")
            try:
                clock = datetime.now(UTC if timezone == "UTC" else ZoneInfo(timezone)).strftime("%H:%M")
            except (ZoneInfoNotFoundError, ValueError):
                continue
            if (start <= clock < end) if start < end else (clock >= start or clock < end):
                muted.add(user_id)
        return sorted(muted)

    async def open_direct_thread(self, user_id: str, target_user_id: str, user_name: str, target_name: str) -> tuple[dict, bool]:
        """Return or create the exact two-person conversation for two users."""
        if not target_user_id or target_user_id == user_id:
            raise ValueError("Choose another active Home Assistant user")
        participants = {user_id, target_user_id}
        async with self._lock:
            for thread in self.data["threads"].values():
                if set(thread.get("participants", [])) == participants and len(thread.get("participants", [])) == 2:
                    archived = thread.setdefault("archived_by", [])
                    if user_id in archived:
                        archived.remove(user_id)
                        await self._save(thread["id"], "thread_archive")
                    return deepcopy(thread), False
            clean_user = self._limited(user_name or user_id, MAX_SENDER_NAME_LENGTH, "User name", required=True)
            clean_target = self._limited(target_name or target_user_id, MAX_SENDER_NAME_LENGTH, "Target name", required=True)
            title = self._limited(f"{clean_user} & {clean_target}", MAX_THREAD_TITLE_LENGTH, "Thread title", required=True)
            key = uuid.uuid4().hex
            thread = {"id": key, "title": title, "participants": [user_id, target_user_id], "icon": "mdi:account-multiple", "image": "", "color": "", "created_at": utcnow(), "archived_by": [], "muted_by": [], "pinned": False}
            self.data["threads"][key] = thread
            self.data["messages"][key] = []
            await self._save(key, "thread_created")
            return deepcopy(thread), True

    @staticmethod
    def normalize_attachment(attachment: dict | None) -> dict | None:
        """Validate and normalize an optional persistent image attachment."""
        if not attachment:
            return None
        if not isinstance(attachment, dict):
            raise ValueError("Attachment must be an object")
        url = str(attachment.get("url", "")).strip()
        if not url or len(url) > MAX_ATTACHMENT_REFERENCE_LENGTH:
            raise ValueError("Attachment URL or media reference is invalid")
        if not url.startswith(("http://", "https://", "/local/", "/api/", "media-source://")):
            raise ValueError("Attachment must use Home Assistant media, /local/, /api/, http, or https")
        content_type = str(attachment.get("content_type", "image/*")).strip().lower()[:100]
        if not content_type.startswith("image/") and content_type not in {"application/pdf", "audio/mpeg", "audio/wav"}:
            raise ValueError("Supported attachments are images, GIFs, PDF, MP3 and WAV")
        name = str(attachment.get("name", "Shared image")).strip()[:MAX_ATTACHMENT_NAME_LENGTH]
        return {"url": url, "content_type": content_type, "name": name or "Shared image"}

    def list_threads(self, user_id: str, is_admin: bool, include_archived: bool = False) -> list[dict]:
        """Return accessible threads with previews and unread counts."""
        result = []
        for thread in self.data["threads"].values():
            archived = user_id in thread.get("archived_by", [])
            if not self.can_access(thread, user_id, is_admin) or (archived and not include_archived):
                continue
            messages = self.data["messages"].get(thread["id"], [])
            visible = [m for m in messages if not m.get("deleted")]
            last = visible[-1] if visible else None
            read_at = self.data["reads"].get(thread["id"], {}).get(user_id, "")
            unread = sum(1 for m in visible if m.get("sender_id") != user_id and m.get("created_at", "") > read_at)
            item = deepcopy(thread)
            item.update({"last_message": deepcopy(last), "unread": unread, "muted": user_id in thread.get("muted_by", []), "archived": archived, "pinned": user_id in thread.get("pinned_by", [])})
            result.append(item)
        return sorted(result, key=lambda t: (bool(t.get("pinned")), (t.get("last_message") or {}).get("created_at", t.get("created_at", ""))), reverse=True)

    def list_messages(self, thread_id: str, user_id: str, is_admin: bool, limit: int = 100, before: str | None = None) -> list[dict]:
        """Return accessible messages newest-window first, displayed oldest to newest."""
        thread = self.data["threads"].get(thread_id)
        if not thread or not self.can_access(thread, user_id, is_admin):
            raise PermissionError("Thread not found or access denied")
        messages = self.data["messages"].get(thread_id, [])
        if before:
            messages = [m for m in messages if m.get("created_at", "") < before]
        result = deepcopy(messages[-max(1, min(limit, 500)):])
        reads = self.data["reads"].get(thread_id, {})
        for message in result:
            message["bookmarked"] = message.get("id") in self.data.get("bookmarks", {}).get(user_id, [])
            message["pinned"] = message.get("id") in thread.get("pinned_message_ids", [])
            message["read_by"] = [uid for uid, read_at in reads.items() if read_at >= message.get("created_at", "")]
        return result

    async def create_thread(self, title: str, participants: list[str], icon: str = "mdi:message", color: str = "", thread_id: str | None = None, image: str = "") -> dict:
        """Create a private thread."""
        async with self._lock:
            clean_title = self._limited(title, MAX_THREAD_TITLE_LENGTH, "Thread title", required=True)
            if not isinstance(participants, list):
                raise ValueError("Participants must be a list")
            clean_participants = [self._limited(item, MAX_THREAD_ID_LENGTH, "Participant ID", required=True) for item in participants]
            if not clean_participants:
                raise ValueError("Choose at least one participant")
            clean_participants = list(dict.fromkeys(clean_participants))
            if len(clean_participants) > MAX_PARTICIPANTS:
                raise ValueError(f"Choose no more than {MAX_PARTICIPANTS} participants")
            await self.validate_participant_ids(clean_participants)
            key = self._limited(thread_id, MAX_THREAD_ID_LENGTH, "Thread ID", required=True) if thread_id else uuid.uuid4().hex
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]*", key):
                raise ValueError("Thread ID contains unsupported characters")
            if key in self.data["threads"]:
                raise ValueError("Thread ID already exists")
            clean_icon = self._limited(icon, MAX_ICON_LENGTH, "Thread icon") or "mdi:message"
            clean_color = self._limited(color, MAX_COLOR_LENGTH, "Thread color")
            if clean_color and not re.fullmatch(r"#[0-9a-fA-F]{3,8}", clean_color):
                raise ValueError("Thread color must be a hexadecimal color")
            thread = {"id": key, "title": clean_title, "participants": clean_participants, "icon": clean_icon, "image": self.normalize_image_reference(image), "color": clean_color, "created_at": utcnow(), "archived_by": [], "muted_by": [], "pinned": False}
            self.data["threads"][key] = thread
            self.data["messages"][key] = []
            await self._save(key, "thread_created")
            return deepcopy(thread)

    async def send_message(self, thread_id: str, sender_id: str, sender_name: str, text: str, is_admin: bool = False, message_type: str = "text", reply_to: str | None = None, notify: bool = True, attachment: dict | None = None, bypass_access: bool = False, client_id: str | None = None) -> dict:
        """Append a message to a thread."""
        async with self._lock:
            thread = self.data["threads"].get(thread_id)
            if not thread or not (bypass_access or self.can_access(thread, sender_id, is_admin)):
                raise PermissionError("Thread not found or access denied")
            request_id = self._limited(client_id, MAX_THREAD_ID_LENGTH, "Request ID") if client_id else ""
            if request_id:
                for existing in self.data["messages"].get(thread_id, []):
                    if existing.get("client_id") == request_id and existing.get("sender_id") == sender_id:
                        return deepcopy(existing)
            clean = self._limited(text, MAX_MESSAGE_LENGTH, "Message")
            clean_attachment = self.normalize_attachment(attachment)
            if not clean and not clean_attachment:
                raise ValueError("Message or image attachment is required")
            if reply_to:
                replied = self._find_message(thread_id, reply_to)
                if replied.get("deleted"):
                    raise ValueError("Cannot reply to a deleted message")
            clean_sender = self._limited(sender_name or "Home Assistant", MAX_SENDER_NAME_LENGTH, "Sender name", required=True)
            message = {"id": uuid.uuid4().hex, "thread_id": thread_id, "sender_id": sender_id, "sender_name": clean_sender, "text": clean, "type": message_type, "attachment": clean_attachment, "reply_to": reply_to, "created_at": utcnow(), "edited_at": None, "deleted": False, "reactions": {}}
            if request_id:
                message["client_id"] = request_id
            self.data["messages"].setdefault(thread_id, []).append(message)
            self.data["reads"].setdefault(thread_id, {})[sender_id] = message["created_at"]
            await self._save(thread_id, "message_sent", {"message_id": message["id"], "sender_id": message["sender_id"], "sender_person_entity_id": self.person_entity_for_user(message["sender_id"]), "sender_name": message["sender_name"], "text": message["text"], "message_type": message["type"], "attachment": deepcopy(message["attachment"]), "muted_by": self.muted_users(thread)}, emit_message_event=notify)
            return deepcopy(message)

    async def edit_message(self, thread_id: str, message_id: str, user_id: str, text: str, is_admin: bool) -> dict:
        """Edit a user's own message or an admin-managed message."""
        async with self._lock:
            thread = self.data["threads"].get(thread_id)
            if not thread or not self.can_access(thread, user_id, is_admin):
                raise PermissionError("Thread not found or access denied")
            message = self._find_message(thread_id, message_id)
            if not is_admin and message["sender_id"] != user_id:
                raise PermissionError("Only the sender can edit this message")
            if message.get("deleted"):
                raise ValueError("Deleted messages cannot be edited")
            clean = text.strip()
            if not clean:
                raise ValueError("Message cannot be empty")
            message["text"] = clean
            message["edited_at"] = utcnow()
            updated = deepcopy(message)
            await self._save(
                thread_id,
                "message_edited",
                {"message_id": message_id, "message": updated},
            )
            return deepcopy(updated)

    async def delete_message(self, thread_id: str, message_id: str, user_id: str, is_admin: bool) -> dict:
        """Soft-delete a message."""
        async with self._lock:
            thread = self.data["threads"].get(thread_id)
            if not thread or not self.can_access(thread, user_id, is_admin):
                raise PermissionError("Thread not found or access denied")
            message = self._find_message(thread_id, message_id)
            if not is_admin and message["sender_id"] != user_id:
                raise PermissionError("Only the sender can delete this message")
            message.update({"deleted": True, "text": "", "attachment": None, "edited_at": utcnow(), "reactions": {}})
            self._prune_bookmarks()
            updated = deepcopy(message)
            await self._save(
                thread_id,
                "message_deleted",
                {"message_id": message_id, "message": updated},
            )
            return deepcopy(updated)

    async def react(self, thread_id: str, message_id: str, user_id: str, emoji: str, is_admin: bool = False) -> dict:
        """Toggle a reaction by a user."""
        async with self._lock:
            thread = self.data["threads"].get(thread_id)
            if not thread or not self.can_access(thread, user_id, is_admin):
                raise PermissionError("Thread not found or access denied")
            message = self._find_message(thread_id, message_id)
            if message.get("deleted"):
                raise ValueError("Deleted messages cannot receive reactions")
            reactions = message.setdefault("reactions", {})
            users = reactions.setdefault(emoji, [])
            if user_id in users:
                users.remove(user_id)
                if not users:
                    reactions.pop(emoji, None)
            else:
                users.append(user_id)
            updated = deepcopy(message)
            await self._save(
                thread_id,
                "reaction_changed",
                {"message_id": message_id, "message": updated},
            )
            return deepcopy(updated)

    async def mark_read(self, thread_id: str, user_id: str, is_admin: bool) -> dict:
        """Mark a thread read for one user."""
        async with self._lock:
            thread = self.data["threads"].get(thread_id)
            if not thread or not self.can_access(thread, user_id, is_admin):
                raise PermissionError("Thread not found or access denied")
            reads = self.data["reads"].setdefault(thread_id, {})
            stored_read_at = self.normalize_timestamp(reads.get(user_id))
            newest_message_at = max(
                (self.normalize_timestamp(message.get("created_at")) for message in self.data["messages"].get(thread_id, [])),
                default="",
            )
            if not newest_message_at or (stored_read_at and stored_read_at >= newest_message_at):
                return {"user_id": user_id, "read_at": stored_read_at}
            read_at = utcnow()
            reads[user_id] = read_at
            result = {"user_id": user_id, "read_at": read_at}
            await self._save(thread_id, "thread_read", result)
            return deepcopy(result)

    async def set_thread_flag(self, thread_id: str, user_id: str, is_admin: bool, flag: str, enabled: bool) -> None:
        """Set mute/archive flags for a user."""
        key = {"mute": "muted_by", "archive": "archived_by", "pin": "pinned_by"}[flag]
        async with self._lock:
            thread = self.data["threads"].get(thread_id)
            if not thread or not self.can_access(thread, user_id, is_admin):
                raise PermissionError("Thread not found or access denied")
            values = thread.setdefault(key, [])
            if enabled and user_id not in values:
                values.append(user_id)
            if not enabled and user_id in values:
                values.remove(user_id)
            await self._save(thread_id, f"thread_{flag}")

    async def schedule_message(self, thread_id: str, user_id: str, text: str, delay_minutes: int) -> dict:
        async with self._lock:
            thread = self.data["threads"].get(thread_id)
            if not thread or not self.can_access(thread, user_id):
                raise PermissionError("Thread not found or access denied")
            if not isinstance(delay_minutes, int) or isinstance(delay_minutes, bool) or not 1 <= delay_minutes <= 10080:
                raise ValueError("Choose a delay from 1 minute to 7 days")
            scheduled = self.data.setdefault("scheduled", {})
            if len(scheduled) >= 1000 or sum(item["sender_id"] == user_id for item in scheduled.values()) >= 100:
                raise ValueError("Scheduled message limit reached")
            item = {"id": uuid.uuid4().hex, "thread_id": thread_id, "sender_id": user_id, "text": self._limited(text, MAX_MESSAGE_LENGTH, "Message", required=True), "due_at": (datetime.now(UTC) + timedelta(minutes=delay_minutes)).isoformat(), "error": ""}
            scheduled[item["id"]] = item
            await self._save(thread_id, "schedule_updated")
            return deepcopy(item)

    def list_scheduled(self, user_id: str) -> list[dict]:
        return sorted([deepcopy(item) for item in self.data.get("scheduled", {}).values() if item["sender_id"] == user_id], key=lambda item: item["due_at"])

    async def cancel_scheduled(self, user_id: str, schedule_id: str) -> None:
        async with self._lock:
            item = self.data.get("scheduled", {}).get(schedule_id)
            if not item or item["sender_id"] != user_id:
                raise PermissionError("Scheduled message not found or access denied")
            if schedule_id in self._scheduled_in_flight:
                raise ValueError("This message is already being sent")
            self.data["scheduled"].pop(schedule_id)
            await self._save(item["thread_id"], "schedule_updated")

    async def deliver_scheduled(self, _now=None) -> None:
        """Deliver due text once, rechecking current membership and user activity."""
        await self.deliver_reminders()
        for item in list(self.data.get("scheduled", {}).values()):
            if item.get("error") or item["due_at"] > utcnow():
                continue
            async with self._lock:
                if self.data.get("scheduled", {}).get(item["id"]) is not item or item["id"] in self._scheduled_in_flight:
                    continue
                self._scheduled_in_flight.add(item["id"])
            try:
                users = await self.hass.auth.async_get_users()
                user = next((user for user in users if user.id == item["sender_id"] and user.is_active and not user.system_generated), None)
                if user is None:
                    raise PermissionError("Sender is no longer active")
                await self.send_message(item["thread_id"], user.id, user.name, item["text"], client_id="schedule:" + item["id"])
                async with self._lock:
                    self.data.get("scheduled", {}).pop(item["id"], None)
                    await self._save(item["thread_id"], "schedule_updated")
            except Exception:
                async with self._lock:
                    current = self.data.get("scheduled", {}).get(item["id"])
                    if current:
                        current["error"] = "Delivery failed. Check account access and the conversation, then cancel and reschedule."
                        await self._save(item["thread_id"], "schedule_updated")
            finally:
                self._scheduled_in_flight.discard(item["id"])

    async def bookmark_message(self, thread_id: str, message_id: str, user_id: str, enabled: bool) -> None:
        async with self._lock:
            thread = self.data["threads"].get(thread_id)
            if not thread or not self.can_access(thread, user_id):
                raise PermissionError("Thread not found or access denied")
            message = self._find_message(thread_id, message_id)
            if message.get("deleted"):
                raise ValueError("Deleted messages cannot be saved")
            saved = self.data.setdefault("bookmarks", {}).setdefault(user_id, [])
            if enabled and message_id not in saved:
                if len(saved) >= 1000:
                    raise ValueError("Saved message limit reached")
                saved.append(message_id)
            if not enabled and message_id in saved:
                saved.remove(message_id)
            await self._save(thread_id, "bookmark_updated", {"user_id": user_id})

    def list_bookmarks(self, thread_id: str, user_id: str) -> list[dict]:
        thread = self.data["threads"].get(thread_id)
        if not thread or not self.can_access(thread, user_id):
            raise PermissionError("Thread not found or access denied")
        saved = set(self.data.get("bookmarks", {}).get(user_id, []))
        return deepcopy([message for message in self.data["messages"].get(thread_id, []) if message["id"] in saved and not message.get("deleted")])

    def search_messages(self, thread_id: str, user_id: str, query: str) -> list[dict]:
        """Search all retained text in a participant's conversation."""
        thread = self.data["threads"].get(thread_id)
        if not thread or not self.can_access(thread, user_id):
            raise PermissionError("Thread not found or access denied")
        query = self._limited(query, 200, "Search", required=True).casefold()
        return deepcopy([message for message in reversed(self.data["messages"].get(thread_id, [])) if not message.get("deleted") and query in message.get("text", "").casefold()][:100])

    def export_thread(self, thread_id: str, user_id: str) -> dict:
        """Export only the requesting participant's conversation."""
        thread = self.data["threads"].get(thread_id)
        if not thread or not self.can_access(thread, user_id):
            raise PermissionError("Thread not found or access denied")
        messages = self.data["messages"].get(thread_id, [])
        if len(messages) > 10000:
            raise ValueError("Export is limited to 10,000 messages; use a Home Assistant backup for larger histories")
        return {"format": "hassenger-export-v1", "title": thread["title"], "exported_at": utcnow(), "messages": deepcopy(messages)}

    async def update_thread(self, thread_id: str, user_id: str, is_admin: bool, title: str, participants: list[str]) -> dict:
        """Edit a conversation only as an administrator who participates in it."""
        async with self._lock:
            thread = self.data["threads"].get(thread_id)
            if not is_admin or not thread or not self.can_access(thread, user_id):
                raise PermissionError("Thread not found or access denied")
            clean_title = self._limited(title, MAX_THREAD_TITLE_LENGTH, "Thread title", required=True)
            if not isinstance(participants, list):
                raise ValueError("Participants must be a list")
            clean_participants = list(dict.fromkeys(self._limited(item, MAX_THREAD_ID_LENGTH, "Participant ID", required=True) for item in participants))
            if not clean_participants or len(clean_participants) > MAX_PARTICIPANTS:
                raise ValueError(f"Choose between 1 and {MAX_PARTICIPANTS} participants")
            if user_id not in clean_participants:
                raise ValueError("Keep yourself in the conversation while editing it")
            await self.validate_participant_ids(clean_participants)
            previous = list(thread["participants"])
            thread.update(title=clean_title, participants=clean_participants)
            for field in ("archived_by", "muted_by"):
                thread[field] = [value for value in thread.get(field, []) if value in clean_participants]
            await self._save(thread_id, "thread_updated", {"previous_participants": previous})
            return deepcopy(thread)

    async def clear_thread(self, thread_id: str) -> None:
        """Clear all messages in a thread."""
        async with self._lock:
            if thread_id not in self.data["threads"]:
                raise ValueError("Thread not found")
            self.data["messages"][thread_id] = []
            self.data["reads"][thread_id] = {}
            self._prune_bookmarks()
            await self._save(thread_id, "thread_cleared")

    async def delete_thread(self, thread_id: str) -> None:
        """Permanently delete a thread and all of its associated data."""
        async with self._lock:
            if thread_id not in self.data["threads"]:
                raise ValueError("Thread not found")
            participants = deepcopy(self.data["threads"][thread_id].get("participants", []))
            self.data["threads"].pop(thread_id, None)
            self.data["messages"].pop(thread_id, None)
            self.data["reads"].pop(thread_id, None)
            self.data["scheduled"] = {key: item for key, item in self.data.get("scheduled", {}).items() if item["thread_id"] != thread_id}
            self._prune_bookmarks()
            await self._save(thread_id, "thread_deleted", {"participants": participants})

    async def prune(self, retention_days: int = DEFAULT_RETENTION_DAYS) -> int:
        """Remove messages older than the retention period."""
        cutoff = (datetime.now(UTC) - timedelta(days=max(1, retention_days))).isoformat()
        removed = 0
        async with self._lock:
            for thread_id, messages in self.data["messages"].items():
                kept = [m for m in messages if m.get("created_at", "") >= cutoff]
                removed += len(messages) - len(kept)
                self.data["messages"][thread_id] = kept
            self._prune_bookmarks()
            await self._save("*", "messages_pruned")
        return removed

    def _prune_bookmarks(self) -> None:
        retained = {item["id"] for messages in self.data["messages"].values() for item in messages if not item.get("deleted")}
        self.data["bookmarks"] = {user: [item for item in saved if item in retained] for user, saved in self.data.get("bookmarks", {}).items()}
        for thread in self.data["threads"].values():
            thread["pinned_message_ids"] = [key for key in thread.get("pinned_message_ids", []) if key in retained]

    async def record_activity(self, user_id: str) -> None:
        """Opt-in activity in this app, rounded to a minute; never an online claim."""
        async with self._lock:
            presence = self.data.get("presence", {}).get(user_id, {})
            if presence.get("share_last_active") is not True:
                return
            now = datetime.now(UTC)
            previous = self.normalize_timestamp(presence.get("last_active_at"))
            if previous and (now - datetime.fromisoformat(previous)).total_seconds() < 60:
                return
            presence["last_active_at"] = now.replace(second=0, microsecond=0).isoformat()
            await self._save("*", "activity_updated", {"user_id": user_id, "last_active_at": presence["last_active_at"]})

    def list_favorites(self, user_id: str) -> list[str]:
        return deepcopy(self.data.get("favorites", {}).get(user_id, []))

    async def set_favorite(self, user_id: str, target_user_id: str, enabled: bool) -> list[str]:
        if enabled:
            await self.validate_participant_ids([target_user_id])
            if user_id == target_user_id:
                raise ValueError("Choose another contact")
        async with self._lock:
            values = self.data.setdefault("favorites", {}).setdefault(user_id, [])
            if enabled and target_user_id not in values:
                if len(values) >= 500:
                    raise ValueError("Favorite contact limit reached")
                values.append(target_user_id)
            if not enabled and target_user_id in values:
                values.remove(target_user_id)
            await self._save("*", "favorites_updated", {"user_id": user_id})
            return deepcopy(values)

    def list_pins(self, thread_id: str, user_id: str) -> list[dict]:
        thread = self.data["threads"].get(thread_id)
        if not thread or not self.can_access(thread, user_id):
            raise PermissionError("Thread not found or access denied")
        by_id = {item["id"]: item for item in self.data["messages"].get(thread_id, []) if not item.get("deleted")}
        return deepcopy([by_id[key] for key in thread.get("pinned_message_ids", []) if key in by_id])

    async def set_message_pin(self, thread_id: str, message_id: str, user_id: str, enabled: bool) -> None:
        async with self._lock:
            thread = self.data["threads"].get(thread_id)
            if not thread or not self.can_access(thread, user_id):
                raise PermissionError("Thread not found or access denied")
            message = self._find_message(thread_id, message_id)
            if enabled and message.get("deleted"):
                raise ValueError("Deleted messages cannot be pinned")
            pins = thread.setdefault("pinned_message_ids", [])
            if enabled and message_id not in pins:
                if len(pins) >= 50:
                    raise ValueError("A conversation can have at most 50 pinned messages")
                pins.append(message_id)
            if not enabled and message_id in pins:
                pins.remove(message_id)
            await self._save(thread_id, "pins_updated")

    def list_reminders(self, user_id: str) -> list[dict]:
        return sorted([deepcopy(item) for item in self.data.get("reminders", {}).values() if item["user_id"] == user_id], key=lambda item: (item["state"] != "due", item["due_at"]))

    async def create_reminder(self, user_id: str, text: str, delay_minutes: int, repeat_minutes: int = 0) -> dict:
        if type(delay_minutes) is not int or not 1 <= delay_minutes <= 10080 or type(repeat_minutes) is not int or repeat_minutes not in {0, 60, 1440, 10080}:
            raise ValueError("Choose a delay from 1 minute to 7 days and a supported repeat interval")
        async with self._lock:
            reminders = self.data.setdefault("reminders", {})
            if len(reminders) >= 1000 or len(self.list_reminders(user_id)) >= 100:
                raise ValueError("Reminder limit reached")
            item = {"id": uuid.uuid4().hex, "user_id": user_id, "text": self._limited(text, MAX_MESSAGE_LENGTH, "Reminder", required=True), "due_at": (datetime.now(UTC) + timedelta(minutes=delay_minutes)).isoformat(), "state": "pending", "repeat_minutes": repeat_minutes}
            reminders[item["id"]] = item
            await self._save("*", "reminders_updated", {"user_id": user_id})
            return deepcopy(item)

    async def update_reminder(self, user_id: str, reminder_id: str, action: str, minutes: int = 15) -> None:
        if action not in {"complete", "cancel", "snooze"} or type(minutes) is not int or not 1 <= minutes <= 10080:
            raise ValueError("Invalid reminder action")
        async with self._lock:
            item = self.data.get("reminders", {}).get(reminder_id)
            if not item or item["user_id"] != user_id:
                raise PermissionError("Reminder not found or access denied")
            if action == "cancel" or (action == "complete" and not item["repeat_minutes"]):
                self.data["reminders"].pop(reminder_id)
            else:
                delay = minutes if action == "snooze" else item["repeat_minutes"]
                item.update(state="pending", due_at=(datetime.now(UTC) + timedelta(minutes=delay)).isoformat())
            await self._save("*", "reminders_updated", {"user_id": user_id})

    async def deliver_reminders(self) -> None:
        """Persist due state once; disconnected users retrieve it on reconnect."""
        async with self._lock:
            for item in self.data.get("reminders", {}).values():
                if item["state"] == "pending" and item["due_at"] <= utcnow():
                    item["state"] = "due"
                    try:
                        await self._save("*", "reminder_due", {"user_id": item["user_id"], "reminder_id": item["id"]})
                    except Exception:
                        # A failed storage write must remain eligible for the next timer tick.
                        item["state"] = "pending"
                        raise

    def _find_message(self, thread_id: str, message_id: str) -> dict:
        for message in self.data["messages"].get(thread_id, []):
            if message["id"] == message_id:
                return message
        raise ValueError("Message not found")
