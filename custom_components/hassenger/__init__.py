"""Hassenger persistent household messaging integration."""

from __future__ import annotations

from pathlib import Path
from datetime import timedelta
from homeassistant.helpers.event import async_track_time_interval

import voluptuous as vol

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .audio import async_speak_message
from .const import DATA_STORE, DEFAULT_RETENTION_DAYS, DOMAIN, INTEGRATION_VERSION, MAX_ATTACHMENT_NAME_LENGTH, MAX_ATTACHMENT_REFERENCE_LENGTH, MAX_MESSAGE_LENGTH, MAX_PARTICIPANTS, MAX_SENDER_NAME_LENGTH, MAX_THREAD_ID_LENGTH, MAX_THREAD_TITLE_LENGTH
from .media_upload import HassengerMediaUploadView
from .store import HassengerStore
from .websocket import async_register as async_register_websocket

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


CREATE_SCHEMA = vol.Schema({vol.Required("title"): vol.All(cv.string, vol.Length(min=1, max=MAX_THREAD_TITLE_LENGTH)), vol.Required("participants"): vol.All([vol.All(cv.string, vol.Length(min=1, max=MAX_THREAD_ID_LENGTH))], vol.Length(min=1, max=MAX_PARTICIPANTS)), vol.Optional("thread_id"): vol.All(cv.string, vol.Length(min=1, max=MAX_THREAD_ID_LENGTH)), vol.Optional("icon", default="mdi:message"): cv.icon, vol.Optional("image", default=""): vol.All(cv.string, vol.Length(max=MAX_ATTACHMENT_REFERENCE_LENGTH)), vol.Optional("color", default=""): vol.All(cv.string, vol.Length(max=32))})
SEND_SCHEMA = vol.Schema({vol.Required("thread_id"): vol.All(cv.string, vol.Length(min=1, max=MAX_THREAD_ID_LENGTH)), vol.Optional("message", default=""): vol.All(cv.string, vol.Length(max=MAX_MESSAGE_LENGTH)), vol.Optional("attachment_url", default=""): vol.All(cv.string, vol.Length(max=MAX_ATTACHMENT_REFERENCE_LENGTH)), vol.Optional("attachment_content_type", default="image/*"): vol.All(cv.string, vol.Length(max=100)), vol.Optional("attachment_name", default="Shared image"): vol.All(cv.string, vol.Length(max=MAX_ATTACHMENT_NAME_LENGTH)), vol.Optional("sender_name", default="Home Assistant"): vol.All(cv.string, vol.Length(max=MAX_SENDER_NAME_LENGTH)), vol.Optional("message_type", default="system"): vol.In(["text", "system", "success", "warning", "error"]), vol.Optional("notify", default=True): cv.boolean})
CLEAR_SCHEMA = vol.Schema({vol.Required("thread_id"): vol.All(cv.string, vol.Length(min=1, max=MAX_THREAD_ID_LENGTH))})
PRUNE_SCHEMA = vol.Schema({vol.Optional("retention_days", default=DEFAULT_RETENTION_DAYS): vol.All(vol.Coerce(int), vol.Range(min=1, max=3650))})
SPEAK_MESSAGE_SCHEMA = vol.Schema({vol.Required("tts_engine"): cv.entity_id, vol.Required("media_player_entity_id"): cv.comp_entity_ids, vol.Required("message"): vol.All(cv.string, vol.Length(min=1, max=MAX_MESSAGE_LENGTH)), vol.Optional("cache", default=True): cv.boolean, vol.Optional("language", default=""): cv.string, vol.Optional("announce", default=True): cv.boolean, vol.Optional("use_pre_announce", default=False): cv.boolean, vol.Optional("chime_media_content_id", default=""): cv.string, vol.Optional("chime_media_content_type", default="music"): cv.string, vol.Optional("chime_wait_seconds", default=0): vol.All(vol.Coerce(float), vol.Range(min=0, max=60))})


async def _async_initialize(hass: HomeAssistant) -> bool:
    """Initialize Hassenger exactly once for config-entry setup."""
    if DATA_STORE in hass.data.get(DOMAIN, {}):
        return True
    store = HassengerStore(hass)
    await store.async_load()
    hass.data.setdefault(DOMAIN, {})[DATA_STORE] = store
    await hass.http.async_register_static_paths(
        [StaticPathConfig("/hassenger/hassenger-card.js", str(Path(__file__).parent / "frontend" / "hassenger-card.js"), False)]
    )
    async_register_websocket(hass)
    hass.http.register_view(HassengerMediaUploadView(hass))

    async def require_admin(call: ServiceCall) -> None:
        if call.context.user_id is None:
            return
        user = await hass.auth.async_get_user(call.context.user_id)
        if user is None or not user.is_admin:
            raise ServiceValidationError("Administrator permission required")

    async def create_thread(call: ServiceCall) -> None:
        await require_admin(call)
        try:
            await store.create_thread(call.data["title"], call.data["participants"], call.data["icon"], call.data["color"], call.data.get("thread_id"), call.data["image"])
        except ValueError as err:
            raise ServiceValidationError(str(err)) from err

    async def send_message(call: ServiceCall) -> None:
        user_id = call.context.user_id or "home_assistant"
        user = await hass.auth.async_get_user(user_id) if call.context.user_id else None
        attachment = None
        if call.data["attachment_url"].strip():
            attachment = {"url": call.data["attachment_url"], "content_type": call.data["attachment_content_type"], "name": call.data["attachment_name"]}
        is_admin = user is None or user.is_admin
        message_type = call.data["message_type"] if is_admin else "text"
        await store.send_message(call.data["thread_id"], user_id, call.data["sender_name"] if not user else user.name, call.data["message"], is_admin, message_type, notify=call.data["notify"], attachment=attachment, bypass_access=is_admin)

    async def clear_thread(call: ServiceCall) -> None:
        await require_admin(call)
        await store.clear_thread(call.data["thread_id"])

    async def delete_thread(call: ServiceCall) -> None:
        await require_admin(call)
        await store.delete_thread(call.data["thread_id"])

    async def prune(call: ServiceCall) -> None:
        await require_admin(call)
        await store.prune(call.data["retention_days"])

    async def speak_message(call: ServiceCall) -> None:
        await async_speak_message(
            hass,
            tts_engine=call.data["tts_engine"],
            media_player_entity_ids=call.data["media_player_entity_id"],
            message=call.data["message"],
            cache=call.data["cache"],
            language=call.data["language"],
            announce=call.data["announce"],
            use_pre_announce=call.data["use_pre_announce"],
            chime_media_content_id=call.data["chime_media_content_id"],
            chime_media_content_type=call.data["chime_media_content_type"],
            chime_wait_seconds=call.data["chime_wait_seconds"],
            context=call.context,
        )

    hass.services.async_register(DOMAIN, "create_thread", create_thread, schema=CREATE_SCHEMA)
    hass.services.async_register(DOMAIN, "send_message", send_message, schema=SEND_SCHEMA)
    hass.services.async_register(DOMAIN, "clear_thread", clear_thread, schema=CLEAR_SCHEMA)
    hass.services.async_register(DOMAIN, "delete_thread", delete_thread, schema=CLEAR_SCHEMA)
    hass.services.async_register(DOMAIN, "prune", prune, schema=PRUNE_SCHEMA)
    hass.services.async_register(DOMAIN, "speak_message", speak_message, schema=SPEAK_MESSAGE_SCHEMA)
    hass.data[DOMAIN]["integration_version"] = INTEGRATION_VERSION
    if not hass.data[DOMAIN].get("schedule_unsubscribe"):
        hass.data[DOMAIN]["schedule_unsubscribe"] = async_track_time_interval(hass, store.deliver_scheduled, timedelta(seconds=30))
    return True


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Prepare Hassenger; config-entry setup owns runtime registration."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up the single config entry."""
    return await _async_initialize(hass)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Require a restart because Home Assistant cannot unregister WS commands/views."""
    return False
