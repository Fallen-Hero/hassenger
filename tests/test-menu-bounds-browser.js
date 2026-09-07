const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const path=require("node:path");
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.HASSENGER_BROWSER_PATH?{executablePath:process.env.HASSENGER_BROWSER_PATH}:{})});
 try{
  const results=[],errors=[];
  for(const width of [390,1000]){
   const page=await browser.newPage({viewport:{width,height:800},isMobile:width<600,hasTouch:width<600});page.on("pageerror",e=>errors.push(e.message));
   await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px}:root{--card-background-color:#171717;--primary-text-color:#fff;--secondary-text-color:#aaa;--primary-color:#03a9f4;--divider-color:#555}</style>');
   await page.addScriptTag({path:path.resolve(process.argv[2])});
   const checks=await page.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms)),card=document.createElement("hassenger-card");document.body.append(card);
    const hass={user:{id:"person_1",name:"Person #1",is_admin:true},states:{},connection:{subscribeMessage:async()=>()=>{}},callWS:async r=>r.type==="hassenger/diagnostics"?{integration_version:"1.0.0"}:r.type==="hassenger/threads/list"?[{id:"t1",title:"Household",participants:["person_1","person_2"]}]:r.type==="hassenger/messages/list"?[{id:"m1",sender_id:"person_2",sender_name:"Person #2",text:"Test message",created_at:new Date().toISOString(),read_by:[]}]:r.type==="hassenger/presence/list"?{}:[]};
    card.setConfig({data_source:"hassenger",show_contacts:true});card.hass=hass;await sleep(100);const checks=[];
    if(card._config.chat_height!==400||card._config.preserve_chat_height!==true)throw Error("New cards must default to a preserved 400 px conversation");
    for(const preset of ["home_assistant","modern_chat","minimal","terminal","industrial","retro_messenger","midnight","oled","rgb","glass","paper","playful","high_contrast","custom"])for(const height of [200,300,400,460])for(const control_style of ["refined","classic"]){
     card.setConfig({data_source:"hassenger",show_contacts:true,preset,height,preserve_chat_height:false,control_style,show_typing:false});await sleep(12);
     const root=card.shadowRoot,menu=root.querySelector(".thread-menu");menu.open=true;await sleep(25);const panel=root.querySelector(".thread-menu-popover");panel.scrollTop=panel.scrollHeight;await sleep(0);
     const target=root.querySelector('[data-thread-action="delete"]'),p=panel.getBoundingClientRect(),b=target.getBoundingClientRect(),main=root.querySelector(".card-main").getBoundingClientRect();
     const hit=root.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2);
     checks.push({preset,height,control_style,visible:b.top>=Math.max(p.top,main.top,0)-1&&b.bottom<=Math.min(p.bottom,main.bottom,innerHeight)+1,clickable:hit===target||target.contains(hit),bounded:p.top>=Math.max(main.top,0)-1&&p.bottom<=Math.min(main.bottom,innerHeight)+1});
    }
    for(const card_scale of [75,150]){
     card.style.marginTop="350px";card.setConfig({data_source:"hassenger",show_contacts:true,height:260,preserve_chat_height:false,preset:"rgb",card_scale});await sleep(20);
     const root=card.shadowRoot,menu=root.querySelector(".thread-menu");menu.open=true;await sleep(25);
     window.scrollTo(0,100);await sleep(30);
     const panel=root.querySelector(".thread-menu-popover");panel.scrollTop=panel.scrollHeight;
     const target=root.querySelector('[data-thread-action="delete"]'),p=panel.getBoundingClientRect(),b=target.getBoundingClientRect(),main=root.querySelector(".card-main").getBoundingClientRect(),hit=root.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2);
     checks.push({card_scale,visible:b.bottom<=Math.min(p.bottom,main.bottom,innerHeight)+1,clickable:hit===target||target.contains(hit),bounded:p.top>=Math.max(main.top,0)-1&&p.bottom<=Math.min(main.bottom,innerHeight)+1});
     target.click();await sleep(20);if(!root.querySelector(".action-dialog"))throw Error("Delete confirmation is unreachable");
     root.querySelector("[data-action-dialog-cancel]").click();window.scrollTo(0,0);card.style.marginTop="0";
    }
    // Inbox and Contacts must never render competing conversation switchers.
    for(const contacts_replace_inbox of [false,true])for(const show_inbox of [false,true])for(const show_contacts of [false,true])for(const inbox_style of ["cards","dropdown"])for(const control_style of ["refined","classic"]){
     card.setConfig({data_source:"hassenger",show_contacts,contacts_replace_inbox,show_inbox,inbox_style,control_style,preset:"rgb"});await sleep(12);
     const root=card.shadowRoot,inboxVisible=show_inbox&&!(show_contacts&&contacts_replace_inbox);
     if(!!root.querySelector(".thread-inbox,.thread-inbox-dropdown")!==inboxVisible)throw Error("Inbox visibility disagrees with configuration");
     if(!!root.querySelector(".conversation-switcher")!==(show_contacts&&!inboxVisible))throw Error("Duplicate or missing Contacts conversation switcher");
     if(root.querySelectorAll(".thread-menu").length!==1||!root.querySelector('[data-thread-action="delete"]'))throw Error("Conversation actions were lost or duplicated");
    }
    // Exercise the actual editor fields, not just normalized configuration.
    card.setConfig({data_source:"hassenger",show_contacts:true,contacts_include_people:false,persistent_profiles:[{thread_title_match:"Household",match_name:"Person #2"},{}]});await sleep(20);
    const editor=document.createElement("hassenger-card-editor");document.body.append(editor);editor.hass=hass;editor.setConfig(card._config);await sleep(30);
    const section=editor.shadowRoot.querySelector('[data-editor-section="persistent"]');section.open=true;section.dispatchEvent(new Event("toggle"));await sleep(30);
    editor.addEventListener("config-changed",event=>card.setConfig(event.detail.config));
    const change=async(path,value)=>{const input=editor.shadowRoot.querySelector('[data-path="'+path+'"]');if(!input)throw Error("Missing appearance override field "+path);input.value=value;input.dispatchEvent(new Event("change",{bubbles:true}));await sleep(40);};
    await change("persistent_profiles.1.thread_title_match","Household");
    await change("persistent_profiles.1.conversation_name","Family room");
    if(card.shadowRoot.querySelector("[data-conversation-current]")?.textContent!=="Family room")throw Error("Editor custom name did not reach conversation header");
    if(card.shadowRoot.querySelector('[data-contact-thread="t1"] b')?.textContent!=="Family room")throw Error("Contacts ignored custom conversation name");
    for(const inbox_style of ["cards","dropdown"]){card.setConfig({...card._config,contacts_replace_inbox:false,inbox_style});await sleep(20);const label=card.shadowRoot.querySelector('.thread-preview b,[data-thread-select] option');if(label?.textContent!=="Family room")throw Error("Inbox ignored custom conversation name");}
    card._contactSearch="Family room";card._render();if(!card.shadowRoot.querySelector('[data-contact-thread="t1"]'))throw Error("Custom name is not searchable");card._contactSearch="";
    if(card._backendThreads[0].title!=="Household")throw Error("Display override modified stored conversation title");
    // Sender names also resolve through the same display mapping while typing.
    editor._set("persistent_profiles.1.match_name","Person #2");await sleep(40);
    await change("persistent_profiles.1.display_name","Chat buddy");
    card._receiveTyping({thread_id:"t1",sender_id:"person_2",sender_name:"Person #2",typing:true});
    if(card.shadowRoot.querySelector("[data-typing-label]")?.textContent!=="Chat buddy is typing…")throw Error("Typing ignored custom sender name");
    if(card._backendParsedMessages()[0]?.sender!=="Chat buddy")throw Error("Message sender ignored a later nonblank custom name");
    card._contacts=[{id:"person_2",name:"Person #2",is_self:false}];card.setConfig({...card._config,contacts_include_people:true});await sleep(20);
    if(card.shadowRoot.querySelector(".contact-entry .contact-copy b")?.textContent!=="Chat buddy")throw Error("Contact ignored custom sender name");
    await change("persistent_profiles.1.display_name","");card._updateTypingIndicator();
    if(card.shadowRoot.querySelector("[data-typing-label]")?.textContent!=="Person #2 is typing…")throw Error("Typing did not restore original sender name");
    await change("persistent_profiles.1.conversation_name","");
    if(card._availablePeople()[0].name!=="Household")throw Error("Clearing custom name did not restore original");
    editor.remove();card.remove();return checks;
   });results.push({width,checks});await page.close();
  }
  const failures=results.flatMap(r=>r.checks.filter(c=>!c.visible||!c.clickable||!c.bounded).map(c=>({width:r.width,...c})));console.log(JSON.stringify({cases:results.reduce((n,r)=>n+r.checks.length,0),navigationConfigurations:64,failures:failures.slice(0,8)},null,2));assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
