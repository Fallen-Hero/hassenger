## Hassenger 1.0.1

### Privacy and reliability fixes
- Uploaded attachments are stored in `config/hassenger`, outside Home Assistant's shared Media library. Every download requires a signed-in conversation participant; administrator status alone does not grant access.
- Existing managed uploads in configured Media `hassenger` folders are migrated on startup. Conversation pictures and message references are preserved. Unreferenced managed files are moved out of shared Media without granting download access.
- The card fetches private attachments using the current login session and clears downloaded media when accounts change. Uploads no longer fall back to shared Home Assistant Media storage.
- Quiet-hours timezones are resolved asynchronously when preferences load or change, and reused when sending messages.

### Updating
1. Back up Home Assistant, including Media and the configuration directory.
2. Update Hassenger and restart Home Assistant. Migration must succeed before the integration becomes available; check the logs if setup fails.
3. Update the dashboard resource to `/hassenger/hassenger-card.js?v=1.0.1` and reload the browser/app.

Keep `config/hassenger` in backups and outside configured Media roots and `www`. Files deliberately attached through external URLs, `/local/`, or the general Media picker retain the permissions of their original source. Legacy copies in backups and previously downloaded files are not changed by migration.

### Validation
The release workflow gates publication on HACS and Hassfest, the Python regression suites, browser suites and Chromium/Firefox/WebKit smoke tests, archive verification, and tests using the official Home Assistant Core **2026.10.2** container. The latter exercise actual Home Assistant HTTP authentication, persistence, migration, participant authorization, and timezone APIs. Physical devices and Companion App behavior are not exercised by these automated tests.

Minimum supported Home Assistant remains **2026.9.1**. Download `Hassenger-v1.0.1.zip` and its matching SHA-256 file for a complete source archive, or install through HACS as a custom integration repository while default inclusion is pending.
