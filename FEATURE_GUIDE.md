# Hassenger 1.0.0: controls and recovery

Install the complete integration, restart Home Assistant, and register its bundled card using one resource: `/hassenger/hassenger-card.js?v=1.0.0`.

This is a first-public-release review build. Private 2.x testers should read UPGRADING.md before replacing files. Local automated tests are not a substitute for the real-device and installation gates in RELEASE_CHECKLIST.md.

## Cleaner chat controls

New cards default to a preserved 400 px conversation area. The overall card grows around the header and composer. Explicit existing height settings are retained, including an explicit overall height. The conversation menu is independently bounded to the card and visible viewport, so increasing height is not needed to reach its last actions. Delete conversation remains restricted to participating administrators.

In the visual editor, open **Conversations & message display → Control layout**.

- **Refined** is the default. The selected conversation is a compact upper-left selector without the redundant Conversation caption. Its actions menu sits on the right of that bar. The attachment button is inside the composer, removing the extra toolbar row.
- **Classic** keeps the separate attachment row and the original uniform RGB field glows.
- Quick messages default to a **Quick** button inside the composer. Open it for group tabs and wrapping message buttons; choose one to fill the draft and collapse the panel. Explicit **Send immediately** items retain that behavior and show **Send now**. Large groups stay in a bounded vertical panel.
- Under **Composer, Assist & TTS → Quick messages**, edit the Quick label or select **Always-visible dropdowns** to keep the previous layout and editable prompt/Hide labels. No configured shortcuts means no Quick button.
- The microphone remains hidden by default, independently of Quick. Enable **Message entry → Show speech-to-text button** if wanted. When enabled, the microphone and Send are adjacent; the character count sits before them.
- Retro Messenger's Contacts heading uses the same blue gradient as its chat header, with white text/icons. Other presets use a subtle preset-accent heading; RGB retains adjustable glow and separate-window borders.
- The existing header search button searches the active persistent conversation's retained history. No extra header search icon is added. Legacy and tool transcripts retain loaded-message search.
- Nested visual-editor subsections are collapsible. Main sections retain their distinct accent colors. Search recognizes friends/contacts, shortcuts/quick messages, bubbles and timestamps.

The contacts editor includes **Contact content → Section order**. Contacts, Conversations and Destinations can collapse separately. Their open/closed state is remembered for the signed-in account in this browser. Search temporarily expands results. Pin a direct conversation to put that contact first; pinning is personal and synchronizes through the integration.

## Message tools

The conversation actions menu adds:

- **Pin/Unpin conversation**: personal navigation priority, not a shared pinned-message board.
- **Saved messages**: only your own saved list for the selected conversation. Use the bookmark action on a message to save or remove it. Other participants do not receive your bookmark update.
- **Search all history**: searches retained text on the server, returns at most the newest 100 matches, and loads the selected message's position. Deleted or pruned text cannot be searched.
- Reply quotes are clickable and can load older history. Jump navigation is bounded; extremely old results may require loading additional pages.
- **Export conversation**: downloads JSON containing private message history and attachment references. It does not bundle Media files and is not an importable backup. Maximum 10,000 messages per export.
- **Copy safe diagnostics**: copies versions, configuration mode/preset, counts and viewport dimensions without names, messages, user/conversation IDs, server addresses or authentication tokens. Ordinary Debug output and screenshots may still contain private information.

Message actions remain hidden at rest on mobile and appear through the existing tap/long-press interactions. Desktop hover and keyboard access remain available. Reactions default below the timestamp, without padding out the message bubble.

## Drafts and uncertain sends

In **Conversations & message display → Draft recovery**, choose:

- **Memory only** (default): no saved draft text in browser storage.
- **This tab/session**: recover text across a refresh in the same browser tab.
- **This browser**: recover text after closing/reopening the browser.

Draft keys are scoped to the account and card. Up to 100 nonempty text drafts are stored, each bounded to 4,000 characters. Files and reply context are not persisted. Browser storage is not encrypted by Hassenger; avoid persistent drafts on a shared kiosk. Changing back to Memory only stops future saves but does not erase previously stored browser copies. Clear the site's storage to remove those copies, understanding that this also resets other site preferences and may sign you out.

An uncertain failed send retains its request ID while the same card remains loaded. Retrying the unchanged message does not duplicate a message already stored for that account/request ID. Changing the draft creates a new request ID. This protection is not a permanent delivery ledger: a page reload or removed/pruned original message can end the retry window. Account changes discard old in-flight UI results.

## Status, typing privacy and quiet hours

**Contacts → My status** contains personal preferences:

- **Automatic** follows the linked Home Assistant Person entity. Home uses the home message; away uses the away message. Missing/unavailable state is not proof that a person is online. An unlinked person without a reported state displays **Status not shared**.
- **Available, Away, Busy, Offline** are explicit user-selected labels. They are not network connection monitors and do not prevent delivery.
- **Return to previous status after** supports temporary status overrides. The server stores the expiry and return mode; clients revert the displayed status when it expires.
- **Share my typing activity across my devices** is an account-wide, server-enforced opt-out. Card-level display and sharing switches remain independent. No draft text is sent as typing activity. Tabs use independent expiring sessions, displayed as one participant name.
- **Quiet hours** use start/end times and an IANA timezone, such as UTC or America/New_York. Overnight periods are supported. Blank/equal start/end disables the schedule. Messages continue arriving. Supported blueprint notifications and the optional card sound use the event's mute list; unrelated custom automations must respect `muted_by` themselves.

The visual editor offers **Notification sound** and volume. Sound is off by default. Browser audio policy may require a click in the card before sound can play. It is not a replacement for Companion App notifications and is not a background-delivery guarantee.

Presence preferences are shared status data on the Home Assistant server. Do not place sensitive details in them. Account-wide presence and typing preferences apply across cards; card appearance and sound settings apply to that dashboard card.

## Scheduled text

Type plain text, then choose **Schedule drafted text**. Enter a delay from 1 minute to 7 days. **My scheduled messages** lists your pending or failed deliveries and lets you cancel one.

- Text only; remove attachment and reply context first.
- Up to 100 pending/failed messages per account and 1,000 total.
- Home Assistant checks due work every 30 seconds while running. After downtime it attempts overdue work on the next check, not necessarily at the original time.
- Delivery rechecks active-account and conversation membership. A failure remains visible with a generic error; cancel and reschedule after correcting access.
- Simultaneous delivery checks use a claim and retry ID to prevent duplicate sends. Once sending begins, cancellation is refused.
- Deleting a conversation removes its scheduled work. Clearing history alone does not cancel pending schedules.

These are scheduled messages, not a complete reminder service. Test a noncritical scheduled message on your actual Home Assistant installation before relying on it.

## Last used, favorite contacts, shared pins and reminders

- **Last used Hassenger:** in Contacts → My status, enable last-active sharing if wanted. It is off by default. Pointer/keyboard interaction records a server timestamp at minute precision, throttled by the card and server. Other signed-in users can see that timestamp; it does not mean the person is currently online. Disabling sharing clears the stored value. This is independent of home/away, status and typing.
- **Favorite contacts:** use the star beside a human contact. Favorites sort first, can be set before a chat exists, and are private to the signed-in account. They are stored on the server and survive a browser refresh or Home Assistant restart. This does not pin or create a conversation.
- **Shared pinned messages:** reveal a message's actions, choose More message tools → Pin for everyone. Open the conversation menu → Shared pinned messages to browse and jump to a pin. Any current participant may pin/unpin; nonparticipants cannot read them. There are at most 50 pins per conversation. Deleted or pruned messages are removed from the board. Saved messages remain private.
- **My reminders:** open Contacts → My reminders or the conversation menu. More message tools → Remind me about this pre-fills a private reminder without sending another chat message. Set a delay of 1 minute to 7 days, optionally repeating hourly, daily or weekly. Complete, snooze or cancel it from My reminders. Repeats schedule from completion, not a fixed calendar appointment.

Reminders are private in-app records, not phone push notifications, TTS or chat announcements. A due badge appears in the card header; headerless/no-Contacts layouts retain a management entry. Home Assistant checks due records approximately every 30 seconds while running, and overdue pending records become due after restart. Due reminders remain until acted on and are loaded when you reconnect. Allow up to 100 reminders per account and 1,000 total. The host's storage and backup security still apply; these records are not encrypted separately. Do not rely on reminders for urgent or safety-critical alerts.

When following the latest message, automatically accumulated client history is capped at 1,000 messages. Older retained messages remain on the server and can be paged back into view while reading history.

## Attachments

Supported managed uploads are PNG, JPEG, GIF, WebP, AVIF, BMP, PDF, MP3 and WAV. The existing limits remain 10 MiB per file and 100 MiB total managed storage. Uploads require authenticated conversation membership. Files are checked for matching signatures; this is not antivirus scanning.

Images/GIFs open in a bounded in-card viewer with Close/Escape controls and an option to open the original. PDF files are links/downloads, not embedded documents. MP3/WAV files have browser audio controls and an original-file link. Actual codec playback depends on the browser. Unsafe executable/HTML/SVG uploads remain rejected.

Managed Media has Home Assistant's access boundary; this is not end-to-end encryption or a replacement for host security. External image links contact their external server.

## Suggested starting configurations

Under **Card setup & branding → Starting layout**, choose a recipe without replacing your configured users, conversations or destinations. The editor offers Undo:

- **Everyday chat:** Modern Chat, Refined controls, comfortable density, overlay Contacts, no sender reminder.
- **Wall panel:** left/right Contacts, separate windows, fixed/preserved chat height, Memory-only drafts and sound off.
- **RGB messenger:** RGB Neon, Refined controls, adjustable glow brightness, full logo and blank optional title.

Recipes change layout/preset settings. They preserve your existing branding choices and content; customize the title/logo separately.

## Reproducible candidate packaging

With the documented Python/Node/Playwright dependencies installed, run:

```text
python scripts/build-release.py --output ../Hassenger-v1.0.0-Release-Review.zip
```

The script runs the Python and browser suites, checks the file allowlist, builds a sorted fixed-timestamp archive outside the repository, verifies every archived file against its source hash, and creates a SHA-256 sidecar. It refuses to overwrite an existing archive.

`--engines chromium,webkit` can create a locally tested candidate when Firefox is unavailable, but that leaves Firefox explicitly unverified. All three engines, live devices, HACS/Hassfest and installation checks must pass before public release.
