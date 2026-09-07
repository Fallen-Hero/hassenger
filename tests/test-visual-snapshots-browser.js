const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const assert = require("assert");
const mdi = require("@mdi/js");
const iconNames=[...new Set([...fs.readFileSync(path.resolve(process.argv[2]),"utf8").matchAll(/mdi:[a-z0-9-]+/g)].map(match=>match[0]))];
const iconPaths=Object.fromEntries(iconNames.map(name=>[name,mdi["mdi"+name.slice(4).split("-").map(part=>part[0].toUpperCase()+part.slice(1)).join("")]||mdi.mdiHelpCircleOutline]));

(async()=>{
  const out=path.resolve(process.env.HASSENGER_SCREENSHOT_DIR||"test-results/visual");fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.HASSENGER_BROWSER_PATH?{executablePath:process.env.HASSENGER_BROWSER_PATH}:{})});
  const scenes=[
    {name:"desktop-modern",viewport:{width:900,height:720},preset:"modern_chat",contacts:true},
    {name:"desktop-rgb-contacts",viewport:{width:1100,height:760},preset:"rgb",contacts:true},
    {name:"mobile-rgb",viewport:{width:390,height:844},preset:"rgb",contacts:false},
    {name:"mobile-retro-contacts",viewport:{width:390,height:844},preset:"retro_messenger",contacts:true},
    {name:"contact-profile-rgb",viewport:{width:430,height:820},preset:"rgb",contacts:true,profile:true},
    {name:"contact-profile-retro",viewport:{width:430,height:820},preset:"retro_messenger",contacts:true,profile:true},
  ];
  const results=[];
  for(const scene of scenes){
    const page=await browser.newPage({viewport:scene.viewport,deviceScaleFactor:1});
    await page.setContent("<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444;--error-color:#f44336;--primary-font-family:Arial,sans-serif}body{margin:20px;background:#101010;font-family:Arial,sans-serif}hassenger-card{display:block;max-width:1000px;margin:auto}</style>");
    await page.evaluate(paths=>{class TestIcon extends HTMLElement{connectedCallback(){const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"),shape=document.createElementNS(svg.namespaceURI,"path");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("width","24");svg.setAttribute("height","24");svg.style.cssText="display:block;width:100%;height:100%;fill:currentColor";shape.setAttribute("d",paths[this.getAttribute("icon")]||"");svg.append(shape);this.replaceChildren(svg);this.style.display="inline-flex";}}if(!customElements.get("ha-icon"))customElements.define("ha-icon",TestIcon);},iconPaths);
    await page.addScriptTag({path:path.resolve(process.argv[2])});
    await page.evaluate(async scene=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));const threads=[{id:"family",title:"Household",participants:["person_1","person_2"],icon:"mdi:account-group",color:"#03a9f4",unread:0,last_message:{text:"Perfect!",created_at:"2026-09-01T22:07:00Z"}}];const messages=[{id:"m1",thread_id:"family",sender_id:"person_2",sender_name:"Person #2",text:"Are we still on for movie night?",created_at:"2026-09-01T22:05:00Z",read_by:["person_2"],reactions:{}},{id:"m2",thread_id:"family",sender_id:"person_1",sender_name:"Person #1",text:"Yes — I’ll bring snacks.",created_at:"2026-09-01T22:06:00Z",read_by:["person_1","person_2"],reactions:{"👍":["person_2"]}},{id:"m3",thread_id:"family",sender_id:"person_2",sender_name:"Person #2",text:"Perfect!",created_at:"2026-09-01T22:07:00Z",read_by:["person_2"],reactions:{}}];const hass={user:{id:"person_1",name:"Person #1",is_admin:true},locale:{language:"en-US"},states:{"person.person_1":{state:"home",attributes:{friendly_name:"Person #1",user_id:"person_1"}},"person.person_2":{state:"not_home",attributes:{friendly_name:"Person #2",user_id:"person_2"}}},connection:{subscribeMessage:async()=>()=>{}},callWS:async msg=>msg.type==="hassenger/diagnostics"?{integration_version:"1.0.0"}:msg.type==="hassenger/threads/list"?threads:msg.type==="hassenger/messages/list"?messages:msg.type==="hassenger/contacts/list"?[{id:"person_1",name:"Person #1",is_self:true,person_entity_id:"person.person_1"},{id:"person_2",name:"Person #2",person_entity_id:"person.person_2"}]:msg.type==="hassenger/presence/list"?{person_1:{mode:"available",available_message:""},person_2:{mode:"automatic",away_message:"Out running errands. I’ll be home around 6—leave me a message and I’ll reply when I’m back. 🛒",share_last_active:true,last_active_at:"2026-09-01T21:42:00Z"}}:{}};const card=document.createElement("hassenger-card");document.body.append(card);card.setConfig({data_source:"hassenger",preset:scene.preset,show_contacts:true,contacts_default_open:scene.contacts,contacts_placement:innerWidth>600?"right":"overlay",contacts_separate_windows:true,contacts_window_gap:12,show_send_identity:false,quick_messages:[{label:"On my way",message:"On my way",group:"General"}],density:"comfortable"});card.hass=hass;await sleep(140);if(scene.profile){card.shadowRoot.querySelector('[data-contact-profile="person_2"]').click();await sleep(80);}},scene);
    const file=path.join(out,`${scene.name}.png`),buffer=await page.locator("hassenger-card").screenshot({path:file});
    const box=await page.locator("hassenger-card").boundingBox();assert.ok(buffer.length>8000,`${scene.name} screenshot is unexpectedly empty`);assert.ok(box.width<=scene.viewport.width,`${scene.name} exceeds viewport`);results.push({scene:scene.name,bytes:buffer.length,width:Math.round(box.width),height:Math.round(box.height),file});await page.close();
  }
  await browser.close();console.log(JSON.stringify(results,null,2));console.log("Sanitized desktop/mobile visual snapshots generated and validated.");
})().catch(error=>{console.error(error);process.exit(1);});
