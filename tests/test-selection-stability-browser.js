const { chromium } = require("playwright");
const path = require("path");
const assert = require("assert");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 430, height: 780 } });
  await page.setContent("<!doctype html><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444}</style>");
  await page.addScriptTag({ path: path.resolve(process.argv[2]) });
  const result = await page.evaluate(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const a = { id: "thread_a", title: "Conversation A", participants: ["person_1"], icon: "mdi:message", color: "#03a9f4", unread: 0 };
    const b = { id: "thread_b", title: "Conversation B", participants: ["person_1"], icon: "mdi:message", color: "#ff9800", unread: 0 };
    let threads = [a, b], subscriber, listCalls = 0, delayLists = false;
    const hass = {
      user: { id: "person_1", name: "Person #1", is_admin: true }, states: {}, locale: { language: "en" },
      connection: { subscribeMessage: async callback => { subscriber = callback; return () => {}; } },
      callWS: async msg => {
        if (msg.type === "hassenger/threads/list") { listCalls += 1; if (delayLists) await sleep(30); return threads; }
        if (msg.type === "hassenger/diagnostics") return { integration_version: "2.1.7" };
        if (msg.type === "hassenger/messages/list") return [{ id: `message_${msg.thread_id}`, thread_id: msg.thread_id, sender_id: "person_1", sender_name: "Person #1", text: `Transcript for ${msg.thread_id}`, type: "text", created_at: "2026-08-30T12:00:00Z", read_by: ["person_1"], reactions: {} }];
        return {};
      },
    };
    const card = document.createElement("hassenger-card"); document.body.append(card); card.setConfig({ type: "custom:hassenger-card", data_source: "hassenger", show_inbox: true, inbox_style: "dropdown", preserve_chat_height: true, chat_height: 320 }); card.hass = hass; await sleep(60);
    const selector = card.shadowRoot.querySelector("[data-thread-select]"); selector.value = "1"; selector.dispatchEvent(new Event("change", { bubbles: true })); await sleep(40);
    const before = { id: card._availablePeople()[card._selected].thread_id, text: card._backendMessages[0]?.text };
    threads = [b, a]; delayLists = true; subscriber({}); await sleep(5); subscriber({}); await sleep(130);
    const active = card._availablePeople()[card._selected];
    return { before, after: { id: active.thread_id, index: card._selected, text: card._backendMessages[0]?.text, selector: card.shadowRoot.querySelector("[data-thread-select]")?.value }, listCalls };
  });
  assert.deepEqual(result.before, { id: "thread_b", text: "Transcript for thread_b" });
  assert.deepEqual(result.after, { id: "thread_b", index: 0, text: "Transcript for thread_b", selector: "0" });
  assert.equal(result.listCalls, 3, "a refresh event that arrived mid-refresh was dropped");
  console.log(JSON.stringify(result, null, 2));
  console.log("Stable conversation-ID selection and queued refresh handling passed.");
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
