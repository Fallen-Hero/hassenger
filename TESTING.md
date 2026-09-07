# Testing Hassenger

The first-public-release review adds 228 conversation-menu cases covering 14 presets, Refined/Classic placement, short fixed-height cards, mobile/desktop viewports, scaling, page scrolling, hit-testing the last action and safely opening/canceling Delete confirmation. New-card 400 px defaults are checked while explicit height configurations remain covered.

The compact-controls pass adds actual keyboard-input tests for composer/search/Contacts/status/editor fields, selection and cursor preservation during background read updates, and separation of dialog typing/Enter from chat drafts and sending. The default-collapsed Quick panel is checked alongside explicit old-style dropdowns; preset tests include microphone adjacency/default-off behavior, bounded long labels and matching Retro header gradients.

The roadmap-completion suite covers private favorites, participant-shared pins, private reminder creation/due/snooze, escaped text, opt-in last-used throttling, preset layouts and pending subscription cleanup. Backend tests cover restart persistence, owner-only events, concurrent due delivery, storage-failure retry, opt-out clearing and deleted-pin cleanup.

The four-card synthetic session test runs briefly in the normal suite. Set HASSENGER_SOAK_MS to 180000 for a three-minute run (maximum 600000). It checks bounded automatic history, duplicate events, stable rendered node counts and subscription cleanup. It is not a real Home Assistant, overnight or physical-device soak.

The 1.0.0 roadmap suite covers Refined/Classic controls, all-preset dropdown and menu containment, private browser drafts, retry IDs, account-switch races, saved/search actions, sanitized diagnostics, scheduled-text requests, media viewer/file controls, setup recipes and remembered Contacts sections. Backend checks exercise private saved lists, export/search authorization, personal pins, timed presence, quiet hours, typing privacy/rate bounds, concurrent scheduled delivery, revoked membership and restart idempotency.

For reproducible candidate packaging, see `scripts/build-release.py` and FEATURE_GUIDE.md. The script refuses overwrite and validates every archived file hash. A partial browser-engine selection does not complete the public release gate.

Typing coverage checks authenticated participant-only broadcasts, absence of message storage, one/two/several names, throttling, no draft leakage, unchanged composer and footer geometry, hostile names, ignored self/stranger events, expiry, reduced motion, display/sharing toggles, and listener/timer cleanup.

Regression coverage includes checks for default-hidden/explicitly-enabled sender reminders, a single Clear messages location, outside-card menu dismissal, name/participant editing, participating-administrator authorization, invalid membership rejection, minimal removal events, and reading-position stability during the first update frames. See VALIDATION_REPORT.md for the current run and outstanding live-device gates.

The release gate is intentionally layered. Passing browser tests does not replace real Home Assistant and Companion App testing.

## Automated coverage

- JavaScript syntax and Python AST parsing.
- All 14 presets, three message layouts, three header-information layouts, 240–768 px card widths, 75–150% scale, and dense conversations/shortcuts.
- iPhone, Android, and tablet portrait/landscape viewports, coarse-pointer targets, dialogs, scroll containers, composer focus, and media controls.
- Mobile message-action trays are checked hidden-at-rest with zero layout height, then through tap, repeated/double-tap, long-press, drag cancellation, one-tray switching, outside dismissal, scaled sizing, desktop hover, and keyboard focus.
- The composer attachment portal is checked across all 14 presets for card/viewport containment and absence of a page-covering background, border, glow, blur, animation, or pointer interception.
- Conversation selection and refresh persistence, smart latest-message following, reading-position anchors (including paged history), unread jump counts, 200-message pagination, and deduplication.
- Visual-editor lazy loading, rapid-change coalescing, compact fields, accessible labels, responsive overflow, and speech-recognition success/failure paths.
- DOM-level write tests for the visible editor controls and configuration paths (see the latest validation report for counts), including every persistent/legacy/private conditional branch, Home Assistant pickers, media selectors, color swatches/resets, and all collection add/remove actions.
- Participant-only reads/uploads/subscriptions/diagnostics, trusted automation delivery, admin management, message ownership, archive/mute isolation, deletion, replies, reactions, administrator-invoked retention pruning, bounds, malformed storage, and attachment validation.
- Authenticated upload routing, exact 10 MiB per-file boundary, 100 MiB managed-media quota, oldest-unreferenced cleanup, referenced-file preservation, full-quota rejection, forged attachment signatures, unsupported types, randomized names, HTTP errors, and legacy endpoint fallback.
- TTS buffering, announce/pre-announce independence, optional chime, exact wait order, and blank/default language handling.
- Default Full Hassenger logo, Compact Hassenger logo alternative, non-overlapping two-color lettering, blank optional title, independent logo/icon/title combinations, theme-aware colors across all 14 presets, custom brand colors and size, unsafe color rejection, RGB Neon glow, 240/280/360 px overflow, and visual-editor controls.
- Quick-message group/message selectors in normal, focused, selected, and post-selection states across all 14 presets, including suppression of native white focus highlighting and preservation of RGB Neon glow.
- Quick-message single/multi-group selection, disabled/editable prompt, editable compact Hide label, complete option availability, fill/send behavior, compact two-selector alignment, accessible labeling, hide/restore behavior, all-preset focus styling, RGB Neon glow, zero horizontal scrolling, and narrow-card containment.
- HACS/Home Assistant icon dimensions and transparency, plus byte-for-byte SHA-256 validation of all three selected original branding PNGs.
- Hostile message/title/dropdown/custom-CSS input, unsafe URLs/CSS declarations, legacy custom-element compatibility, and release privacy/archive allowlists.
- Contacts group/direct/destination routing, authenticated active-user discovery, immediate exact-two-person thread reuse/creation and selection, presence read/write authorization, automatic Person-linked home/away state, bounded hostile status text, centered avatar/status geometry, search-focus retention, and management-control consolidation.
- Contacts overlay/left/right/automatic placement, smooth collapse/expand, forced mobile drawer and close-on-select, adaptive narrow-desktop pane widths, configurable gaps, separate-window radii/borders, bright Retro surface, all-preset inheritance, and dual animated RGB Neon borders.
- Compact upper-left conversation switching, absence of a duplicate footer selector, left-anchored sending identity, and footer containment. Both reaction placements are checked with equal-width short reacted/unreacted bubbles, wrapped long messages, hidden timestamps, multiple directions, bounded rails, unchanged text padding, and zero card overflow. Timestamps remain flush against the outside edge with sent/read checks inline; sender names align above their bubble edge, avatar/bubble tops align, and sent/received fallback avatars use the same circular frame and person glyph at every tested scale.
- Content-sized conversation selection, preset-readable native options, a single outer focus treatment, immediate pre-history Contact selection, and message-border width/style/color rendering across all 14 presets.
- Visual-editor category organization, unique section accents, collapsible Header branding, and Contacts placement/content/status/color controls.
- Regression coverage for stale rapid-switch and older-page responses, optimistic-send isolation, upload-to-conversation isolation, duplicate-create prevention, deferred live updates, immediate clear, saved-view key separation, dismissible attachment/dialog states, presence rejection recovery, custom conversation-menu keyboard/outside dismissal, preset/mobile menu containment, and bounded non-painting media portals.
- Recovery-state coverage for offline detection, first-conversation actions, backend retry, retained failed-send drafts, inline resend, upload progress/cancel, and archive/new-conversation access without a header or Contacts panel.
- Basic/Advanced editor views, searchable settings, per-section Modified/reset controls, Undo after reset/removal, persistent-mode Preview suppression, numeric bounds, and global density configuration.
- Sanitized desktop/mobile screenshot generation for Modern Chat, RGB Neon, Retro Contacts, and preset-matched contact profiles, using official Material Design Icons and fictional sample data. CI uploads these six images for visual review on every run.
- Chromium, Firefox, and WebKit desktop/mobile smoke coverage in CI, in addition to the full Chromium interaction matrix.

The packaged suite currently contains **22 focused Playwright browser suites**, **one Chromium/Firefox/WebKit smoke suite**, and **7 Python backend/integration/upload/audio/blueprint/layout/privacy suites**.

## Local commands

GitHub Actions exports the checked-out commit into a clean temporary release tree before testing it. Git metadata, installed Node dependencies, and the generated package lock remain in the checkout; screenshots go to a separate temporary artifact folder. The strict release allowlist runs before and after the browser tests without ignoring unexpected packaged files. A local checkout containing `.git` or installed dependencies must likewise be exported to a clean folder before running the strict package check or release builder.

Install Python 3.12+, Node 20+, and PyYAML. Run `npm install` to install the declared development dependencies (Playwright 1.62.1 and Material Design Icons 7.4.47), then install Playwright Chromium, Firefox, and WebKit. `HASSENGER_BROWSER_PATH` may point focused Chromium suites to an installed Chrome/Chromium executable.

Run each `tests/test-*-browser.js` with `dist/hassenger-card.js` as its first argument, then run `tests/cross-browser-smoke.js` with the same argument. The visual-snapshot suite writes to `test-results/visual` by default; set `HASSENGER_SCREENSHOT_DIR=docs/screenshots` only when intentionally refreshing the reviewed documentation images. Run each Python file in `tests/` directly. `test-blueprint.py` requires PyYAML. The GitHub workflow is the authoritative command list and runs from a fresh dependency environment.

## Manual Home Assistant matrix

Use two participant accounts plus an administrator account that is not a participant. Link at least one account to a Person entity. Test the exact packaged files after a full Home Assistant restart. Cover creation, sending, simultaneous sends, editing, deleting, reactions, images, GIFs, archive/restore, mute, clear, permanent delete, pruning, backup/restore, browser refresh, tab/session behavior, external image warnings, Assist, TTS, Contacts discovery/search, first-time direct-chat creation and immediate opening, manual and automatic presence, home/not-home/unavailable transitions, every panel placement, narrow and wide dock sizing, dock collapse/expand, gapped preset borders, Retro Contacts contrast, and unauthorized direct WebSocket/upload/presence attempts.

For iOS and Android, test foreground/background/locked delivery, notification expansion, text reply, View chat, multiple outstanding notifications, timeout, mute, attachment-only messages, and notification permissions. Operating-system notification behavior cannot be certified by headless browser tests.

Record Home Assistant, Companion App, browser, Cast/Music Assistant, card, integration, and blueprint versions. Remove all household data from logs/screenshots before attaching them to an issue.
