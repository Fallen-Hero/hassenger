# Hassenger first-time setup

Install Hassenger 1.0.0 using this guide. New cards default to a preserved 400 px conversation area.

See [FEATURE_GUIDE.md](FEATURE_GUIDE.md) for optional controls and customization.

Follow these steps in order, then send a test message to verify your configuration.

## 1. Install the backend

Copy the complete `custom_components/hassenger` folder so this file exists:

```text
/config/custom_components/hassenger/manifest.json
```

Restart Home Assistant. Open **Settings → Devices & services → Add integration**, search for **Hassenger**, and add its single instance.

Checkpoint: Hassenger appears without a setup error. This package's integration version is **1.0.0**.

## 2. Install the card

Under **Settings → Dashboards → Resources**, add:

```text
/hassenger/hassenger-card.js?v=1.0.0
```

Choose **JavaScript module**, save, and refresh the browser.

Checkpoint: Hassenger Card appears in the card picker or the browser console reports `HASSENGER CARD v1.0.0`.

Manual alternative: copy `hassenger-card.js` to `/config/www/hassenger-card.js` and use `/local/hassenger-card.js?v=1.0.0`. Configure only one of these resource URLs.

## 3. Add a persistent card

Add a Manual card with:

```yaml
type: custom:hassenger-card
data_source: hassenger
layout: chat_bubbles
preset: modern_chat
show_inbox: true
inbox_style: dropdown
show_conversation_header: true
show_message_actions: true
```

It is normal to see no conversations yet.

The **Full Hassenger logo** appears by default and the separate title starts blank. In **Basics → Header branding**, you can switch to the **Compact Hassenger logo**, add optional custom title text beside it, use title text in place of the logo, and override the logo colors. Blank logo text colors automatically match the selected appearance preset.

## 4. Create the first conversation

Use a Home Assistant administrator account.

1. Press the new-conversation icon in the Hassenger header.
2. Enter a name such as `Person #1 & Person #2`.
3. Tap the checkbox row for every Home Assistant user who may see it.
4. Choose a conversation icon and accent color.
5. Optionally enter a custom picture URL. Otherwise Hassenger uses an available participant Person picture or the selected icon.
6. Press **Create conversation**.

The form uses regular checkboxes and compact controls; Ctrl/Shift is not required. Its entries remain intact if Home Assistant state updates arrive while the dialog is open.

Checkpoint: the conversation appears in the card's conversation selector.

## 5. Test chat before notifications

Send a message. Sign in as the other participant in another browser or Companion App account and open the same dashboard.

Verify:

- both selected participants see the conversation and history;
- an unselected non-admin user does not see it;
- messages survive a browser refresh and Home Assistant restart;
- each message says the correct sender. The optional **Sending as** reminder is hidden by default; enable it under Conversations & message display → Sending identity if wanted.
- switching conversations restores the unsent draft that belongs to each conversation.

Do not continue until ordinary chat works.

## 6. Configure pictures, Assist, or TTS (optional)

In the card visual editor:

- Main editor sections use distinct accent colors for navigation. **Essentials → Card setup & branding → Header branding** can be opened and minimized independently.
- **Persistent messaging → People appearance overrides** lets you choose actual Home Assistant users and Hassenger conversations from dropdowns, then optionally customize names, Person pictures, fallback icons, custom images, sender/bubble/text colors, and alignment.
- **Persistent messaging → Inbox style** offers Preview cards, Compact, or a single **Conversation dropdown**. The card styles wrap into rows rather than running off the side.
- **Persistent messaging → Show sending identity** controls the aligned identity chip. Its label, visible name, and icon are editable without changing the signed-in account or permissions.
- **Appearance → Responsive sizing** offers Fit dashboard width or a 240–1600 px custom width, 75–150% whole-card scaling, and a Fit-to-screen safeguard for phones.
- **Appearance → Keep conversation window height** keeps the message area at your chosen height. Added header information, conversation destinations, and quick messages then increase the total card height instead of shrinking the chat.
- **Header info → Show section label** controls the left-hand label. When enabled, its text and MDI icon can be customized; when disabled, chips or badges receive the full row.
- **Composer, Assist & TTS → Add Assist** adds a Home Assistant Assist destination.
- **Composer, Assist & TTS → Add TTS speaker** provides searchable TTS-engine and media-player dropdowns. Its editor separates Destination appearance, Voice & speaker, Playback behavior, and Optional Hassenger chime settings into readable groups. Each destination supports announcement mode, the player's optional pre-announcement sound, an optional Home Assistant media chime with wait control, language, and cache settings.
- **Composer, Assist & TTS → Show speech-to-text button** adds a microphone that fills the message draft without sending it automatically. Hassenger requests microphone access and explains blocked permission or insecure HTTP errors. Use an HTTPS Home Assistant address; unsupported browsers and Companion App webviews can use the phone keyboard microphone.

Assist/TTS destinations appear in the conversation picker. They are tools local to that card, not private participant conversations stored by the integration.

The `+` button inside the message composer (above it in Classic control layout) opens a preset-aware emoji and media panel that stays within the visible card and viewport without covering the page. You can choose an emoji, upload an image/GIF, select Home Assistant Media, paste an image into the message box, or attach an image URL. Images may be sent alone or with text. File uploads are limited to 10 MiB each and are supported by the included card 1.0.0 and integration 1.0.0. Any authenticated participant may upload to a conversation; administrator rights are not required. Hassenger-managed uploads share a 100 MiB quota. Before accepting a new file, the integration removes the oldest unreferenced managed files as needed, never files still referenced by a message. If referenced files consume the available quota, the new upload is rejected.

To enable the optional friends-style panel, open **Conversations & Contacts → Contacts, presence & away messages** and turn on **Show Contacts / friends list**. Use **Automatic** placement for a side pane on wide cards and an overlay drawer on phones. The panel separates group Conversations, Home Assistant Contacts, and Assist/TTS Destinations. Selecting a contact opens the conversation immediately; the compact conversation selector stays at the upper-left of the transcript instead of being repeated in the footer. Each person can set an automatic home/away message from **My status**. For two clearly separated desktop windows, enable **Separate desktop windows** and set the desired spacing; each pane keeps the active preset border, radius, and effects. Narrow desktop cards cap a docked Contacts pane to preserve chat width, and Retro Messenger uses its bright classic-window Contacts surface.

Long conversations open at the newest 200 messages. Use **Load older messages** at the top of the transcript to fetch the next page without losing your reading position. Use the archive button in the card header—or the Contacts heading when Contacts is enabled—to view and restore conversations archived for your account.

With the default **Smart** autoscroll, the card follows new messages only while you are already at the bottom. Scroll upward to pause it; use **Latest message** to return. Refreshing the page reopens the same conversation and restores that browser tab's reading position. Sender alignment defaults to **Automatic (signed-in user right)**, so each signed-in participant sees their own messages on the right; use an appearance override for a fixed side.

Quick messages appear as collapsible editor items. Assign a group name to each shortcut. The default footer uses a **Quick** button inside the composer; open it for group tabs and message buttons. Selecting a shortcut closes the panel and fills the draft, unless that item explicitly enables **Send immediately**. Large groups scroll vertically inside the panel. The Quick label is editable. Choose **Quick-message layout → Always-visible dropdowns** for the previous selectors and editable prompt/Hide labels. Use the always-visible trash button in an editor item's header to remove it. Speech-to-text remains a separate opt-in control and is not enabled by Quick.

Under **Appearance**, **Message spacing** applies to every message. If consecutive-message grouping is enabled and you want a different gap within those groups, enable **Use separate grouped spacing** and set the same-sender gap.

New cards default to **Hassenger Persistent Mode**. Use **Legacy Input Mode** only when preserving an older `input_text` setup.

Persistent conversations are stored in Home Assistant's hidden `/config/.storage/hassenger.messages` file. Archive only hides a conversation for one user; clearing retains the conversation; deleting permanently removes the thread, messages, and read state. Uploaded attachment files are not deleted immediately when their reference is cleared or deleted. Once unreferenced, a managed file is eligible for oldest-first quota cleanup during a later upload, or it can be removed manually from Home Assistant Media.

Hassenger does not prune message history on a schedule. To apply retention, an administrator can run the `hassenger.prune` action in Developer Tools. Set `retention_days` from 1–3650; omitting it uses 365 days. Pruning removes messages older than the cutoff across all conversations but keeps the conversations themselves. Any attachment that loses its final message reference becomes eligible for managed-media cleanup on a later upload.

## 7. Install phone replies (optional)

Copy `blueprints/automation/hassenger/mobile_actionable_reply.yaml` to:

```text
/config/blueprints/automation/hassenger/mobile_actionable_reply.yaml
```

After replacing the complete integration folder and fully restarting Home Assistant, open **Settings → Automations & scenes → Blueprints**, select **Hassenger - Mobile replies, TTS and optional sounds**, and create an automation.

Set:

- **Phone or tablet to notify:** your Companion App device.
- **Message from:** select the sender's Home Assistant Person, such as `Person #1`.
- **Reply as:** select the phone owner's Home Assistant Person, such as `Person #2`.
- **Dashboard path:** `/lovelace/hassenger` or your actual relative dashboard path.
- **Reply timeout:** 60 minutes.
- **Only this conversation:** optional. Copy the conversation ID from the card's **Conversation actions** menu to restrict both the phone notification and TTS announcement to that chat.
- **Show matching diagnostics:** enable this for the first test, then turn it off after notifications work.
- **Announce messages with TTS:** leave off for the first notification test. To add announcements, enable it and select the TTS engine plus one or more media players from the entity dropdowns.
- **Use media-player announcement mode:** leave on. Some Cast and Music Assistant players cut direct playback short.
- **Play the player's pre-announcement sound:** leave off to suppress Music Assistant's bell/whistle without disabling reliable announcement playback.
- **Play an extra Hassenger chime before TTS:** optional. Turn it on, select an audio item from Home Assistant's media browser, and set the chime-to-speech wait long enough for that sound. Leave it off to omit the selected sound.
- **Intro-to-message pause:** use **Natural pause (period)** for Piper and Chromecast. Short, strong, and no-punctuation choices are available. The mobile reply blueprint generates and fully buffers the entire spoken announcement before playback.
- **Include sender / prefix / cache:** customize the spoken wording and caching behavior as desired.

No conversation ID, sender ID, or typed notification action is required in the mobile reply blueprint. It listens to the dedicated `hassenger_message_sent` event and checks the Person entity, linked user ID, and name in that order. If the phone owner's account mutes the conversation in Hassenger, the mobile reply blueprint suppresses both that route's notification and TTS until it is unmuted.

For reliable quiet playback, leave **Use media-player announcement mode** on, leave **Play the player's pre-announcement sound** off, and leave **Play an extra Hassenger chime before TTS** off. Hassenger sends Music Assistant `use_pre_announce: false` independently from `announce: true`; a native Chromecast/Nest can still make its own connection tone. Avoid enabling duplicate notification automations for the same recipient.

If you deliberately enable the extra Hassenger sound, **Chime-to-speech wait** controls the interval after that selected file starts and before TTS starts. It has no role while the extra sound is off.

Create one automation for each sender-to-phone route. For Person #2's phone receiving Person #1's messages, choose Person #2's phone, Person #1 under **Message from**, and Person #2 under **Reply as**.

## 8. Test the actionable notification

1. Send a message from the other participant's Home Assistant account.
2. Confirm the phone receives **Reply** and **View chat**.
3. On iOS, press and hold, swipe and choose **View** on the lock screen, or pull the banner down to reveal **Reply**. iOS does not allow Home Assistant to keep actions visible on a collapsed banner.
4. Reply and confirm the response appears in the same conversation.
5. Repeat once with the Companion App open and once with the phone locked. Confirm notification permission, lock-screen previews, sounds, and background refresh behave as intended.
6. Open the Hassenger conversation menu as the phone owner, choose **Mute notifications**, and send another message from the other account. Confirm that phone route and its TTS stay silent. Unmute and confirm delivery resumes.
7. On both iOS and Android, rotate the dashboard between portrait and landscape and confirm the conversation selector, media `+` panel, both reaction placements, message actions, archive dialog, and editor stay within the screen.

## Recovery checklist

- **Old or resetting editor:** verify `?v=1.0.0`, then refresh/clear frontend cache once.
- **No new-conversation button:** the signed-in account must be an administrator.
- **Accidental conversation:** select it and use the red footer trash control. This permanently deletes it and its messages.
- **Weird copy window:** card 1.0.0 uses the clipboard and in-card emoji selector without opening a prompt; verify the loaded card version.
- **Speech-to-text says blocked or not allowed:** open Home Assistant over HTTPS, allow microphone permission for the site or Companion App in device settings, reload, and try again. If the app webview still does not expose speech recognition, use the phone keyboard microphone.
- **No phone trace:** use a newly created automation from the mobile reply blueprint and confirm integration 1.0.0 loaded after a full restart. Enable the card Debug panel and verify its backend `last_event.kind` becomes `message_sent` after sending.
- **Sender selection never matches:** open **Settings → People** and make sure the selected Person is linked to the same Home Assistant user that sends from the card. The Debug panel's last event must include the matching `sender_person_entity_id`.
- **No notification but there is a trace:** enable **Show matching diagnostics**, send one message, and read the generated persistent notice. It reports the selected and incoming Person/user values without stopping as an unknown condition.
- **Trace reaches notification but phone stays silent:** test the selected phone's notification in Developer Tools and verify Companion App notification permission; the mobile reply blueprint resolves the phone's registered notifier internally.
- **TTS starts and cuts off:** confirm integration 1.0.0 is loaded and leave **Use media-player announcement mode** on.
- **Long gap inside TTS:** recreate the automation from the mobile reply blueprint and choose Natural pause. The spoken introduction and message use one fully buffered media item.
- **Extra announcement ding:** leave announcement mode on and turn **Play the player's pre-announcement sound** off. This suppresses Music Assistant's optional sound without using the unreliable direct-playback route.
- **Selected chime will not wait:** confirm integration 1.0.0 is loaded. The `hassenger.speak_message` service awaits the selected number of seconds internally between the chime playback call and TTS generation.
- **Image upload returns 401:** replace the complete integration folder with 1.0.0, fully restart Home Assistant, load card 1.0.0, and sign in again. Hassenger provides authenticated conversation members with its own restricted upload route; Home Assistant's general upload route is administrator-only.
- **Contacts cannot load:** confirm card 1.0.0 and integration 1.0.0 are loaded, restart Home Assistant after replacing the complete integration folder, and verify the signed-in Home Assistant account is active. A linked Person entity is optional, but is required for automatic home/away state.
- **Other image upload failure:** verify Home Assistant has a local Media directory and the selected file is a supported image no larger than 10 MiB. You can still attach a `/local/...` or `https://...` image URL. If the server reports that managed media storage is full, remove unneeded Home Assistant Media files or delete old message references; referenced files are preserved rather than evicted automatically.
- **Phone works but TTS does not:** confirm both the `tts.*` engine and `media_player.*` entity are selected, then test that same pair with the `tts.speak` action in Developer Tools.
- **`!input` error:** the blueprint was pasted into a normal automation editor. Store the file under `/config/blueprints/automation/` and create the automation from the Blueprints page.
