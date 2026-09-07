const { chromium } = require("playwright");
const path = require("path");
const assert = require("assert");

const cases = [
  { name: "iPhone SE portrait", width: 320, height: 568, scale: 100 },
  { name: "iPhone modern portrait", width: 393, height: 852, scale: 100 },
  { name: "iPhone landscape", width: 852, height: 393, scale: 100 },
  { name: "Pixel portrait enlarged", width: 412, height: 915, scale: 150 },
  { name: "Android narrow enlarged", width: 360, height: 740, scale: 150 },
  { name: "Tablet portrait", width: 768, height: 1024, scale: 100 },
  { name: "Tablet landscape", width: 1024, height: 768, scale: 100 },
];

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const results = [];
  for (const testCase of cases) {
    const context = await browser.newContext({ viewport: { width: testCase.width, height: testCase.height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.setContent("<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><style>:root{--primary-color:#03a9f4;--card-background-color:#1c1c1c;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444;--error-color:#f44336}html,body{margin:0;width:100%;overflow-x:hidden}</style>");
    await page.addScriptTag({ path: path.resolve(process.argv[2]) });
    const metrics = await page.evaluate(async ({ scale }) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const calls = [];
      const liveThreads = [
        { id: "thread_1", title: "Person #1 and Person #2", participants: ["person_1", "person_2"], icon: "mdi:message", color: "#03a9f4", unread: 2, muted: false, archived: false, last_message: { text: "A recent message", created_at: "2026-08-30T02:00:00Z" } },
        { id: "thread_2", title: "A very long household conversation title", participants: ["person_1", "person_3"], icon: "mdi:home", color: "#ff9800", unread: 0, muted: false, archived: false, last_message: { text: "Another preview", created_at: "2026-08-30T01:00:00Z" } },
      ];
      const archived = { id: "thread_old", title: "Archived household conversation", participants: ["person_1", "person_2"], icon: "mdi:archive", color: "#9c27b0", unread: 0, muted: false, archived: true, last_message: { text: "Older message", created_at: "2026-08-29T01:00:00Z" } };
      const longReactionText="This is an intentionally long reacted message that must wrap normally without allowing its reaction rail to overlap the text, enlarge the bubble, or escape the card at narrow mobile widths.";
      const messages = Array.from({ length: 24 }, (_, index) => ({ id: `m${index}`, thread_id: "thread_1", sender_id: index % 2 ? "person_1" : "person_2", sender_name: index % 2 ? "Person #1" : "Person #2", text: index === 18 ? longReactionText : index >= 20 ? "test" : `Mobile message ${index + 1}`, type: "text", created_at: new Date(Date.now() - (24 - index) * 60000).toISOString(), read_by: ["person_1", "person_2"], reactions: index === 18 ? { "🔥": ["person_2"] } : index >= 22 ? { [index === 22 ? "👍" : "😂"]: ["person_2"] } : {} }));
      const hass = {
        states: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`sensor.mobile_${index}`, { state: String(index), attributes: { friendly_name: `Mobile status ${index}`, icon: "mdi:information-outline" } }])),
        locale: { language: "en-US" },
        user: { id: "person_1", name: "Person #1", is_admin: true },
        connection: { subscribeMessage: async () => () => {} },
        callService: async (...args) => calls.push({ service: args }),
        callWS: async (msg) => {
          calls.push(msg);
          if (msg.type === "hassenger/diagnostics") return { integration_version: "2.1.7" };
          if (msg.type === "hassenger/threads/list") return msg.include_archived ? [...liveThreads, archived] : liveThreads;
          if (msg.type === "hassenger/messages/list") return messages;
          if (msg.type === "hassenger/users/list") return [{ id: "person_1", name: "Person #1", is_admin: true }, { id: "person_2", name: "Person #2", is_admin: false }];
          if (msg.type === "hassenger/messages/send") return { id: "sent", created_at: new Date().toISOString(), ...msg };
          return null;
        },
      };
      const config = {
        type: "custom:hassenger-card", data_source: "hassenger", title: "Hassenger mobile validation", preset: "rgb", card_scale: scale,
        fit_to_screen: true, width_mode: "fit", height_mode: "fixed", height: 600, show_header: true, show_inbox: true, inbox_style: "dropdown",
        show_search: true, show_clear: true, show_composer_media: true, show_voice_input: true, show_message_actions: true,
        header_info_style: "chips", header_entities: Array.from({ length: 8 }, (_, index) => ({ entity: `sensor.mobile_${index}`, name: `Status ${index}`, icon: "mdi:information-outline", show_icon: true, show_name: true, show_state: true })),
        quick_message_layout:"dropdowns",quick_messages: Array.from({ length: 12 }, (_, index) => ({ label: `Quick ${index + 1}`, message: `Complete quick message ${index + 1}`, group: index < 6 ? "People" : "Home", icon: "mdi:message-fast" })),
      };
      const card = document.createElement("hassenger-card"); document.body.append(card); card.setConfig(config); card.hass = hass; await sleep(40);
      const dispatchTouch=(target,type,x=24,y=24)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,pointerType:"touch",pointerId:7,isPrimary:true,clientX:x,clientY:y}));
      let actionRows=[...card.shadowRoot.querySelectorAll("[data-message-actions-id]")],firstActionRow=actionRows[0],secondActionRow=actionRows[1];
      const initialActionRows=actionRows.map(row=>({display:getComputedStyle(row.querySelector(".msg-actions")).display,height:row.querySelector(".msg-actions").getBoundingClientRect().height,expanded:row.getAttribute("aria-expanded")}));
      dispatchTouch(firstActionRow,"pointerdown");dispatchTouch(firstActionRow,"pointerup");await sleep(0);const tapOpened=firstActionRow.classList.contains("actions-open")&&getComputedStyle(firstActionRow.querySelector(".msg-actions")).display!=="none";
      dispatchTouch(firstActionRow,"pointerdown");dispatchTouch(firstActionRow,"pointerup");await sleep(0);const repeatedTapStayedOpen=firstActionRow.classList.contains("actions-open");
      dispatchTouch(secondActionRow,"pointerdown");dispatchTouch(secondActionRow,"pointerup");await sleep(0);const switchedTray=!firstActionRow.classList.contains("actions-open")&&secondActionRow.classList.contains("actions-open");
      dispatchTouch(card.shadowRoot.querySelector("header"),"pointerdown");dispatchTouch(card.shadowRoot.querySelector("header"),"pointerup");await sleep(0);const outsideDismissed=!actionRows.some(row=>row.classList.contains("actions-open"));
      dispatchTouch(firstActionRow,"pointerdown");await sleep(525);const longPressOpened=firstActionRow.classList.contains("actions-open");dispatchTouch(firstActionRow,"pointerup");dispatchTouch(card.shadowRoot.querySelector("header"),"pointerdown");dispatchTouch(card.shadowRoot.querySelector("header"),"pointerup");
      dispatchTouch(firstActionRow,"pointerdown",20,20);dispatchTouch(firstActionRow,"pointermove",40,20);dispatchTouch(firstActionRow,"pointerup",40,20);await sleep(0);const dragDidNotOpen=!firstActionRow.classList.contains("actions-open");
      dispatchTouch(firstActionRow,"pointerdown");dispatchTouch(firstActionRow,"pointerup");const defaultActionWidth=firstActionRow.querySelector(".msg-actions button").getBoundingClientRect().width;dispatchTouch(card.shadowRoot.querySelector("header"),"pointerdown");
      card.setConfig({...config,message_action_size:22,large_mobile_message_actions:false});await sleep(20);actionRows=[...card.shadowRoot.querySelectorAll("[data-message-actions-id]")];firstActionRow=actionRows[0];dispatchTouch(firstActionRow,"pointerdown");dispatchTouch(firstActionRow,"pointerup");const compactActionWidth=firstActionRow.querySelector(".msg-actions button").getBoundingClientRect().width;dispatchTouch(card.shadowRoot.querySelector("header"),"pointerdown");
      card.setConfig(config);await sleep(20);
      const messageActionBehavior={initialActionRows,tapOpened,repeatedTapStayedOpen,switchedTray,outsideDismissed,longPressOpened,dragDidNotOpen};
      const surface = card.shadowRoot.querySelector("ha-card"), surfaceRect = surface.getBoundingClientRect();
      const initial = { overflow: surface.scrollWidth - surface.clientWidth, left: surfaceRect.left, right: surfaceRect.right, viewport: innerWidth, messagesHeight: card.shadowRoot.querySelector(".messages").getBoundingClientRect().height };
      const defaultReactionPlacement = card._config.reaction_placement;
      const belowTimePlacements=["m22","m23"].map(id=>{const bubble=card.shadowRoot.querySelector(`[data-scroll-id="${id}"]`),body=bubble.querySelector(".body"),timing=bubble.querySelector(".message-timing"),reaction=bubble.querySelector(".below-time-reactions .reactions"),bodyRect=body.getBoundingClientRect(),timingRect=timing.getBoundingClientRect(),reactionRect=reaction.getBoundingClientRect(),side=bubble.classList.contains("left")?"left":"right";return{side,belowTime:reactionRect.top>=timingRect.bottom,outerEdgeGap:side==="left"?Math.abs(reactionRect.left-timingRect.left):Math.abs(reactionRect.right-timingRect.right),outsideBubble:reactionRect.top>=bodyRect.bottom,insideCard:reactionRect.left>=surfaceRect.left-1&&reactionRect.right<=surfaceRect.right+1,bodyWidth:bodyRect.width};});
      const belowTimeLong=card.shadowRoot.querySelector('[data-scroll-id="m18"]'),belowTimeLongBody=belowTimeLong.querySelector(".body").getBoundingClientRect(),belowTimeLongRail=belowTimeLong.querySelector(".below-time-reactions").getBoundingClientRect();
      const belowTimePlacement={placements:belowTimePlacements,longInside:belowTimeLongRail.right<=surfaceRect.right+1,longWrapped:belowTimeLongBody.height>50*scale/100,noHorizontalScroll:card.shadowRoot.querySelector(".messages").scrollWidth<=card.shadowRoot.querySelector(".messages").clientWidth+1};

      card.setConfig({...config,reaction_placement:"side"});await sleep(20);
      const reactionPlacements=[...card.shadowRoot.querySelectorAll(".bubble-reaction-dock")].map(dock=>{const bubble=dock.closest(".bubble"),body=bubble.querySelector(".body"),reactions=dock.querySelector(".reactions"),timing=bubble.querySelector(".message-timing"),bodyRect=body.getBoundingClientRect(),reactionRect=reactions.getBoundingClientRect(),timingRect=timing.getBoundingClientRect(),bodyStyle=getComputedStyle(body),side=bubble.classList.contains("left")?"left":"right";return{side,outsideTowardCenter:side==="left"?reactionRect.left>=bodyRect.right:reactionRect.right<=bodyRect.left,innerGap:side==="left"?reactionRect.left-bodyRect.right:bodyRect.left-reactionRect.right,firstLineOffset:reactionRect.top-bodyRect.top,timestampEdgeGap:side==="left"?Math.abs(timingRect.left-bodyRect.left):Math.abs(timingRect.right-bodyRect.right),withinTranscript:reactionRect.left>=surfaceRect.left-1&&reactionRect.right<=surfaceRect.right+1,paddingTop:parseFloat(bodyStyle.paddingTop),paddingBottom:parseFloat(bodyStyle.paddingBottom)};});
      const reactionWidthStability=[{side:"left",plain:"m20",reacted:"m22"},{side:"right",plain:"m21",reacted:"m23"}].map(({side,plain,reacted})=>{const plainBody=card.shadowRoot.querySelector(`[data-scroll-id="${plain}"] .body`),reactedBody=card.shadowRoot.querySelector(`[data-scroll-id="${reacted}"] .body`);return{side,plain:plainBody.getBoundingClientRect().width,reacted:reactedBody.getBoundingClientRect().width};});
      const longReactionBubble=card.shadowRoot.querySelector('[data-scroll-id="m18"]'),longReactionBody=longReactionBubble.querySelector(".body"),longReactionDock=longReactionBubble.querySelector(".bubble-reaction-dock"),messagesScroller=card.shadowRoot.querySelector(".messages"),longBodyRect=longReactionBody.getBoundingClientRect(),longDockRect=longReactionDock.getBoundingClientRect();const longReaction={bodyHeight:longBodyRect.height,railWidth:longDockRect.width,insideCard:longBodyRect.left>=surfaceRect.left-1&&longDockRect.right<=surfaceRect.right+1,noHorizontalScroll:messagesScroller.scrollWidth<=messagesScroller.clientWidth+1};

      card.setConfig({...config,reaction_placement:"below_time",timestamp_format:"none",show_read_receipts:false});await sleep(20);const noTimestampPlacement=["m22","m23"].map(id=>{const bubble=card.shadowRoot.querySelector(`[data-scroll-id="${id}"]`),bodyRect=bubble.querySelector(".body").getBoundingClientRect(),reactionRect=bubble.querySelector(".below-time-reactions .reactions").getBoundingClientRect();return{timingAbsent:!bubble.querySelector(".message-timing"),gap:reactionRect.top-bodyRect.bottom,insideCard:reactionRect.left>=surfaceRect.left-1&&reactionRect.right<=surfaceRect.right+1};});card.setConfig(config);await sleep(20);
      const senderGeometry=["left","right"].map(side=>{const bubble=card.shadowRoot.querySelector(`.bubble.${side}.named`),sender=bubble.querySelector(".sender"),avatar=bubble.querySelector(".avatar,.avatar-icon"),body=bubble.querySelector(".body"),senderRect=sender.getBoundingClientRect(),avatarRect=avatar.getBoundingClientRect(),bodyRect=body.getBoundingClientRect(),avatarStyle=getComputedStyle(avatar);return{side,nameBubbleEdgeGap:side==="left"?Math.abs(senderRect.left-bodyRect.left):Math.abs(senderRect.right-bodyRect.right),nameBubbleVerticalGap:bodyRect.top-senderRect.bottom,avatarBubbleTopDelta:avatarRect.top-bodyRect.top,avatarWidth:avatarRect.width,avatarHeight:avatarRect.height,avatarRadius:avatarStyle.borderRadius,avatarBorderStyle:avatarStyle.borderStyle,avatarIcon:avatar.getAttribute("icon")||"image"};});
      const quick = card.shadowRoot.querySelector(".quick-area"), quickMessage=card.shadowRoot.querySelector("[data-quick-message]"), info = card.shadowRoot.querySelector(".info-scroll"), quickMetrics={client:quick.clientWidth,scroll:quick.scrollWidth,options:quickMessage.options.length}, quickContained = quick.scrollWidth <= quick.clientWidth+1, infoScrollable = info.scrollWidth > info.clientWidth;

      card.shadowRoot.querySelector('[data-action="archived"]').click(); await sleep(10);
      const archiveBox = card.shadowRoot.querySelector(".archive-dialog .thread-dialog-box"), archiveRect = archiveBox.getBoundingClientRect();
      const archive = { visible: !!archiveBox, left: archiveRect.left, right: archiveRect.right, top: archiveRect.top, bottom: archiveRect.bottom, restoreVisible: !!card.shadowRoot.querySelector('[data-restore-thread="thread_old"]') };
      card.shadowRoot.querySelector('[data-restore-thread="thread_old"]').click(); await sleep(10);
      archive.restoreCalled = calls.some((call) => call.type === "hassenger/thread/flag" && call.thread_id === "thread_old" && call.enabled === false);
      card.shadowRoot.querySelector("[data-archive-close]").click(); await sleep(5);

      let attachmentMenu=card.shadowRoot.querySelector(".attachment-menu"),attachmentSummary=attachmentMenu.querySelector("summary");attachmentSummary.click();await sleep(5);
      let media=card.shadowRoot.querySelector(".attachment-popover"),mediaRect=media.getBoundingClientRect(),mediaClose=media.querySelector("[data-close-attachment-menu]"),mediaCloseRect=mediaClose.getBoundingClientRect(),mediaPortal=card.shadowRoot.querySelector(".attachment-popover-portal"),portalStyle=getComputedStyle(mediaPortal),portalRect=mediaPortal.getBoundingClientRect();
      const mediaPanel={visible:!!media,left:mediaRect.left,right:mediaRect.right,top:mediaRect.top,bottom:mediaRect.bottom,width:mediaRect.width,closeWidth:mediaCloseRect.width,closeHeight:mediaCloseRect.height,legacyLayer:!!card.shadowRoot.querySelector(".attachment-viewport-layer"),portal:{left:portalRect.left,right:portalRect.right,top:portalRect.top,bottom:portalRect.bottom,width:portalRect.width,height:portalRect.height,backgroundColor:portalStyle.backgroundColor,backgroundImage:portalStyle.backgroundImage,borderWidth:portalStyle.borderTopWidth,boxShadow:portalStyle.boxShadow,animationName:portalStyle.animationName,pointerEvents:portalStyle.pointerEvents}};
      mediaClose.click();await sleep(0);mediaPanel.closedByX=!attachmentMenu.open&&card.shadowRoot.activeElement===attachmentSummary&&!card.shadowRoot.querySelector(".attachment-popover-portal");
      attachmentSummary.click();await sleep(0);mediaClose=card.shadowRoot.querySelector("[data-close-attachment-menu]");mediaClose.focus();mediaClose.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,composed:true}));await sleep(0);mediaPanel.closedByEscape=!attachmentMenu.open&&card.shadowRoot.activeElement===attachmentSummary;

      const threadMenu = card.shadowRoot.querySelector(".thread-menu summary"); threadMenu.click();
      card.shadowRoot.querySelector('[data-thread-action="archive"]').click(); await sleep(5);
      const confirm = card.shadowRoot.querySelector(".action-dialog .thread-dialog-box"), confirmRect = confirm.getBoundingClientRect();
      const customConfirm = { visible: !!confirm, nativeDialogs: typeof window.__nativeDialogUsed !== "undefined", left: confirmRect.left, right: confirmRect.right };
      card.shadowRoot.querySelector("[data-action-dialog-cancel]").click(); await sleep(5);

      const composer = card.shadowRoot.querySelector("textarea[data-composer]"), key = composer.dataset.focusKey;
      composer.value = "Mobile send focus"; composer.dispatchEvent(new Event("input", { bubbles: true })); composer.focus();
      card.shadowRoot.querySelector("[data-send]").click(); await sleep(90);
      const focusedComposer = card.shadowRoot.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
      const focusRetained = card.shadowRoot.activeElement === focusedComposer;

      const visibleButtons = [...card.shadowRoot.querySelectorAll("button")].filter((button) => { const style = getComputedStyle(button), rect = button.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0; });
      const tinyTargets = visibleButtons.filter((button) => !button.matches(".reaction") && (()=>{const rect=button.getBoundingClientRect();return rect.width < 36 || rect.height < 36;})()).map((button) => ({ title: button.title, cls: button.className, width: Math.round(button.getBoundingClientRect().width), height: Math.round(button.getBoundingClientRect().height) })).slice(0, 12);

      const editor = document.createElement("hassenger-card-editor"); document.body.append(editor); editor.style.width = "100%"; editor.hass = hass; editor.setConfig(config); await sleep(20); for(const key of ["basics","header-info","persistent","message-actions","composer","appearance","typography","behavior","preview","debug"]){const details=editor.shadowRoot.querySelector(`[data-editor-section="${key}"]`);if(details&&!details.open){details.open=true;details.dispatchEvent(new Event("toggle"));await sleep(0);}}for (const details of editor.shadowRoot.querySelectorAll("details")) details.open = true; await sleep(0);
      const editorOverflow = editor.scrollWidth - editor.clientWidth;
      return { initial, defaultReactionPlacement, reactionPlacements, reactionWidthStability, longReaction, belowTimePlacement, noTimestampPlacement, senderGeometry, quickMetrics, quickContained, infoScrollable, archive, mediaPanel, customConfirm, focusRetained, tinyTargets, editorOverflow, actionSizing:{defaultActionWidth,compactActionWidth},messageActionBehavior };
    }, { scale: testCase.scale });
    results.push({ ...testCase, ...metrics });
    if(process.argv[3]&&testCase.name==="iPhone modern portrait")await page.locator("hassenger-card").screenshot({path:process.argv[3]});
    await context.close();
  }

  for (const result of results) {
    assert.ok(result.initial.overflow <= 1, `${result.name}: card overflowed by ${result.initial.overflow}px`);
    assert.ok(result.initial.left >= -1 && result.initial.right <= result.initial.viewport + 1, `${result.name}: card left viewport`);
    assert.ok(result.initial.messagesHeight >= 120, `${result.name}: transcript collapsed`);
    assert.equal(result.defaultReactionPlacement,"below_time",`${result.name}: under-timestamp reactions are not the default`);assert.deepEqual(result.reactionPlacements.map(item=>item.side),["left","left","right"],`${result.name}: explicit side-placement coverage changed`);const scaleFactor=result.scale/100;for(const placement of result.reactionPlacements){assert.equal(placement.outsideTowardCenter,true,`${result.name}: ${placement.side} reaction is not outside the bubble toward chat center ${JSON.stringify(placement)}`);assert.ok(placement.innerGap>=5*scaleFactor&&placement.innerGap<=9*scaleFactor,`${result.name}: ${placement.side} reaction rail gap is inconsistent ${JSON.stringify(placement)}`);assert.ok(placement.firstLineOffset>=5*scaleFactor&&placement.firstLineOffset<=9*scaleFactor,`${result.name}: ${placement.side} reaction is not aligned with the first text line ${JSON.stringify(placement)}`);assert.ok(placement.timestampEdgeGap<=1.5*scaleFactor,`${result.name}: ${placement.side} timestamp is not flush with its outer bubble edge ${JSON.stringify(placement)}`);assert.equal(placement.withinTranscript,true,`${result.name}: ${placement.side} reaction escaped the card ${JSON.stringify(placement)}`);assert.ok(Math.abs(placement.paddingBottom-placement.paddingTop)<=0.1,`${result.name}: reaction changed the text bubble padding ${JSON.stringify(placement)}`);}for(const widths of result.reactionWidthStability){assert.ok(Math.abs(widths.plain-widths.reacted)<=0.5,`${result.name}: ${widths.side} emoji elongated a short message bubble ${JSON.stringify(widths)}`);}assert.ok(result.longReaction.bodyHeight>50*scaleFactor,`${result.name}: long reacted message did not wrap ${JSON.stringify(result.longReaction)}`);assert.ok(result.longReaction.railWidth<=112*scaleFactor+1,`${result.name}: reaction rail exceeded its cap ${JSON.stringify(result.longReaction)}`);assert.equal(result.longReaction.insideCard&&result.longReaction.noHorizontalScroll,true,`${result.name}: long side-placement reaction overflowed ${JSON.stringify(result.longReaction)}`);
    assert.deepEqual(result.belowTimePlacement.placements.map(item=>item.side),["left","right"]);for(const placement of result.belowTimePlacement.placements){assert.equal(placement.belowTime&&placement.outsideBubble&&placement.insideCard,true,`${result.name}: under-timestamp reaction placement failed ${JSON.stringify(placement)}`);assert.ok(placement.outerEdgeGap<=1.5*scaleFactor,`${result.name}: under-timestamp reaction missed the outer edge ${JSON.stringify(placement)}`);}assert.equal(result.belowTimePlacement.longInside&&result.belowTimePlacement.longWrapped&&result.belowTimePlacement.noHorizontalScroll,true,`${result.name}: long under-timestamp reaction overflowed ${JSON.stringify(result.belowTimePlacement)}`);
    for(const placement of result.noTimestampPlacement){assert.equal(placement.timingAbsent&&placement.insideCard,true,`${result.name}: hidden timestamp left a timing element or overflow ${JSON.stringify(placement)}`);assert.ok(placement.gap>=2*scaleFactor&&placement.gap<=4*scaleFactor,`${result.name}: hidden timestamp left a phantom reaction gap ${JSON.stringify(placement)}`);}
    assert.deepEqual(result.senderGeometry.map(item=>item.side),["left","right"]);const expectedAvatarSize=30*result.scale/100;for(const geometry of result.senderGeometry){assert.ok(geometry.nameBubbleEdgeGap<=1.5,`${result.name}: ${geometry.side} sender name is not aligned above the bubble edge ${JSON.stringify(geometry)}`);assert.ok(geometry.nameBubbleVerticalGap>=3&&geometry.nameBubbleVerticalGap<=7,`${result.name}: ${geometry.side} sender label spacing is inconsistent ${JSON.stringify(geometry)}`);assert.ok(Math.abs(geometry.avatarBubbleTopDelta)<=1.5,`${result.name}: ${geometry.side} avatar and bubble do not start together ${JSON.stringify(geometry)}`);assert.ok(Math.abs(geometry.avatarWidth-expectedAvatarSize)<=0.1&&Math.abs(geometry.avatarHeight-expectedAvatarSize)<=0.1,`${result.name}: ${geometry.side} avatar frame is not consistently scaled ${JSON.stringify(geometry)}`);assert.equal(geometry.avatarRadius,"50%",`${result.name}: ${geometry.side} avatar is not circular`);assert.equal(geometry.avatarBorderStyle,"solid",`${result.name}: ${geometry.side} avatar frame is missing`);}const [incomingAvatar,outgoingAvatar]=result.senderGeometry;assert.equal(incomingAvatar.avatarIcon,outgoingAvatar.avatarIcon,`${result.name}: send/receive fallback avatars differ ${JSON.stringify(result.senderGeometry)}`);assert.equal(incomingAvatar.avatarIcon,"mdi:account",`${result.name}: fallback avatar was not normalized`);
    assert.equal(result.quickContained,true,`${result.name}: quick-message selectors escaped their footer`);assert.equal(result.quickMetrics.options,7,`${result.name}: selected group did not expose all quick messages`);
    assert.equal(result.infoScrollable, true, `${result.name}: header items did not scroll`);
    assert.equal(result.archive.visible && result.archive.restoreVisible && result.archive.restoreCalled, true, `${result.name}: archive restore failed`);
    assert.ok(result.archive.left >= 0 && result.archive.right <= result.initial.viewport + 1 && result.archive.top >= 0, `${result.name}: archive dialog clipped`);
    assert.equal(result.mediaPanel.visible, true, `${result.name}: media panel missing`);
    assert.ok(result.mediaPanel.left >= -1 && result.mediaPanel.right <= result.initial.viewport + 1, `${result.name}: media panel clipped horizontally`);
    assert.ok(result.mediaPanel.top >= -1 && result.mediaPanel.bottom <= result.height + 1, `${result.name}: media panel clipped vertically`);
    assert.ok(result.mediaPanel.closeWidth>=44&&result.mediaPanel.closeHeight>=44,`${result.name}: attachment close target is too small ${JSON.stringify(result.mediaPanel)}`);
    assert.equal(result.mediaPanel.legacyLayer,false,`${result.name}: legacy fullscreen media layer returned`);assert.ok(result.mediaPanel.width<=Math.min(440,result.initial.right-result.initial.left-16)+1,`${result.name}: media panel exceeded the card ${JSON.stringify(result.mediaPanel)}`);assert.equal(result.mediaPanel.portal.backgroundColor,"rgba(0, 0, 0, 0)",`${result.name}: media portal painted a fullscreen background ${JSON.stringify(result.mediaPanel.portal)}`);assert.equal(result.mediaPanel.portal.backgroundImage,"none",`${result.name}: media portal inherited a preset background`);assert.equal(result.mediaPanel.portal.borderWidth,"0px",`${result.name}: media portal inherited a preset border`);assert.equal(result.mediaPanel.portal.boxShadow,"none",`${result.name}: media portal inherited a preset shadow`);assert.equal(result.mediaPanel.portal.animationName,"none",`${result.name}: media portal inherited a preset animation`);assert.equal(result.mediaPanel.portal.pointerEvents,"none",`${result.name}: media portal intercepted the page`);
    assert.equal(result.mediaPanel.closedByX&&result.mediaPanel.closedByEscape,true,`${result.name}: attachment menu could not be dismissed by X and Escape ${JSON.stringify(result.mediaPanel)}`);
    assert.equal(result.customConfirm.visible, true, `${result.name}: custom confirmation missing`);
    assert.ok(result.customConfirm.left >= 0 && result.customConfirm.right <= result.initial.viewport + 1, `${result.name}: confirmation clipped`);
    assert.equal(result.focusRetained, true, `${result.name}: composer focus was lost after send`);
    assert.ok(result.actionSizing.compactActionWidth<result.actionSizing.defaultActionWidth,`${result.name}: compact message actions did not shrink ${JSON.stringify(result.actionSizing)}`);
    assert.ok(result.actionSizing.defaultActionWidth>=35&&result.actionSizing.defaultActionWidth<=37,`${result.name}: scaled large-touch action was not held near 36px ${JSON.stringify(result.actionSizing)}`);assert.equal(result.messageActionBehavior.initialActionRows.every(row=>row.display==="none"&&row.height<=0.5&&row.expanded==="false"),true,`${result.name}: dormant mobile action rows still consumed space ${JSON.stringify(result.messageActionBehavior.initialActionRows)}`);assert.equal(result.messageActionBehavior.tapOpened&&result.messageActionBehavior.repeatedTapStayedOpen&&result.messageActionBehavior.switchedTray&&result.messageActionBehavior.outsideDismissed&&result.messageActionBehavior.longPressOpened&&result.messageActionBehavior.dragDidNotOpen,true,`${result.name}: touch action tray behavior failed ${JSON.stringify(result.messageActionBehavior)}`);
    assert.deepEqual(result.tinyTargets, [], `${result.name}: undersized touch targets ${JSON.stringify(result.tinyTargets)}`);
    assert.ok(result.editorOverflow <= 1, `${result.name}: editor overflowed by ${result.editorOverflow}px`);
  }
  console.log(JSON.stringify(results.map(({ name, width, height, scale, initial, editorOverflow, tinyTargets }) => ({ name, width, height, scale, overflow: initial.overflow, transcriptHeight: Math.round(initial.messagesHeight), editorOverflow, tinyTargets: tinyTargets.length })), null, 2));
  console.log("Mobile phone/tablet portrait-landscape, touch target, dialog, media, archive, focus, scrolling, and editor tests passed.");
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
