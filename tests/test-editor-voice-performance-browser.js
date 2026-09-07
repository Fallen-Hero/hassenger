const { chromium } = require("playwright");
const path = require("path"), assert = require("assert");

(async()=>{
  const browser=await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page=await browser.newPage({viewport:{width:1100,height:900}});
  await page.setContent("<!doctype html><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444}</style>");
  await page.addScriptTag({path:path.resolve(process.argv[2])});
  const result=await page.evaluate(async()=>{
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const config={type:"custom:hassenger-card",data_source:"hassenger",show_voice_input:true,persistent_profiles:Array.from({length:40},(_,i)=>({match_name:`Person #${i+1}`,person_entity:`person.person_${i+1}`,icon:"mdi:account"})),personal_threads:Array.from({length:20},(_,i)=>({name:`Tool ${i+1}`,sender_type:i%2?"tts":"assist",icon:i%2?"mdi:speaker":"mdi:robot"})),header_entities:Array.from({length:30},(_,i)=>({entity:`sensor.item_${i}`,name:`Item ${i+1}`,icon:"mdi:gauge"})),quick_messages:Array.from({length:40},(_,i)=>({label:`Quick ${i+1}`,message:`Message ${i+1}`,group:"Stress"}))};
    const hass={user:{id:"u1",name:"Person #1",is_admin:true},states:{},locale:{language:"en-US"},connection:{subscribeMessage:async()=>()=>{}},callWS:async msg=>msg.type==="hassenger/users/list"?[]:msg.type==="hassenger/threads/list"?[]:msg.type==="hassenger/diagnostics"?{integration_version:"2.1.7"}:[]};
    const editor=document.createElement("hassenger-card-editor");document.body.append(editor);const started=performance.now();editor.setConfig(config);editor.hass=hass;await sleep(30);const initialMs=performance.now()-started;
    const pickerSelector="ha-icon-picker,ha-entity-picker,ha-selector",initialPickers=editor.shadowRoot.querySelectorAll(pickerSelector).length;
    const initialLoaded=[...editor._loadedSections],initialOpen=[...editor._openSections],persistent=editor.shadowRoot.querySelector('[data-editor-section="persistent"]');
    persistent.open=true;persistent.dispatchEvent(new Event("toggle"));await sleep(25);
    const persistentPickers=editor.shadowRoot.querySelectorAll(pickerSelector).length,persistentProfiles=editor.shadowRoot.querySelector('[data-editor-section="persistent"]').querySelectorAll(".info-editor").length;
    const appearance=editor.shadowRoot.querySelector('[data-editor-section="appearance"]');appearance.open=true;appearance.dispatchEvent(new Event("toggle"));await sleep(25);
    const appearanceLoaded=editor._loadedSections.has("appearance"),presetField=!!editor.shadowRoot.querySelector('[data-path="preset"]');
    const actionSection=editor.shadowRoot.querySelector('[data-editor-section="message-actions"]');actionSection.open=true;actionSection.dispatchEvent(new Event("toggle"));await sleep(5);const actionFields={placement:editor.shadowRoot.querySelector('[data-path="reaction_placement"]')?.value,size:editor.shadowRoot.querySelector('[data-path="message_action_size"]')?.value,largeMobile:!!editor.shadowRoot.querySelector('[data-path="large_mobile_message_actions"]')};

    // Exhaustive visual-editor wiring audit. Each visible field is changed through
    // the same DOM event a user produces, then the emitted card configuration is
    // checked. Multiple configurations expose every conditional editor branch.
    const auditHeader={entity:"sensor.audit",name:"Audit",icon:"mdi:gauge",color:"#03a9f4",show_icon:true,show_name:true,show_state:true,tap_action:"navigate",navigation_path:"/lovelace/audit",double_tap_action:"url",double_tap_url_path:"https://example.invalid",hold_action:"call-service",hold_service:"light.turn_on",hold_service_data:'{"brightness_pct":50}'};
    const auditQuick={label:"Audit quick",message:"Audit message",group:"General",icon:"mdi:message-text-fast",send_immediately:false};
    const auditProfile={match_name:"Person #2",display_name:"Person #2",thread_title_match:"Audit chat",conversation_name:"Audit chat",person_entity:"person.person_2",icon:"mdi:account-circle",image:"",color:"#03a9f4",bubble_color:"#163844",text_color:"#ffffff",alignment:"auto",show_name:true,show_timestamp:true};
    const auditAssist={name:"Assistant",sender_type:"assist",icon:"mdi:robot",color:"#7e57c2",enabled:true,assist_agent:"conversation.home_assistant",assist_language:"en",assist_keep_context:true};
    const auditTts={name:"Speaker",sender_type:"tts",icon:"mdi:speaker-message",color:"#ff9800",enabled:true,tts_entity:"tts.audit",media_player_entity:"media_player.audit",tts_language:"en-US",tts_announce:true,tts_pre_announce:true,tts_cache:true,tts_chime_enabled:true,tts_chime_media:{media_content_id:"media-source://media_source/local/chime.mp3"},tts_chime_wait:1};
    const persistentAudit={type:"custom:hassenger-card",data_source:"hassenger",show_header:true,show_header_logo:true,header_logo_style:"wordmark",show_header_icon:true,show_header_title:true,show_send_identity:true,show_header_info_label:true,show_contacts:true,contacts_placement:"right",contacts_separate_windows:true,contacts_replace_inbox:true,show_voice_input:true,separate_grouped_spacing:true,preserve_chat_height:true,width_mode:"custom",preset:"custom",group_consecutive:true,persistent_profiles:[auditProfile],personal_threads:[auditAssist,auditTts],header_entities:[auditHeader],quick_messages:[auditQuick]};
    const rgbAudit={...persistentAudit,preset:"rgb"};
    const fixedAudit={...persistentAudit,preserve_chat_height:false,height_mode:"fixed",preset:"default"};
    const legacyPerson=(name,type,index)=>({name,match_name:name,sender_type:type,icon:"mdi:account",image:"",input_entity:`input_text.person_${index}`,color:"#2196f3",bubble_color:"#163844",text_color:"#ffffff",font_size:0,font_weight:"inherit",font_style:"inherit",alignment:"auto",use_entity_picture:false,show_name:true,show_timestamp:true,enabled:true,assist_agent:"conversation.home_assistant",assist_language:"en",assist_user_name:"Person #1",assist_keep_context:true,tts_entity:"tts.audit",tts_language:"en-US",tts_announce:true,tts_pre_announce:true,tts_cache:true,tts_chime_enabled:true,tts_chime_media:{media_content_id:"media-source://media_source/local/chime.mp3"},tts_chime_wait:1});
    const legacyAudit={...persistentAudit,data_source:"input_text",composer_mode:"shared",preset:"default",history_entity:"input_text.history",shared_input_entity:"input_text.send",people:[legacyPerson("Person #1","person",1),legacyPerson("Assistant","assist",2),legacyPerson("Speaker","tts",3)],personal_threads:[]};
    const privateAudit={...legacyAudit,composer_mode:"personal",personal_sender_name:"Person #1",personal_threads:[{name:"Person #2",sender_type:"person",icon:"mdi:account",color:"#e91e63",enabled:true,history_entity:"input_text.person_2_history",input_entity:"input_text.person_2_send"},auditAssist,auditTts]};
    const auditConfigs=[persistentAudit,rgbAudit,fixedAudit,legacyAudit,privateAudit];
    const loadAll=(target)=>{const keys=[...target.shadowRoot.querySelectorAll("[data-editor-section]")].map(section=>section.dataset.editorSection);target._loadedSections=new Set(keys);target._openSections=new Set(keys);target._render();};
    const makeEditor=async(config)=>{const target=document.createElement("hassenger-card-editor");document.body.append(target);target.setConfig(config);target.hass=hass;await sleep(0);loadAll(target);await sleep(0);return target;};
    const readPath=(object,path)=>path.split(".").reduce((value,key)=>value?.[/^\d+$/.test(key)?Number(key):key],object);
    const descriptors=new Map(),unlabeled=[];
    for(let variant=0;variant<auditConfigs.length;variant++){
      const target=await makeEditor(auditConfigs[variant]);
      const add=(kind,node,path)=>{const key=`${kind}:${path}`;if(!descriptors.has(key))descriptors.set(key,{kind,path,variant});const label=node.closest("label"),text=label?.querySelector(":scope > span, :scope > b, :scope > span > b")?.textContent?.trim();if(!label||!text)unlabeled.push(key);};
      target.shadowRoot.querySelectorAll("input[data-path],select[data-path],textarea[data-path]").forEach(node=>add("field",node,node.dataset.path));
      target.shadowRoot.querySelectorAll("ha-icon-picker[data-icon-path]").forEach(node=>add("icon",node,node.dataset.iconPath));
      target.shadowRoot.querySelectorAll("ha-entity-picker[data-entity-path]").forEach(node=>add("entity",node,node.dataset.entityPath));
      target.shadowRoot.querySelectorAll("ha-selector[data-media-path]").forEach(node=>add("media",node,node.dataset.mediaPath));
      target.shadowRoot.querySelectorAll("input[data-color-path]").forEach(node=>add("color",node,node.dataset.colorPath));
      target.shadowRoot.querySelectorAll("button[data-clear-path]").forEach(node=>{const path=node.dataset.clearPath,key=`clear:${path}`;if(!descriptors.has(key))descriptors.set(key,{kind:"clear",path,variant});if(!node.title)unlabeled.push(key);});
      target.remove();
    }
    const failedWrites=[];
    for(const descriptor of descriptors.values()){
      const target=await makeEditor(auditConfigs[descriptor.variant]),escaped=CSS.escape(descriptor.path);let node;
      if(descriptor.kind==="field")node=target.shadowRoot.querySelector(`input[data-path="${escaped}"],select[data-path="${escaped}"],textarea[data-path="${escaped}"]`);
      if(descriptor.kind==="icon")node=target.shadowRoot.querySelector(`ha-icon-picker[data-icon-path="${escaped}"]`);
      if(descriptor.kind==="entity")node=target.shadowRoot.querySelector(`ha-entity-picker[data-entity-path="${escaped}"]`);
      if(descriptor.kind==="media")node=target.shadowRoot.querySelector(`ha-selector[data-media-path="${escaped}"]`);
      if(descriptor.kind==="color")node=target.shadowRoot.querySelector(`input[data-color-path="${escaped}"]`);
      if(descriptor.kind==="clear")node=target.shadowRoot.querySelector(`button[data-clear-path="${escaped}"]`);
      let emitted=null;target.addEventListener("config-changed",event=>{emitted=event.detail.config;});
      if(!node){failedWrites.push(`${descriptor.kind}:${descriptor.path}:missing`);target.remove();continue;}
      if(descriptor.kind==="field"){
        if(node.type==="checkbox")node.checked=!node.checked;
        else if(node.tagName==="SELECT"){const choices=[...node.options];node.value=(choices.find(option=>option.value!==node.value)||choices[0])?.value??"";}
        else if(node.type==="number")node.value=String((Number(node.value)||0)+1);
        else if(node.tagName==="TEXTAREA")node.value=descriptor.path.endsWith("service_data")?'{"brightness_pct":25}':`${node.value||""} audit`;
        else node.value=descriptor.path.includes("color")?"#123456":`${node.value||""} audit`;
        node.dispatchEvent(new Event("change",{bubbles:true}));
      }else if(descriptor.kind==="icon"){node.dispatchEvent(new CustomEvent("value-changed",{detail:{value:"mdi:star"},bubbles:true}));
      }else if(descriptor.kind==="entity"){node.dispatchEvent(new CustomEvent("value-changed",{detail:{value:"sensor.audit_changed"},bubbles:true}));
      }else if(descriptor.kind==="media"){node.dispatchEvent(new CustomEvent("value-changed",{detail:{value:{media_content_id:"media-source://media_source/local/audit.mp3"}},bubbles:true}));
      }else if(descriptor.kind==="color"){node.value="#123456";node.dispatchEvent(new Event("change",{bubbles:true}));
      }else{target._set(descriptor.path,"#123456");target._render();emitted=null;node=target.shadowRoot.querySelector(`button[data-clear-path="${escaped}"]`);node?.click();}
      await sleep(0);const value=readPath(emitted,descriptor.path);if(!emitted||value===undefined||(descriptor.kind==="clear"&&value!==""))failedWrites.push(`${descriptor.kind}:${descriptor.path}:${emitted?JSON.stringify(value):"no-event"}`);target.remove();
    }
    const visibility={};
    for(const [name,config] of Object.entries({persistent:persistentAudit,rgb:rgbAudit,fixed:fixedAudit,legacy:legacyAudit,private:privateAudit})){
      const target=await makeEditor(config),has=path=>!!target.shadowRoot.querySelector(`[data-path="${CSS.escape(path)}"],[data-icon-path="${CSS.escape(path)}"],[data-entity-path="${CSS.escape(path)}"],[data-media-path="${CSS.escape(path)}"]`);
      visibility[name]={customCss:has("custom_css"),rgbGlow:has("rgb_glow_brightness"),height:has("height"),chatHeight:has("chat_height"),groupedGap:has("grouped_message_gap"),contactsWidth:has("contacts_width"),wordmarkColor:has("header_wordmark_text_color"),voiceLanguage:has("speech_language"),ttsChime:has(name==="legacy"?"people.2.tts_chime_media":name==="private"?"personal_threads.2.tts_chime_media":"personal_threads.1.tts_chime_media"),historyEntity:has("history_entity"),sharedInput:has("shared_input_entity"),privateHistory:has("personal_threads.0.history_entity")};
      target.remove();
    }
    const brandingEditor=await makeEditor(persistentAudit),branding=brandingEditor.shadowRoot.querySelector(".branding-subsection");branding.open=true;branding.dispatchEvent(new Event("toggle"));branding.open=false;branding.dispatchEvent(new Event("toggle"));const brandingCollapses=!branding.open;brandingEditor.remove();
    const mutationCases=[
      [persistentAudit,"[data-add-header]","header_entities",1],[persistentAudit,"[data-add-profile]","persistent_profiles",1],[persistentAudit,"[data-add-quick]","quick_messages",1],[persistentAudit,'[data-add-tool="assist"]',"personal_threads",1],[persistentAudit,'[data-add-tool="tts"]',"personal_threads",1],
      [legacyAudit,"[data-add-person]","people",1],[privateAudit,"[data-add-thread]","personal_threads",1],[persistentAudit,'[data-remove-header="0"]',"header_entities",-1],[persistentAudit,'[data-remove-profile="0"]',"persistent_profiles",-1],[persistentAudit,'[data-remove-quick="0"]',"quick_messages",-1],[persistentAudit,'[data-remove-thread="0"]',"personal_threads",-1],[legacyAudit,'[data-remove-person="0"]',"people",-1]
    ];
    const failedMutations=[];
    for(const [config,selector,arrayName,delta] of mutationCases){const target=await makeEditor(config),before=target._config[arrayName].length;let emitted=null;target.addEventListener("config-changed",event=>emitted=event.detail.config);const button=target.shadowRoot.querySelector(selector);button?.click();await sleep(0);if(!button||!emitted||emitted[arrayName].length!==before+delta)failedMutations.push(`${selector}:${before}->${emitted?.[arrayName]?.length}`);target.remove();}
    const editorAudit={controls:descriptors.size,paths:new Set([...descriptors.values()].map(item=>item.path)).size,unlabeled:[...new Set(unlabeled)],failedWrites,failedMutations,visibility,brandingCollapses};

    const notices=[];const card=document.createElement("hassenger-card");card.addEventListener("hass-notification",event=>notices.push(event.detail.message));document.body.append(card);card.setConfig({type:"custom:hassenger-card",data_source:"hassenger",show_voice_input:true,show_inbox:false});card.hass={...hass,callWS:async msg=>msg.type==="hassenger/threads/list"?[{id:"t1",title:"Voice test",participants:["u1"]}]:msg.type==="hassenger/messages/list"?[]:msg.type==="hassenger/diagnostics"?{integration_version:"2.1.7"}:[]};await sleep(50);
    Object.defineProperty(window,"isSecureContext",{configurable:true,value:true});Object.defineProperty(navigator,"permissions",{configurable:true,value:{query:async()=>({state:"denied"})}});Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}});
    window.SpeechRecognition=class{start(){} stop(){}};await card._startVoiceInput(card._selected,card.shadowRoot.querySelector("[data-voice]"));
    const deniedMessage=notices.at(-1)||"";
    Object.defineProperty(navigator,"permissions",{configurable:true,value:{query:async()=>({state:"granted"})}});
    window.SpeechRecognition=class{start(){queueMicrotask(()=>{this.onerror?.({error:"service-not-allowed"});this.onend?.();});} stop(){this.onend?.();}};await card._startVoiceInput(card._selected,card.shadowRoot.querySelector("[data-voice]"));await sleep(5);
    const serviceMessage=notices.at(-1)||"";
    window.SpeechRecognition=class{start(){queueMicrotask(()=>{this.onstart?.();this.onresult?.({results:[[{transcript:"browser dictation works"}]]});this.onend?.();});} stop(){this.onend?.();}};await card._startVoiceInput(card._selected,card.shadowRoot.querySelector("[data-voice]"));await sleep(5);const recognizedText=card.shadowRoot.querySelector("textarea").value;
    return{version:window.HassengerCardUtils.VERSION,initialMs,initialPickers,initialLoaded,initialOpen,persistentPickers,persistentProfiles,appearanceLoaded,presetField,actionFields,editorAudit,deniedMessage,serviceMessage,recognizedText};
  });
  console.log(JSON.stringify(result,null,2));
  assert.equal(result.version,require("../package.json").version);
  assert.deepEqual(result.initialLoaded,["basics"]);assert.deepEqual(result.initialOpen,["basics"]);assert.ok(result.initialPickers<=2,`collapsed sections initialized ${result.initialPickers} Home Assistant pickers`);
  assert.ok(result.persistentPickers>result.initialPickers);assert.equal(result.persistentProfiles,40);assert.equal(result.appearanceLoaded,true);assert.equal(result.presetField,true);assert.deepEqual(result.actionFields,{placement:"below_time",size:"24",largeMobile:true});
  assert.ok(result.editorAudit.controls>=170,`only ${result.editorAudit.controls} editor controls were audited`);assert.ok(result.editorAudit.paths>=120,`only ${result.editorAudit.paths} editor paths were audited`);assert.deepEqual(result.editorAudit.unlabeled,[]);assert.deepEqual(result.editorAudit.failedWrites,[]);assert.deepEqual(result.editorAudit.failedMutations,[]);assert.equal(result.editorAudit.brandingCollapses,true);
  assert.deepEqual(result.editorAudit.visibility,{persistent:{customCss:true,rgbGlow:false,height:false,chatHeight:true,groupedGap:true,contactsWidth:true,wordmarkColor:true,voiceLanguage:true,ttsChime:true,historyEntity:false,sharedInput:false,privateHistory:false},rgb:{customCss:false,rgbGlow:true,height:false,chatHeight:true,groupedGap:true,contactsWidth:true,wordmarkColor:true,voiceLanguage:true,ttsChime:true,historyEntity:false,sharedInput:false,privateHistory:false},fixed:{customCss:false,rgbGlow:false,height:true,chatHeight:false,groupedGap:true,contactsWidth:true,wordmarkColor:true,voiceLanguage:true,ttsChime:true,historyEntity:false,sharedInput:false,privateHistory:false},legacy:{customCss:false,rgbGlow:false,height:false,chatHeight:true,groupedGap:true,contactsWidth:false,wordmarkColor:true,voiceLanguage:true,ttsChime:true,historyEntity:true,sharedInput:true,privateHistory:false},private:{customCss:false,rgbGlow:false,height:false,chatHeight:true,groupedGap:true,contactsWidth:false,wordmarkColor:true,voiceLanguage:true,ttsChime:true,historyEntity:false,sharedInput:false,privateHistory:true}});
  assert.match(result.deniedMessage,/site permissions/i);assert.match(result.serviceMessage,/speech-recognition service/i);assert.equal(result.recognizedText,"browser dictation works");
  console.log(`Lazy editor sections, ${result.editorAudit.controls} controls across ${result.editorAudit.paths} paths, collection actions, conditional branches, and browser speech permission diagnostics passed.`);
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
