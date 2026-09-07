"""Controlled TTS and optional pre-chime playback for Hassenger."""

from __future__ import annotations

import asyncio

from homeassistant.components.media_player import (
    ATTR_MEDIA_ANNOUNCE,
    ATTR_MEDIA_CONTENT_ID,
    ATTR_MEDIA_CONTENT_TYPE,
    ATTR_MEDIA_EXTRA,
    DOMAIN as MEDIA_PLAYER_DOMAIN,
    SERVICE_PLAY_MEDIA,
    MediaType,
)
from homeassistant.components.tts import async_get_media_source_audio
from homeassistant.components.tts.media_source import generate_media_source_id
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import Context, HomeAssistant


async def async_speak_message(
    hass: HomeAssistant,
    *,
    tts_engine: str,
    media_player_entity_ids: list[str],
    message: str,
    cache: bool,
    announce: bool,
    language: str | None = None,
    use_pre_announce: bool = False,
    chime_media_content_id: str = "",
    chime_media_content_type: str = "music",
    chime_wait_seconds: float = 0,
    context: Context | None = None,
) -> None:
    """Play an optional sound, wait exactly, then play generated TTS media."""
    chime_id = chime_media_content_id.strip()
    if chime_id:
        await hass.services.async_call(
            MEDIA_PLAYER_DOMAIN,
            SERVICE_PLAY_MEDIA,
            {
                ATTR_ENTITY_ID: media_player_entity_ids,
                ATTR_MEDIA_CONTENT_ID: chime_id,
                ATTR_MEDIA_CONTENT_TYPE: chime_media_content_type or "music",
                ATTR_MEDIA_ANNOUNCE: False,
            },
            blocking=True,
            context=context,
        )
        if chime_wait_seconds > 0:
            await asyncio.sleep(chime_wait_seconds)

    tts_media_source_id = generate_media_source_id(
        hass,
        message=message,
        engine=tts_engine,
        language=language or None,
        cache=cache,
    )
    # Fully generate the Piper audio before Cast starts consuming it. Without
    # this, some Cast devices can start the live TTS stream and lose its tail.
    await async_get_media_source_audio(hass, tts_media_source_id)
    await hass.services.async_call(
        MEDIA_PLAYER_DOMAIN,
        SERVICE_PLAY_MEDIA,
        {
            ATTR_ENTITY_ID: media_player_entity_ids,
            ATTR_MEDIA_CONTENT_ID: tts_media_source_id,
            ATTR_MEDIA_CONTENT_TYPE: MediaType.MUSIC,
            ATTR_MEDIA_ANNOUNCE: announce,
            # Music Assistant separates its reliable announcement route from
            # the optional pre-announcement sound. Native Cast safely ignores
            # this extra value while Music Assistant consumes it.
            ATTR_MEDIA_EXTRA: {"use_pre_announce": use_pre_announce},
        },
        blocking=True,
        context=context,
    )
