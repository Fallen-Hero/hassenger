"""WebSocket API for Hassenger."""

from __future__ import annotations

import voluptuous as vol
from time import monotonic

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv

from .const import DATA_STORE, DOMAIN, EVENT_MESSAGE_SENT, EVENT_UPDATED, INTEGRATION_VERSION, MAX_ATTACHMENT_NAME_LENGTH, MAX_ATTACHMENT_REFERENCE_LENGTH, MAX_MESSAGE_LENGTH, MAX_PARTICIPANTS, MAX_PRESENCE_MESSAGE_LENGTH, MAX_THREAD_ID_LENGTH, MAX_THREAD_TITLE_LENGTH


THREAD_ID = vol.All(cv.string, vol.Length(min=1, max=MAX_THREAD_ID_LENGTH))


def _store(hass: HomeAssistant):
    return hass.data[DOMAIN][DATA_STORE]


@websocket_api.websocket_command({vol.Required("type"): "hassenger/typing", vol.Required("thread_id"): THREAD_ID, vol.Required("typing"): cv.boolean, vol.Optional("session_id", default="legacy"): vol.All(cv.string, vol.Length(min=1, max=64))})
@websocket_api.async_response
async def ws_typing(hass, connection, msg) -> None:
    """Broadcast ephemeral activity without storing draft text or history."""
    thread = _store(hass).data["threads"].get(msg["thread_id"])
    if not thread or not _store(hass).can_access(thread, connection.user.id):
        connection.send_error(msg["id"], "unauthorized", "Thread not found or access denied")
        return
    if msg["typing"] and _store(hass).list_presence().get(connection.user.id, {}).get("share_typing") is False:
        connection.send_result(msg["id"])
        return
    now = monotonic()
    limits = hass.data.setdefault(DOMAIN, {}).setdefault("typing_limits", {})
    for key, value in list(limits.items()):
        if now - value[0] > 60:
            limits.pop(key, None)
    key = (connection.user.id, msg["thread_id"])
    previous = limits.get(key, (0, 0))
    count = previous[1] + 1 if now - previous[0] < 10 else 1
    if count > 20 or (len(limits) >= 2048 and key not in limits):
        connection.send_result(msg["id"])
        return
    limits[key] = (previous[0] if now - previous[0] < 10 else now, count)
    hass.bus.async_fire(EVENT_UPDATED, {"kind": "typing", "thread_id": msg["thread_id"], "sender_id": connection.user.id, "sender_name": str(connection.user.name or "Someone")[:80], "typing": msg["typing"], "session_id": msg.get("session_id", "legacy")})
    connection.send_result(msg["id"])


def _error(connection, msg: dict, err: Exception) -> None:
    code = "unauthorized" if isinstance(err, PermissionError) else "invalid_format"
    connection.send_error(msg["id"], code, str(err))


ATTACHMENT_SCHEMA = vol.Schema(
    {
        vol.Required("url"): vol.All(cv.string, vol.Length(min=1, max=MAX_ATTACHMENT_REFERENCE_LENGTH)),
        vol.Optional("content_type", default="image/*"): vol.All(cv.string, vol.Length(min=1, max=100)),
        vol.Optional("name", default="Shared image"): vol.All(cv.string, vol.Length(max=MAX_ATTACHMENT_NAME_LENGTH)),
    }
)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/diagnostics"})
@websocket_api.async_response
async def ws_diagnostics(hass, connection, msg) -> None:
    """Report the running backend version and most recent emitted event."""
    store = _store(hass)
    visible_threads = {
        thread_id
        for thread_id, thread in store.data["threads"].items()
        if store.can_access(thread, connection.user.id)
    }
    last_event = store.last_event
    if last_event and last_event.get("kind") in {"bookmark_updated", "favorites_updated", "reminders_updated", "reminder_due"} and last_event.get("user_id") != connection.user.id:
        last_event = None
    if last_event and last_event.get("thread_id") not in visible_threads and last_event.get("thread_id") != "*":
        last_event = None
    connection.send_result(
        msg["id"],
        {
            "integration_version": INTEGRATION_VERSION,
            "message_event": EVENT_MESSAGE_SENT,
            "update_event": EVENT_UPDATED,
            "last_event": last_event,
            "thread_count": len(visible_threads),
            "message_count": sum(len(store.data["messages"].get(thread_id, [])) for thread_id in visible_threads),
        },
    )


@websocket_api.websocket_command({vol.Required("type"): "hassenger/threads/list", vol.Optional("include_archived", default=False): cv.boolean})
@websocket_api.async_response
async def ws_threads_list(hass, connection, msg) -> None:
    """List threads visible to the signed-in user."""
    connection.send_result(msg["id"], _store(hass).list_threads(connection.user.id, connection.user.is_admin, msg["include_archived"]))


@websocket_api.websocket_command({vol.Required("type"): "hassenger/messages/list", vol.Required("thread_id"): THREAD_ID, vol.Optional("limit", default=100): vol.All(vol.Coerce(int), vol.Range(min=1, max=500)), vol.Optional("before"): cv.string})
@websocket_api.async_response
async def ws_messages_list(hass, connection, msg) -> None:
    """List messages in an accessible thread."""
    try:
        result = _store(hass).list_messages(msg["thread_id"], connection.user.id, connection.user.is_admin, msg["limit"], msg.get("before"))
        connection.send_result(msg["id"], result)
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/messages/send", vol.Required("thread_id"): THREAD_ID, vol.Optional("text", default=""): vol.All(cv.string, vol.Length(max=MAX_MESSAGE_LENGTH)), vol.Optional("attachment"): ATTACHMENT_SCHEMA, vol.Optional("message_type", default="text"): vol.In(["text", "system", "success", "warning", "error"]), vol.Optional("reply_to"): THREAD_ID, vol.Optional("client_id"): THREAD_ID})
@websocket_api.async_response
async def ws_messages_send(hass, connection, msg) -> None:
    """Send a message as the signed-in user."""
    try:
        message_type = msg["message_type"] if connection.user.is_admin else "text"
        result = await _store(hass).send_message(msg["thread_id"], connection.user.id, connection.user.name, msg["text"], connection.user.is_admin, message_type, msg.get("reply_to"), attachment=msg.get("attachment"), client_id=msg.get("client_id"))
        connection.send_result(msg["id"], result)
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/messages/edit", vol.Required("thread_id"): THREAD_ID, vol.Required("message_id"): THREAD_ID, vol.Required("text"): vol.All(cv.string, vol.Length(min=1, max=MAX_MESSAGE_LENGTH))})
@websocket_api.async_response
async def ws_messages_edit(hass, connection, msg) -> None:
    """Edit a message."""
    try:
        result = await _store(hass).edit_message(msg["thread_id"], msg["message_id"], connection.user.id, msg["text"], connection.user.is_admin)
        connection.send_result(msg["id"], result)
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/messages/delete", vol.Required("thread_id"): THREAD_ID, vol.Required("message_id"): THREAD_ID})
@websocket_api.async_response
async def ws_messages_delete(hass, connection, msg) -> None:
    """Delete a message."""
    try:
        result = await _store(hass).delete_message(msg["thread_id"], msg["message_id"], connection.user.id, connection.user.is_admin)
        connection.send_result(msg["id"], result)
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/messages/react", vol.Required("thread_id"): THREAD_ID, vol.Required("message_id"): THREAD_ID, vol.Required("emoji"): vol.All(cv.string, vol.Length(min=1, max=16))})
@websocket_api.async_response
async def ws_messages_react(hass, connection, msg) -> None:
    """Toggle a reaction."""
    try:
        result = await _store(hass).react(msg["thread_id"], msg["message_id"], connection.user.id, msg["emoji"], connection.user.is_admin)
        connection.send_result(msg["id"], result)
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/thread/mark_read", vol.Required("thread_id"): THREAD_ID})
@websocket_api.async_response
async def ws_mark_read(hass, connection, msg) -> None:
    """Mark a thread read."""
    try:
        result = await _store(hass).mark_read(msg["thread_id"], connection.user.id, connection.user.is_admin)
        connection.send_result(msg["id"], result)
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/thread/flag", vol.Required("thread_id"): THREAD_ID, vol.Required("flag"): vol.In(["mute", "archive", "pin"]), vol.Required("enabled"): cv.boolean})
@websocket_api.async_response
async def ws_thread_flag(hass, connection, msg) -> None:
    """Mute or archive a thread for the signed-in user."""
    try:
        await _store(hass).set_thread_flag(msg["thread_id"], connection.user.id, connection.user.is_admin, msg["flag"], msg["enabled"])
        connection.send_result(msg["id"])
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command({vol.Required("type"): "hassenger/thread/create", vol.Required("title"): vol.All(cv.string, vol.Length(min=1, max=MAX_THREAD_TITLE_LENGTH)), vol.Required("participants"): vol.All([THREAD_ID], vol.Length(min=1, max=MAX_PARTICIPANTS)), vol.Optional("icon", default="mdi:message"): cv.icon, vol.Optional("image", default=""): vol.All(cv.string, vol.Length(max=MAX_ATTACHMENT_REFERENCE_LENGTH)), vol.Optional("color", default=""): vol.All(cv.string, vol.Length(max=32)), vol.Optional("thread_id"): THREAD_ID})
async def ws_thread_create(hass, connection, msg) -> None:
    """Create a private thread as an administrator."""
    try:
        result = await _store(hass).create_thread(msg["title"], msg["participants"], msg["icon"], msg["color"], msg.get("thread_id"), msg["image"])
        connection.send_result(msg["id"], result)
    except ValueError as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/thread/update", vol.Required("thread_id"): THREAD_ID, vol.Required("title"): vol.All(cv.string, vol.Length(min=1, max=MAX_THREAD_TITLE_LENGTH)), vol.Required("participants"): vol.All([THREAD_ID], vol.Length(min=1, max=MAX_PARTICIPANTS))})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_thread_update(hass, connection, msg) -> None:
    """Rename and manage participants as a participating administrator."""
    try:
        result = await _store(hass).update_thread(msg["thread_id"], connection.user.id, connection.user.is_admin, msg["title"], msg["participants"])
        connection.send_result(msg["id"], result)
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command({vol.Required("type"): "hassenger/thread/delete", vol.Required("thread_id"): THREAD_ID})
async def ws_thread_delete(hass, connection, msg) -> None:
    """Permanently delete a thread as an administrator."""
    try:
        await _store(hass).delete_thread(msg["thread_id"])
        connection.send_result(msg["id"])
    except ValueError as err:
        _error(connection, msg, err)


@websocket_api.require_admin
@websocket_api.async_response
@websocket_api.websocket_command({vol.Required("type"): "hassenger/users/list"})
async def ws_users_list(hass, connection, msg) -> None:
    """List selectable Home Assistant users for an admin creating a thread."""
    users = await hass.auth.async_get_users()
    result = [
        {"id": user.id, "name": user.name or user.id, "is_admin": user.is_admin}
        for user in users
        if user.is_active and not user.system_generated
    ]
    connection.send_result(msg["id"], sorted(result, key=lambda item: item["name"].casefold()))


@websocket_api.websocket_command({vol.Required("type"): "hassenger/contacts/list"})
@websocket_api.async_response
async def ws_contacts_list(hass, connection, msg) -> None:
    """List active same-server users and their linked Person state."""
    users = await hass.auth.async_get_users()
    store = _store(hass)
    result = []
    for user in users:
        if not user.is_active or user.system_generated:
            continue
        result.append(
            {
                "id": user.id,
                "name": user.name or user.id,
                "is_self": user.id == connection.user.id,
                **store.person_state_for_user(user.id),
            }
        )
    connection.send_result(msg["id"], sorted(result, key=lambda item: (not item["is_self"], item["name"].casefold())))


@websocket_api.websocket_command({vol.Required("type"): "hassenger/direct_thread/open", vol.Required("target_user_id"): THREAD_ID})
@websocket_api.async_response
async def ws_direct_thread_open(hass, connection, msg) -> None:
    """Open or safely create an exact two-person conversation."""
    try:
        users = await hass.auth.async_get_users()
        target = next(
            (
                user
                for user in users
                if user.id == msg["target_user_id"] and user.is_active and not user.system_generated
            ),
            None,
        )
        if target is None:
            raise ValueError("The selected contact is not an active Home Assistant user")
        thread, created = await _store(hass).open_direct_thread(
            connection.user.id,
            target.id,
            connection.user.name or connection.user.id,
            target.name or target.id,
        )
        connection.send_result(msg["id"], {"thread": thread, "created": created})
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/presence/list"})
@websocket_api.async_response
async def ws_presence_list(hass, connection, msg) -> None:
    """Return shared Hassenger presence preferences for active users."""
    users = await hass.auth.async_get_users()
    active_ids = {user.id for user in users if user.is_active and not user.system_generated}
    presence = _store(hass).list_presence()
    connection.send_result(msg["id"], {user_id: value for user_id, value in presence.items() if user_id in active_ids})


PRESENCE_MESSAGE = vol.All(cv.string, vol.Length(max=MAX_PRESENCE_MESSAGE_LENGTH))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "hassenger/presence/set",
        vol.Required("mode"): vol.In(["automatic", "available", "away", "busy", "offline"]),
        vol.Optional("home_message", default=""): PRESENCE_MESSAGE,
        vol.Optional("away_message", default=""): PRESENCE_MESSAGE,
        vol.Optional("available_message", default=""): PRESENCE_MESSAGE,
        vol.Optional("busy_message", default=""): PRESENCE_MESSAGE,
        vol.Optional("offline_message", default=""): PRESENCE_MESSAGE,
        vol.Optional("share_typing"): cv.boolean,
        vol.Optional("share_last_active"): cv.boolean,
        vol.Optional("duration_minutes"): vol.All(vol.Coerce(int), vol.Range(min=0, max=1440)),
        vol.Optional("quiet_start"): vol.All(cv.string, vol.Length(max=5)),
        vol.Optional("quiet_end"): vol.All(cv.string, vol.Length(max=5)),
        vol.Optional("quiet_timezone"): vol.All(cv.string, vol.Length(min=1, max=128)),
    }
)
@websocket_api.async_response
async def ws_presence_set(hass, connection, msg) -> None:
    """Update only the signed-in user's shared Hassenger presence."""
    try:
        value = {key: msg[key] for key in ("mode", "home_message", "away_message", "available_message", "busy_message", "offline_message")}
        value.update({key: msg[key] for key in ("share_typing", "share_last_active", "duration_minutes", "quiet_start", "quiet_end", "quiet_timezone") if key in msg})
        result = await _store(hass).set_presence(connection.user.id, value)
        connection.send_result(msg["id"], result)
    except ValueError as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/subscribe"})
@callback
def ws_subscribe(hass, connection, msg) -> None:
    """Subscribe to Hassenger updates."""
    @callback
    def forward(event) -> None:
        thread_id = event.data.get("thread_id")
        thread = _store(hass).data["threads"].get(thread_id)
        if event.data.get("kind") in {"bookmark_updated", "favorites_updated", "reminders_updated", "reminder_due"} and event.data.get("user_id") != connection.user.id:
            return
        if event.data.get("kind") == "thread_updated":
            if connection.user.id in event.data.get("previous_participants", []) or (thread and _store(hass).can_access(thread, connection.user.id)):
                connection.send_event(msg["id"], {"thread_id": thread_id, "kind": "thread_updated"})
            return
        deleted_participants = event.data.get("participants", []) if event.data.get("kind") == "thread_deleted" else []
        if thread_id == "*" or connection.user.id in deleted_participants or (thread and _store(hass).can_access(thread, connection.user.id)):
            connection.send_event(msg["id"], event.data)

    connection.subscriptions[msg["id"]] = hass.bus.async_listen(EVENT_UPDATED, forward)
    connection.send_result(msg["id"])


COMMANDS = (ws_diagnostics, ws_threads_list, ws_messages_list, ws_messages_send, ws_messages_edit, ws_messages_delete, ws_messages_react, ws_mark_read, ws_thread_flag, ws_thread_create, ws_thread_update, ws_thread_delete, ws_users_list, ws_contacts_list, ws_direct_thread_open, ws_presence_list, ws_presence_set, ws_subscribe)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/messages/search", vol.Required("thread_id"): THREAD_ID, vol.Required("query"): vol.All(cv.string, vol.Length(min=1, max=200))})
@websocket_api.async_response
async def ws_messages_search(hass, connection, msg) -> None:
    try:
        connection.send_result(msg["id"], _store(hass).search_messages(msg["thread_id"], connection.user.id, msg["query"]))
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/thread/export", vol.Required("thread_id"): THREAD_ID})
@websocket_api.async_response
async def ws_thread_export(hass, connection, msg) -> None:
    try:
        connection.send_result(msg["id"], _store(hass).export_thread(msg["thread_id"], connection.user.id))
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/schedule/create", vol.Required("thread_id"): THREAD_ID, vol.Required("text"): vol.All(cv.string, vol.Length(min=1, max=MAX_MESSAGE_LENGTH)), vol.Required("delay_minutes"): vol.All(vol.Coerce(int), vol.Range(min=1, max=10080))})
@websocket_api.async_response
async def ws_schedule_create(hass, connection, msg) -> None:
    try:
        connection.send_result(msg["id"], await _store(hass).schedule_message(msg["thread_id"], connection.user.id, msg["text"], msg["delay_minutes"]))
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/schedule/list"})
@websocket_api.async_response
async def ws_schedule_list(hass, connection, msg) -> None:
    connection.send_result(msg["id"], _store(hass).list_scheduled(connection.user.id))


@websocket_api.websocket_command({vol.Required("type"): "hassenger/schedule/cancel", vol.Required("schedule_id"): THREAD_ID})
@websocket_api.async_response
async def ws_schedule_cancel(hass, connection, msg) -> None:
    try:
        await _store(hass).cancel_scheduled(connection.user.id, msg["schedule_id"])
        connection.send_result(msg["id"])
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/bookmark/set", vol.Required("thread_id"): THREAD_ID, vol.Required("message_id"): THREAD_ID, vol.Required("enabled"): cv.boolean})
@websocket_api.async_response
async def ws_bookmark_set(hass, connection, msg) -> None:
    try:
        await _store(hass).bookmark_message(msg["thread_id"], msg["message_id"], connection.user.id, msg["enabled"])
        connection.send_result(msg["id"])
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/bookmark/list", vol.Required("thread_id"): THREAD_ID})
@websocket_api.async_response
async def ws_bookmark_list(hass, connection, msg) -> None:
    try:
        connection.send_result(msg["id"], _store(hass).list_bookmarks(msg["thread_id"], connection.user.id))
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/activity/ping"})
@websocket_api.async_response
async def ws_activity(hass, connection, msg) -> None:
    await _store(hass).record_activity(connection.user.id)
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "hassenger/favorites/list"})
@websocket_api.async_response
async def ws_favorites_list(hass, connection, msg) -> None:
    connection.send_result(msg["id"], _store(hass).list_favorites(connection.user.id))


@websocket_api.websocket_command({vol.Required("type"): "hassenger/favorites/set", vol.Required("target_user_id"): THREAD_ID, vol.Required("enabled"): cv.boolean})
@websocket_api.async_response
async def ws_favorites_set(hass, connection, msg) -> None:
    try:
        connection.send_result(msg["id"], await _store(hass).set_favorite(connection.user.id, msg["target_user_id"], msg["enabled"]))
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/pins/list", vol.Required("thread_id"): THREAD_ID})
@websocket_api.async_response
async def ws_pins_list(hass, connection, msg) -> None:
    try:
        connection.send_result(msg["id"], _store(hass).list_pins(msg["thread_id"], connection.user.id))
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/pins/set", vol.Required("thread_id"): THREAD_ID, vol.Required("message_id"): THREAD_ID, vol.Required("enabled"): cv.boolean})
@websocket_api.async_response
async def ws_pins_set(hass, connection, msg) -> None:
    try:
        await _store(hass).set_message_pin(msg["thread_id"], msg["message_id"], connection.user.id, msg["enabled"])
        connection.send_result(msg["id"])
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/reminders/list"})
@websocket_api.async_response
async def ws_reminders_list(hass, connection, msg) -> None:
    connection.send_result(msg["id"], _store(hass).list_reminders(connection.user.id))


@websocket_api.websocket_command({vol.Required("type"): "hassenger/reminders/create", vol.Required("text"): vol.All(cv.string, vol.Length(min=1, max=MAX_MESSAGE_LENGTH)), vol.Required("delay_minutes"): vol.All(vol.Coerce(int), vol.Range(min=1, max=10080)), vol.Optional("repeat_minutes", default=0): vol.In([0, 60, 1440, 10080])})
@websocket_api.async_response
async def ws_reminders_create(hass, connection, msg) -> None:
    try:
        connection.send_result(msg["id"], await _store(hass).create_reminder(connection.user.id, msg["text"], msg["delay_minutes"], msg["repeat_minutes"]))
    except ValueError as err:
        _error(connection, msg, err)


@websocket_api.websocket_command({vol.Required("type"): "hassenger/reminders/update", vol.Required("reminder_id"): THREAD_ID, vol.Required("action"): vol.In(["complete", "cancel", "snooze"]), vol.Optional("minutes", default=15): vol.All(vol.Coerce(int), vol.Range(min=1, max=10080))})
@websocket_api.async_response
async def ws_reminders_update(hass, connection, msg) -> None:
    try:
        await _store(hass).update_reminder(connection.user.id, msg["reminder_id"], msg["action"], msg["minutes"])
        connection.send_result(msg["id"])
    except (PermissionError, ValueError) as err:
        _error(connection, msg, err)


def async_register(hass: HomeAssistant) -> None:
    """Register all Hassenger WebSocket commands."""
    for command in (*COMMANDS, ws_typing, ws_messages_search, ws_thread_export, ws_schedule_create, ws_schedule_list, ws_schedule_cancel, ws_bookmark_set, ws_bookmark_list, ws_activity, ws_favorites_list, ws_favorites_set, ws_pins_list, ws_pins_set, ws_reminders_list, ws_reminders_create, ws_reminders_update):
        websocket_api.async_register_command(hass, command)
