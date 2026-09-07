# Release checklist

First public release: v1.0.0. Checked items are backed by recorded evidence; unchecked items remain explicit follow-up work, not claims of successful testing. Publication requires the automated release workflow to pass and the maintainer's live smoke-test confirmation.

## Confirmed live smoke testing

- [x] On 2026-09-07, the maintainer confirmed the latest verified package works on Home Assistant Core 2026.9.1 after restart, with messaging between two accounts, media uploads, and mobile use.
- [x] Set the supported minimum to the tested version, Home Assistant Core 2026.9.1. Earlier versions are unverified.

## Required owner information

- [x] Prepare package links for `Fallen-Hero/hassenger`; confirm/create the actual repository before publication.
- [x] Set manifest documentation, issue-tracker, code-owner and private-security links to the selected owner.
- [x] Prepare `v1.0.0` as the first public version with first-time setup and future-update guidance. No tag has been created by package preparation.
- [x] Add a repository description, enable Issues and private vulnerability reporting, and add `home-assistant`, `hacs`, and `messaging` topics.
- [x] Include Home Assistant/HACS icons generated from the exact original mark and verify their dimensions, transparency, hashes, and release layout.

## Automated gates

- [x] Rerun the blueprint schema suite with a readable PyYAML installation. Both included blueprints passed during the 1.0.0 pass.

- [x] GitHub HACS validation passes without ignored checks.
- [x] Hassfest passes.
- [x] All 22 focused browser suites, the Chromium/Firefox/WebKit smoke suite, and 7 Python backend/integration/upload/audio/blueprint/privacy/layout suites pass in GitHub Actions. See VALIDATION_REPORT.md; the release workflow reruns these against the exact selected commit.
- [ ] The release archive contains only allowlisted files; no old ZIPs, unreviewed screenshots, caches, local vendor folders, or generated test output. The six sanitized documentation screenshots and their icon license are intentional.
- [ ] SHA-256 checksum matches the published archive.
- [ ] CI visual-snapshot artifact was reviewed at desktop and phone widths for Modern Chat, RGB Neon, Retro Contacts, and preset-matched contact profiles.
- [ ] Keyboard focus order, visible focus, reduced motion, 200% zoom, VoiceOver, TalkBack, and one desktop screen reader pass the checks in `ACCESSIBILITY.md`.

## Extended real-device follow-up matrix

- [x] Align hacs.json and compatibility documentation to the maintainer-tested Home Assistant Core 2026.9.1 minimum.
- [ ] Verify restart and backup/restore preserve messages/media, reads, presence, mute/archive choices, favorites, shared pins, bookmarks and reminders.
- [ ] Verify favorite/reminder privacy and shared-pin membership on two physical devices, including restart, expiry, snooze/repeats and last-used opt-out.
- [ ] At default height and smaller explicit heights, scroll the conversation menu to its last administrative action; check resizing, page scrolling and keyboard access.

- [ ] Test timed status across restart, account-wide typing opt-out across two devices, quiet-hour timezone/daylight-saving boundaries and opt-in card sound after a user gesture.
- [ ] Verify scheduled text during uptime/downtime, cancellation, revoked membership and error recovery; confirm history clear does not cancel schedules.
- [ ] Verify private saved lists, search/export permissions, account-specific browser drafts, stale account responses, PDF downloads, audio playback and bounded image viewing on real phones.

- [ ] Fresh Home Assistant install: HACS download, restart, integration setup, resource registration, first conversation, send, receive, archive, restore, clear, and delete.
- [ ] Contacts loads active Home Assistant users, safely creates/reuses and immediately opens a two-person chat, keeps groups under Conversations and Assist/TTS under Destinations, centers person/status icons, searches without losing focus, and does not expose a nonparticipant's message history.
- [ ] Manual Available/Away/Busy/Offline status and automatic linked-Person home/not-home/unavailable transitions work for two accounts; each account can update only its own status.
- [ ] Overlay, left, right, and Automatic Contacts placement work on desktop and phone; phones close the drawer after selection; left/right collapse smoothly and do not crush a narrow desktop chat; custom panel gap preserves both panes' preset border/radius, including both animated RGB Neon borders; Retro Contacts remains bright and readable.
- [ ] Two non-administrator participant accounts can exchange messages; an administrator who is not a participant cannot list/read/upload to that conversation.
- [ ] Current iOS Companion App receives, expands, replies, opens the dashboard, honors mute, and handles simultaneous notification actions.
- [ ] Current Android Companion App performs the same notification/reply/mute checks.
- [ ] Selected Cast/Music Assistant speakers complete long TTS with announce on/off, pre-announce on/off, optional chime on/off, and 0/changed wait values.
- [ ] Backup and restore retain conversations and presence preferences; an administrator-invoked 365-day and custom-age prune removes only messages beyond the cutoff and keeps conversations; no automatic prune occurs.
- [ ] Real uploads enforce 10 MiB per file and 100 MiB total managed storage; quota cleanup removes oldest unreferenced files, preserves referenced files, and rejects an upload when referenced media leaves no capacity.
- [ ] Confirm saved conversations, explicit sender-visibility settings, card configuration, drafts/session position, optional helper-based mode, and media references behave correctly after restart and browser refresh.
- [ ] After installing card 1.0.0 / integration 1.0.0, confirm the resource URL uses `?v=1.0.0`, restart Home Assistant, perform one normal refresh, and verify no stale editor or card bundle remains. Repeat once with a deliberately stale browser cache to verify the documented recovery steps.
- [ ] Test typing between two real participants and in a group: stopping, sending, backgrounding, disconnection, privacy toggles on each card, and multiple-tab expiry. No nonparticipant should receive activity.
- [ ] A participating administrator can rename a conversation and change its participants. Added participants can read its history; removed participants lose future access and refresh their inbox. Nonparticipant administrators and ordinary participants cannot edit membership.

## Publication

- [ ] Update versions and changelog once, rebuild, rerun all gates, and never edit the archive afterward.
- [ ] Publish a full GitHub release (not only a tag) with archive, checksum, compatibility notes, first-time setup steps, and known limitations.
- [ ] Install that exact published release through HACS on a clean test system before announcing it.
