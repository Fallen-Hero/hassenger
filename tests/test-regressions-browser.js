const { chromium } = require("playwright");
const path = require("path");
const assert = require("assert");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 760, height: 820 } });
  await page.setContent("<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444;--error-color:#f44336}body{margin:0}</style>");
  await page.addScriptTag({ path: path.resolve(process.argv[2]) });

  const desktop = await page.evaluate(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const calls = [];
    const threads = [
      { id: "thread_1", title: "Short", participants: ["person_1", "person_2"], icon: "mdi:message", color: "#03a9f4", unread: 0 },
      { id: "thread_2", title: "A much longer conversation name", participants: ["person_1", "person_3"], icon: "mdi:account-group", color: "#9b5de5", unread: 2 },
    ];
    const messages = {
      thread_1: [{ id: "one", thread_id: "thread_1", sender_id: "person_2", sender_name: "Person #2", text: "Message one", created_at: "2026-09-01T12:00:00Z", read_by: [], reactions: { "👍": ["person_1"] } }],
      thread_2: [{ id: "two", thread_id: "thread_2", sender_id: "person_3", sender_name: "Person #3", text: "Message two", created_at: "2026-09-01T12:01:00Z", read_by: [], reactions: {} }],
    };
    const presence = { person_1: { mode: "automatic", home_message: "At home", away_message: "Away", available_message: "", busy_message: "", offline_message: "", updated_at: "server-only", status: "available", message: "At home", future_response_key: "never echo me" } };
    let olderRelease = null, olderRequested = false, sendRelease = null, createRelease = null, uploadRelease = null;
    const allowedPresenceKeys = ["available_message", "away_message", "busy_message", "duration_minutes", "home_message", "mode", "offline_message", "quiet_end", "quiet_start", "quiet_timezone", "share_last_active", "share_typing", "type"];
    const hass = {
      user: { id: "person_1", name: "Person #1", is_admin: true }, locale: { language: "en-US" },
      states: { "person.person_1": { state: "home", attributes: { user_id: "person_1" } } },
      connection: { subscribeMessage: async () => () => {} }, callService: async () => {},
      callWS: async msg => {
        calls.push({ ...msg });
        if (msg.type === "hassenger/diagnostics") return { integration_version: "2.2.1" };
        if (msg.type === "hassenger/threads/list") return threads;
        if (msg.type === "hassenger/messages/list") { if (msg.before) { olderRequested = true; await new Promise(resolve => { olderRelease = resolve; }); return [{ id: "old-page", thread_id: msg.thread_id, sender_id: "person_2", sender_name: "Person #2", text: "Old page must not leak", created_at: "2025-01-01T00:00:00Z", read_by: [], reactions: {} }]; } await sleep(msg.thread_id === "thread_2" ? 110 : 12); return messages[msg.thread_id] || []; }
        if (msg.type === "hassenger/thread/mark_read") return null;
        if (msg.type === "hassenger/messages/send") return await new Promise(resolve => { sendRelease = () => resolve({ id: "sent-a", thread_id: msg.thread_id, sender_id: "person_1", sender_name: "Person #1", text: msg.text, created_at: "2026-09-01T12:03:00Z", read_by: ["person_1"], reactions: {} }); });
        if (msg.type === "hassenger/thread/create") return await new Promise(resolve => { createRelease = () => resolve({ id: "created-once", title: msg.title, participants: msg.participants }); });
        if (msg.type === "hassenger/contacts/list") return [
          { id: "person_1", name: "Person #1", is_self: true, person_entity_id: "person.person_1", person_state: "home" },
          { id: "person_2", name: "Person #2", is_self: false, person_entity_id: "person.person_2", person_state: "home" },
          { id: "person_3", name: "Person #3", is_self: false, person_entity_id: "person.person_3", person_state: "not_home" },
        ];
        if (msg.type === "hassenger/presence/list") return presence;
        if (msg.type === "hassenger/presence/set") {
          const keys = Object.keys(msg).sort();
          if (JSON.stringify(keys) !== JSON.stringify(allowedPresenceKeys)) throw new Error(`extra keys not allowed: ${keys.filter(key => !allowedPresenceKeys.includes(key)).join(",")}`);
          if (msg.away_message === "Reject this") throw new Error("server rejected test value");
          presence.person_1 = { ...msg, type: undefined, updated_at: "server-only-next", status: "available", future_response_key: "still server-only" };
          delete presence.person_1.type;
          return presence.person_1;
        }
        return null;
      },
    };
    hass.fetchWithAuth = async () => await new Promise(resolve => { uploadRelease = () => resolve({ ok: true, status: 200, json: async () => ({ media_content_id: "media-source://media_source/local/hassenger/uploaded.gif", content_type: "image/gif", name: "uploaded.gif" }) }); });
    const base = { type: "custom:hassenger-card", data_source: "hassenger", show_contacts: true, contacts_default_open: false, contacts_placement: "overlay", contacts_replace_inbox: true, show_composer_media: true, height_mode: "fixed", height: 610, preset: "home_assistant" };
    const card = document.createElement("hassenger-card"); document.body.append(card); card.setConfig(base); card.hass = hass; await sleep(150);
    let root = card.shadowRoot;

    const defaultReaction = { configured: card._config.reaction_placement, below: root.querySelectorAll(".below-time-reactions").length, side: root.querySelectorAll(".bubble-reaction-dock").length };

    const switcher = root.querySelector(".conversation-switcher"), toggle = switcher.querySelector("[data-conversation-toggle]"), menu = switcher.querySelector(".conversation-options");
    const closedDisplay = getComputedStyle(menu).display;
    toggle.click(); await sleep(0);
    const switcherRect = switcher.getBoundingClientRect(), menuRect = menu.getBoundingClientRect(), menuStyle = getComputedStyle(menu);
    const openedMenu = { open: switcher.open, closedDisplay, background: menuStyle.backgroundColor, color: menuStyle.color, border: menuStyle.borderTopWidth, radius: menuStyle.borderRadius, within: menuRect.left >= 0 && menuRect.right <= innerWidth + 1, widerThanToggle: menuRect.width >= switcherRect.width };
    toggle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); await sleep(0);
    const keyboardOpened = switcher.open && root.activeElement?.matches("[data-conversation-option]");
    root.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const keyboardClosed = !switcher.open && root.activeElement === toggle;
    toggle.click(); document.querySelector("body").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // A click elsewhere inside the card is the supported outside-click path.
    root.querySelector("header")?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    const outsideClosed = !switcher.open;

    // Prove a slow, older response cannot overwrite a newer selection.
    toggle.click(); root.querySelector('[data-conversation-option="1"]').click(); await sleep(4);
    const immediateSwitch = { title: root.querySelector("[data-conversation-current]")?.textContent || "", oldTextVisible: /Message one/.test(root.querySelector(".messages")?.textContent || "") };
    root.querySelector("[data-conversation-toggle]").click(); root.querySelector('[data-conversation-option="0"]').click();
    await sleep(150);
    const race = { selected: card._availablePeople()[card._selected]?.thread_id, loaded: card._loadedThreadId, text: root.querySelector(".messages")?.textContent || "" };

    // A pending older-page request must not merge into a different conversation.
    messages.thread_1 = Array.from({ length: 201 }, (_, index) => ({ id: `page-${index}`, thread_id: "thread_1", sender_id: "person_2", sender_name: "Person #2", text: `Paged ${index}`, created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(), read_by: [], reactions: {} }));
    await card._loadBackendMessages(); const olderPromise = card._loadOlderBackendMessages();
    for (let wait = 0; wait < 20 && !olderRequested; wait++) await sleep(2);
    card._selectConversation(1); await sleep(5); olderRelease?.(); await olderPromise; await sleep(130);
    const olderRace = { requested: olderRequested, selected: card._availablePeople()[card._selected]?.thread_id, loaded: card._loadedThreadId, leaked: /Old page must not leak/.test(root.querySelector(".messages")?.textContent || "") };

    // Server-only presence response fields must never be sent back.
    root.querySelector("[data-contacts-toggle]").click(); await sleep(10); root.querySelector("[data-presence-settings]").click();
    let dialog = root.querySelector(".presence-dialog"), away = dialog.querySelector('[data-presence-field="away_message"]');
    away.value = "Back after dinner"; away.dispatchEvent(new Event("input", { bubbles: true }));
    away.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); dialog.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const dragSelectionKeptOpen = !!root.querySelector(".presence-dialog") && card._presenceDraft?.away_message === "Back after dinner";
    root.querySelector("[data-presence-save]").click(); await sleep(25);
    const presenceCalls = calls.filter(call => call.type === "hassenger/presence/set"), firstPresenceKeys = Object.keys(presenceCalls[0] || {}).sort();
    root.querySelector("[data-presence-settings]").click(); away = root.querySelector('[data-presence-field="away_message"]'); away.value = "Saved twice"; away.dispatchEvent(new Event("input", { bubbles: true })); root.querySelector("[data-presence-save]").click(); await sleep(25);
    const secondPresenceKeys = Object.keys(calls.filter(call => call.type === "hassenger/presence/set")[1] || {}).sort();
    root.querySelector("[data-presence-settings]").click(); away = root.querySelector('[data-presence-field="away_message"]'); away.value = "Reject this"; away.dispatchEvent(new Event("input", { bubbles: true })); root.querySelector("[data-presence-save]").click(); await sleep(25);
    const rejectionKeptOpen = !!root.querySelector(".presence-dialog") && card._presenceDraft?.away_message === "Reject this" && !root.querySelector("[data-presence-save]").disabled;
    root.querySelector("[data-presence-cancel]").click();

    // The add panel must always have reachable close paths and selected media must be removable.
    let add = root.querySelector(".attachment-menu"), summary = add.querySelector("summary"); summary.click();
    const closeButton = add.querySelector("[data-close-attachment-menu]"); closeButton.click();
    const closeButtonWorked = !add.open && root.activeElement === summary;
    summary.click(); add.querySelector("[data-attachment-url]").value = "invalid-value"; add.querySelector("[data-use-attachment-url]").click();
    const invalidStaysCorrectable = add.open && !!add.querySelector("[data-close-attachment-menu]");
    add.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); const escapeWorked = !add.open;
    summary.click(); const emoji = add.querySelector("[data-message-emoji]"); emoji.value = "😀"; emoji.dispatchEvent(new Event("change", { bubbles: true }));
    const emojiClosed = !add.open && root.querySelector("textarea").value.includes("😀");
    root.querySelector(".attachment-menu summary").click(); root.querySelector("[data-attachment-url]").value = "/local/example.gif"; root.querySelector("[data-use-attachment-url]").click(); await sleep(0);
    const previewRemovable = !!root.querySelector("[data-remove-attachment]"); root.querySelector("[data-remove-attachment]")?.click(); const previewRemoved = !root.querySelector("[data-remove-attachment]");

    // Duplicate sends are blocked, and a delayed send/upload cannot write into a newly selected conversation.
    let people = card._availablePeople(), threadAIndex = people.findIndex(person => person.thread_id === "thread_1"); card._selectConversation(threadAIndex); await sleep(20); people = card._availablePeople(); threadAIndex = people.findIndex(person => person.thread_id === "thread_1"); const threadAKey = card._personKey(people[threadAIndex], threadAIndex); card._drafts[threadAKey] = "Delayed A"; card._render();
    const sendPromise = card._send(threadAIndex); await sleep(2); const duplicateSendPromise = card._send(threadAIndex); const sendCallsWhilePending = calls.filter(call => call.type === "hassenger/messages/send").length; card._selectConversation(card._availablePeople().findIndex(person => person.thread_id === "thread_2")); sendRelease?.(); await Promise.all([sendPromise, duplicateSendPromise]); await sleep(125);
    const delayedSendIsolated = card._availablePeople()[card._selected]?.thread_id === "thread_2" && !card._backendMessages.some(message => message.id === "sent-a");
    people = card._availablePeople(); threadAIndex = people.findIndex(person => person.thread_id === "thread_1"); const uploadPromise = card._uploadAttachment(new File(["gif"], "uploaded.gif", { type: "image/gif" }), threadAIndex); await sleep(2); card._backendThreads = [card._backendThreads.find(thread => thread.id === "thread_2"), card._backendThreads.find(thread => thread.id === "thread_1")].filter(Boolean); card._selected = 0; card._render(); uploadRelease?.(); await uploadPromise; await sleep(5);
    const delayedUploadIsolated = card._attachmentDrafts.thread_1?.url?.includes("uploaded.gif") && !card._attachmentDrafts.thread_2;

    // Live read/mutation/clear events must reconcile in place, including events deferred during a local send.
    const currentMessage = messages.thread_2[0]; card._handleBackendUpdate({ data: { kind: "thread_read", thread_id: "thread_2", user_id: "person_3", read_at: currentMessage.created_at } });
    const liveReadApplied = card._backendMessages.find(message => message.id === currentMessage.id)?.read_by?.includes("person_3") === true;
    messages.thread_2 = [{ ...currentMessage, text: "Edited live" }]; card._handleBackendUpdate({ data: { kind: "message_edited", thread_id: "thread_2", message: messages.thread_2[0] } }); await sleep(125);
    const liveEditApplied = card._backendMessages.some(message => message.text === "Edited live");
    card._beginLocalMutation("thread_2"); messages.thread_2.push({ id: "during-send", thread_id: "thread_2", sender_id: "person_3", sender_name: "Person #3", text: "Arrived during send", created_at: "2026-09-01T12:02:00Z", read_by: [], reactions: {} }); card._handleBackendUpdate({ data: { kind: "message_sent", thread_id: "thread_2", message_id: "during-send", sender_id: "person_3", sender_name: "Person #3", text: "Arrived during send" } });
    const deferredQueued = card._deferredMutationThreads.has("thread_2"); card._finishLocalMutation("thread_2"); await sleep(125);
    const deferredRecovered = card._backendMessages.some(message => message.id === "during-send");
    messages.thread_2 = []; card._handleBackendUpdate({ data: { kind: "thread_cleared", thread_id: "thread_2" } }); const clearImmediate = card._backendMessages.length === 0; await sleep(125); const clearStayedEmpty = card._backendMessages.length === 0;

    card._threadDialogDraft = { title: "One group", participants: ["person_1", "person_2"], icon: "mdi:message", image: "", color: "#03a9f4" }; card._threadDialogOpen = true; const createOne = card._createThreadFromDialog(); const createTwo = card._createThreadFromDialog(); await sleep(2); const createCallsWhilePending = calls.filter(call => call.type === "hassenger/thread/create").length; createRelease?.(); await Promise.all([createOne, createTwo]); const duplicateCreateBlocked = createCallsWhilePending === 1;

    const secondCard = document.createElement("hassenger-card"); document.body.append(secondCard); secondCard.setConfig(base); secondCard.hass = hass; await sleep(5);
    const automaticStateKeysSeparate = card._viewStateKey() !== secondCard._viewStateKey();
    const stateKeyBeforeTitle=card._viewStateKey();card.setConfig({...card._config,title:"Renamed without losing the active conversation"});await sleep(5);const titleChangePreservesStateKey=card._viewStateKey()===stateKeyBeforeTitle;
    secondCard.setConfig({ ...base, state_storage_key: "dashboard-main" }); const explicitStateKey = secondCard._viewStateKey(); secondCard.remove(); const replacement = document.createElement("hassenger-card"); document.body.append(replacement); replacement.setConfig({ ...base, state_storage_key: "dashboard-main" }); replacement.hass = hass; const explicitStateKeyStable = replacement._viewStateKey() === explicitStateKey; replacement.remove();

    const presets = ["home_assistant","modern_chat","minimal","terminal","industrial","retro_messenger","midnight","oled","rgb","glass","paper","playful","high_contrast"];
    const presetMenus = [];
    for (const preset of presets) {
      card.setConfig({ ...base, preset }); await sleep(5); root.querySelector("[data-conversation-toggle]").click();
      const panel = root.querySelector(".conversation-options"), style = getComputedStyle(panel), rect = panel.getBoundingClientRect(), surface = root.querySelector("ha-card");
      presetMenus.push({ preset, display: style.display, color: style.color, background: style.backgroundColor, border: style.borderTopWidth, radius: style.borderRadius, overflow: surface.scrollWidth - surface.clientWidth, within: rect.left >= -1 && rect.right <= innerWidth + 1 });
    }

    const editor = document.createElement("hassenger-card-editor"); document.body.append(editor); editor.hass = hass; editor.setConfig(base); editor._loadedSections = new Set(["basics","persistent","appearance","behavior"]); editor._render();
    const dependency = {};
    editor._set("show_send_identity", false); dependency.identityHidden = !editor.shadowRoot.querySelector('[data-path="send_identity_label"]');
    editor._set("show_send_identity", true); dependency.identityShown = !!editor.shadowRoot.querySelector('[data-path="send_identity_label"]');
    editor._set("preserve_chat_height", false); dependency.chatHeightHidden = !editor.shadowRoot.querySelector('[data-path="chat_height"]');
    editor._set("preserve_chat_height", true); dependency.chatHeightShown = !!editor.shadowRoot.querySelector('[data-path="chat_height"]');
    editor._set("group_consecutive", false); dependency.groupMinutesHidden = !editor.shadowRoot.querySelector('[data-path="group_minutes"]');
    editor._set("group_consecutive", true); dependency.groupMinutesShown = !!editor.shadowRoot.querySelector('[data-path="group_minutes"]');
    dependency.defaultReaction = editor._config.reaction_placement;

    // Contextual controls must never advertise settings that the active layout cannot use.
    editor._loadedSections.add("message-actions"); editor._openSections.add("message-actions");
    editor._set("layout", "classic_log"); dependency.classicPlacementHidden = !editor.shadowRoot.querySelector('[data-path="reaction_placement"]');
    editor._set("layout", "chat_bubbles"); dependency.bubblePlacementShown = !!editor.shadowRoot.querySelector('[data-path="reaction_placement"]');
    editor._set("show_message_actions", false); dependency.hiddenActionSize = !editor.shadowRoot.querySelector('[data-path="message_action_size"]');
    editor._set("show_message_actions", true); dependency.shownActionSize = !!editor.shadowRoot.querySelector('[data-path="message_action_size"]');

    // Switching from Legacy mode must immediately load persistent choices without a reload.
    const legacyEditor = document.createElement("hassenger-card-editor"); document.body.append(legacyEditor);
    legacyEditor.setConfig({ type:"custom:hassenger-card", data_source:"input_text", history_entity:"input_text.history", people:[{ name:"Person #1", match_name:"Person #1", input_entity:"input_text.message" }] });
    const persistentCalls=[]; legacyEditor.hass={ callWS:async msg=>{persistentCalls.push(msg.type);return msg.type==="hassenger/contacts/list"?[{id:"person_1",name:"Person #1"}]:msg.type==="hassenger/threads/list"?[{id:"thread_1",title:"Short"}]:[];} };
    legacyEditor._set("data_source", "hassenger"); await sleep(20);
    const legacySwitchLoaded = legacyEditor._persistentOptionsLoaded && persistentCalls.includes("hassenger/contacts/list") && persistentCalls.includes("hassenger/threads/list") && legacyEditor._persistentUsers.length===1 && legacyEditor._persistentThreads.length===1; legacyEditor.remove();

    // Retro keeps its transparent default but must honor explicit bubble colors.
    card.setConfig({ ...base, preset:"retro_messenger", history_days:0, incoming_bubble_color:"#654321" }); card._contactsOpen=false; card._selectConversation(card._availablePeople().findIndex(person=>person.thread_id==="thread_1")); await sleep(35);
    const retroCustomBody=root.querySelector(".bubble.custom-bubble .body"),retroCustomBackground=retroCustomBody?getComputedStyle(retroCustomBody).backgroundColor:"";
    card.setConfig({ ...base, preset:"retro_messenger", history_days:0, incoming_bubble_color:"" }); await sleep(20);
    const retroDefaultBody=root.querySelector(".bubble .body"),retroDefaultBackground=retroDefaultBody?getComputedStyle(retroDefaultBody).backgroundColor:"";

    // A separate-window divider visibly emphasizes the two facing borders on desktop.
    card.setConfig({ ...base, contacts_placement:"left", contacts_separate_windows:true, contacts_show_divider:false }); card._contactsOpen=true; card._render();
    const dividerOff={panel:getComputedStyle(root.querySelector(".contacts-panel")).borderRightWidth,chat:getComputedStyle(root.querySelector(".card-main")).borderLeftWidth};
    card.setConfig({ ...base, contacts_placement:"left", contacts_separate_windows:true, contacts_show_divider:true }); await sleep(20);
    const dividerOn={panel:getComputedStyle(root.querySelector(".contacts-panel")).borderRightWidth,chat:getComputedStyle(root.querySelector(".card-main")).borderLeftWidth};

    return { defaultReaction, openedMenu, keyboardOpened, keyboardClosed, outsideClosed, immediateSwitch, race, olderRace, dragSelectionKeptOpen, firstPresenceKeys, secondPresenceKeys, expectedPresenceKeys: allowedPresenceKeys, rejectionKeptOpen, closeButtonWorked, invalidStaysCorrectable, escapeWorked, emojiClosed, previewRemovable, previewRemoved, sendCallsWhilePending, delayedSendIsolated, delayedUploadIsolated, duplicateCreateBlocked, liveReadApplied, liveEditApplied, deferredQueued, deferredRecovered, clearImmediate, clearStayedEmpty, automaticStateKeysSeparate, titleChangePreservesStateKey, explicitStateKeyStable, presetMenus, dependency, legacySwitchLoaded, retroCustomBackground, retroDefaultBackground, dividerOff, dividerOn };
  });

  assert.equal(desktop.defaultReaction.configured, "below_time"); assert.ok(desktop.defaultReaction.below > 0); assert.equal(desktop.defaultReaction.side, 0);
  assert.equal(desktop.openedMenu.closedDisplay, "none"); assert.equal(desktop.openedMenu.open, true); assert.equal(desktop.openedMenu.within && desktop.openedMenu.widerThanToggle, true); assert.notEqual(desktop.openedMenu.background, "rgba(0, 0, 0, 0)"); assert.equal(desktop.openedMenu.border, "1px");
  assert.equal(desktop.keyboardOpened && desktop.keyboardClosed && desktop.outsideClosed, true);
  assert.match(desktop.immediateSwitch.title, /longer conversation/i); assert.equal(desktop.immediateSwitch.oldTextVisible, false);
  assert.equal(desktop.race.selected, "thread_1"); assert.equal(desktop.race.loaded, "thread_1"); assert.match(desktop.race.text, /Message one/); assert.doesNotMatch(desktop.race.text, /Message two/);
  assert.deepEqual(desktop.olderRace, { requested: true, selected: "thread_2", loaded: "thread_2", leaked: false });
  assert.equal(desktop.dragSelectionKeptOpen, true); assert.deepEqual(desktop.firstPresenceKeys, desktop.expectedPresenceKeys); assert.deepEqual(desktop.secondPresenceKeys, desktop.expectedPresenceKeys); assert.equal(desktop.rejectionKeptOpen, true);
  assert.equal(desktop.closeButtonWorked && desktop.invalidStaysCorrectable && desktop.escapeWorked && desktop.emojiClosed && desktop.previewRemovable && desktop.previewRemoved, true, JSON.stringify({ closeButtonWorked: desktop.closeButtonWorked, invalidStaysCorrectable: desktop.invalidStaysCorrectable, escapeWorked: desktop.escapeWorked, emojiClosed: desktop.emojiClosed, previewRemovable: desktop.previewRemovable, previewRemoved: desktop.previewRemoved }));
  assert.equal(desktop.sendCallsWhilePending, 1); assert.equal(desktop.delayedSendIsolated && desktop.delayedUploadIsolated && desktop.duplicateCreateBlocked, true, JSON.stringify({ delayedSendIsolated: desktop.delayedSendIsolated, delayedUploadIsolated: desktop.delayedUploadIsolated, duplicateCreateBlocked: desktop.duplicateCreateBlocked }));
  assert.equal(desktop.liveReadApplied && desktop.liveEditApplied && desktop.deferredQueued && desktop.deferredRecovered && desktop.clearImmediate && desktop.clearStayedEmpty, true, JSON.stringify({ liveReadApplied: desktop.liveReadApplied, liveEditApplied: desktop.liveEditApplied, deferredQueued: desktop.deferredQueued, deferredRecovered: desktop.deferredRecovered, clearImmediate: desktop.clearImmediate, clearStayedEmpty: desktop.clearStayedEmpty }));
  assert.equal(desktop.automaticStateKeysSeparate && desktop.titleChangePreservesStateKey && desktop.explicitStateKeyStable, true);
  for (const preset of desktop.presetMenus) { assert.notEqual(preset.display, "none", `${preset.preset}: menu did not open`); assert.ok(preset.color && preset.background, `${preset.preset}: unreadable menu`); assert.equal(preset.border, "1px", `${preset.preset}: missing menu border`); assert.ok(preset.overflow <= 1 && preset.within, `${preset.preset}: menu overflow`); }
  assert.deepEqual(desktop.dependency, { identityHidden: true, identityShown: true, chatHeightHidden: true, chatHeightShown: true, groupMinutesHidden: true, groupMinutesShown: true, defaultReaction: "below_time", classicPlacementHidden:true, bubblePlacementShown:true, hiddenActionSize:true, shownActionSize:true });
  assert.equal(desktop.legacySwitchLoaded, true);
  assert.equal(desktop.retroCustomBackground, "rgb(101, 67, 33)"); assert.equal(desktop.retroDefaultBackground, "rgba(0, 0, 0, 0)");
  assert.deepEqual(desktop.dividerOff, { panel:"1px", chat:"1px" }); assert.deepEqual(desktop.dividerOn, { panel:"2px", chat:"2px" });

  await page.setViewportSize({ width: 360, height: 640 });
  const mobile = await page.evaluate(async () => {
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),card = document.querySelector("hassenger-card"), root = card.shadowRoot; card.setConfig({ ...card._config, preset: "rgb", card_scale: 150, fit_to_screen: true }); await sleep(25);
    const surface = root.querySelector("ha-card"), toggle = root.querySelector("[data-conversation-toggle]"); toggle.click(); const menu = root.querySelector(".conversation-options"), menuRect = menu.getBoundingClientRect();
    const mediaPresets=[];let closeSize=0;for(const preset of ["home_assistant","modern_chat","minimal","terminal","industrial","retro_messenger","midnight","oled","rgb","glass","paper","playful","high_contrast","custom"]){card.setConfig({...card._config,preset,custom_css:""});await sleep(8);const currentSurface=root.querySelector("ha-card"),surfaceRect=currentSurface.getBoundingClientRect(),summary=root.querySelector(".attachment-menu summary");summary.click();await sleep(0);const add=root.querySelector(".attachment-popover"),addRect=add.getBoundingClientRect(),addStyle=getComputedStyle(add),portal=root.querySelector(".attachment-popover-portal"),portalRect=portal.getBoundingClientRect(),portalStyle=getComputedStyle(portal),close=root.querySelector("[data-close-attachment-menu]");closeSize=Math.max(closeSize,close.getBoundingClientRect().width);const visibleLeft=Math.max(0,surfaceRect.left),visibleRight=Math.min(innerWidth,surfaceRect.right),visibleTop=Math.max(0,surfaceRect.top),visibleBottom=Math.min(innerHeight,surfaceRect.bottom),measurement={preset,withinViewport:addRect.left>=-1&&addRect.right<=innerWidth+1&&addRect.top>=-1&&addRect.bottom<=innerHeight+1,withinVisibleCard:addRect.left>=visibleLeft-1&&addRect.right<=visibleRight+1&&addRect.top>=visibleTop-1&&addRect.bottom<=visibleBottom+1,width:addRect.width,panelBackground:addStyle.backgroundColor,panelColor:addStyle.color,panelBorder:addStyle.borderTopWidth,legacyLayer:!!root.querySelector(".attachment-viewport-layer"),portalWidth:portalRect.width,portalHeight:portalRect.height,portalBackground:portalStyle.backgroundColor,portalImage:portalStyle.backgroundImage,portalBorder:portalStyle.borderTopWidth,portalShadow:portalStyle.boxShadow,portalAnimation:portalStyle.animationName,portalBackdrop:portalStyle.backdropFilter||portalStyle.webkitBackdropFilter,portalPointerEvents:portalStyle.pointerEvents};close.click();await sleep(0);mediaPresets.push({...measurement,removed:!root.querySelector(".attachment-popover-portal")});}
    return { cardOverflow: surface.scrollWidth - surface.clientWidth, menuWithin: menuRect.left >= -1 && menuRect.right <= innerWidth + 1, closeSize, mediaPresets };
  });
  assert.ok(mobile.cardOverflow <= 1); assert.equal(mobile.menuWithin, true, JSON.stringify(mobile)); assert.ok(mobile.closeSize >= 33);for(const media of mobile.mediaPresets){assert.equal(media.withinViewport&&media.withinVisibleCard&&media.removed,true,`${media.preset}: media panel escaped its card or did not close ${JSON.stringify(media)}`);assert.ok(media.width<=440.5,`${media.preset}: media panel exceeded 440px ${JSON.stringify(media)}`);assert.ok(media.panelBackground!=="rgba(0, 0, 0, 0)"&&media.panelColor&&media.panelBorder!=="0px",`${media.preset}: media panel did not inherit a readable preset ${JSON.stringify(media)}`);assert.equal(media.legacyLayer,false,`${media.preset}: fullscreen media layer returned`);assert.ok(media.portalWidth<=440.5&&media.portalHeight<640,`${media.preset}: media portal covered the viewport ${JSON.stringify(media)}`);assert.equal(media.portalBackground,"rgba(0, 0, 0, 0)",`${media.preset}: media portal painted a background`);assert.equal(media.portalImage,"none",`${media.preset}: media portal painted a preset image`);assert.equal(media.portalBorder,"0px",`${media.preset}: media portal painted a preset border`);assert.equal(media.portalShadow,"none",`${media.preset}: media portal painted a shadow`);assert.equal(media.portalAnimation,"none",`${media.preset}: media portal animated like the card`);assert.ok(media.portalBackdrop==="none"||media.portalBackdrop==="",`${media.preset}: media portal inherited a backdrop filter ${JSON.stringify(media)}`);assert.equal(media.portalPointerEvents,"none",`${media.preset}: media portal intercepted the dashboard`);}

  console.log(JSON.stringify({ desktop, mobile }, null, 2));
  console.log("Presence, dismissible composer, custom conversation menu, rapid switching, reaction default, editor dependencies, presets, and mobile regressions passed.");
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
