const { chromium } = require("playwright");
const path = require("path");
const assert = require("assert");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.setContent("<!doctype html><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444}</style>");
  await page.addScriptTag({ path: path.resolve(process.argv[2]) });
  const result = await page.evaluate(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const all = Array.from({ length: 450 }, (_, index) => ({
      id: `message_${index + 1}`, thread_id: "thread_1", sender_id: index % 2 ? "person_1" : "person_2",
      sender_name: index % 2 ? "Person #1" : "Person #2", text: `History message ${index + 1}`, type: "text",
      created_at: new Date(Date.UTC(2026, 7, 1, 0, index)).toISOString(), read_by: ["person_1", "person_2"], reactions: {},
    }));
    const calls = [];
    const thread = { id: "thread_1", title: "Person #1 and Person #2", participants: ["person_1", "person_2"], icon: "mdi:message", color: "#03a9f4", unread: 0 };
    const hass = {
      user: { id: "person_1", name: "Person #1", is_admin: true }, states: {}, locale: { language: "en" },
      connection: { subscribeMessage: async () => () => {} },
      callWS: async msg => {
        calls.push({ ...msg });
        if (msg.type === "hassenger/threads/list") return [thread];
        if (msg.type === "hassenger/diagnostics") return { integration_version: "2.1.7" };
        if (msg.type === "hassenger/messages/list") {
          const eligible = msg.before ? all.filter(item => item.created_at < msg.before) : all;
          return eligible.slice(-msg.limit);
        }
        return {};
      },
    };
    const card = document.createElement("hassenger-card"); document.body.append(card);
    card.setConfig({ type: "custom:hassenger-card", data_source: "hassenger", title: "Hassenger", height_mode: "fixed", height: 640, show_inbox: false, preserve_chat_height: true, chat_height: 430, history_days: 0 });
    card.hass = hass; await sleep(80);
    const initial = { count: card._backendMessages.length, first: card._backendMessages[0]?.id, last: card._backendMessages.at(-1)?.id, button: !!card.shadowRoot.querySelector("[data-load-older]") };
    const sc = card.shadowRoot.querySelector(".messages"); sc.scrollTop = 30; const firstHeight = sc.scrollHeight, firstTop = sc.scrollTop;
    card.shadowRoot.querySelector("[data-load-older]").click(); await sleep(80);
    const nextSc=card.shadowRoot.querySelector(".messages"),heightGrowth=nextSc.scrollHeight-firstHeight;
    const afterOne = { count: card._backendMessages.length, first: card._backendMessages[0]?.id, last: card._backendMessages.at(-1)?.id, button: !!card.shadowRoot.querySelector("[data-load-older]"), top: nextSc.scrollTop, oldTop: firstTop, heightGrowth };
    card.shadowRoot.querySelector("[data-load-older]").click(); await sleep(80);
    const afterTwo = { count: card._backendMessages.length, first: card._backendMessages[0]?.id, last: card._backendMessages.at(-1)?.id, button: !!card.shadowRoot.querySelector("[data-load-older]") };
    return { initial, afterOne, afterTwo, limits: calls.filter(call => call.type === "hassenger/messages/list").map(call => ({ limit: call.limit, before: !!call.before })) };
  });
  assert.deepEqual(result.initial, { count: 200, first: "message_251", last: "message_450", button: true });
  assert.equal(result.afterOne.count, 400); assert.equal(result.afterOne.first, "message_51"); assert.equal(result.afterOne.last, "message_450"); assert.equal(result.afterOne.button, true);
  assert.ok(result.afterOne.top >= result.afterOne.oldTop + result.afterOne.heightGrowth - 2, `scroll position was not preserved: ${JSON.stringify(result.afterOne)}`);
  assert.deepEqual(result.afterTwo, { count: 450, first: "message_1", last: "message_450", button: false });
  assert.deepEqual(result.limits.slice(0, 3), [{ limit: 201, before: false }, { limit: 201, before: true }, { limit: 201, before: true }]);
  console.log(JSON.stringify(result, null, 2));
  console.log("Older-message pagination, deduplication, completion, and scroll preservation passed.");
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
