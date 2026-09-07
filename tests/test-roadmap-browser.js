const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("http://hassenger.test/**", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444}body{margin:8px}</style>' }));
  await page.goto("http://hassenger.test/");
  await page.addScriptTag({ path: path.resolve(process.argv[2]) });
  const result = await page.evaluate(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const calls = [], messages = [{ id: "m1", thread_id: "t1", sender_id: "person_2", sender_name: "Person #2", text: "Original", created_at: new Date().toISOString(), reactions: {}, read_by: [] }];
    let failedSend = true;
    const hass = {
      user: { id: "person_1", name: "Person #1", is_admin: true }, states: {}, locale: { language: "en" },
      connection: { subscribeMessage: async () => () => {} },
      callWS: async request => {
        calls.push(structuredClone(request));
        if (request.type === "hassenger/threads/list") return [{ id: "t1", title: "Short", participants: ["person_1", "person_2"], unread: 2 }];
        if (request.type === "hassenger/messages/list") return structuredClone(messages);
        if (request.type === "hassenger/diagnostics") return { integration_version: "1.0.0" };
        if (request.type === "hassenger/contacts/list") return [{ id: "person_1", name: "Person #1", is_self: true }, { id: "person_2", name: "Person #2" }];
        if (request.type === "hassenger/presence/list") return {};
        if (request.type === "hassenger/messages/send") {
          if (failedSend) { failedSend = false; throw new Error("Connection interrupted"); }
          return { id: "sent", thread_id: "t1", sender_id: "person_1", sender_name: "Person #1", text: request.text, created_at: new Date().toISOString() };
        }
        if (request.type === "hassenger/messages/search" || request.type === "hassenger/bookmark/list") return structuredClone(messages);
        return null;
      }
    };
    const config = { type: "custom:hassenger-card", data_source: "hassenger", state_storage_key: "roadmap-test", draft_storage: "local", show_contacts: true, show_inbox: false, height_mode: "fixed", height: 500, quick_message_layout:"dropdowns",quick_messages: [{ label: "Hello", message: "Hello", group: "General" }] };
    const make = async (settings = config, account = hass) => { const card = document.createElement("hassenger-card"); document.body.append(card); card.setConfig(settings); card.hass = account; await sleep(60); return card; };
    let card = await make(), root = card.shadowRoot;
    const refined = { selected: card._config.control_style, addInComposer: !!root.querySelector(".composer .attachment-menu"), actionsAtTop: !!root.querySelector(".conversation-bar .thread-menu"), noFooterActions: !root.querySelector("footer .thread-menu"), noExtraLabel: getComputedStyle(root.querySelector(".conversation-heading small")).display };
    const type = (text) => { const input = card.shadowRoot.querySelector("textarea"); input.value = text; input.dispatchEvent(new Event("input", { bubbles: true })); };
    type("Retained draft");
    const storageKey = card._draftStorageKey(), savedDraft = JSON.parse(localStorage.getItem(storageKey));
    card.remove(); card = await make(); root = card.shadowRoot;
    const restoredDraft = root.querySelector("textarea").value;
    await card._send(0); await card._send(0);
    const sends = calls.filter(call => call.type === "hassenger/messages/send");
    const retry = { sameId: sends.length === 2 && sends[0].client_id === sends[1].client_id, cleared: root.querySelector("textarea").value === "", persistedClear: !Object.values(JSON.parse(localStorage.getItem(storageKey))).some(Boolean) };
    type("Account-specific draft");
    card.hass = { ...hass, user: { id: "person_2", name: "Person #2", is_admin: false } }; await sleep(50);
    const accountIsolated = !Object.values(card._drafts).includes("Account-specific draft") && card._draftStorageKey() !== storageKey;
    card.remove(); card = await make(); root = card.shadowRoot;
    const priorAccountRestored = root.querySelector("textarea").value === "Account-specific draft";
    await card._handleMessageAction("bookmark", "m1");
    const savedRequest = calls.some(call => call.type === "hassenger/bookmark/set" && call.enabled && call.message_id === "m1");
    const originalDialog = card._showActionDialog.bind(card), answers = ["Original", "m1"];
    card._showActionDialog = async () => answers.shift();
    await card._extendedThreadAction("search-all", card._backendThreads[0]);
    const searched = calls.some(call => call.type === "hassenger/messages/search" && call.query === "Original");
    card._showActionDialog = originalDialog;
    const dialogPromise = card._showActionDialog({ mode: "choices", title: "Safe choices", items: [{ value: "m1", label: "<img src=x onerror=alert(1)>" }] });
    await sleep(30);
    const escapedChoice = !root.querySelector(".dialog-choices img") && root.querySelector("[data-dialog-choice]").textContent.includes("<img");
    root.querySelector("[data-dialog-choice]").click();
    const choice = await dialogPromise; await sleep(100);
    const focusReturned = !!root.activeElement && !root.activeElement.closest(".action-dialog") && root.activeElement !== root.host;
    let diagnostics = "";
    card._copyText = async value => { diagnostics = value; return true; };
    await card._extendedThreadAction("diagnostics", card._backendThreads[0]);
    const safeDiagnostics = !/Person #|person_1|Original|Retained draft|hassenger.test/.test(diagnostics) && !!JSON.parse(diagnostics).card_version;
    const mediaMarkup=document.createElement("div");
    mediaMarkup.innerHTML=card._attachmentHtml({url:"http://hassenger.test/file.pdf",content_type:"application/pdf",name:"Example.pdf"})+card._attachmentHtml({url:"http://hassenger.test/file.mp3",content_type:"audio/mpeg",name:"Example.mp3"});
    const fileControls=!!mediaMarkup.querySelector("audio[controls]") && mediaMarkup.querySelectorAll("a[download]").length===2 && !mediaMarkup.querySelector("iframe,object,embed");
    const viewerPromise=card._showActionDialog({mode:"media",title:"Image",mediaUrl:"http://hassenger.test/example.png",mediaName:"Example image",confirmLabel:"Close"});
    await sleep(100);
    const viewer=root.querySelector(".media-viewer"),viewerRect=viewer.getBoundingClientRect();
    const boundedViewer=viewerRect.height<=innerHeight*.65+1 && viewerRect.width<=innerWidth && !!viewer.querySelector("img") && !!root.querySelector("[data-action-dialog-confirm]");
    root.querySelector("[data-action-dialog-confirm]").click();await viewerPromise;await sleep(80);
    type("Later text"); card._showActionDialog = async () => "30";
    await card._scheduleAction("schedule", card._backendThreads[0]);
    const scheduled = calls.some(call => call.type === "hassenger/schedule/create" && call.text === "Later text" && call.delay_minutes === 30);
    card._showActionDialog = originalDialog;
    const presets = [];
    for (const preset of ["home_assistant", "modern_chat", "minimal", "terminal", "industrial", "retro_messenger", "midnight", "oled", "rgb", "glass", "paper", "playful", "high_contrast", "custom"]) {
      card.setConfig({ ...config, preset }); await sleep(25);
      const surface = root.querySelector("ha-card"), quick = root.querySelector("[data-quick-message]"), cs = getComputedStyle(quick), rect = quick.getBoundingClientRect();
      quick.focus({ preventScroll: true }); const focused = getComputedStyle(quick);
      const menu = root.querySelector(".thread-menu"); menu.open = true; await sleep(10);
      const panel = root.querySelector(".thread-menu-popover"), pr = panel.getBoundingClientRect();
      presets.push({ preset, overflow: surface.scrollWidth - surface.clientWidth, within: rect.right <= innerWidth + 1 && rect.left >= 0, readable: cs.color !== cs.backgroundColor && focused.color !== focused.backgroundColor, menuWithin: pr.left >= 0 && pr.right <= innerWidth + 1, scrollable: getComputedStyle(panel).overflowY === "auto" });
      menu.open = false;
    }
    card.setConfig({ ...config, control_style: "classic" }); await sleep(30);
    const classic = !!root.querySelector("footer .recipient-row .attachment-menu");
    card.setConfig({...config,contacts_default_open:true,contacts_section_order:"people_first"}); await sleep(50);
    const section=root.querySelector('[data-contact-section="people"]');
    section.open=false; section.dispatchEvent(new Event("toggle")); await sleep(10); card._render(); await sleep(30);
    const contactsRemembered=!root.querySelector('[data-contact-section="people"]').open && root.querySelector(".contacts-list details").dataset.contactSection==="people";
    let releaseThreads;
    const delayed=new Promise(resolve=>releaseThreads=resolve);
    card.hass={...hass,callWS:async request=>request.type==="hassenger/threads/list"?delayed:hass.callWS(request)};
    const loading=card._ensureBackend(true); await sleep(10);
    card.hass={...hass,user:{id:"person_2",name:"Person #2",is_admin:false}}; await sleep(50);
    releaseThreads([{id:"old-private",title:"Previous account secret",participants:["person_1"]}]);
    await loading; await sleep(30);
    const staleAccountIgnored=card._backendThreads.every(thread=>thread.id!=="old-private") && !root.textContent.includes("Previous account secret");
    const editor = document.createElement("hassenger-card-editor"); document.body.append(editor); editor.setConfig(config);
    editor._loadedSections.add("persistent"); editor._openSections.add("persistent"); editor._render(); await sleep(30);
    const subsections = [...editor.shadowRoot.querySelectorAll("details.editor-subsection")];
    const collapsed = subsections.length > 0 && subsections.some(section => !section.open);
    const priorQuick=JSON.stringify(editor._config.quick_messages);
    editor.shadowRoot.querySelector('[data-setup-profile="neon"]').click(); await sleep(20);
    const setupRecipe=editor._config.preset==="rgb" && editor._config.show_contacts && priorQuick===JSON.stringify(editor._config.quick_messages);
    card.remove(); editor.remove();
    return { refined, savedDraft, restoredDraft, retry, accountIsolated, priorAccountRestored, savedRequest, searched, escapedChoice, choice, focusReturned, safeDiagnostics, scheduled, presets, classic, collapsed, contactsRemembered, staleAccountIgnored, setupRecipe, fileControls, boundedViewer };
  });
  assert.equal(result.refined.selected, "refined");
  assert.ok(result.refined.addInComposer && result.refined.actionsAtTop && result.refined.noFooterActions);
  assert.equal(result.refined.noExtraLabel, "none");
  assert.equal(result.restoredDraft, "Retained draft");
  assert.ok(result.retry.sameId && result.retry.cleared && result.retry.persistedClear);
  for (const key of ["accountIsolated", "priorAccountRestored", "savedRequest", "searched", "escapedChoice", "focusReturned", "safeDiagnostics", "scheduled", "classic", "collapsed", "contactsRemembered", "staleAccountIgnored", "setupRecipe", "fileControls", "boundedViewer"]) assert.equal(result[key], true, key);
  assert.equal(result.choice, "m1");
  for (const preset of result.presets) assert.ok(preset.overflow <= 1 && preset.within && preset.readable && preset.menuWithin && preset.scrollable, JSON.stringify(preset));
  assert.deepEqual(errors, []);
  console.log("Refined and classic controls, 14 presets, private drafts, send retry IDs, saved/search actions, safe diagnostics, scheduling, escaped dialogs and focus passed.");
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
