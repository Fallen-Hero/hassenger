# Updating Hassenger

For 1.0.0 → 1.0.1, back up Home Assistant, update the integration, restart, and load `/hassenger/hassenger-card.js?v=1.0.1`. Managed attachments migrate from shared Media to `config/hassenger` before setup completes. Keep that private directory in backups and outside all configured Media roots and `www`.

If migration cannot copy, save, or remove an old file, setup fails and the logs identify the error. Correct the filesystem/storage issue and retry; migration preserves originals until the new references are saved. Do not downgrade to 1.0.0 after migration without restoring a matching backup.

See [1.0.1 release notes](RELEASE_NOTES_1.0.1.md) for privacy scope and testing. New users should follow [First-time setup](FIRST_TIME_SETUP.md).

For future updates:

1. Back up Home Assistant, including Hassenger data and automations.
2. Read the release notes before installing the update.
3. Update the complete Hassenger integration and restart Home Assistant.
4. Load the matching bundled card resource and refresh your browsers.
5. Test a conversation and any notification or speaker automations you use.

Do not delete and recreate the integration as a routine update step. Blueprint filenames are stable; follow release-specific instructions if an automation needs adjustment.
