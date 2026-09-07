"""Schema and mute-routing checks for the mobile actionable reply blueprint."""

from __future__ import annotations

import pathlib
from collections.abc import Iterator

import yaml


class HassengerLoader(yaml.SafeLoader):
    pass


HassengerLoader.add_constructor("!input", lambda loader, node: {"!input": loader.construct_scalar(node)})


def mappings(value: object) -> Iterator[dict]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from mappings(child)
    elif isinstance(value, list):
        for child in value:
            yield from mappings(child)


path = pathlib.Path(__file__).resolve().parent.parent / "blueprints" / "automation" / "hassenger" / "mobile_actionable_reply.yaml"
text = path.read_text(encoding="utf-8")
data = yaml.load(text, Loader=HassengerLoader)
inputs = data["blueprint"]["input"]

assert data["blueprint"]["domain"] == "automation"
assert data["blueprint"]["name"] == "Hassenger - Mobile replies, TTS and optional sounds"
assert "integration 1.0.0" in data["blueprint"]["description"]
assert "\\_" not in text
assert inputs["incoming_person"]["selector"]["entity"]["filter"][0]["domain"] == "person"
assert inputs["reply_person"]["selector"]["entity"]["filter"][0]["domain"] == "person"
assert inputs["mobile_device"]["selector"]["device"]["filter"][0]["integration"] == "mobile_app"
assert inputs["tts_engine"]["selector"]["entity"]["filter"][0]["domain"] == "tts"
assert inputs["tts_media_players"]["selector"]["entity"]["multiple"] is True
assert inputs["tts_chime_enabled"]["default"] is False
assert inputs["tts_pre_announce_enabled"]["default"] is False
assert inputs["tts_announce_enabled"]["default"] is True
assert data["triggers"] == [{"trigger": "event", "event_type": "hassenger_message_sent", "event_data": {"kind": "message_sent"}}]
assert data["conditions"] == []
assert data["mode"] == "parallel" and data["max"] == 20

variables = data["actions"][0]["variables"]
assert "muted_by" in variables["incoming_muted_by"]
assert "selected_reply_user_id" in variables["route_is_muted"]
assert "incoming_muted_by" in variables["route_is_muted"]

route_condition = next(
    item["value_template"]
    for item in mappings(data)
    if item.get("condition") == "template" and "sender_matches" in str(item.get("value_template", ""))
)
assert "conversation_matches" in route_condition
assert "not route_is_muted" in route_condition

actions = [item.get("action") for item in mappings(data) if "action" in item]
assert "hassenger.speak_message" in actions
assert "hassenger.send_message" in actions
assert any(item.get("domain") == "mobile_app" and item.get("type") == "notify" for item in mappings(data))

legacy_path = path.with_name("legacy_input_text_message.yaml")
legacy_text = legacy_path.read_text(encoding="utf-8")
legacy = yaml.load(legacy_text, Loader=HassengerLoader)
assert legacy["blueprint"]["domain"] == "automation"
assert legacy["blueprint"]["name"] == "Hassenger - Legacy input_text message"
assert legacy["mode"] == "queued"
assert legacy["blueprint"]["input"]["sender_input"]["selector"]["entity"]["domain"] == "input_text"
assert legacy["blueprint"]["input"]["history_input"]["selector"]["entity"]["domain"] == "input_text"
assert any(item.get("action") == "input_text.set_value" for item in mappings(legacy))
assert "\\_" not in legacy_text

print("Hassenger mobile reply and optional legacy input_text blueprint schema, selectors, mute routing, reply, and TTS tests passed.")
