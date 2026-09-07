"""Config flow for Hassenger."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult

from .const import DOMAIN


class HassengerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a Hassenger config flow."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Create the single local Hassenger instance."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title="Hassenger", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))
