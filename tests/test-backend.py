"""Security, privacy, lifecycle, and pagination checks for Hassenger storage."""

from __future__ import annotations

import asyncio
import ast
import importlib.util
import pathlib
import sys
import types


class FakeStorage:
    def __init__(self, *_args):
        self.saved = None
        self.save_count = 0

    async def async_load(self):
        return None

    async def async_save(self, data):
        self.saved = data
        self.save_count += 1


class LoadedStorage(FakeStorage):
    def __init__(self, loaded):
        super().__init__()
        self.loaded = loaded

    async def async_load(self):
        return self.loaded


class FakeBus:
    def __init__(self):
        self.events = []

    def async_fire(self, event_type, data):
        self.events.append((event_type, data))


class FakeStates:
    def __init__(self):
        self.person = types.SimpleNamespace(entity_id="person.person_2", state="home", attributes={"user_id": "person_2", "entity_picture": "/api/image/person_2"})

    def async_all(self):
        return [self.person]

    def get(self, entity_id):
        return self.person if entity_id == self.person.entity_id else None


class FakeAuth:
    def __init__(self):
        self.users = [
            types.SimpleNamespace(id="person_1", name="Person #1", is_active=True, system_generated=False, is_admin=True),
            types.SimpleNamespace(id="person_2", name="Person #2", is_active=True, system_generated=False, is_admin=False),
            types.SimpleNamespace(id="person_3", name="Person #3", is_active=True, system_generated=False, is_admin=False),
            types.SimpleNamespace(id="inactive", name="Inactive", is_active=False, system_generated=False, is_admin=False),
            types.SimpleNamespace(id="system", name="System", is_active=True, system_generated=True, is_admin=False),
        ]

    async def async_get_users(self):
        return self.users


homeassistant = types.ModuleType("homeassistant")
core = types.ModuleType("homeassistant.core")
core.HomeAssistant = object
helpers = types.ModuleType("homeassistant.helpers")
storage = types.ModuleType("homeassistant.helpers.storage")
storage.Store = FakeStorage
sys.modules.update({"homeassistant": homeassistant, "homeassistant.core": core, "homeassistant.helpers": helpers, "homeassistant.helpers.storage": storage})

package = types.ModuleType("hassenger")
package.__path__ = []
sys.modules["hassenger"] = package
const = types.ModuleType("hassenger.const")
const.DEFAULT_RETENTION_DAYS = 365
const.EVENT_MESSAGE_SENT = "hassenger_message_sent"
const.EVENT_UPDATED = "hassenger_updated"
const.STORAGE_KEY = "hassenger.messages"
const.STORAGE_VERSION = 1
const.MAX_ATTACHMENT_REFERENCE_LENGTH = 4096
const.MAX_ATTACHMENT_NAME_LENGTH = 255
const.MAX_MESSAGE_LENGTH = 4000
const.MAX_THREAD_TITLE_LENGTH = 120
const.MAX_THREAD_ID_LENGTH = 128
const.MAX_SENDER_NAME_LENGTH = 120
const.MAX_PARTICIPANTS = 50
const.MAX_ICON_LENGTH = 100
const.MAX_COLOR_LENGTH = 32
const.MAX_PRESENCE_MESSAGE_LENGTH = 160
const.MAX_TIMESTAMP_LENGTH = 64
sys.modules["hassenger.const"] = const

root = pathlib.Path(__file__).resolve().parent.parent
path = root / "custom_components" / "hassenger" / "store.py"
spec = importlib.util.spec_from_file_location("hassenger.store", path)
module = importlib.util.module_from_spec(spec)
sys.modules["hassenger.store"] = module
spec.loader.exec_module(module)


async def denied(awaitable):
    try:
        await awaitable
    except PermissionError:
        return
    raise AssertionError("Unauthorized operation was allowed")


async def main():
    hass = types.SimpleNamespace(bus=FakeBus(), states=FakeStates(), auth=FakeAuth(), data={})
    damaged = module.HassengerStore(hass)
    damaged._store = LoadedStorage(
        {
            "threads": {"broken": {"id": "different", "participants": "not-a-list"}},
            "messages": {"broken": "not-a-list", "orphan": [{"id": "safe-dict"}, "bad-item"]},
            "reads": [],
        }
    )
    await damaged.async_load()
    assert damaged.data["threads"] == {}
    assert damaged.data["messages"] == {}
    assert damaged.data["reads"] == {}
    assert damaged.data["presence"] == {}

    mixed = module.HassengerStore(hass)
    mixed._store = LoadedStorage(
        {
            "threads": {
                "valid": {"id": "valid", "title": "Valid", "participants": ["person_1"], "created_at": None, "pinned": "yes"},
                "timestamped": {"id": "timestamped", "title": "Timestamped", "participants": ["person_1"], "created_at": "2026-08-30T12:34:56+00:00", "pinned": True},
                "bad_timestamp": {"id": "bad_timestamp", "title": "Bad timestamp", "participants": ["person_1"], "created_at": "not-a-date", "pinned": 1},
                "long_timestamp": {"id": "long_timestamp", "title": "Long timestamp", "participants": ["person_1"], "created_at": "2" * 65, "pinned": None},
            },
            "messages": {
                "valid": [
                    {"sender_id": "person_1", "created_at": "2026-08-30T00:00:00+00:00"},
                    {
                        "id": "message_1", "sender_id": "person_1", "sender_name": "Person #1", "text": "Kept",
                        "created_at": "2026-08-30T00:00:00+00:00", "edited_at": {"bad": "type"},
                        "read_by": ["person_1", "person_1", 42, "x" * 129, "bad\nuser"],
                        "reactions": {"👍": ["person_1", "person_1", 42, "x" * 129, "bad\nuser"], "x" * 17: ["person_1"]},
                    },
                    {"id": "bad_created", "sender_id": "person_1", "sender_name": "Person #1", "text": "Safe fallback", "created_at": {"bad": "type"}},
                    {"id": "canonical", "sender_id": "person_1", "sender_name": "Person #1", "text": "Canonical", "created_at": "2026-08-30T01:00:00Z"},
                    {"id": 7, "sender_id": "person_1", "sender_name": "Person #1", "text": "Numeric ID", "created_at": "2026-08-30T02:00:00Z"},
                    {"id": "x" * 129, "sender_id": "person_1", "sender_name": "Person #1", "text": "Long ID", "created_at": "2026-08-30T02:00:00Z"},
                    {"id": "bad_sender", "sender_id": "x" * 129, "sender_name": "Person #1", "text": "Long sender", "created_at": "2026-08-30T02:00:00Z"},
                ]
            },
            "reads": {"valid": {"person_1": "2026-08-30T00:00:00Z", "bad": 42, "person_2": "not-a-date", "x" * 129: "2026-08-30T00:00:00Z", 7: "2026-08-30T00:00:00Z"}},
        }
    )
    await mixed.async_load()
    assert [item["id"] for item in mixed.data["messages"]["valid"]] == ["message_1", "bad_created", "canonical"]
    assert mixed.data["messages"]["valid"][0]["reactions"] == {"👍": ["person_1"]}
    assert mixed.data["messages"]["valid"][0]["read_by"] == ["person_1"]
    assert mixed.data["messages"]["valid"][0]["edited_at"] is None
    assert mixed.data["messages"]["valid"][1]["created_at"] == ""
    assert mixed.data["messages"]["valid"][2]["created_at"] == "2026-08-30T01:00:00+00:00"
    assert mixed.data["reads"]["valid"] == {"person_1": "2026-08-30T00:00:00+00:00"}
    assert mixed.data["threads"]["valid"]["created_at"] == ""
    assert mixed.data["threads"]["valid"]["pinned"] is False
    assert mixed.data["threads"]["timestamped"]["created_at"] == "2026-08-30T12:34:56+00:00"
    assert mixed.data["threads"]["timestamped"]["pinned"] is True
    assert mixed.data["threads"]["bad_timestamp"]["created_at"] == ""
    assert mixed.data["threads"]["bad_timestamp"]["pinned"] is False
    assert mixed.data["threads"]["long_timestamp"]["created_at"] == ""
    assert mixed.data["threads"]["long_timestamp"]["pinned"] is False
    assert len(mixed.list_threads("person_1", False)) == 4
    assert [item["id"] for item in mixed.list_messages("valid", "person_1", False, before="2027-01-01T00:00:00+00:00")] == ["message_1", "bad_created", "canonical"]
    assert await mixed.prune(3650) == 1

    presence = await mixed.set_presence(
        "person_1",
        {
            "mode": "automatic",
            "home_message": "Home and ready to chat",
            "away_message": "Away from home",
            "available_message": "",
            "busy_message": "Please do not disturb",
            "offline_message": "Offline",
        },
    )
    assert presence["mode"] == "automatic" and presence["away_message"] == "Away from home"
    assert mixed.list_presence()["person_1"]["home_message"] == "Home and ready to chat"
    assert hass.bus.events[-1][1]["kind"] == "presence_updated"
    for invalid in ({"mode": "hidden"}, {"mode": "away", "away_message": "x" * 161}):
        try:
            await mixed.set_presence("person_1", invalid)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid presence data was accepted")

    store = module.HassengerStore(hass)
    await store.async_load()
    thread = await store.create_thread("Private conversation", ["person_1", "person_2"])
    managed = await store.create_thread("Manage conversation", ["person_1", "person_2"])
    for actor, admin in (("person_2", False), ("person_3", True)):
        try:
            await store.update_thread(managed["id"], actor, admin, "Denied", [actor])
        except PermissionError:
            pass
        else:
            raise AssertionError("Unauthorized conversation edit succeeded")
    for participants in ([], ["person_2"], ["person_1", "inactive"]):
        try:
            await store.update_thread(managed["id"], "person_1", True, "Invalid", participants)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid participant update succeeded")
    updated = await store.update_thread(managed["id"], "person_1", True, "Renamed", ["person_1", "person_3"])
    assert updated["title"] == "Renamed" and updated["participants"] == ["person_1", "person_3"]
    assert not store.can_access(updated, "person_2") and store.can_access(updated, "person_3")
    assert hass.bus.events[-1][1]["previous_participants"] == ["person_1", "person_2"]
    subscription_source = pathlib.Path(__file__).resolve().parent.parent / "custom_components" / "hassenger" / "websocket.py"
    subscribe_node = next(node for node in ast.parse(subscription_source.read_text(encoding="utf-8")).body if isinstance(node, ast.FunctionDef) and node.name == "ws_subscribe")
    subscribe_node.decorator_list = []
    namespace = {"callback": lambda func: func, "_store": lambda _hass: store, "EVENT_UPDATED": "updated"}
    exec(compile(ast.Module(body=[subscribe_node], type_ignores=[]), str(subscription_source), "exec"), namespace)
    for user_id in ("person_1", "person_2", "person_3", "stranger"):
        delivered = []
        subscribed = []
        fake_hass = types.SimpleNamespace(bus=types.SimpleNamespace(async_listen=lambda _event, callback: subscribed.append(callback)))
        connection = types.SimpleNamespace(user=types.SimpleNamespace(id=user_id), subscriptions={}, send_result=lambda _id: None, send_event=lambda _id, data: delivered.append(data))
        namespace["ws_subscribe"](fake_hass, connection, {"id": 1})
        subscribed[0](types.SimpleNamespace(data=hass.bus.events[-1][1]))
        assert delivered == ([] if user_id == "stranger" else [{"thread_id": managed["id"], "kind": "thread_updated"}])
    await store.delete_thread(managed["id"])
    typing_node = next(node for node in ast.parse(subscription_source.read_text(encoding="utf-8")).body if isinstance(node, ast.AsyncFunctionDef) and node.name == "ws_typing")
    typing_node.decorator_list = []
    namespace.update({"monotonic": __import__("time").monotonic, "DOMAIN": "hassenger"})
    exec(compile(ast.Module(body=[typing_node], type_ignores=[]), str(subscription_source), "exec"), namespace)
    for actor in ("person_1", "stranger"):
        errors, results = [], []
        connection = types.SimpleNamespace(user=types.SimpleNamespace(id=actor, name="Person #1"), send_error=lambda *args: errors.append(args), send_result=lambda *args: results.append(args))
        before = len(hass.bus.events)
        await namespace["ws_typing"](hass, connection, {"id": 2, "thread_id": thread["id"], "typing": True})
        if actor == "stranger":
            assert errors and len(hass.bus.events) == before
        else:
            assert results and hass.bus.events[-1][1] == {"kind": "typing", "thread_id": thread["id"], "sender_id": actor, "sender_name": "Person #1", "typing": True, "session_id": "legacy"}
            assert not store.data["messages"][thread["id"]]
    results = []
    connection = types.SimpleNamespace(user=types.SimpleNamespace(id="person_1", name="Person #1"), send_error=lambda *args: None, send_result=lambda *args: results.append(args))
    hass.data["hassenger"]["typing_limits"] = {}
    events_before = len(hass.bus.events)
    for signal in range(100):
        await namespace["ws_typing"](hass, connection, {"id": signal, "thread_id": thread["id"], "typing": True, "session_id": "tab-a"})
    assert len(hass.bus.events) - events_before == 20
    assert len(results) == 100
    store.data["presence"]["person_1"] = {"share_typing": False}
    hass.data["hassenger"]["typing_limits"] = {}
    events_before = len(hass.bus.events)
    await namespace["ws_typing"](hass, connection, {"id": 101, "thread_id": thread["id"], "typing": True, "session_id": "tab-b"})
    assert len(hass.bus.events) == events_before
    store.data["presence"].pop("person_1")
    for invalid_participant in ("missing", "inactive", "system"):
        try:
            await store.create_thread("Invalid participants", ["person_1", invalid_participant])
        except ValueError as err:
            assert "active, non-system" in str(err)
        else:
            raise AssertionError(f"Invalid participant was accepted: {invalid_participant}")
    reopened, created = await store.open_direct_thread("person_1", "person_2", "Person #1", "Person #2")
    assert reopened["id"] == thread["id"] and created is False
    new_direct, created = await store.open_direct_thread("person_1", "person_3", "Person #1", "Person #3")
    assert created is True and set(new_direct["participants"]) == {"person_1", "person_3"}
    duplicate, created = await store.open_direct_thread("person_1", "person_3", "Person #1", "Person #3")
    assert duplicate["id"] == new_direct["id"] and created is False
    try:
        await store.open_direct_thread("person_1", "person_1", "Person #1", "Person #1")
    except ValueError:
        pass
    else:
        raise AssertionError("A direct conversation with self was allowed")
    message = await store.send_message(thread["id"], "person_2", "Person #2", "Original")

    # Administrator status is not membership. Admin-only management APIs may
    # create/delete threads, but private message content remains participant-only.
    assert store.list_threads("administrator_outsider", True) == []
    await denied(store.send_message(thread["id"], "administrator_outsider", "Administrator", "Not allowed", True))
    automated = await store.send_message(thread["id"], "home_assistant", "Home Assistant", "Automation delivery", True, "system", bypass_access=True)
    assert automated["text"] == "Automation delivery"

    await denied(store.react(thread["id"], message["id"], "outsider", "👍"))
    await denied(store.edit_message(thread["id"], message["id"], "outsider", "Changed", False))
    await denied(store.delete_message(thread["id"], message["id"], "outsider", False))
    assert message["id"] == store.list_messages(thread["id"], "person_1", False)[0]["id"]

    mutable = await store.send_message(thread["id"], "person_2", "Person #2", "Change me")
    edited = await store.edit_message(thread["id"], mutable["id"], "person_2", "Changed", False)
    assert edited["text"] == "Changed" and edited["edited_at"]
    assert hass.bus.events[-1][1]["kind"] == "message_edited"
    assert hass.bus.events[-1][1]["message_id"] == mutable["id"]
    assert hass.bus.events[-1][1]["message"] == edited

    reacted = await store.react(thread["id"], mutable["id"], "person_1", "👍", False)
    assert reacted["reactions"] == {"👍": ["person_1"]}
    assert hass.bus.events[-1][1]["kind"] == "reaction_changed"
    assert hass.bus.events[-1][1]["message"] == reacted

    saves_before_read = store._store.save_count
    read = await store.mark_read(thread["id"], "person_1", False)
    assert read == {"user_id": "person_1", "read_at": store.data["reads"][thread["id"]]["person_1"]}
    assert store._store.saved["reads"][thread["id"]]["person_1"] == read["read_at"]
    assert store._store.save_count == saves_before_read + 1
    assert hass.bus.events[-1][1] == {
        "thread_id": thread["id"],
        "kind": "thread_read",
        "user_id": "person_1",
        "read_at": read["read_at"],
    }
    events_after_read = len(hass.bus.events)
    saves_after_read = store._store.save_count
    repeated_read = await store.mark_read(thread["id"], "person_1", False)
    assert repeated_read == read
    assert store._store.save_count == saves_after_read
    assert len(hass.bus.events) == events_after_read

    removed = await store.delete_message(thread["id"], mutable["id"], "person_2", False)
    assert removed["deleted"] is True and removed["text"] == "" and removed["reactions"] == {}
    assert hass.bus.events[-1][1]["kind"] == "message_deleted"
    assert hass.bus.events[-1][1]["message"] == removed

    await store.set_thread_flag(thread["id"], "person_1", False, "mute", True)
    await store.send_message(thread["id"], "person_2", "Person #2", "Muted route")
    assert hass.bus.events[-1][1]["muted_by"] == ["person_1"]

    await store.set_thread_flag(thread["id"], "person_1", False, "archive", True)
    assert thread["id"] not in {item["id"] for item in store.list_threads("person_1", False)}
    archived = store.list_threads("person_1", False, include_archived=True)
    archived_thread = next(item for item in archived if item["id"] == thread["id"])
    assert archived_thread["archived"] is True
    assert store.list_threads("person_2", False)[0]["archived"] is False
    await store.set_thread_flag(thread["id"], "person_1", False, "archive", False)
    assert store.list_threads("person_1", False)[0]["archived"] is False

    try:
        await store.send_message(thread["id"], "person_1", "Person #1", "Bad reply", reply_to="missing")
    except ValueError:
        pass
    else:
        raise AssertionError("A reply to a missing message was allowed")

    deleted = await store.send_message(thread["id"], "person_2", "Person #2", "Delete me")
    await store.delete_message(thread["id"], deleted["id"], "person_2", False)
    for operation in (
        store.edit_message(thread["id"], deleted["id"], "person_2", "Resurrected", False),
        store.react(thread["id"], deleted["id"], "person_2", "👍", False),
    ):
        try:
            await operation
        except ValueError:
            pass
        else:
            raise AssertionError("A deleted message accepted a mutation")

    store.data["messages"][thread["id"]] = [
        {"id": f"m{index:03}", "thread_id": thread["id"], "sender_id": "person_2", "sender_name": "Person #2", "text": str(index), "created_at": f"2026-08-30T00:{index // 60:02}:{index % 60:02}+00:00", "deleted": False, "reactions": {}}
        for index in range(120)
    ]
    newest = store.list_messages(thread["id"], "person_1", False, limit=50)
    assert [item["id"] for item in newest] == [f"m{index:03}" for index in range(70, 120)]
    older = store.list_messages(thread["id"], "person_1", False, limit=50, before=newest[0]["created_at"])
    assert [item["id"] for item in older] == [f"m{index:03}" for index in range(20, 70)]

    for unsafe in ("javascript:alert(1)", "data:image/png;base64,AAAA", "file:///tmp/a.png"):
        try:
            store.normalize_attachment({"url": unsafe, "content_type": "image/png"})
        except ValueError:
            pass
        else:
            raise AssertionError(f"Unsafe attachment URL was allowed: {unsafe}")

    for invalid_title in ("", "x" * 121, "line\nbreak"):
        try:
            await store.create_thread(invalid_title, ["person_1"])
        except ValueError:
            pass
        else:
            raise AssertionError("An invalid conversation title was accepted")

    deletion_thread = await store.create_thread("Delete event", ["person_1", "person_2"])
    await store.delete_thread(deletion_thread["id"])
    assert hass.bus.events[-1][1]["kind"] == "thread_deleted"
    assert hass.bus.events[-1][1]["participants"] == ["person_1", "person_2"]

    # Extended roadmap: retries, personal saves, expiry, quiet hours and schedules.
    extended = module.HassengerStore(hass)
    room = await extended.create_thread("Roadmap validation", ["person_1", "person_2"])
    room_id = room["id"]
    first = await extended.send_message(room_id, "person_1", "Person #1", "Searchable text", client_id="retry-1")
    saves, events = extended._store.save_count, len(hass.bus.events)
    again = await extended.send_message(room_id, "person_1", "Person #1", "Searchable text", client_id="retry-1")
    assert first["id"] == again["id"]
    assert saves == extended._store.save_count and events == len(hass.bus.events)
    other = await extended.send_message(room_id, "person_2", "Person #2", "Other sender", client_id="retry-1")
    assert other["id"] != first["id"]
    await denied(extended.send_message(room_id, "person_3", "Person #3", "No access", client_id="retry-1"))
    await extended.bookmark_message(room_id, first["id"], "person_1", True)
    assert [m["id"] for m in extended.list_bookmarks(room_id, "person_1")] == [first["id"]]
    assert extended.list_bookmarks(room_id, "person_2") == []
    assert extended.list_messages(room_id, "person_1", False)[0]["bookmarked"] is True
    assert extended.list_messages(room_id, "person_2", False)[0]["bookmarked"] is False
    assert extended.search_messages(room_id, "person_1", "SEARCHABLE")[0]["id"] == first["id"]
    for operation in (lambda: extended.search_messages(room_id, "person_3", "text"), lambda: extended.export_thread(room_id, "person_3"), lambda: extended.list_bookmarks(room_id, "person_3")):
        try:
            operation()
        except PermissionError:
            pass
        else:
            raise AssertionError("New read operation bypassed participant access")
    exported = extended.export_thread(room_id, "person_1")
    assert exported["format"] == "hassenger-export-v1" and len(exported["messages"]) == 2
    assert "bookmarks" not in exported and all("bookmarked" not in message for message in exported["messages"])
    await extended.set_thread_flag(room_id, "person_1", False, "pin", True)
    assert extended.list_threads("person_1", False)[0]["pinned"]
    assert not extended.list_threads("person_2", False)[0]["pinned"]

    await extended.set_presence("person_1", {"mode": "available", "share_typing": False, "quiet_start": "22:00", "quiet_end": "07:00", "quiet_timezone": "UTC"})
    timed = await extended.set_presence("person_1", {"mode": "busy", "duration_minutes": 15})
    assert timed["return_mode"] == "available" and timed["expires_at"]
    assert timed["share_typing"] is False and timed["quiet_start"] == "22:00"
    extended.data["presence"]["person_1"]["expires_at"] = "2000-01-01T00:00:00+00:00"
    assert extended.list_presence()["person_1"]["mode"] == "available"
    # Older clients omitting new preferences cannot silently re-enable typing.
    assert not (await extended.set_presence("person_1", {"mode": "away"}))["share_typing"]
    real_datetime = module.datetime
    class FixedClock(real_datetime):
        @classmethod
        def now(cls, tz=None):
            return real_datetime(2026, 9, 6, 23, 30, tzinfo=module.UTC).astimezone(tz)
    module.datetime = FixedClock
    try:
        assert "person_1" in extended.muted_users(room)
        await extended.set_presence("person_1", {"mode": "away", "quiet_start": "08:00", "quiet_end": "09:00"})
        assert "person_1" not in extended.muted_users(room)
    finally:
        module.datetime = real_datetime
    for invalid in ({"duration_minutes": -1}, {"duration_minutes": True}, {"quiet_start": "25:00"}, {"quiet_timezone": "not/a/timezone"}):
        try:
            await extended.set_presence("person_1", {"mode": "busy", **invalid})
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid presence accepted")

    scheduled = await extended.schedule_message(room_id, "person_1", "Deliver later", 1)
    assert extended.list_scheduled("person_2") == []
    await denied(extended.cancel_scheduled("person_2", scheduled["id"]))
    extended.data["scheduled"][scheduled["id"]]["due_at"] = "2000-01-01T00:00:00+00:00"
    await asyncio.gather(extended.deliver_scheduled(), extended.deliver_scheduled())
    await extended.deliver_scheduled()
    assert sum(m["text"] == "Deliver later" for m in extended.data["messages"][room_id]) == 1
    assert extended.list_scheduled("person_1") == []
    canceled = await extended.schedule_message(room_id, "person_1", "Canceled", 1)
    await extended.cancel_scheduled("person_1", canceled["id"])
    revoked = await extended.schedule_message(room_id, "person_2", "Revoked sender", 1)
    extended.data["scheduled"][revoked["id"]]["due_at"] = "2000-01-01T00:00:00+00:00"
    extended.data["threads"][room_id]["participants"].remove("person_2")
    await extended.deliver_scheduled()
    assert extended.list_scheduled("person_2")[0]["error"]
    assert not any(m["text"] == "Revoked sender" for m in extended.data["messages"][room_id])
    restored = module.HassengerStore(hass)
    from copy import deepcopy
    restored._store = LoadedStorage(deepcopy(extended.data))
    await restored.async_load()
    retried_after_restart = await restored.send_message(room_id, "person_1", "Person #1", "Searchable text", client_id="retry-1")
    assert retried_after_restart["id"] == first["id"]
    assert not restored.list_presence()["person_1"]["share_typing"]
    # Remaining roadmap features: independent favorites, shared pins and activity privacy.
    await restored.set_favorite("person_1", "person_3", True)
    assert restored.list_favorites("person_1") == ["person_3"]
    assert restored.list_favorites("person_2") == []
    try:
        await restored.set_favorite("person_1", "inactive", True)
    except ValueError:
        pass
    else:
        raise AssertionError("Inactive account could be favorited")
    await restored.set_message_pin(room_id, first["id"], "person_1", True)
    await denied(restored.set_message_pin(room_id, first["id"], "person_3", True))
    assert restored.list_pins(room_id, "person_1")[0]["id"] == first["id"]
    assert restored.list_messages(room_id, "person_1", False)[0]["pinned"]
    activity_events = len(hass.bus.events)
    await restored.record_activity("person_1")
    assert len(hass.bus.events) == activity_events
    await restored.set_presence("person_1", {"mode": "available", "share_last_active": True})
    await restored.record_activity("person_1")
    activity_time = restored.list_presence()["person_1"]["last_active_at"]
    assert activity_time and activity_time.endswith(":00+00:00")
    activity_events = len(hass.bus.events)
    await restored.record_activity("person_1")
    assert len(hass.bus.events) == activity_events
    await restored.set_presence("person_1", {"mode": "busy"})
    assert restored.list_presence()["person_1"]["share_last_active"]
    await restored.set_presence("person_1", {"mode": "busy", "share_last_active": False})
    assert restored.list_presence()["person_1"]["last_active_at"] == ""

    reminder = await restored.create_reminder("person_1", "Private reminder text", 1, 60)
    assert restored.list_reminders("person_2") == []
    await denied(restored.update_reminder("person_2", reminder["id"], "cancel"))
    restored.data["reminders"][reminder["id"]]["due_at"] = "2000-01-01T00:00:00+00:00"
    message_count = len(restored.data["messages"][room_id])
    before_events = len(hass.bus.events)
    original_save = restored._store.async_save
    async def failed_reminder_save(_data):
        raise OSError("Simulated storage failure")
    restored._store.async_save = failed_reminder_save
    try:
        await restored.deliver_reminders()
        raise AssertionError("Storage failure should propagate")
    except OSError:
        pass
    finally:
        restored._store.async_save = original_save
    assert restored.list_reminders("person_1")[0]["state"] == "pending"
    assert len(hass.bus.events) == before_events
    await asyncio.gather(restored.deliver_reminders(), restored.deliver_reminders())
    due_events = [data for _, data in hass.bus.events[before_events:] if data["kind"] == "reminder_due"]
    assert len(due_events) == 1 and "text" not in due_events[0]
    assert restored.list_reminders("person_1")[0]["state"] == "due"
    assert len(restored.data["messages"][room_id]) == message_count
    await restored.update_reminder("person_1", reminder["id"], "snooze", 5)
    assert restored.list_reminders("person_1")[0]["state"] == "pending"
    await restored.update_reminder("person_1", reminder["id"], "complete")
    assert restored.list_reminders("person_1")[0]["repeat_minutes"] == 60
    # Check private broadcast filtering, including when users share a conversation.
    namespace["_store"] = lambda _hass: restored
    for actor in ("person_1", "person_2"):
        delivered, listeners = [], []
        hass.bus.async_listen = lambda _kind, callback: (listeners.append(callback) or (lambda: None))
        connection = types.SimpleNamespace(user=types.SimpleNamespace(id=actor), subscriptions={}, send_result=lambda *_: None, send_event=lambda _id, data: delivered.append(data))
        namespace["ws_subscribe"](hass, connection, {"id": 7})
        for kind in ("reminder_due", "reminders_updated", "favorites_updated"):
            listeners[0](types.SimpleNamespace(data={"thread_id": "*", "kind": kind, "user_id": "person_1", "reminder_id": reminder["id"]}))
        assert len(delivered) == (3 if actor == "person_1" else 0)
    restart = module.HassengerStore(hass)
    restart._store = LoadedStorage(deepcopy(restored.data))
    await restart.async_load()
    assert restart.list_reminders("person_1")[0]["id"] == reminder["id"]
    assert restart.list_favorites("person_1") == ["person_3"]
    assert restart.list_pins(room_id, "person_1")[0]["id"] == first["id"]
    await restart.update_reminder("person_1", reminder["id"], "cancel")
    assert restart.list_reminders("person_1") == []
    await restored.delete_message(room_id, first["id"], "person_1", False)
    assert restored.list_pins(room_id, "person_1") == []
    await restored.delete_thread(room_id)
    assert not restored.data["scheduled"]
    assert not any(restored.data["bookmarks"].values())
    print("Backend security/lifecycle plus idempotency, private bookmarks, search/export authorization, personal pins, timed presence, quiet hours, concurrent schedule delivery, revoked access and restart tests passed.")


asyncio.run(main())
