const { chromium } = require("playwright");
const path = require("path");
const assert = require("assert");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.setContent("<!doctype html><style>:root{--primary-color:#03a9f4;--card-background-color:#1c1c1c;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444;--error-color:#f44336}body{margin:0}</style>");
  await page.addScriptTag({ path: path.resolve(process.argv[2]) });

  const result = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const users = Array.from({ length: 8 }, (_, index) => ({ id: `person_${index + 1}`, name: `Person #${index + 1}`, is_admin: index === 0 }));
    const threads = Array.from({ length: 36 }, (_, index) => ({
      id: `thread_${index + 1}`,
      title: `Conversation ${index + 1} with an intentionally long descriptive title`,
      participants: ["person_1", `person_${(index % 7) + 2}`],
      icon: "mdi:message-text-outline",
      color: index % 2 ? "#7e57c2" : "#03a9f4",
      unread: index % 5,
      muted: index % 7 === 0,
      last_message: { text: `Latest message preview ${index + 1}`, created_at: new Date(Date.now() - index * 60000).toISOString() },
    }));
    const messages = Array.from({ length: 240 }, (_, index) => ({
      id: `message_${index + 1}`,
      thread_id: "thread_1",
      sender_id: index % 2 ? "person_1" : "person_2",
      sender_name: index % 2 ? "Person #1" : "Person #2",
      text: index === 239 ? '<img id="injected-message" src=x onerror="window.__injected=true">' : `Stress message ${index + 1} ${"content ".repeat(index % 8)}`,
      type: "text",
      created_at: new Date(Date.now() - (240 - index) * 60000).toISOString(),
      read_by: index % 2 ? ["person_1", "person_2"] : ["person_2"],
      reactions: index % 11 === 0 ? { "👍": ["person_1"] } : {},
    }));
    const states = Object.fromEntries(Array.from({ length: 24 }, (_, index) => [`sensor.status_${index + 1}`, { state: index % 6 === 0 ? "unavailable" : `${index + 1}`, attributes: { friendly_name: `Very long status entity ${index + 1}`, icon: "mdi:information-outline" } }]));
    states["tts.piper"] = { state: "idle", attributes: { friendly_name: "Piper" } };
    states["media_player.office"] = { state: "idle", attributes: { friendly_name: "Office speaker" } };
    let listCalls = 0;
    const hass = {
      states,
      locale: { language: "en-US" },
      user: { id: "person_1", name: "Person #1", is_admin: true },
      connection: { subscribeMessage: async () => () => {} },
      callService: async () => {},
      callWS: async (msg) => {
        if (msg.type === "hassenger/diagnostics") return { integration_version: "2.1.7" };
        if (msg.type === "hassenger/users/list") return users;
        if (msg.type === "hassenger/threads/list") { listCalls++; return threads; }
        if (msg.type === "hassenger/messages/list") return messages.slice(-Math.min(Number(msg.limit) || 100, 500));
        return null;
      },
    };
    const headerEntities = Array.from({ length: 24 }, (_, index) => ({ entity: `sensor.status_${index + 1}`, name: `Status ${index + 1}`, icon: "mdi:information-outline", color: index % 2 ? "#ff9800" : "#03a9f4", show_icon: true, show_name: true, show_state: true }));
    const quickMessages = Array.from({ length: 50 }, (_, index) => ({ label: `Shortcut ${index + 1}`, message: `Full shortcut message ${index + 1}`, group: index < 25 ? "People" : "Automation and Assist", icon: "mdi:message-fast" }));
    const personalThreads = [
      { name: "Home Assistant Assist destination with a long name", sender_type: "assist", icon: "mdi:robot", color: "#7e57c2", enabled: true, assist_agent: "conversation.home_assistant", assist_keep_context: true },
      { name: "Office announcement speaker with a long name", sender_type: "tts", icon: "mdi:speaker-message", color: "#ff9800", enabled: true, tts_entity: "tts.piper", media_player_entity: "media_player.office", tts_announce: true, tts_pre_announce: false, tts_chime_enabled: false },
    ];
    const base = { type: "custom:hassenger-card", data_source: "hassenger", title: "Hassenger stress validation", show_header: true, show_inbox: true, inbox_style: "cards", show_conversation_header: true, show_search: true, show_clear: true, show_jump: true, show_send_identity: true, show_composer_media: true, show_voice_input: true, fit_to_screen: true, width_mode: "fit", height_mode: "fixed", height: 620, header_entities: headerEntities, quick_message_layout:"dropdowns",quick_messages: quickMessages, personal_threads: personalThreads, preset: "home_assistant" };
    const presets = Object.keys(window.HassengerCardUtils.PRESETS), layouts = ["classic_log", "chat_bubbles", "compact_feed"], headerStyles = ["chips", "badges", "compact"], widths = [280, 320, 375, 480, 768], scales = [75, 100, 150];
    const card = document.createElement("hassenger-card"); document.body.append(card); card.hass = hass; card.setConfig(base); await sleep(40);
    card._backendThreads = threads.slice(0, 4); card._backendMessages = messages.slice(-12);
    const matrixBase = { ...base, header_entities: headerEntities.slice(0, 1), quick_message_layout:"dropdowns",quick_messages: [], personal_threads: [], inbox_style: "dropdown" };
    const matrixFailures = [], renderTimes = [];
    for (const preset of presets) for (const layout of layouts) for (const header_info_style of headerStyles) for (const width of widths) {
      const scale = scales[(preset.length + layout.length + header_info_style.length + width) % scales.length];
      card.style.width = `${width}px`;
      const started = performance.now();
      card.setConfig({ ...matrixBase, preset, layout, header_info_style, card_scale: scale });
      renderTimes.push(performance.now() - started);
      const surface = card.shadowRoot.querySelector("ha-card"), hostRect = card.getBoundingClientRect(), cardRect = surface.getBoundingClientRect(), composer = card.shadowRoot.querySelector(".composer"), composerRect = composer?.getBoundingClientRect(), sendRect = card.shadowRoot.querySelector(".send")?.getBoundingClientRect(), messagesRect = card.shadowRoot.querySelector(".messages")?.getBoundingClientRect();
      const reasons = [];
      if (cardRect.left < hostRect.left - 1 || cardRect.right > hostRect.right + 1) reasons.push(`card bounds ${cardRect.left.toFixed(1)}..${cardRect.right.toFixed(1)} outside host ${hostRect.left.toFixed(1)}..${hostRect.right.toFixed(1)}`);
      if (surface.scrollWidth > surface.clientWidth + 2) reasons.push(`horizontal overflow ${surface.scrollWidth - surface.clientWidth}px`);
      if (!composer || !sendRect || sendRect.right > cardRect.right + 1 || composerRect.left < cardRect.left - 1) reasons.push("composer/send clipped");
      if (!messagesRect || messagesRect.height < 118) reasons.push(`message area collapsed to ${messagesRect?.height || 0}px`);
      if (/NaN|undefined/.test(surface.getAttribute("style") || "")) reasons.push("invalid inline CSS");
      if (reasons.length) matrixFailures.push({ preset, layout, header_info_style, width, scale, reasons });
    }

    card._backendThreads = threads; card._backendMessages = messages.slice(-200); card.style.width = "320px";
    card.setConfig({ ...base, preset: "rgb", card_scale: 150, preserve_chat_height: true, chat_height: 360, inbox_style: "dropdown" });
    const denseSurface = card.shadowRoot.querySelector("ha-card"), denseMessages = card.shadowRoot.querySelector(".messages"), denseHeader = card.shadowRoot.querySelector(".info-scroll"), denseQuick = card.shadowRoot.querySelector(".quick-area"), denseQuickSelect=card.shadowRoot.querySelector("[data-quick-message]");
    const dense = { surfaceOverflow: denseSurface.scrollWidth - denseSurface.clientWidth, messageHeight: Math.round(denseMessages.getBoundingClientRect().height), headerScrollable: denseHeader.scrollWidth > denseHeader.clientWidth, quickScrollable: denseQuick.scrollWidth > denseQuick.clientWidth+1, quickOptions:denseQuickSelect.options.length, loadedMessages: card.shadowRoot.querySelectorAll(".msg").length, threadOptions: card.shadowRoot.querySelectorAll("[data-thread-select] option").length };
    const overflowElements=[...denseSurface.querySelectorAll("*")].map((element)=>({tag:element.tagName.toLowerCase(),classes:element.className||"",overflow:element.scrollWidth-element.clientWidth,client:element.clientWidth,scroll:element.scrollWidth})).filter((item)=>item.overflow>1).sort((a,b)=>b.overflow-a.overflow).slice(0,12);

    const migrated = window.HassengerCardUtils.migrateConfig({ data_source: "hassenger", reaction_placement: "outside_the_card", card_scale: 999, card_width: 1, message_gap: -5, grouped_message_gap: 99, chat_height: 9999, rgb_glow_brightness: 999, people: null, personal_threads: null, quick_message_layout:"dropdowns",quick_messages: null, header_entities: null, persistent_profiles: null, colors: "bad", typography: null });
    const clamps = { card_scale: migrated.card_scale, card_width: migrated.card_width, message_gap: migrated.message_gap, grouped_message_gap: migrated.grouped_message_gap, chat_height: migrated.chat_height, rgb_glow_brightness: migrated.rgb_glow_brightness, reaction_placement:migrated.reaction_placement, arrays: [migrated.people, migrated.personal_threads, migrated.quick_messages, migrated.header_entities, migrated.persistent_profiles].every(Array.isArray), colorsObject: !!migrated.colors && typeof migrated.colors === "object" && !Array.isArray(migrated.colors) };

    card.style.width = "480px";
    card.setConfig({ ...base, title: '<img id="injected-title" src=x onerror="window.__injected=true">', header_entities: [], quick_message_layout:"dropdowns",quick_messages: [], personal_threads: [] }); await sleep(20);
    threads[0].last_message.text = '<img id="injected-preview" src=x onerror="window.__injected=true">';
    card._backendThreads = threads;
    card.setConfig({ ...base, preset: "custom", inbox_style: "dropdown", custom_css: '</style><img id="injected-css" src=x onerror="window.__injected=true"><style>', header_entities: [], quick_message_layout:"dropdowns",quick_messages: [], personal_threads: [] }); await sleep(20);
    const injection = { titleText: card.shadowRoot.querySelector("h2")?.textContent, titleElement: !!card.shadowRoot.querySelector("#injected-title"), messageElement: !!card.shadowRoot.querySelector("#injected-message"), previewElement: !!card.shadowRoot.querySelector("#injected-preview"), cssElement: !!card.shadowRoot.querySelector("#injected-css"), previewText: card.shadowRoot.querySelector("[data-thread-select] option")?.textContent, globalExecuted: window.__injected === true };

    const editor = document.createElement("hassenger-card-editor"); document.body.append(editor); editor.hass = hass; editor.setConfig({ ...base, preset: "rgb", persistent_profiles: [{ match_name: "Person #2", display_name: "A very long custom sender display name", thread_title_match: threads[0].title, conversation_name: "A very long custom conversation display name", person_entity: "person.person_2", icon: "mdi:account", color: "#03a9f4", bubble_color: "#123456", text_color: "#ffffff", alignment: "left", show_name: true, show_timestamp: true }], header_entities: [headerEntities[0]], quick_message_layout:"dropdowns",quick_messages: quickMessages.slice(0, 3) }); await sleep(30);
    const editorWidths = {}, unnamedButtons = {}, smallTargets = {};
    for (const width of [320, 480, 760]) {
      editor.style.width = `${width}px`; for (const key of ["basics","header-info","persistent","composer","appearance","typography","behavior","preview","debug"]) { const details=editor.shadowRoot.querySelector(`[data-editor-section="${key}"]`);if(details&&!details.open){details.open=true;details.dispatchEvent(new Event("toggle"));await sleep(0);} } for (const details of editor.shadowRoot.querySelectorAll("details")) details.open = true; await sleep(0);
      editorWidths[width] = editor.scrollWidth - editor.clientWidth;
      const buttons = [...editor.shadowRoot.querySelectorAll("button")];
      unnamedButtons[width] = buttons.filter((button) => !(button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent.trim())).length;
      smallTargets[width] = buttons.filter((button) => { const rect = button.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && (rect.width < 32 || rect.height < 32); }).length;
    }
    const editorConsistency = { looseChecks: editor.shadowRoot.querySelectorAll("label.check").length, structuredToggles: editor.shadowRoot.querySelectorAll("label.setting-toggle").length, inlineStyleButtons: [...editor.shadowRoot.querySelectorAll("button[style]")].length, sectionsWithCount: [...editor.shadowRoot.querySelectorAll(".editor>details>summary em")].length };

    let voiceRecognition;
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "permissions", { value: { query: async () => ({ state: "granted" }) }, configurable: true });
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) }, configurable: true });
    class DelayedRecognition { start() { voiceRecognition = this; this.onstart?.(); } stop() { this.onend?.(); } }
    window.SpeechRecognition = DelayedRecognition;
    card.setConfig({ ...base, header_entities: [], quick_message_layout:"dropdowns",quick_messages: [], personal_threads: [], show_voice_input: true }); await sleep(20);
    card.shadowRoot.querySelector("[data-voice]").click(); await sleep(0); card._render(); voiceRecognition.onresult?.({ results: [[{ transcript: "Rerender race" }]] }); voiceRecognition.onend?.(); await sleep(0);
    const active = card.shadowRoot.activeElement, composer = card.shadowRoot.querySelector("textarea[data-composer]");
    const voiceRerender = { draft: composer?.value, focused: active === composer, oldFieldDetached: !voiceRecognition ? null : true };

    const failureReasons = {};
    for (const failure of matrixFailures) for (const reason of failure.reasons) {
      const category = reason.startsWith("horizontal overflow") ? "horizontal overflow" : reason.startsWith("message area collapsed") ? "message area collapsed" : reason;
      failureReasons[category] = (failureReasons[category] || 0) + 1;
    }
    const maxRender = Math.max(...renderTimes), averageRender = renderTimes.reduce((sum, value) => sum + value, 0) / renderTimes.length;
    return { version: window.HassengerCardUtils.VERSION, presets: presets.length, matrixCases: renderTimes.length, matrixFailureCount: matrixFailures.length, failureReasons, matrixFailures: matrixFailures.slice(0, 20), renderMs: { max: maxRender, average: averageRender }, dense, overflowElements, clamps, injection, editorWidths, unnamedButtons, smallTargets, editorConsistency, voiceRerender, listCalls };
  });

  assert.equal(result.version, require("../package.json").version);
  assert.equal(result.matrixCases, result.presets * 3 * 3 * 5);
  assert.deepEqual(result.clamps, { card_scale: 150, card_width: 240, message_gap: 0, grouped_message_gap: 16, chat_height: 1000, rgb_glow_brightness: 100, reaction_placement:"below_time", arrays: true, colorsObject: true });
  assert.equal(result.injection.titleElement, false); assert.equal(result.injection.messageElement, false); assert.equal(result.injection.previewElement, false); assert.equal(result.injection.cssElement, false); assert.equal(result.injection.globalExecuted, false);
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
