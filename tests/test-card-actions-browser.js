const { chromium } = require("playwright");
const path = require("path");
const assert = require("assert");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 900, height: 844 }, hasTouch: false });
  await page.setContent("<!doctype html><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444;--error-color:#f44336}</style>");
  await page.addScriptTag({ path: path.resolve(process.argv[2]) });
  const initial = await page.evaluate(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const calls = [], services = [];window.__hassengerActionCalls=calls;window.__hassengerActionServices=services;window.__hassengerActionState={nativeDialogs:0};
    const thread = { id: "thread_1", title: "Person #1 and Person #2", participants: ["person_1", "person_2"], icon: "mdi:message", color: "#03a9f4", unread: 0 };
    const messages = [{ id: "message_1", thread_id: "thread_1", sender_id: "person_1", sender_name: "Person #1", text: "Original text", type: "text", created_at: "2026-08-30T12:00:00Z", read_by: ["person_1"], reactions: {} }];
    window.prompt = window.confirm = () => { window.__hassengerActionState.nativeDialogs += 1; throw new Error("Native dialog used"); };
    const hass = {
      user: { id: "person_1", name: "Person #1", is_admin: true }, states: {}, locale: { language: "en" },
      connection: { subscribeMessage: async () => () => {} },
      callService: async (domain, service, data) => { services.push({ domain, service, data }); if (domain === "hassenger" && service === "clear_thread") messages.splice(0); },
      callWS: async msg => {
        calls.push({ ...msg });
        if (msg.type === "hassenger/threads/list") return [thread];
        if (msg.type === "hassenger/diagnostics") return { integration_version: "2.1.7" };
        if (msg.type === "hassenger/messages/list") return messages;
        if (msg.type === "hassenger/messages/edit") { messages[0].text = msg.text; messages[0].edited_at = "2026-08-30T12:01:00Z"; return messages[0]; }
        if (msg.type === "hassenger/messages/delete") { messages[0].deleted = true; messages[0].text = ""; return {}; }
        return {};
      },
    };
    const card = document.createElement("ha-chat-card"); document.body.append(card);
    card.setConfig({ type: "custom:ha-chat-card", data_source: "hassenger", show_inbox: false, show_message_actions: true, show_clear: true, preserve_chat_height: true, chat_height: 360 });
    card.hass = hass; await sleep(60);

    const actionStyle=getComputedStyle(card.shadowRoot.querySelector(".msg-actions"));
    return { idleOpacity:actionStyle.opacity, idleVisibility:actionStyle.visibility, idlePointerEvents:actionStyle.pointerEvents };
  });
  const message=page.locator("ha-chat-card").locator(".msg").first();await message.hover();await page.waitForTimeout(180);
  const hovered=await page.locator("ha-chat-card").evaluate(card=>{const style=getComputedStyle(card.shadowRoot.querySelector(".msg-actions"));return{opacity:style.opacity,visibility:style.visibility,pointerEvents:style.pointerEvents};});
  await page.locator("body").hover({position:{x:1,y:1}});await page.waitForTimeout(180);
  const unhovered=await page.locator("ha-chat-card").evaluate(card=>getComputedStyle(card.shadowRoot.querySelector(".msg-actions")).opacity);
  await page.locator("ha-chat-card").evaluate(card=>card.shadowRoot.querySelector('[data-message-actions-id]').focus());await page.waitForTimeout(180);
  const focused=await page.locator("ha-chat-card").evaluate(card=>{const style=getComputedStyle(card.shadowRoot.querySelector(".msg-actions"));return{opacity:style.opacity,visibility:style.visibility,pointerEvents:style.pointerEvents};});
  const result = await page.evaluate(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const card=document.querySelector("ha-chat-card"),calls=window.__hassengerActionCalls||[],services=window.__hassengerActionServices||[];
    card.shadowRoot.querySelector('[data-msg-action="edit"]').click(); await sleep(5);
    const editDialog = card.shadowRoot.querySelector(".action-dialog"), editField = editDialog.querySelector("[data-action-dialog-value]"); editField.value = "Edited text"; editField.dispatchEvent(new Event("input", { bubbles: true })); editDialog.querySelector("[data-action-dialog-confirm]").click(); await sleep(50);
    const edited = calls.some(call => call.type === "hassenger/messages/edit" && call.message_id === "message_1" && call.text === "Edited text");

    card.shadowRoot.querySelector('[data-msg-action="delete"]').click(); await sleep(5);
    const deleteDialog = card.shadowRoot.querySelector(".action-dialog"), deleteText = deleteDialog?.textContent || ""; deleteDialog.querySelector("[data-action-dialog-confirm]").click(); await sleep(50);
    const deleted = calls.some(call => call.type === "hassenger/messages/delete" && call.message_id === "message_1");

    card.shadowRoot.querySelector('.thread-menu summary').click();
    card.shadowRoot.querySelector('[data-thread-action="clear"]').click(); await sleep(5);
    const clearDialog = card.shadowRoot.querySelector(".action-dialog"), clearText = clearDialog?.textContent || ""; clearDialog.querySelector("[data-action-dialog-confirm]").click(); await sleep(50);
    const cleared = services.some(call => call.domain === "hassenger" && call.service === "clear_thread" && call.data.thread_id === "thread_1");
    return { edited, deleted, cleared, deleteText, clearText, nativeDialogs:window.__hassengerActionState?.nativeDialogs||0, dialogRemaining: !!card.shadowRoot.querySelector(".action-dialog") };
  });
  result.desktopReveal={initial,hovered,unhovered,focused};
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.edited, true); assert.equal(result.deleted, true); assert.equal(result.cleared, true);
  assert.match(result.deleteText, /Delete message/); assert.match(result.clearText, /Clear conversation history/);
  assert.equal(result.nativeDialogs, 0); assert.equal(result.dialogRemaining, false);
  assert.deepEqual(result.desktopReveal.initial,{idleOpacity:"0",idleVisibility:"hidden",idlePointerEvents:"none"});assert.deepEqual(result.desktopReveal.hovered,{opacity:"1",visibility:"visible",pointerEvents:"auto"});assert.equal(result.desktopReveal.unhovered,"0");assert.deepEqual(result.desktopReveal.focused,{opacity:"1",visibility:"visible",pointerEvents:"auto"});
  console.log("Custom edit/delete/clear dialogs and backend calls passed without native browser prompts.");
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
