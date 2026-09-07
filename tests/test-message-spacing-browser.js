const { chromium } = require("playwright");
const path = require("path");
const assert = require("assert");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 480, height: 820 } });
  await page.setContent("<!doctype html><style>:root{--primary-color:#03a9f4;--card-background-color:#1c1c1c;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444}</style>");
  await page.addScriptTag({ path: path.resolve(process.argv[2]) });

  const result = await page.evaluate(async () => {
    const sentTexts=[],serviceCalls=[];
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const openEditorSection=async(editor,key)=>{const section=editor.shadowRoot.querySelector(`[data-editor-section="${key}"]`);if(section&&!section.open){section.open=true;section.dispatchEvent(new Event("toggle"));await new Promise(resolve=>setTimeout(resolve,0));}};
    const messages = [
      { id: "m1", thread_id: "t1", sender_id: "person_2", sender_name: "Person #2", text: "First", type: "text", created_at: "2026-08-30T10:00:00Z", read_by: ["person_2"], reactions: {} },
      { id: "m2", thread_id: "t1", sender_id: "person_2", sender_name: "Person #2", text: "Second", type: "text", created_at: "2026-08-30T10:01:00Z", read_by: ["person_2"], reactions: {} },
      { id: "m3", thread_id: "t1", sender_id: "person_1", sender_name: "Person #1", text: "Reply", type: "text", created_at: "2026-08-30T10:02:00Z", read_by: ["person_1"], reactions: {} },
    ];
    const base = {
      type: "custom:hassenger-card",
      data_source: "hassenger",
      show_send_identity: true,
      show_inbox: false,
      date_separators: false,
      group_consecutive: true,
      group_minutes: 5,
      message_gap: 24,
      grouped_message_gap: 3,
      header_entities: [{ entity: "sensor.status", name: "Status", icon: "mdi:information-outline", color: "#7c4dff" }],
    };
    const card = document.createElement("hassenger-card");
    document.body.append(card);
    card.setConfig(base);
    const hass = {
      states: { "sensor.status": { state: "Ready", attributes: { friendly_name: "Status" } }, "tts.piper":{state:"idle",attributes:{friendly_name:"Piper"}}, "media_player.office":{state:"idle",attributes:{friendly_name:"Office"}} },
      locale: { language: "en" },
      user: { id: "person_1", name: "Person #1", is_admin: true },
      connection: { subscribeMessage: async () => () => {} },
      callService: async (domain,service,data,target) => { serviceCalls.push({domain,service,data,target}); },
      callWS: async (msg) => {
        if (msg.type === "hassenger/messages/send") { sentTexts.push(msg.text); return { id:`sent-${sentTexts.length}` }; }
        if (msg.type === "hassenger/threads/list") return [{ id: "t1", title: "Person #1 & Person #2", participants: ["person_1", "person_2"], icon: "mdi:message", color: "#03a9f4" }];
        if (msg.type === "hassenger/messages/list") return messages;
        if (msg.type === "hassenger/diagnostics") return { integration_version: "2.1.7" };
        return null;
      },
    };
    card.hass = hass;
    await new Promise((resolve) => setTimeout(resolve, 40));

    const gaps = {};
    for (const layout of ["chat_bubbles", "classic_log", "compact_feed"]) {
      card.setConfig({ ...base, layout, separate_grouped_spacing: false });
      await sleep(40);
      gaps[`${layout}_shared`] = [...card.shadowRoot.querySelectorAll(".msg")].map((row) => getComputedStyle(row).marginTop);
      card.setConfig({ ...base, layout, separate_grouped_spacing: true });
      await sleep(40);
      gaps[`${layout}_separate`] = [...card.shadowRoot.querySelectorAll(".msg")].map((row) => getComputedStyle(row).marginTop);
    }

    const rgbConfig = {
      ...base,
      control_style: "classic", // Original uniform-glow layout remains supported.
      quick_message_prompt: "Choose a quick message…",
      preset: "rgb",
      rgb_glow_brightness: 72,
      layout: "chat_bubbles",
      show_inbox: true,
      personal_threads: [
        { name: "Home Assistant", sender_type: "assist", icon: "mdi:robot", color: "#7e57c2", enabled: true },
        { name: "Speaker", sender_type: "tts", icon: "mdi:speaker-message", color: "#ff9800", enabled: true },
      ],
      quick_message_layout:"dropdowns",quick_messages: [
        { label: "Arriving", message: "I am arriving.", group: "People", icon: "mdi:message-fast", send_immediately: false },
        { label: "Leaving", message: "I am leaving.", group: "People", icon: "mdi:message-fast", send_immediately: false },
        { label: "Lights", message: "Turn off the lights.", group: "Assist", icon: "mdi:robot", send_immediately: false },
      ],
    };
    card.setConfig(rgbConfig);
    await sleep(40);
    const rgbGlow = [".thread-preview", ".bubble .body", ".quick-message-select select", ".send-identity", ".composer", ".attachment-menu summary", ".thread-menu summary"].map((selector) => {
      const element = card.shadowRoot.querySelector(selector);
      return { selector, shadow: getComputedStyle(element).boxShadow };
    });
    const uniformSelectors=["header .icon-btn",".quick-message-select select",".send-identity",".composer",".attachment-menu summary",".thread-menu summary",".quick-group-select select"];
    const uniformGlows=uniformSelectors.map(selector=>({selector,shadow:getComputedStyle(card.shadowRoot.querySelector(selector)).boxShadow}));
    const glowStrength=getComputedStyle(card.shadowRoot.querySelector("ha-card")).getPropertyValue("--rgb-glow-strength").trim();
    const headerGlow=getComputedStyle(card.shadowRoot.querySelector("header")).boxShadow;
    const quickArea=card.shadowRoot.querySelector(".quick-area"),quickSelectInitial=card.shadowRoot.querySelector("[data-quick-group]"),quickMessageInitial=card.shadowRoot.querySelector("[data-quick-message]"),quickSurfaceRect=card.shadowRoot.querySelector("ha-card").getBoundingClientRect(),quickSelectRect=quickSelectInitial.getBoundingClientRect(),quickMessageRect=quickMessageInitial.getBoundingClientRect();
    const quickLayout={visibleHeading:!!card.shadowRoot.querySelector(".quick-group-select>span"),groupAria:quickSelectInitial.getAttribute("aria-label"),messageAria:quickMessageInitial.getAttribute("aria-label"),selectorBeforeShortcut:quickSelectRect.left<quickMessageRect.left,sameRow:Math.abs(quickSelectRect.top-quickMessageRect.top)<=2,contained:quickSelectRect.left>=quickSurfaceRect.left&&quickMessageRect.right<=quickSurfaceRect.right+1,horizontalScroll:quickArea.scrollWidth>quickArea.clientWidth+1};
    const quickPlaceholder=quickMessageInitial.options[0];
    const quickGroupInitial={value:quickSelectInitial.value,options:[...quickSelectInitial.options].map(option=>option.textContent),messages:[...quickMessageInitial.options].map(option=>option.textContent),placeholder:{disabled:quickPlaceholder.disabled,hidden:quickPlaceholder.hidden,selected:quickPlaceholder.selected}};
    quickMessageInitial.value="0";quickMessageInitial.dispatchEvent(new Event("change",{bubbles:true}));await sleep(20);const quickSelection={draft:card.shadowRoot.querySelector("textarea[data-composer]")?.value,focused:card.shadowRoot.activeElement===card.shadowRoot.querySelector("textarea[data-composer]")};
    const quickGroupSelect=card.shadowRoot.querySelector("[data-quick-group]");quickGroupSelect.value="Assist";quickGroupSelect.dispatchEvent(new Event("change",{bubbles:true}));
    const quickGroupAfter={value:card.shadowRoot.querySelector("[data-quick-group]")?.value,messages:[...card.shadowRoot.querySelector("[data-quick-message]").options].map(option=>option.textContent),glow:getComputedStyle(card.shadowRoot.querySelector("[data-quick-message]")).boxShadow};
    const quickHideSelect=card.shadowRoot.querySelector("[data-quick-group]");quickHideSelect.value="";quickHideSelect.dispatchEvent(new Event("change",{bubbles:true}));
    const quickGroupHidden={selectExists:!!card.shadowRoot.querySelector("[data-quick-group]"),value:card.shadowRoot.querySelector("[data-quick-group]")?.value,messageSelectExists:!!card.shadowRoot.querySelector("[data-quick-message]")};
    const quickRestoreSelect=card.shadowRoot.querySelector("[data-quick-group]");quickRestoreSelect.value="People";quickRestoreSelect.dispatchEvent(new Event("change",{bubbles:true}));
    const quickPresetStates=[];
    for(const preset of Object.keys(window.HassengerCardUtils.PRESETS)){
      card.setConfig({...rgbConfig,preset,show_inbox:false,quick_message_prompt:"Pick a saved message",quick_message_hidden_label:"Hidden"});await sleep(25);
      const group=card.shadowRoot.querySelector("[data-quick-group]"),message=card.shadowRoot.querySelector("[data-quick-message]"),placeholder=message.options[0];
      const normalGroup=getComputedStyle(group),normalMessage=getComputedStyle(message),normal={groupBackground:normalGroup.backgroundColor,messageBackground:normalMessage.backgroundColor};
      group.focus();const groupFocus=getComputedStyle(group);const groupState={background:groupFocus.backgroundColor,outline:groupFocus.outlineStyle,shadow:groupFocus.boxShadow};
      message.focus();const messageFocus=getComputedStyle(message);const messageState={background:messageFocus.backgroundColor,outline:messageFocus.outlineStyle,shadow:messageFocus.boxShadow};
      message.value="0";message.dispatchEvent(new Event("change",{bubbles:true}));await sleep(15);
      const replacement=card.shadowRoot.querySelector("[data-quick-message]"),postStyle=getComputedStyle(replacement);
      quickPresetStates.push({preset,hiddenLabel:card.shadowRoot.querySelector("[data-quick-group]").options[0].textContent,prompt:replacement.options[0].textContent,disabled:replacement.options[0].disabled,hidden:replacement.options[0].hidden,normal,groupFocus:groupState,messageFocus:messageState,post:{background:postStyle.backgroundColor,outline:postStyle.outlineStyle,composerFocused:card.shadowRoot.activeElement===card.shadowRoot.querySelector("textarea[data-composer]")}});
    }
    card.setConfig({...rgbConfig,rgb_glow_brightness:25});
    await sleep(40);
    const lowGlow={configured:card._config.rgb_glow_brightness,pendingFrame:card._configRenderFrame,strength:getComputedStyle(card.shadowRoot.querySelector("ha-card")).getPropertyValue("--rgb-glow-strength").trim(),shadow:getComputedStyle(card.shadowRoot.querySelector(".composer")).boxShadow};
    card.setConfig(rgbConfig);
    await sleep(40);
    const threadGlows = [...card.shadowRoot.querySelectorAll(".thread-preview")].map((element) => ({
      name: element.textContent.trim(),
      shadow: getComputedStyle(element).boxShadow,
    }));
    const inboxPadding = getComputedStyle(card.shadowRoot.querySelector(".thread-inbox")).paddingTop;
    const headerGlows = {};
    const headerClearance = {};
    const headerVisible = {};
    let badgeCenterDelta = null, badgeDimensions = null;
    for (const style of ["chips", "badges", "compact"]) {
      card.setConfig({ ...rgbConfig, header_info_style: style });
      await sleep(40);
      const selector = style === "badges" ? ".info-item ha-icon" : ".info-item";
      const glowElement = card.shadowRoot.querySelector(selector), scrollElement = card.shadowRoot.querySelector(".info-scroll");
      headerGlows[style] = getComputedStyle(glowElement).boxShadow;
      const glowRect=glowElement.getBoundingClientRect(),scrollRect=scrollElement.getBoundingClientRect();
      headerClearance[style]={top:glowRect.top-scrollRect.top,bottom:scrollRect.bottom-glowRect.bottom};
      const itemRect=card.shadowRoot.querySelector(".info-item").getBoundingClientRect(),headerRect=card.shadowRoot.querySelector(".header-info").getBoundingClientRect();
      headerVisible[style]=itemRect.top>=headerRect.top-1&&itemRect.bottom<=headerRect.bottom+1;
      if(style==="badges"){
        const item=card.shadowRoot.querySelector(".info-item"),iconRect=item.querySelector("ha-icon").getBoundingClientRect(),copyRect=item.querySelector(".info-copy").getBoundingClientRect(),itemRect=item.getBoundingClientRect();
        badgeCenterDelta=Math.abs((iconRect.left+iconRect.width/2)-(copyRect.left+copyRect.width/2));
        badgeDimensions={width:itemRect.width,height:itemRect.height};
      }
    }

    const editor = document.createElement("hassenger-card-editor");
    document.body.append(editor);
    editor.setConfig(base);
    await openEditorSection(editor,"appearance");
    const before = !!editor.shadowRoot.querySelector('[data-path="grouped_message_gap"]');
    const toggle = editor.shadowRoot.querySelector('[data-path="separate_grouped_spacing"]');
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    const after = !!editor.shadowRoot.querySelector('[data-path="grouped_message_gap"]');
    editor.setConfig({...base,preset:"rgb",rgb_glow_brightness:64});
    await openEditorSection(editor,"appearance");
    const rgbBrightnessValue=editor.shadowRoot.querySelector('[data-path="rgb_glow_brightness"]')?.value;
    editor.setConfig({...base,preset:"home_assistant"});
    const nonRgbBrightnessField=!!editor.shadowRoot.querySelector('[data-path="rgb_glow_brightness"]');
    const borderEditor=document.createElement("hassenger-card-editor"),borderEvents=[];document.body.append(borderEditor);borderEditor.addEventListener("config-changed",event=>borderEvents.push(event.detail.config));borderEditor.setConfig(base);await openEditorSection(borderEditor,"typography");const borderWidthBefore=borderEditor.shadowRoot.querySelector('[data-path="typography.bubble_border_width"]')?.value,borderStyleField=borderEditor.shadowRoot.querySelector('[data-path="typography.bubble_border_style"]');borderStyleField.value="double";borderStyleField.dispatchEvent(new Event("change",{bubbles:true}));await sleep(0);const borderEditorBehavior={widthBefore:borderWidthBefore,configuredWidth:borderEvents.at(-1).typography.bubble_border_width,configuredStyle:borderEvents.at(-1).typography.bubble_border_style,visibleWidth:borderEditor.shadowRoot.querySelector('[data-path="typography.bubble_border_width"]')?.value};
    const borderPresetResults=[];for(const preset of ["home_assistant","modern_chat","minimal","terminal","industrial","retro_messenger","midnight","oled","rgb","glass","paper","playful","high_contrast","custom"]){card.setConfig({...base,preset,layout:"chat_bubbles",typography:{bubble_border_width:4,bubble_border_style:"dashed",bubble_border_color:"#ff00aa"}});await sleep(5);const style=getComputedStyle(card.shadowRoot.querySelector(".bubble .body"));borderPresetResults.push({preset,width:style.borderTopWidth,style:style.borderTopStyle,color:style.borderTopColor});}

    const quickEditor=document.createElement("hassenger-card-editor");document.body.append(quickEditor);
    const quickConfig={...base,quick_message_layout:"dropdowns",quick_messages:[{label:"First",message:"One",group:"General",icon:"mdi:numeric-1"},{label:"Second",message:"Two",group:"Assist",icon:"mdi:numeric-2"}]};
    const quickEvents=[];quickEditor.addEventListener("config-changed",event=>quickEvents.push(event.detail.config));quickEditor.setConfig(quickConfig);
    await openEditorSection(quickEditor,"composer");
    const quickPromptField=quickEditor.shadowRoot.querySelector('[data-path="quick_message_prompt"]'),quickHiddenField=quickEditor.shadowRoot.querySelector('[data-path="quick_message_hidden_label"]'),quickPromptDefault=quickPromptField?.value,quickHiddenDefault=quickHiddenField?.value;quickPromptField.value="Select a saved reply";quickPromptField.dispatchEvent(new Event("change",{bubbles:true}));quickHiddenField.value="Off";quickHiddenField.dispatchEvent(new Event("change",{bubbles:true}));
    const quickPromptEditor={fieldExists:!!quickPromptField,hiddenFieldExists:!!quickHiddenField,defaultValue:quickPromptDefault,hiddenDefault:quickHiddenDefault,updatedValue:quickEvents.at(-1).quick_message_prompt,updatedHidden:quickEvents.at(-1).quick_message_hidden_label};
    const initialQuickDeleteButtons=quickEditor.shadowRoot.querySelectorAll("[data-remove-quick]").length;
    quickEditor.shadowRoot.querySelector('[data-remove-quick="1"]').click();
    const afterFirstDelete={buttons:quickEditor.shadowRoot.querySelectorAll("[data-remove-quick]").length,items:quickEvents.at(-1).quick_messages.length,label:quickEvents.at(-1).quick_messages[0].label};
    quickEditor.setConfig(quickEvents.at(-1));
    quickEditor.shadowRoot.querySelector('[data-remove-quick="0"]').click();
    const afterSecondDelete={buttons:quickEditor.shadowRoot.querySelectorAll("[data-remove-quick]").length,items:quickEvents.at(-1).quick_messages.length};
    quickEditor.shadowRoot.querySelector("[data-add-quick]").click();
    const afterQuickAdd={buttons:quickEditor.shadowRoot.querySelectorAll("[data-remove-quick]").length,items:quickEvents.at(-1).quick_messages.length,group:quickEvents.at(-1).quick_messages[0].group};
    card.setConfig({...rgbConfig,quick_message_layout:"dropdowns",quick_messages:[]});
    await sleep(40);
    const emptyQuickSelector=!!card.shadowRoot.querySelector("[data-quick-group]");
    let composer=card.shadowRoot.querySelector("textarea[data-composer]");composer.focus();composer.value="First consecutive message";composer.dispatchEvent(new Event("input",{bubbles:true}));composer.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,60));
    const focusedAfterEnter=card.shadowRoot.activeElement===card.shadowRoot.querySelector("textarea[data-composer]");
    composer=card.shadowRoot.querySelector("textarea[data-composer]");composer.value="Second consecutive message";composer.dispatchEvent(new Event("input",{bubbles:true}));card.shadowRoot.querySelector("[data-send]").click();
    await new Promise(resolve=>setTimeout(resolve,60));
    const focusedAfterButton=card.shadowRoot.activeElement===card.shadowRoot.querySelector("textarea[data-composer]");
    const ttsCard=document.createElement("hassenger-card");document.body.append(ttsCard);
    const ttsTool={name:"Speaker",sender_type:"tts",icon:"mdi:speaker-message",color:"#ff9800",enabled:true,tts_entity:"tts.piper",media_player_entity:"media_player.office",tts_language:"en-US",tts_cache:true,tts_announce:false,tts_pre_announce:true,tts_chime_enabled:false,tts_chime_media:{media_content_id:"media-source://media_source/local/ding.mp3",media_content_type:"audio/mpeg"},tts_chime_wait:4.5};
    const ttsConfig={...base,preset:"rgb",show_inbox:true,personal_threads:[ttsTool],quick_message_layout:"dropdowns",quick_messages:[]};ttsCard.setConfig(ttsConfig);ttsCard.hass=hass;await new Promise(resolve=>setTimeout(resolve,40));
    [...ttsCard.shadowRoot.querySelectorAll("[data-thread-index]")].find(button=>button.textContent.includes("Speaker"))?.click();await new Promise(resolve=>setTimeout(resolve,20));
    let ttsComposer=ttsCard.shadowRoot.querySelector("textarea[data-composer]");ttsComposer.focus();ttsComposer.value="Direct playback";ttsComposer.dispatchEvent(new Event("input",{bubbles:true}));ttsCard.shadowRoot.querySelector("[data-send]").click();await new Promise(resolve=>setTimeout(resolve,25));
    const directTts=serviceCalls.at(-1),directTtsFocused=ttsCard.shadowRoot.activeElement===ttsCard.shadowRoot.querySelector("textarea[data-composer]");
    ttsCard.setConfig({...ttsConfig,personal_threads:[{...ttsTool,tts_language:"",tts_announce:true,tts_pre_announce:true,tts_chime_enabled:true,tts_chime_wait:3.25}]});
    await sleep(40);
    ttsComposer=ttsCard.shadowRoot.querySelector("textarea[data-composer]");ttsComposer.value="Announcement playback";ttsComposer.dispatchEvent(new Event("input",{bubbles:true}));ttsCard.shadowRoot.querySelector("[data-send]").click();await new Promise(resolve=>setTimeout(resolve,25));
    const announcedTts=serviceCalls.at(-1);
    const ttsEditor=document.createElement("hassenger-card-editor");ttsEditor.id="tts-editor-preview";document.body.append(ttsEditor);ttsEditor.setConfig({...ttsConfig,personal_threads:[{...ttsTool,tts_announce:true}]});ttsEditor.hass=hass;
    await openEditorSection(ttsEditor,"composer");
    const ttsToggleWidths=[...ttsEditor.shadowRoot.querySelectorAll('.tool-editor .tts-settings .setting-toggle')].map(row=>Math.round(row.getBoundingClientRect().width));
    const ttsEditorInitial={announce:!!ttsEditor.shadowRoot.querySelector('[data-path="personal_threads.0.tts_announce"]'),preAnnounce:!!ttsEditor.shadowRoot.querySelector('[data-path="personal_threads.0.tts_pre_announce"]'),chimeMedia:!!ttsEditor.shadowRoot.querySelector('[data-media-path="personal_threads.0.tts_chime_media"]'),sections:[...ttsEditor.shadowRoot.querySelectorAll('.tool-editor .editor-subsection h5')].map(h=>h.textContent.trim()),toggles:[...ttsEditor.shadowRoot.querySelectorAll('.tool-editor .setting-toggle b')].map(b=>b.textContent.trim()),uniformToggleWidths:new Set(ttsToggleWidths).size,looseCheckboxes:ttsEditor.shadowRoot.querySelectorAll('.tool-editor>.grid>.check').length};
    const announceToggle=ttsEditor.shadowRoot.querySelector('[data-path="personal_threads.0.tts_announce"]');announceToggle.checked=false;announceToggle.dispatchEvent(new Event("change",{bubbles:true}));
    const preAnnounceHidden=!ttsEditor.shadowRoot.querySelector('[data-path="personal_threads.0.tts_pre_announce"]');
    ttsEditor.setConfig({...ttsConfig,personal_threads:[{...ttsTool,tts_chime_enabled:true}]});ttsEditor.hass=hass;
    const ttsEditorChime={media:!!ttsEditor.shadowRoot.querySelector('[data-media-path="personal_threads.0.tts_chime_media"]'),wait:!!ttsEditor.shadowRoot.querySelector('[data-path="personal_threads.0.tts_chime_wait"]')};
    const stressCard=document.createElement("hassenger-card");document.body.append(stressCard);stressCard.style.width="340px";stressCard.setConfig({...base,preset:"rgb",quick_message_layout:"dropdowns",quick_messages:[...Array(12)].map((_,i)=>({label:`Long shortcut ${i+1}`,message:`This is the complete quick message number ${i+1}`,group:"Busy group",icon:"mdi:message-fast"})).concat([{label:"Assist action",message:"Run the requested Assist action",group:"Assist",icon:"mdi:robot"}])});stressCard.hass=hass;await new Promise(resolve=>setTimeout(resolve,35));
    const stressSurface=stressCard.shadowRoot.querySelector("ha-card"),stressArea=stressCard.shadowRoot.querySelector(".quick-area"),stressSelect=stressCard.shadowRoot.querySelector("[data-quick-group]"),stressMessage=stressCard.shadowRoot.querySelector("[data-quick-message]"),stressRect=stressSurface.getBoundingClientRect(),stressSelectRect=stressSelect.getBoundingClientRect(),stressMessageRect=stressMessage.getBoundingClientRect();
    const quickOverflow={cardContained:stressSurface.scrollWidth<=stressSurface.clientWidth+1,horizontalScroll:stressArea.scrollWidth>stressArea.clientWidth+1,selectContained:stressSelectRect.left>=stressRect.left&&stressMessageRect.right<=stressRect.right+1,messageOptions:stressMessage.options.length,selectorBeforeShortcut:stressSelectRect.left<stressMessageRect.left,sameRow:Math.abs(stressSelectRect.top-stressMessageRect.top)<=2};
    const preserveCard=document.createElement("hassenger-card");document.body.append(preserveCard);preserveCard.setConfig({...base,preserve_chat_height:true,chat_height:310,show_inbox:true,header_entities:[{entity:"sensor.status",name:"Status",icon:"mdi:home",show_icon:true,show_name:true,show_state:true}],quick_message_layout:"dropdowns",quick_messages:[{label:"Test",message:"Test",group:"General",icon:"mdi:message-fast"}]});preserveCard.hass=hass;await new Promise(resolve=>setTimeout(resolve,35));
    const preserveSurface=preserveCard.shadowRoot.querySelector("ha-card"),preserveMessages=preserveCard.shadowRoot.querySelector(".messages");
    const preserveHeight={classSet:preserveSurface.classList.contains("preserve-chat-height"),cardStyleHeight:preserveSurface.style.height,messageHeight:Math.round(preserveMessages.getBoundingClientRect().height),cardHeight:Math.round(preserveSurface.getBoundingClientRect().height)};
    const preserveQuickSelect=preserveCard.shadowRoot.querySelector("[data-quick-group]");
    const preserveMessageSelect=preserveCard.shadowRoot.querySelector("[data-quick-message]");const singleGroupSelector={exists:!!preserveQuickSelect,options:[...preserveQuickSelect.options].map(option=>option.textContent),messages:[...preserveMessageSelect.options].map(option=>option.textContent)};
    const preserveEditor=document.createElement("hassenger-card-editor");document.body.append(preserveEditor);preserveEditor.setConfig({...base,preserve_chat_height:true,chat_height:310});
    await openEditorSection(preserveEditor,"appearance");
    preserveHeight.editorToggle=!!preserveEditor.shadowRoot.querySelector('[data-path="preserve_chat_height"]');preserveHeight.editorHeight=preserveEditor.shadowRoot.querySelector('[data-path="chat_height"]')?.value;
    let microphoneRequests=0,microphoneTracksStopped=0,recognitionStarts=0;
    Object.defineProperty(window,"isSecureContext",{value:true,configurable:true});
    Object.defineProperty(navigator,"permissions",{value:{query:async()=>({state:"granted"})},configurable:true});
    Object.defineProperty(navigator,"mediaDevices",{value:{getUserMedia:async()=>{microphoneRequests++;return{getTracks:()=>[{stop:()=>microphoneTracksStopped++}]};}},configurable:true});
    class TestSpeechRecognition{start(){recognitionStarts++;this.onstart?.();setTimeout(()=>{this.onresult?.({results:[[{transcript:"Voice test"}]]});this.onend?.();},0);}stop(){this.onend?.();}}
    window.SpeechRecognition=TestSpeechRecognition;
    const voiceCard=document.createElement("hassenger-card"),voiceNotices=[];voiceCard.addEventListener("hass-notification",event=>voiceNotices.push(event.detail.message));document.body.append(voiceCard);voiceCard.setConfig({...base,show_voice_input:true,quick_message_layout:"dropdowns",quick_messages:[]});voiceCard.hass=hass;await new Promise(resolve=>setTimeout(resolve,35));
    const voiceButton=voiceCard.shadowRoot.querySelector("[data-voice]");voiceButton.focus();voiceButton.click();await new Promise(resolve=>setTimeout(resolve,30));
    const voiceSuccess={microphoneRequests,microphoneTracksStopped,recognitionStarts,draft:voiceCard.shadowRoot.querySelector("textarea[data-composer]")?.value,focused:voiceCard.shadowRoot.activeElement===voiceCard.shadowRoot.querySelector("textarea[data-composer]")};
    Object.defineProperty(navigator,"mediaDevices",{value:{getUserMedia:async()=>{const error=new Error("Permission denied");error.name="NotAllowedError";throw error;}},configurable:true});
    voiceCard.shadowRoot.querySelector("[data-voice]").click();await new Promise(resolve=>setTimeout(resolve,20));
    const deniedMessage=voiceNotices.at(-1);
    Object.defineProperty(window,"isSecureContext",{value:false,configurable:true});voiceCard.shadowRoot.querySelector("[data-voice]").click();await new Promise(resolve=>setTimeout(resolve,10));
    const insecureMessage=voiceNotices.at(-1);
    window.__hassengerTestCard=card;window.__hassengerRgbConfig=rgbConfig;
    return { gaps, rgbGlow, uniformGlows, glowStrength, headerGlow, quickLayout, quickGroupInitial, quickSelection, quickGroupAfter, quickGroupHidden, quickPresetStates, quickPromptEditor, quickOverflow, emptyQuickSelector, singleGroupSelector, preserveHeight, voicePermission:{success:voiceSuccess,deniedMessage,insecureMessage}, lowGlow, threadGlows, inboxPadding, headerGlows, headerClearance, headerVisible, badgeCenterDelta, badgeDimensions, borderEditorBehavior, borderPresetResults, quickActions:{initialQuickDeleteButtons,afterFirstDelete,afterSecondDelete,afterQuickAdd}, focusAfterSend:{focusedAfterEnter,focusedAfterButton,sentTexts}, ttsControls:{directTts,directTtsFocused,announcedTts,ttsEditorInitial,preAnnounceHidden,ttsEditorChime}, before, after, rgbBrightnessValue, nonRgbBrightnessField, version: window.HassengerCardUtils.VERSION };
  });

  for (const layout of ["chat_bubbles", "classic_log", "compact_feed"]) {
    assert.deepEqual(result.gaps[`${layout}_shared`], ["24px", "24px", "24px"]);
    assert.deepEqual(result.gaps[`${layout}_separate`], ["24px", "3px", "24px"]);
  }
  assert.equal(result.before, false);
  assert.equal(result.after, true);
  assert.equal(result.rgbBrightnessValue,"64");
  assert.equal(result.nonRgbBrightnessField,false);
  for (const item of result.rgbGlow) assert.notEqual(item.shadow, "none", `${item.selector} is missing its RGB Neon glow`);
  assert.equal(result.glowStrength,"72%");
  assert.notEqual(result.headerGlow,"none","card header is missing its RGB Neon glow");
  assert.equal(new Set(result.uniformGlows.map(item=>item.shadow)).size,1,`RGB Neon field glows are inconsistent: ${JSON.stringify(result.uniformGlows)}`);
  assert.deepEqual(result.quickLayout,{visibleHeading:false,groupAria:"Quick message group",messageAria:"Quick message",selectorBeforeShortcut:true,sameRow:true,contained:true,horizontalScroll:false});
  assert.deepEqual(result.quickGroupInitial,{value:"People",options:["Hide","People","Assist"],messages:["Choose a quick message…","Arriving — I am arriving.","Leaving — I am leaving."],placeholder:{disabled:true,hidden:true,selected:true}});
  assert.deepEqual(result.quickSelection,{draft:"I am arriving.",focused:true});
  assert.deepEqual(result.quickGroupAfter.value,"Assist");assert.deepEqual(result.quickGroupAfter.messages,["Choose a quick message…","Lights — Turn off the lights."]);assert.notEqual(result.quickGroupAfter.glow,"none");
  assert.deepEqual(result.quickGroupHidden,{selectExists:true,value:"",messageSelectExists:false});
  assert.deepEqual(result.quickOverflow,{cardContained:true,horizontalScroll:false,selectContained:true,messageOptions:13,selectorBeforeShortcut:true,sameRow:true});
  for(const state of result.quickPresetStates){assert.equal(state.hiddenLabel,"Hidden",`${state.preset} lost the custom hidden label`);assert.equal(state.prompt,"Pick a saved message",`${state.preset} lost the custom prompt`);assert.equal(state.disabled,true);assert.equal(state.hidden,true);assert.equal(state.groupFocus.outline,"none",`${state.preset} group selector kept a native focus outline`);assert.equal(state.messageFocus.outline,"none",`${state.preset} message selector kept a native focus outline`);assert.equal(state.groupFocus.background,state.normal.groupBackground,`${state.preset} group selector changed to a native focus background`);assert.equal(state.messageFocus.background,state.normal.messageBackground,`${state.preset} message selector changed to a native focus background`);assert.equal(state.post.background,state.normal.messageBackground,`${state.preset} message selector kept a changed post-selection background`);assert.equal(state.post.outline,"none");assert.equal(state.post.composerFocused,true);assert.notEqual(state.groupFocus.shadow,"none");assert.notEqual(state.messageFocus.shadow,"none");}
  assert.deepEqual(result.quickPromptEditor,{fieldExists:true,hiddenFieldExists:true,defaultValue:"Quick message…",hiddenDefault:"Hide",updatedValue:"Select a saved reply",updatedHidden:"Off"});
  assert.equal(result.emptyQuickSelector,false);assert.deepEqual(result.singleGroupSelector,{exists:true,options:["Hide","General"],messages:["Quick message…","Test"]});
  assert.equal(result.preserveHeight.classSet,true);assert.equal(result.preserveHeight.cardStyleHeight,"auto");assert.equal(result.preserveHeight.messageHeight,310);assert.ok(result.preserveHeight.cardHeight>result.preserveHeight.messageHeight+100,`preserved chat should make the overall card grow: ${JSON.stringify(result.preserveHeight)}`);assert.equal(result.preserveHeight.editorToggle,true);assert.equal(result.preserveHeight.editorHeight,"310");
  assert.deepEqual(result.voicePermission.success,{microphoneRequests:1,microphoneTracksStopped:1,recognitionStarts:1,draft:"Voice test",focused:true});assert.equal(result.voicePermission.deniedMessage,"Microphone permission is blocked. Allow microphone access for this Home Assistant site or Companion App, reload, and try again.");assert.equal(result.voicePermission.insecureMessage,"Microphone access requires HTTPS. Open Home Assistant through a secure HTTPS address, or use the microphone on your phone keyboard.");
  assert.equal(result.lowGlow.strength,"25%",JSON.stringify(result.lowGlow));assert.notEqual(result.lowGlow.shadow,result.uniformGlows.find(item=>item.selector===".composer").shadow,"RGB brightness control did not change the glow");
  assert.equal(result.threadGlows.length, 3);
  for (const item of result.threadGlows) assert.notEqual(item.shadow, "none", `${item.name} is missing its conversation glow`);
  assert.equal(result.inboxPadding, "12px");
  for (const [style, shadow] of Object.entries(result.headerGlows)) assert.notEqual(shadow, "none", `${style} header info is missing its glow`);
  for (const [style, clearance] of Object.entries(result.headerClearance)) assert.ok(clearance.top>=5&&clearance.bottom>=5,`${style} header glow is clipped: ${JSON.stringify(clearance)}`);
  for (const [style, visible] of Object.entries(result.headerVisible)) assert.equal(visible,true,`${style} header item is clipped by the header strip`);
  assert.ok(result.badgeCenterDelta<=1,`badge icon/text centers differ by ${result.badgeCenterDelta}px`);
  assert.ok(result.badgeDimensions.width>=72&&result.badgeDimensions.width<=80&&result.badgeDimensions.height>=54&&result.badgeDimensions.height<=64,`badge footprint is not compact: ${JSON.stringify(result.badgeDimensions)}`);
  assert.deepEqual(result.borderEditorBehavior,{widthBefore:"0",configuredWidth:3,configuredStyle:"double",visibleWidth:"3"});for(const item of result.borderPresetResults)assert.deepEqual(item,{preset:item.preset,width:"4px",style:"dashed",color:"rgb(255, 0, 170)"},`${item.preset} ignored message bubble border controls: ${JSON.stringify(item)}`);
  assert.equal(result.quickActions.initialQuickDeleteButtons,2);assert.deepEqual(result.quickActions.afterFirstDelete,{buttons:1,items:1,label:"First"});assert.deepEqual(result.quickActions.afterSecondDelete,{buttons:0,items:0});assert.deepEqual(result.quickActions.afterQuickAdd,{buttons:1,items:1,group:"General"});
  assert.equal(result.focusAfterSend.focusedAfterEnter,true);assert.equal(result.focusAfterSend.focusedAfterButton,true,JSON.stringify(result.focusAfterSend));assert.deepEqual(result.focusAfterSend.sentTexts.slice(0,2),["First consecutive message","Second consecutive message"]);
  assert.equal(result.ttsControls.directTts.domain,"hassenger");assert.equal(result.ttsControls.directTts.service,"speak_message");assert.deepEqual(result.ttsControls.directTts.data,{tts_engine:"tts.piper",media_player_entity_id:["media_player.office"],message:"Direct playback",cache:true,language:"en-US",announce:false,use_pre_announce:false,chime_media_content_id:"",chime_media_content_type:"audio/mpeg",chime_wait_seconds:0});assert.equal(result.ttsControls.directTtsFocused,true);
  assert.equal(result.ttsControls.announcedTts.data.announce,true);assert.equal(result.ttsControls.announcedTts.data.use_pre_announce,true);assert.equal(result.ttsControls.announcedTts.data.chime_media_content_id,"media-source://media_source/local/ding.mp3");assert.equal(result.ttsControls.announcedTts.data.chime_wait_seconds,3.25);
  assert.equal(Object.prototype.hasOwnProperty.call(result.ttsControls.announcedTts.data,"language"),false,"blank TTS language must be omitted for older Hassenger service schemas");
  assert.deepEqual(result.ttsControls.ttsEditorInitial,{announce:true,preAnnounce:true,chimeMedia:false,sections:["Destination appearance","Voice & speaker","Playback behavior","Optional Hassenger chime"],toggles:["Use announcement mode","Play the media player's pre-announcement sound","Cache generated speech","Play a separate chime before speech","Show this destination in the card"],uniformToggleWidths:1,looseCheckboxes:0});assert.equal(result.ttsControls.preAnnounceHidden,true);assert.deepEqual(result.ttsControls.ttsEditorChime,{media:true,wait:true});
  assert.equal(result.version, require("../package.json").version);
  if(process.argv[3]){
    await page.evaluate(()=>window.__hassengerTestCard.setConfig({...window.__hassengerRgbConfig,header_info_style:"compact"}));
    await page.locator("hassenger-card").first().screenshot({path:`${process.argv[3]}-compact.png`});
    await page.evaluate(()=>window.__hassengerTestCard.setConfig({...window.__hassengerRgbConfig,header_info_style:"chips"}));
    await page.locator("hassenger-card").first().screenshot({path:`${process.argv[3]}-chips.png`});
    await page.evaluate(()=>window.__hassengerTestCard.setConfig({...window.__hassengerRgbConfig,header_info_style:"badges"}));
    await page.locator("hassenger-card").first().screenshot({path:`${process.argv[3]}-badges.png`});
    await page.evaluate(()=>{const editor=document.querySelector("#tts-editor-preview");for(const details of editor.shadowRoot.querySelectorAll("details"))details.open=details.querySelector(":scope>summary")?.textContent.includes("Composer, Assist & TTS")||details.classList.contains("tool-editor");});
    await page.locator("#tts-editor-preview").screenshot({path:`${process.argv[3]}-tts-editor.png`});
  }
  await browser.close();
  console.log("Message spacing, RGB glow visibility, badge geometry, and quick-message CRUD passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
