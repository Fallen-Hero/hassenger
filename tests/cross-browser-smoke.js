const { chromium, firefox, webkit } = require("playwright");
const path = require("path");
const assert = require("assert");

(async()=>{
  const results=[];
  const requested=new Set(String(process.env.HASSENGER_ENGINES||"chromium,firefox,webkit").split(",").map(value=>value.trim()));
  for(const [name,engine] of Object.entries({chromium,firefox,webkit}).filter(([name])=>requested.has(name))){
    console.log(`Starting ${name} smoke checks...`);
    const browser=await engine.launch({headless:true,timeout:30000,...(name==="chromium"&&process.env.HASSENGER_BROWSER_PATH?{executablePath:process.env.HASSENGER_BROWSER_PATH}:{}),...(name==="firefox"?{firefoxUserPrefs:{"gfx.webrender.all":false,"gfx.webrender.software":false,"layers.acceleration.disabled":true}}:{})});
    for(const viewport of [{width:390,height:844},{width:1100,height:800}]){
      console.log(`  ${name} ${viewport.width}px`);
      const page=await browser.newPage({viewport});const errors=[];page.on("pageerror",error=>errors.push(error.message));
      await page.setContent("<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444;--error-color:#f44336}body{margin:0}</style>");
      await page.addScriptTag({path:path.resolve(process.argv[2])});
      const geometry=await page.evaluate(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));const threads=[{id:"t1",title:"Person #1 and Person #2",participants:["person_1","person_2"],icon:"mdi:message",unread:0}];const messages=[{id:"m1",thread_id:"t1",sender_id:"person_2",sender_name:"Person #2",text:"Cross-browser message",created_at:"2026-09-01T12:00:00Z",read_by:["person_2"],reactions:{"👍":["person_1"]}}];const hass={user:{id:"person_1",name:"Person #1",is_admin:true},locale:{language:"en-US"},states:{},connection:{subscribeMessage:async()=>()=>{}},callWS:async msg=>msg.type==="hassenger/diagnostics"?{integration_version:"1.0.0"}:msg.type==="hassenger/threads/list"?threads:msg.type==="hassenger/messages/list"?messages:msg.type==="hassenger/contacts/list"?[{id:"person_1",name:"Person #1"},{id:"person_2",name:"Person #2"}]:[]};const card=document.createElement("hassenger-card");document.body.append(card);card.setConfig({data_source:"hassenger",preset:"rgb",show_contacts:true,contacts_default_open:innerWidth>600,contacts_placement:"right",contacts_separate_windows:true,density:"auto"});card.hass=hass;await sleep(100);const surface=card.shadowRoot.querySelector("ha-card"),rect=surface.getBoundingClientRect();const editor=document.createElement("hassenger-card-editor");document.body.append(editor);editor.setConfig({data_source:"hassenger"});await sleep(20);editor.shadowRoot.querySelector('[data-editor-mode="advanced"]').click();await sleep(20);return {overflow:surface.scrollWidth-surface.clientWidth,left:rect.left,right:rect.right,viewport:innerWidth,bubble:!!card.shadowRoot.querySelector(".bubble"),advanced:!editor.shadowRoot.querySelector('[data-editor-section="typography"]').hidden};});
      results.push({browser:name,width:viewport.width,...geometry,errors});await page.close();console.log(`  ${name} ${viewport.width}px passed`);
    }
    await browser.close();
  }
  for(const result of results){assert.ok(result.overflow<=1,JSON.stringify(result));assert.ok(result.left>=-1&&result.right<=result.viewport+1,JSON.stringify(result));assert.ok(result.bubble&&result.advanced,JSON.stringify(result));assert.deepEqual(result.errors,[],JSON.stringify(result));}
  console.log(JSON.stringify(results,null,2));console.log(`${[...requested].join(", ")} mobile/desktop smoke checks passed.`);
})().catch(error=>{console.error(error);process.exit(1);});
