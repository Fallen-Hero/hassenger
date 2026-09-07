const { chromium } = require(process.env.HASSENGER_PLAYWRIGHT_PATH || "playwright");
const path = require("path");
const assert = require("assert");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 420, height: 760 }, hasTouch: true });
  await page.setContent("<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><style>:root{--primary-color:#03a9f4;--card-background-color:#171717;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444;--error-color:#f44336}html,body{margin:0;width:100%;overflow-x:hidden}</style>");
  await page.addScriptTag({ path: path.resolve(process.argv[2]) });
  const result = await page.evaluate(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const presets = ["home_assistant", "modern_chat", "minimal", "terminal", "industrial", "retro_messenger", "midnight", "oled", "rgb", "glass", "paper", "playful", "high_contrast", "custom"];
    const thread = { id: "thread_brand", title: "Person #1 and Person #2", participants: ["person_1", "person_2"], icon: "mdi:message", color: "#03a9f4", unread: 0, muted: false, archived: false };
    const hass = { states: {}, locale: { language: "en" }, user: { id: "person_1", name: "Person #1", is_admin: true }, connection: { subscribeMessage: async () => () => {} }, callService: async () => {}, callWS: async msg => msg.type === "hassenger/diagnostics" ? { integration_version: "2.2.0" } : msg.type === "hassenger/threads/list" ? [thread] : msg.type === "hassenger/messages/list" ? [] : msg.type === "hassenger/users/list" ? [{ id: "person_1", name: "Person #1", is_admin: true }, { id: "person_2", name: "Person #2", is_admin: false }] : {} };
    const base = { type: "custom:hassenger-card", data_source: "hassenger", show_header: true, show_inbox: false, show_search: true, show_clear: true, height_mode: "fixed", height: 420 };
    const card = document.createElement("hassenger-card"); document.body.append(card);
    const apply = async config => { card.setConfig(config); card.hass = hass; await sleep(35); };
    const inspect = () => {
      const surface = card.shadowRoot.querySelector("ha-card"), header = card.shadowRoot.querySelector("header");
      const mark = header?.querySelector(".header-logo"), wordmark = header?.querySelector(".header-wordmark"), logo = mark || wordmark;
      const primary = logo?.querySelector(".brand-primary-fill"), secondary = logo?.querySelector(".brand-secondary-fill"), dots = logo?.querySelector(".brand-dot-fill");
      const wordText = wordmark?.querySelector(".brand-wordmark-text"), wordAccent = wordmark?.querySelector(".brand-wordmark-accent"), rect = logo?.getBoundingClientRect();
      const wordTextRect = wordText?.getBoundingClientRect(), wordAccentRect = wordAccent?.getBoundingClientRect();
      const dotRows = logo ? [...logo.querySelectorAll(".brand-dot-fill circle")].map(dot => Number(dot.getAttribute("cy"))) : [];
      return {
        logo: mark ? "mark" : wordmark ? "wordmark" : "none", icon: !!header?.querySelector(".header-icon"), title: header?.querySelector("h2")?.textContent || "",
        size: rect ? [Math.round(rect.width), Math.round(rect.height)] : null,
        colors: logo ? [getComputedStyle(primary).fill, getComputedStyle(secondary).fill, getComputedStyle(dots).fill] : [],
        wordColors: wordmark ? [getComputedStyle(wordText).fill, getComputedStyle(wordAccent).fill] : [], wordJoinGap: wordmark ? wordAccentRect.left - wordTextRect.right : null, headerColor: header ? getComputedStyle(header).color : "",
        dotRows, filter: logo ? getComputedStyle(logo).filter : "", overflow: surface.scrollWidth - surface.clientWidth,
        headerOverflow: header ? header.scrollWidth - header.clientWidth : 0, toolCount: header?.querySelectorAll(".icon-btn").length || 0
      };
    };

    await apply(base);
    const defaults = inspect();
    await apply({ ...base, header_logo_style: "mark", show_header_icon: true, header_logo_primary_color: "#12ab34", header_logo_secondary_color: "#6543ab", header_logo_dot_color: "#fedcba", header_logo_size: 40 });
    const compactMark = inspect();
    await apply({ ...base, title: "Household", show_header_title: true, header_wordmark_text_color: "#fefefe", header_wordmark_accent_color: "#ab45ef", header_logo_size: 36 });
    const wordmarkWithTitle = inspect();
    await apply({ ...base, preset: "rgb", header_logo_primary_color: "red;display:none", header_wordmark_text_color: "red;display:none" });
    const rgbSanitized = inspect();
    await apply({ ...base, show_header_logo: false, show_header_icon: false, show_header_title: true, title: "Custom messenger" });
    const titleOnly = inspect();
    await apply({ ...base, show_header_logo: true, show_header_title: false, title: "Hidden title" });
    const logoOnly = inspect();

    const presetResults = [];
    for (const preset of presets) {
      await apply({ ...base, preset, title: "", header_logo_style: "wordmark", header_wordmark_text_color: "", header_wordmark_accent_color: "" });
      presetResults.push({ preset, ...inspect() });
    }
    const widthResults = [];
    for (const width of [240, 280, 360]) {
      document.body.style.width = `${width}px`;
      await apply({ ...base, preset: "home_assistant", title: "", header_logo_style: "wordmark" });
      widthResults.push({ width, ...inspect() });
    }
    document.body.style.width = "420px";

    const editor = document.createElement("hassenger-card-editor"); document.body.append(editor); editor.hass = hass; editor.setConfig(base); await sleep(35);
    const basics = editor.shadowRoot.querySelector('[data-editor-section="basics"]'); if (!basics.open) { basics.open = true; basics.dispatchEvent(new Event("toggle")); await sleep(20); }
    const paths = [...editor.shadowRoot.querySelectorAll("[data-path]")].map(element => element.dataset.path);
    const titleInput = editor.shadowRoot.querySelector('[data-path="title"]');
    const logoStyleOptions = [...editor.shadowRoot.querySelector('[data-path="header_logo_style"]').options].map(option => option.textContent);
    const previewWordmark = editor.shadowRoot.querySelector(".brand-preview-wordmark")?.getBoundingClientRect();
    return { version: window.HassengerCardUtils.VERSION, defaults, compactMark, wordmarkWithTitle, rgbSanitized, titleOnly, logoOnly, presetResults, widthResults, editor: { paths, titleValue: titleInput?.value, logoStyleOptions, previewSize: previewWordmark ? [Math.round(previewWordmark.width), Math.round(previewWordmark.height)] : null, overflow: editor.scrollWidth - editor.clientWidth } };
  });

  if (process.argv[3]) {
    await page.screenshot({ path: `${process.argv[3]}-wordmark.png`, fullPage: true });
    await page.evaluate(() => { const card = document.querySelector("hassenger-card"); card.setConfig({ ...card._config, header_logo_style: "mark", show_header_icon: false, title: "" }); });
    await page.waitForTimeout(40);
    await page.screenshot({ path: `${process.argv[3]}-mark.png`, fullPage: true });
  }

  assert.equal(result.version, require("../package.json").version);
  assert.equal(result.defaults.logo, "wordmark"); assert.equal(result.defaults.title, ""); assert.equal(result.defaults.icon, false); assert.deepEqual(result.defaults.dotRows, [267, 267, 267, 334, 334, 334]); assert.ok(result.defaults.size[0] > result.defaults.size[1] * 3); assert.ok(result.defaults.overflow <= 1);
  assert.equal(result.defaults.wordColors[0], result.defaults.headerColor, "default wordmark text does not inherit the preset/header text color");
  assert.ok(result.defaults.wordJoinGap >= -0.25, `default logo letters overlap by ${-result.defaults.wordJoinGap}px`);
  assert.deepEqual({ logo: result.compactMark.logo, icon: result.compactMark.icon, title: result.compactMark.title, size: result.compactMark.size, colors: result.compactMark.colors, dotRows: result.compactMark.dotRows }, { logo: "mark", icon: true, title: "", size: [40, 40], colors: ["rgb(18, 171, 52)", "rgb(101, 67, 171)", "rgb(254, 220, 186)"], dotRows: [267, 267, 267, 334, 334, 334] });
  assert.equal(result.wordmarkWithTitle.logo, "wordmark"); assert.equal(result.wordmarkWithTitle.title, "Household"); assert.deepEqual(result.wordmarkWithTitle.wordColors, ["rgb(254, 254, 254)", "rgb(171, 69, 239)"]); assert.ok(result.wordmarkWithTitle.wordJoinGap >= -0.25); assert.ok(result.wordmarkWithTitle.overflow <= 1);
  assert.equal(result.rgbSanitized.colors[0], "rgb(0, 229, 240)", "unsafe logo color was not reset"); assert.equal(result.rgbSanitized.wordColors[0], result.rgbSanitized.headerColor, "unsafe wordmark text color was not reset"); assert.notEqual(result.rgbSanitized.filter, "none", "RGB Neon wordmark glow is missing");
  assert.deepEqual({ logo: result.titleOnly.logo, title: result.titleOnly.title }, { logo: "none", title: "Custom messenger" });
  assert.deepEqual({ logo: result.logoOnly.logo, title: result.logoOnly.title }, { logo: "wordmark", title: "" });
  for (const preset of result.presetResults) {
    assert.equal(preset.logo, "wordmark", `${preset.preset} did not render the wordmark`);
    assert.equal(preset.wordColors[0], preset.headerColor, `${preset.preset} wordmark text did not inherit its header color`);
    assert.ok(preset.wordJoinGap >= -0.25, `${preset.preset} logo letters overlap by ${-preset.wordJoinGap}px`);
    assert.ok(!["rgba(0, 0, 0, 0)", "transparent", "none"].includes(preset.wordColors[1]), `${preset.preset} accent is invisible`);
    assert.ok(preset.overflow <= 1 && preset.headerOverflow <= 1, `${preset.preset} header overflowed`);
  }
  for (const width of result.widthResults) {
    assert.equal(width.toolCount, 3, `${width.width}px header lost a tool button`);
    assert.ok(width.wordJoinGap >= 0, `${width.width}px logo letters overlap by ${-width.wordJoinGap}px`);
    assert.ok(width.overflow <= 1 && width.headerOverflow <= 1, `${width.width}px wordmark header overflowed`);
  }
  for (const pathName of ["title", "show_header_logo", "header_logo_style", "show_header_icon", "show_header_title", "header_logo_primary_color", "header_logo_secondary_color", "header_logo_dot_color", "header_wordmark_text_color", "header_wordmark_accent_color", "header_logo_size"]) assert.ok(result.editor.paths.includes(pathName), `missing editor field ${pathName}`);
  assert.equal(result.editor.titleValue, ""); assert.deepEqual(result.editor.logoStyleOptions, ["Full Hassenger logo", "Compact Hassenger logo"]); assert.ok(result.editor.previewSize[0] > result.editor.previewSize[1] * 3); assert.ok(result.editor.overflow <= 1, `editor overflowed by ${result.editor.overflow}px`);
  console.log(JSON.stringify(result, null, 2));
  console.log("Full/compact logo modes, non-overlapping lettering, blank optional title, custom colors, sanitization, all presets, RGB glow, narrow/mobile layout, and editor controls passed.");
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
