# Hassenger architecture

Hassenger stores private favorites and reminders by authenticated account, shared message IDs on each conversation, and an optional minute-level last-active timestamp in presence. Membership gates shared pins; private reminder/favorite events are filtered to their owner, including diagnostics. The existing 30-second timer advances due reminders without creating chat messages. Card removal invalidates pending asynchronous responses and subscriptions; reattachment reconnects. Automatic history accumulation while following latest is capped at 1,000 client messages without deleting server history.

Hassenger has three deliverables in one repository:

1. `custom_components/hassenger` is the local-push Home Assistant integration. It owns storage, authorization, services, the WebSocket API, uploads, controlled audio, and the bundled frontend asset.
2. `dist/hassenger-card.js` is the standalone copy of the same card for manual frontend installation and review. The integration serves its bundled copy at `/hassenger/hassenger-card.js`.
3. `blueprints/automation/hassenger` contains the optional mobile reply and TTS route. It is imported separately from the HACS integration.

Persistent data lives in Home Assistant's versioned `.storage/hassenger.messages` record. Threads contain participant Home Assistant user IDs; messages, read times, mute/archive flags, attachment references, and bounded user-controlled presence preferences are stored there. The card receives only participant-authorized threads/messages over authenticated WebSockets. Administrative management and trusted service delivery are separate from read membership.

Uploaded files are stored below the dedicated `hassenger` folder in a configured Home Assistant local Media source. Each file is limited to 10 MiB and the managed set is limited to 100 MiB. Upload serialization and the storage mutation lock keep quota cleanup from racing a new message reference. Cleanup removes only the oldest unreferenced, Hassenger-named files needed to admit a new upload; referenced files are preserved, and the upload fails when they leave no safe capacity.

Message retention is explicit rather than scheduled. The administrator-only `hassenger.prune` action accepts 1–3650 days, defaults to 365 days, and removes messages older than its cutoff across all threads while leaving thread records intact. Removing message or thread references does not synchronously delete Media files; unreferenced managed files become candidates for cleanup during a later upload.

The authenticated Contacts API combines active Home Assistant users with an optional linked Person entity's current state and picture. It does not copy device-tracker coordinates into Hassenger. The direct-thread endpoint accepts one active target user and atomically reuses or creates only the exact two-user thread, preventing duplicate direct conversations during simultaneous requests. Presence reads are shared for display, while a user may update only their own status and home/away messages.

In the frontend, one grid owns the optional Contacts pane and the main chat pane. Overlay is available at every size; left/right placement becomes an overlay on narrow screens; Automatic docks only in wide containers. Fixed left/right panes honor the configured pixel width on wide cards but cap the Contacts track to 38% when the card is narrower, preventing the chat track from being crushed. Separate-window mode gives both children their own inherited preset surface and leaves the configured gap transparent. This lets animated RGB borders, glass surfaces, radii, and shadows remain correct on both panes rather than styling only a shared outer wrapper.

`hassenger_updated` refreshes authorized cards. `hassenger_message_sent` is the dedicated notification event. Event-bus payloads intentionally include routing and message fields for automations; this is a Home Assistant host trust boundary, not end-to-end encryption.

The old `ha-chat-card` custom element remains a subclass alias. It is not used in new examples, but prevents existing dashboards from failing during the resource filename/type rename.

Storage includes containers for private bookmarks and scheduled text, plus optional presence preferences and per-user conversation pins. Scheduled work uses a 30-second integration timer, a store-lock claim and sender/request idempotency, with active-user/membership checks at delivery. Typing sessions and their rate limiter are ephemeral; draft content is never included. Frontend account-generation guards reject stale asynchronous results after an account change. Optional browser drafts and Contacts section state are account/card-scoped; storage is not encrypted.
