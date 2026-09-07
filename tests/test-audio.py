"""Executable TTS/chime sequencing regression checks for Hassenger."""

from __future__ import annotations

import asyncio
import importlib.util
import pathlib
import sys
import types


media_player = types.ModuleType("homeassistant.components.media_player")
media_player.ATTR_MEDIA_ANNOUNCE = "announce"
media_player.ATTR_MEDIA_CONTENT_ID = "media_content_id"
media_player.ATTR_MEDIA_CONTENT_TYPE = "media_content_type"
media_player.ATTR_MEDIA_EXTRA = "extra"
media_player.DOMAIN = "media_player"
media_player.SERVICE_PLAY_MEDIA = "play_media"
media_player.MediaType = types.SimpleNamespace(MUSIC="music")
tts = types.ModuleType("homeassistant.components.tts")
tts_calls = []


async def async_get_media_source_audio(_hass, media_id):
    tts_calls.append(("buffer", media_id))


tts.async_get_media_source_audio = async_get_media_source_audio
tts_media_source = types.ModuleType("homeassistant.components.tts.media_source")


def generate_media_source_id(_hass, **data):
    tts_calls.append(("generate", data))
    return "media-source://tts/generated"


tts_media_source.generate_media_source_id = generate_media_source_id
const = types.ModuleType("homeassistant.const")
const.ATTR_ENTITY_ID = "entity_id"
core = types.ModuleType("homeassistant.core")
core.Context = object
core.HomeAssistant = object
sys.modules.update(
    {
        "homeassistant": types.ModuleType("homeassistant"),
        "homeassistant.components": types.ModuleType("homeassistant.components"),
        "homeassistant.components.media_player": media_player,
        "homeassistant.components.tts": tts,
        "homeassistant.components.tts.media_source": tts_media_source,
        "homeassistant.const": const,
        "homeassistant.core": core,
    }
)

source = pathlib.Path(__file__).resolve().parent.parent / "custom_components" / "hassenger" / "audio.py"
spec = importlib.util.spec_from_file_location("hassenger_audio", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FakeServices:
    def __init__(self):
        self.calls = []

    async def async_call(self, domain, service, data, *, blocking, context):
        self.calls.append((domain, service, data, blocking, context))


async def main():
    services = FakeServices()
    hass = types.SimpleNamespace(services=services)
    waits = []

    async def fake_sleep(seconds):
        waits.append(seconds)

    module.asyncio.sleep = fake_sleep
    context = object()
    await module.async_speak_message(
        hass,
        tts_engine="tts.example",
        media_player_entity_ids=["media_player.example"],
        message="Person #1 sent a message.",
        cache=True,
        language="",
        announce=True,
        use_pre_announce=False,
        context=context,
    )
    assert waits == [] and len(services.calls) == 1
    generated = next(data for kind, data in tts_calls if kind == "generate")
    assert generated["language"] is None and generated["cache"] is True
    spoken = services.calls[-1][2]
    assert spoken["announce"] is True
    assert spoken["extra"] == {"use_pre_announce": False}
    assert tts_calls[-1] == ("buffer", "media-source://tts/generated")

    services.calls.clear()
    waits.clear()
    tts_calls.clear()
    await module.async_speak_message(
        hass,
        tts_engine="tts.example",
        media_player_entity_ids=["media_player.one", "media_player.two"],
        message="Person #2 replied.",
        cache=False,
        language="en-US",
        announce=False,
        use_pre_announce=True,
        chime_media_content_id="media-source://media_source/local/chime.mp3",
        chime_media_content_type="audio/mpeg",
        chime_wait_seconds=2.25,
        context=context,
    )
    assert waits == [2.25] and len(services.calls) == 2
    chime, spoken = services.calls[0][2], services.calls[1][2]
    assert chime["announce"] is False and chime["media_content_type"] == "audio/mpeg"
    assert spoken["announce"] is False and spoken["extra"] == {"use_pre_announce": True}
    assert tts_calls[0][1]["language"] == "en-US"
    assert tts_calls[1] == ("buffer", "media-source://tts/generated")

    print("TTS generation buffering, announce/pre-announce independence, optional chime, and exact wait sequencing tests passed.")


asyncio.run(main())
