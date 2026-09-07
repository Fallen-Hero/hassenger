# Changelog

## 1.0.0 — 2026-09-07

- Add preset-aware contact profiles with full status messages, opt-in last-used information, direct chat, favorites, and accessible close/focus behavior.
- Persistent participant-scoped conversations, Contacts, presence/typing controls, read receipts, message tools, media uploads, search, favorites, shared pins and private reminders.
- Home Assistant Assist/TTS destinations, actionable-reply blueprints, configurable presets, branding and a categorized visual editor.
- Default-collapsed Quick messages, optional microphone, and a preserved 400 px conversation area for new cards.
- Fix conversation-menu clipping by sizing and positioning the scrollable menu within the card and viewport, including small cards, page scrolling and scaled layouts.
- Avoid duplicate navigation: a visible top inbox replaces the compact Contacts conversation dropdown, with conversation actions retained in the footer.
- Apply custom conversation names to Contacts conversation rows and search, and custom sender names to typing indicators. Empty names in an earlier matching appearance override no longer mask a later custom name.
- Include the approved Hassenger logo and the owner's Buy Me a Coffee link in the README.
- Keep integration/card/service identities and storage/config schema versions unchanged. Align product metadata, links and resource URLs to 1.0.0 for the first public release.
- Provide first-time installation instructions and general backup/update guidance for future releases.
- Require Home Assistant Core 2026.9.1 or newer, matching the maintainer-tested version.
- Correct GitHub workflow context, Home Assistant dependency/schema declarations and manifest ordering; preserve editor focus without delayed composer retries interrupting other controls.
- Publish a verified full-source ZIP and SHA-256 checksum through a manually triggered, test-gated release workflow.
- Use stable, unversioned blueprint filenames for the first public release.
