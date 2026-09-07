# Security policy

## Supported version

Security fixes are applied to the latest published Hassenger release. Before reporting a problem, reproduce it with the newest complete integration and card and restart Home Assistant.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that exposes messages, Home Assistant credentials, filesystem content, or another user's conversation. Use GitHub's private vulnerability reporting for the repository. The repository owner must enable that feature before the first public release.

Include the Hassenger card and integration versions, Home Assistant version, a minimal reproduction, and whether the problem requires administrator access. Remove names, conversation IDs, user IDs, tokens, URLs containing authentication signatures, message text, and screenshots with household information.

## Trust boundaries

Favorite contacts, saved messages and reminders are private to the authenticated account at the API/subscription boundary, not separately encrypted. Shared message pins are visible and editable by current conversation participants. Last-used sharing is opt-in and visible to other signed-in users; disabling it clears the stored timestamp. It reports Hassenger interaction at minute precision, not reliable online presence. Reminder text is not included in update events or public chat messages.

Hassenger conversations are participant-filtered in the card and WebSocket API, but they are not end-to-end encrypted. A Home Assistant host administrator can access `.storage`, backups, automation configuration, and the event bus. External image URLs contact an external server when rendered. See the README privacy model before deployment.

Authenticated conversation uploads are limited to supported image/PDF/MP3/WAV signatures, 10 MiB per file, and 100 MiB across Hassenger-managed Media files. Signature checks are not malware scanning. PDF files are links rather than embedded documents. Capacity cleanup preserves every file still referenced by stored Hassenger data and removes only the oldest unreferenced managed files. Deleting or pruning a message removes its reference, not the Media file immediately.

Draft persistence is opt-in and stores unencrypted text in this browser, scoped by account/card. Switching storage mode does not erase old browser copies. Exported JSON contains private messages and references, not bundled files. Scheduled text is stored on the Home Assistant host and rechecks access at delivery. Personal bookmarks and scheduled lists are filtered to their owner. Safe diagnostics deliberately omit content and identifiers; full Debug logs and screenshots do not have that guarantee.

The Contacts endpoint is available only to authenticated Home Assistant users and returns active user IDs/display names plus an optional linked Person entity state and picture. It does not return credentials, email addresses, device trackers, or coordinates. Direct-chat creation validates the target against active Home Assistant users and atomically creates or reuses only an exact two-participant thread.

Presence messages are visible to authenticated Hassenger users because they are intended as shared contact status. A user may update only their own presence record. Modes are allowlisted, messages are bounded to 160 characters, control characters are rejected, and the card HTML-escapes them before display. Do not place sensitive location details in a home or away message.
