# Hassenger improvement pass

This tracks the requested roadmap. A checked implementation is not a live-device release certification.

## 1.0.0 public-release review

- [x] Preserve a 400 px conversation area by default on new cards; retain explicit existing height settings.
- [x] Bound conversation menus to the actual card/viewport rather than a viewport-only maximum.
- [x] Align product version metadata and GitHub links for the first public release.
- [x] Document first-time setup and future updates; use stable, unversioned blueprint filenames.
- [ ] Complete remaining real-device, minimum-version, Firefox and owner-controlled publication gates.

## Messaging, privacy, and editor features

- [x] Refined conversation bar, quieter shortcut selectors, integrated attachment/composer controls, optional Classic layout.
- [x] Typing session separation, account-level sharing preference and server-side activity limits.
- [x] Timed presence with a return to the previous mode.
- [x] Uncertain-send idempotency, opt-in draft recovery and account-switch result isolation.
- [x] Personal conversation pins (including direct-contact priority) and navigation unread badges.
- [x] Private saved-message lists, full-history search and jump-to-reply navigation.
- [x] JSON export, sanitized diagnostics and backup guidance.
- [x] Quiet hours and opt-in card notification sound.
- [x] Scheduled plain text with cancellation, access revalidation and duplicate-send protection.
- [x] Bounded image viewer, file error/retry paths, PDF links and MP3/WAV uploads.
- [x] Editor categorization, conditional controls, nested collapse, search synonyms and setup recipes with Undo.
- [x] Accurate status-not-shared wording and remembered/reorderable Contacts sections.
- [x] Keyboard/dialog, reduced-motion and responsive regression coverage; real assistive-technology review remains below.
- [x] Reproducible candidate packaging, file allowlists and exact-version/hash checks.

## Contacts, favorites, and reminders

- [x] Optional account-level last-active sharing, disabled by default, showing minute-level Hassenger interaction rather than online/offline inference.
- [x] Private favorite-contact stars before a direct conversation exists, with favorite-first sorting.
- [x] Shared pinned-message board, distinct from private saved messages and personal conversation pins.
- [x] Private in-app reminders with due state, completion, snooze, cancellation and interval repeats.
- [x] Automated four-card session exercise, message-event deduplication, removal/reattachment and subscription cleanup.
- [x] Bounded automatic transcript accumulation while following the latest message.

All previously proposed feature items above are implemented. Real-session certification is still outstanding.

## Compact controls and preset polish

- [x] Default-collapsed Quick inside the composer, with grouped wrapping buttons and selectable previous dropdowns.
- [x] Independent opt-in microphone and adjacent microphone/Send controls.
- [x] Preset-aware Contacts headings, including the matching Retro blue gradient.
- [x] One header search entry for active-conversation history and input-focus/dialog isolation checks.

## Environment-dependent release gates

- [ ] Live two-participant plus nonparticipant-administrator tests.
- [ ] Extended live-session/overnight soak, reconnect and multiple physical devices.
- [ ] Clean Home Assistant installation, restart, backup and restore.
- [ ] Real iOS/Android browsers and Companion notifications.
- [ ] Real microphone, Assist and speaker/TTS tests.
- [x] Current blueprint schema rerun: both blueprints passed from the delivered 1.0.0 ZIP with a fresh dependency.
- [ ] Firefox: the local Windows headless renderer still fails; run on a working host/CI.
- [ ] Final repository owner, HACS/Hassfest and release installation.

Package links target Fallen-Hero/hassenger. Live Home Assistant and remote repository validation remain outstanding.
