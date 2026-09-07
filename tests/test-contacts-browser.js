const { chromium } = require("playwright");
const path = require("path");
const assert = require("assert");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.setContent("<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444;--error-color:#f44336}body{margin:0}</style>");
  await page.addScriptTag({ path: path.resolve(process.argv[2]) });
  const result = await page.evaluate(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const calls = [];
    const contacts = [
      { id: "person_1", name: "Person #1", is_self: true, person_entity_id: "person.person_1", person_state: "home", entity_picture: "" },
      { id: "person_2", name: "Person #2", is_self: false, person_entity_id: "person.person_2", person_state: "not_home", entity_picture: "" },
      { id: "person_3", name: "Person #3", is_self: false, person_entity_id: "person.person_3", person_state: "home", entity_picture: "" },
    ];
    const presence = {
      person_1: { mode: "automatic", home_message: "Home and ready", away_message: "Away from home" },
      person_2: { mode: "automatic", home_message: "At home", away_message: "<img id=attack src=x onerror=alert(1)> Out running errands" },
      person_3: { mode: "busy", busy_message: "In a meeting" },
    };
    const threads = [
      { id: "direct_2", title: "testing", participants: ["person_1", "person_2"], icon: "mdi:message", color: "#03a9f4", unread: 0, last_message: { text: "Direct hello", created_at: "2026-08-31T10:00:00Z" } },
      { id: "group_1", title: "A very long household conversation title", participants: ["person_1", "person_2", "person_3"], icon: "mdi:account-group", color: "#9b5de5", unread: 2, last_message: { text: "Group update", created_at: "2026-08-31T09:00:00Z" } },
    ];
    const messages = {
      direct_2: [{ id: "m1", thread_id: "direct_2", sender_id: "person_2", sender_name: "Person #2", text: "Direct hello", created_at: "2026-08-31T10:00:00Z", read_by: ["person_2"], reactions: {} }],
      group_1: [{ id: "m2", thread_id: "group_1", sender_id: "person_3", sender_name: "Person #3", text: "Group update", created_at: "2026-08-31T09:00:00Z", read_by: ["person_3"], reactions: {} }],
    };
    const hass = {
      user: { id: "person_1", name: "Person #1", is_admin: true },
      locale: { language: "en-US" },
      states: {
        "person.person_1": { state: "home", attributes: { friendly_name: "Person #1", user_id: "person_1" } },
        "person.person_2": { state: "not_home", attributes: { friendly_name: "Person #2", user_id: "person_2" } },
        "person.person_3": { state: "home", attributes: { friendly_name: "Person #3", user_id: "person_3" } },
      },
      connection: { subscribeMessage: async () => () => {} },
      callService: async (...args) => calls.push({ service: args }),
      callWS: async msg => {
        calls.push({ ...msg });
        if (msg.type === "hassenger/diagnostics") return { integration_version: "2.2.0" };
        if (msg.type === "hassenger/threads/list") return threads;
        if (msg.type === "hassenger/messages/list") { if(msg.thread_id==="direct_person_3") await sleep(120); return messages[msg.thread_id] || []; }
        if (msg.type === "hassenger/contacts/list") return contacts;
        if (msg.type === "hassenger/presence/list") return presence;
        if (msg.type === "hassenger/presence/set") { presence.person_1 = { ...msg, type: undefined, updated_at: "now" }; delete presence.person_1.type; return presence.person_1; }
        if (msg.type === "hassenger/direct_thread/open") {
          let thread = threads.find(item => item.participants.length === 2 && item.participants.includes(msg.target_user_id));
          if (!thread) { thread = { id: `direct_${msg.target_user_id}`, title: `Person #1 & Person #3`, participants: ["person_1", msg.target_user_id], icon: "mdi:account-multiple", color: "", unread: 0 }; threads.unshift(thread); messages[thread.id] = []; }
          return { thread, created: thread.id !== "direct_2" };
        }
        if (msg.type === "hassenger/thread/mark_read") return null;
        return null;
      },
    };
    const config = {
      type: "custom:hassenger-card", data_source: "hassenger", show_contacts: true, contacts_default_open: true,
      contacts_placement: "right", contacts_trigger: "header", contacts_replace_inbox: true, contacts_separate_windows: true,
      contacts_window_gap: 12, contacts_width: 260, width_mode: "custom", card_width: 1050, fit_to_screen: true,
      height_mode: "fixed", height: 620, show_inbox: true, show_conversation_header: true, show_search: true, show_clear: true,
      personal_threads: [
        { name: "Home Assistant", sender_type: "assist", icon: "mdi:robot", color: "#7e57c2", enabled: true },
        { name: "Speaker", sender_type: "tts", icon: "mdi:speaker-message", color: "#ff9800", enabled: true },
      ],
    };
    const card = document.createElement("hassenger-card"); document.body.append(card); card.setConfig(config); card.hass = hass; await sleep(120);
    const root = card.shadowRoot, surface = root.querySelector("ha-card"), main = root.querySelector(".card-main"), panel = root.querySelector(".contacts-panel");
    const sectionTitles = [...root.querySelectorAll(".contacts-list h3")].map(node => node.textContent.trim());
    const conversationText = [...root.querySelectorAll(".conversation-contact")].map(node => node.textContent.replace(/\s+/g, " ").trim());
    const contactText = [...root.querySelectorAll("[data-contact-index]")].map(node => node.textContent.replace(/\s+/g, " ").trim());
    const avatar = [...root.querySelectorAll("[data-contact-index]")].find(node => node.textContent.includes("Person #2"))?.querySelector(".contact-avatar"), avatarIcon = avatar?.querySelector(":scope > ha-icon"), statusBadge = avatar?.querySelector(":scope > i"), statusIcon = statusBadge?.querySelector("ha-icon");
    const centerDelta = (outer, inner) => { const a=outer?.getBoundingClientRect(),b=inner?.getBoundingClientRect(); return a&&b ? { x: Math.abs((a.left+a.right-b.left-b.right)/2), y: Math.abs((a.top+a.bottom-b.top-b.bottom)/2) } : null; };
    const switcher = root.querySelector(".conversation-switcher"), messagePanel = root.querySelector(".messages"), destinationRows = [...root.querySelectorAll("[data-contact-index]")].filter(node => /Home Assistant|Speaker/.test(node.textContent));
    const initialSelect=root.querySelector(".conversation-switcher select"),initialSwitcherRect=switcher.getBoundingClientRect(),initialSelectRect=initialSelect.getBoundingClientRect();initialSelect.focus();
    const initial = {
      sectionTitles, conversationText, contactText,
      hasTopInbox: !!root.querySelector(".thread-inbox,.thread-inbox-dropdown"),
      selectedHeading: root.querySelector(".conversation-switcher select")?.selectedOptions?.[0]?.textContent || "",
      switcherInsideTranscript: !!switcher && switcher.parentElement.classList.contains("conversation-bar") && switcher.parentElement.nextElementSibling === messagePanel,
      footerConversationSelector: !!root.querySelector("footer [data-person-select],footer .recipient-select"),
      selectorGeometry:{outerWidth:initialSwitcherRect.width,selectWidth:initialSelectRect.width,innerOutline:getComputedStyle(initialSelect).outlineStyle,innerBorder:getComputedStyle(initialSelect).borderTopWidth,innerShadow:getComputedStyle(initialSelect).boxShadow,outerShadow:getComputedStyle(switcher).boxShadow},
      iconAlignment: { avatar: centerDelta(avatar,avatarIcon), status: centerDelta(statusBadge,statusIcon) },
      destinationStatusBadges: destinationRows.filter(node=>node.querySelector(".contact-avatar > i")).length,
      injectedNode: !!root.querySelector("#attack"),
      headerNew: !!root.querySelector("header [data-action='new-thread']"), headerArchive: !!root.querySelector("header [data-action='archived']"), headerClear: !!root.querySelector("header [data-action='clear']"),
      panelNew: !!panel.querySelector("[data-action='new-thread']"), panelArchive: !!panel.querySelector("[data-action='archived']"),
      menuHasClear: !!root.querySelector("[data-thread-action='clear']"), menuHasDelete: !!root.querySelector("[data-thread-action='delete']"),
      surfaceOverflow: surface.scrollWidth - surface.clientWidth, panelWidth: Math.round(panel.getBoundingClientRect().width), mainWidth: Math.round(main.getBoundingClientRect().width),
      transition: getComputedStyle(surface).transitionDuration,
    };
    root.querySelector("[data-contacts-toggle]").click(); await sleep(300);
    const collapsedSurface=root.querySelector("ha-card"),collapsedPanel=root.querySelector(".contacts-panel"),collapsedMain=root.querySelector(".card-main");
    const collapsed = { panelWidth: Math.round(collapsedPanel.getBoundingClientRect().width), mainWidth: Math.round(collapsedMain.getBoundingClientRect().width), open: collapsedSurface.classList.contains("contacts-open") };
    root.querySelector("[data-contacts-toggle]").click(); await sleep(300);
    const expandedSurface=root.querySelector("ha-card"),expandedPanel=root.querySelector(".contacts-panel"),expandedMain=root.querySelector(".card-main");
    const expanded = { panelWidth: Math.round(expandedPanel.getBoundingClientRect().width), mainWidth: Math.round(expandedMain.getBoundingClientRect().width), open: expandedSurface.classList.contains("contacts-open") };

    root.querySelector("[data-presence-settings]").click(); await sleep(10);
    const away = root.querySelector('[data-presence-field="away_message"]'); away.value = "Back after dinner"; away.dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector("[data-presence-save]").click(); await sleep(40);
    const presenceSaved = calls.some(call => call.type === "hassenger/presence/set" && call.away_message === "Back after dinner" && call.mode === "automatic");

    const widthSelect=root.querySelector(".conversation-switcher select");widthSelect.value="1";widthSelect.dispatchEvent(new Event("change",{bubbles:true}));await sleep(20);const longSelectorWidth=root.querySelector(".conversation-switcher").getBoundingClientRect().width;root.querySelector(".conversation-switcher select").value="0";root.querySelector(".conversation-switcher select").dispatchEvent(new Event("change",{bubbles:true}));await sleep(20);
    const person3 = [...root.querySelectorAll("[data-contact-index]")].find(node => node.textContent.includes("Person #3")); person3.click(); await sleep(10);const selectedImmediately=root.querySelector(".conversation-switcher select")?.selectedOptions?.[0]?.textContent||"";await sleep(150);
    const directCreated = calls.some(call => call.type === "hassenger/direct_thread/open" && call.target_user_id === "person_3");
    const selectedAfterDirect = root.querySelector(".conversation-switcher select")?.selectedOptions?.[0]?.textContent || "";

    card.setConfig({ ...config, card_width: 520, contacts_width: 260, contacts_placement: "right", contacts_default_open: true }); await sleep(40);
    const narrowPanel=root.querySelector(".contacts-panel").getBoundingClientRect(),narrowMain=root.querySelector(".card-main").getBoundingClientRect(),narrowSurface=root.querySelector("ha-card");
    const narrowDock={panelWidth:Math.round(narrowPanel.width),mainWidth:Math.round(narrowMain.width),overflow:narrowSurface.scrollWidth-narrowSurface.clientWidth};

    card.setConfig({ ...config, contacts_placement: "overlay", contacts_default_open: false }); await sleep(40);
    if (!root.querySelector("ha-card").classList.contains("contacts-open")) root.querySelector("[data-contacts-toggle]").click(); await sleep(40);
    const overlaySurface=root.querySelector("ha-card"),overlayPanel=root.querySelector(".contacts-panel"),overlayMain=root.querySelector(".card-main");
    const desktopOverlay = { position: getComputedStyle(overlayPanel).position, mainWidth: Math.round(overlayMain.getBoundingClientRect().width), panelWidth: Math.round(overlayPanel.getBoundingClientRect().width), overflow: overlaySurface.scrollWidth - overlaySurface.clientWidth };

    const presets = ["home_assistant","modern_chat","minimal","terminal","industrial","retro_messenger","midnight","oled","rgb","glass","paper","playful","high_contrast"];
    const presetChecks = [];
    for (const preset of presets) { card.setConfig({ ...config, preset, contacts_placement: "overlay" }); await sleep(5); const currentPanel = card.shadowRoot.querySelector(".contacts-panel"), currentSurface = card.shadowRoot.querySelector("ha-card"),option=card.shadowRoot.querySelector(".conversation-switcher option"); presetChecks.push({ preset, color: getComputedStyle(currentPanel).color, background: getComputedStyle(currentPanel).backgroundColor, optionColor:getComputedStyle(option).color,optionBackground:getComputedStyle(option).backgroundColor, overflow: currentSurface.scrollWidth-currentSurface.clientWidth }); }
    card.setConfig({ ...config, preset: "rgb", contacts_placement: "left", contacts_separate_windows: true, contacts_window_gap: 12 }); await sleep(40);
    const rgbSurface=card.shadowRoot.querySelector("ha-card"),rgbPanel=card.shadowRoot.querySelector(".contacts-panel"),rgbMain=card.shadowRoot.querySelector(".card-main"),rgbPanelStyle=getComputedStyle(rgbPanel),rgbMainStyle=getComputedStyle(rgbMain),rgbSurfaceStyle=getComputedStyle(rgbSurface);
    const rgbSeparated={gap:rgbSurfaceStyle.columnGap,panelRadius:rgbPanelStyle.borderRadius,mainRadius:rgbMainStyle.borderRadius,panelAnimation:rgbPanelStyle.animationName,mainAnimation:rgbMainStyle.animationName,panelBorder:rgbPanelStyle.borderTopWidth,mainBorder:rgbMainStyle.borderTopWidth};

    const editor = document.createElement("hassenger-card-editor"); document.body.append(editor); editor.hass = hass; editor.setConfig(config); await sleep(30);
    const brandingSection=editor.shadowRoot.querySelector('.branding-subsection'),brandingInitiallyOpen=brandingSection.open;brandingSection.querySelector('summary').click();await sleep(5);const brandingOpened=brandingSection.open;brandingSection.querySelector('summary').click();await sleep(5);const brandingMinimized=!brandingSection.open;
    const contactsSection = editor.shadowRoot.querySelector('[data-editor-section="contacts"]'); contactsSection.open = true; contactsSection.dispatchEvent(new Event("toggle")); await sleep(30);
    const editorText = editor.shadowRoot.querySelector('[data-editor-section="contacts"]')?.textContent || "",editorCategories=[...editor.shadowRoot.querySelectorAll(".editor-category b")].map(node=>node.textContent.trim()),editorSectionAccents=[...editor.shadowRoot.querySelectorAll('.editor>details[data-editor-section]')].map(node=>({key:node.dataset.editorSection,color:getComputedStyle(node).borderLeftColor,width:getComputedStyle(node).borderLeftWidth}));
    return { initial, collapsed, expanded, presenceSaved, directCreated, selectedImmediately, selectedAfterDirect, selectorWidths:{short:initialSwitcherRect.width,long:longSelectorWidth}, narrowDock, desktopOverlay, presetChecks, rgbSeparated, editorText, editorCategories, editorSectionAccents, brandingCollapse:{brandingInitiallyOpen,brandingOpened,brandingMinimized} };
  });

  assert.deepEqual(result.initial.sectionTitles, ["Conversations", "Contacts", "Destinations"]);
  assert.equal(result.initial.conversationText.length, 1); assert.match(result.initial.conversationText[0], /household/i); assert.doesNotMatch(result.initial.conversationText[0], /testing/);
  assert.ok(result.initial.contactText.some(text => /Person #2.*Out running errands/.test(text))); assert.ok(result.initial.contactText.some(text => /Person #3.*In a meeting/.test(text)));
  assert.equal(result.initial.injectedNode, false); assert.equal(result.initial.hasTopInbox, false); assert.equal(result.initial.selectedHeading, "testing");
  assert.equal(result.initial.switcherInsideTranscript, true); assert.equal(result.initial.footerConversationSelector, false); assert.equal(result.initial.destinationStatusBadges, 0);
  assert.ok(result.initial.iconAlignment.avatar.x <= 1 && result.initial.iconAlignment.avatar.y <= 1, `contact avatar is off-center ${JSON.stringify(result.initial.iconAlignment.avatar)}`); assert.ok(result.initial.iconAlignment.status.x <= 1 && result.initial.iconAlignment.status.y <= 1, `contact status is off-center ${JSON.stringify(result.initial.iconAlignment.status)}`);
  assert.ok(result.initial.selectorGeometry.outerWidth<160,`short conversation selector stayed oversized ${JSON.stringify(result.initial.selectorGeometry)}`);assert.equal(result.initial.selectorGeometry.innerOutline,"none");assert.equal(result.initial.selectorGeometry.innerBorder,"0px");assert.equal(result.initial.selectorGeometry.innerShadow,"none");assert.notEqual(result.initial.selectorGeometry.outerShadow,"none");assert.ok(result.selectorWidths.long>result.selectorWidths.short+30,`selector did not size to selected name ${JSON.stringify(result.selectorWidths)}`);assert.ok(result.selectorWidths.long<=320);
  assert.equal(result.initial.headerNew || result.initial.headerArchive || result.initial.headerClear, false); assert.equal(result.initial.panelNew && result.initial.panelArchive, true);
  assert.equal(result.initial.menuHasClear && result.initial.menuHasDelete, true); assert.ok(result.initial.surfaceOverflow <= 1); assert.ok(result.initial.panelWidth >= 250);
  assert.equal(result.collapsed.open, false); assert.ok(result.collapsed.mainWidth > result.initial.mainWidth + 200); assert.equal(result.expanded.open, true); assert.ok(result.expanded.panelWidth >= 250);
  assert.equal(result.presenceSaved, true); assert.equal(result.directCreated, true); assert.match(result.selectedImmediately, /Person #1 & Person #3/); assert.match(result.selectedAfterDirect, /Person #1 & Person #3/);
  assert.ok(result.narrowDock.panelWidth<=200,`narrow Contacts pane remained too wide ${JSON.stringify(result.narrowDock)}`); assert.ok(result.narrowDock.mainWidth>=300,`narrow chat was crushed ${JSON.stringify(result.narrowDock)}`); assert.ok(result.narrowDock.overflow<=1);
  assert.equal(result.desktopOverlay.position, "absolute"); assert.ok(result.desktopOverlay.overflow <= 1); assert.ok(result.desktopOverlay.mainWidth > result.desktopOverlay.panelWidth);
  for (const item of result.presetChecks) { assert.ok(item.color && item.background, `${item.preset}: Contacts did not inherit visible colors`); assert.ok(item.optionColor&&item.optionBackground&&item.optionColor!==item.optionBackground,`${item.preset}: dropdown options did not inherit readable preset colors ${JSON.stringify(item)}`); assert.ok(item.overflow <= 1, `${item.preset}: Contacts overflowed by ${item.overflow}px`); }
  const retroContacts=result.presetChecks.find(item=>item.preset==="retro_messenger");assert.equal(retroContacts.background,"rgb(255, 255, 255)");assert.equal(retroContacts.color,"rgb(0, 0, 0)");
  assert.equal(result.rgbSeparated.gap, "12px"); assert.notEqual(result.rgbSeparated.panelRadius, "0px"); assert.notEqual(result.rgbSeparated.mainRadius, "0px"); assert.equal(result.rgbSeparated.panelBorder, "1px"); assert.equal(result.rgbSeparated.mainBorder, "1px"); assert.match(result.rgbSeparated.panelAnimation, /hassenger-rgb-border/); assert.match(result.rgbSeparated.mainAnimation, /hassenger-rgb-border/);
  assert.match(result.editorText, /Contacts replaces top inbox/); assert.match(result.editorText, /Separate desktop windows/); assert.match(result.editorText, /Available icon/);
  assert.deepEqual(result.editorCategories, ["Essentials","Conversations & Contacts","Header & Dashboard","Messaging","Appearance","Behavior & Diagnostics"]);
  assert.ok(result.editorSectionAccents.length >= 10); assert.equal(new Set(result.editorSectionAccents.map(item=>item.color)).size,result.editorSectionAccents.length,`editor sections reused accent colors ${JSON.stringify(result.editorSectionAccents)}`); assert.ok(result.editorSectionAccents.every(item=>item.width==="4px"));
  assert.equal(result.brandingCollapse.brandingInitiallyOpen,false); assert.equal(result.brandingCollapse.brandingOpened,true); assert.equal(result.brandingCollapse.brandingMinimized,true);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(async () => {
    const card = document.querySelector("hassenger-card"), root = card.shadowRoot;
    card.setConfig({ ...card._config, contacts_placement: "left", contacts_default_open: true, width_mode: "fit", card_scale: 100, show_send_identity: true });
    if (!card._contactsOpen) root.querySelector("[data-contacts-toggle]")?.click();
    await new Promise(resolve => setTimeout(resolve, 50));
    const panel = root.querySelector(".contacts-panel"), surface = root.querySelector("ha-card"), rect = panel.getBoundingClientRect(),panelPosition=getComputedStyle(panel).position, person2=[...root.querySelectorAll("[data-contact-index]")].find(node=>node.textContent.includes("Person #2"));
    person2.click(); await new Promise(resolve=>setTimeout(resolve,100));
    const identity=root.querySelector(".send-identity"),attachment=root.querySelector(".attachment-menu"),identityRect=identity?.getBoundingClientRect(),attachmentRect=attachment?.getBoundingClientRect();
    return { position: panelPosition, left: rect.left, right: rect.right, viewport: innerWidth, overflow: root.querySelector("ha-card").scrollWidth-root.querySelector("ha-card").clientWidth, mainWidth: root.querySelector(".card-main").getBoundingClientRect().width, contactsOpen:root.querySelector("ha-card").classList.contains("contacts-open"), selected:root.querySelector(".conversation-switcher select")?.selectedOptions?.[0]?.textContent||"", footerConversationSelector:!!root.querySelector("footer [data-person-select],footer .recipient-select"), identityBeforeAttachment:!!identityRect&&!!attachmentRect&&identityRect.left<attachmentRect.left, footerOverflow:root.querySelector("footer").scrollWidth-root.querySelector("footer").clientWidth };
  });
  assert.equal(mobile.position, "absolute"); assert.ok(mobile.left >= -1 && mobile.right <= mobile.viewport + 1); assert.ok(mobile.overflow <= 1); assert.ok(mobile.mainWidth >= 380); assert.equal(mobile.contactsOpen,false); assert.equal(mobile.selected,"testing"); assert.equal(mobile.footerConversationSelector,false); assert.equal(mobile.identityBeforeAttachment,true); assert.ok(mobile.footerOverflow<=1);
  console.log(JSON.stringify({ desktop: result.initial, collapsed: result.collapsed, overlay: result.desktopOverlay, rgbSeparated: result.rgbSeparated, mobile, presets: result.presetChecks.length }, null, 2));
  console.log("Contacts sections, direct/group routing, presence, automatic home/away, desktop dock/overlay, mobile drawer, preset inheritance, editor, cleanup, and XSS tests passed.");
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
