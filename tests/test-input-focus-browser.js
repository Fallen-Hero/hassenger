const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const path=require("node:path");
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.HASSENGER_BROWSER_PATH?{executablePath:process.env.HASSENGER_BROWSER_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1">');
  await page.addScriptTag({path:path.resolve(process.argv[2])});
  await page.evaluate(async()=>{
   const card=document.createElement("hassenger-card");document.body.append(card);window.focusCard=card;
   card.setConfig({data_source:"hassenger",show_contacts:true,quick_messages:["Hello"],contacts_placement:"overlay"});
   card.hass={user:{id:"person_1",name:"Person #1"},states:{},connection:{subscribeMessage:async()=>()=>{}},callWS:async r=>r.type==="hassenger/diagnostics"?{integration_version:"1.0.0"}:r.type==="hassenger/threads/list"?[{id:"t1",title:"Household",participants:["person_1","person_2"]}]:r.type==="hassenger/messages/list"?[{id:"m1",sender_id:"person_2",sender_name:"Person #2",text:"Hello there",created_at:new Date().toISOString(),read_by:[]}]:r.type==="hassenger/contacts/list"?[{id:"person_2",name:"Person #2"}]:r.type==="hassenger/presence/list"?{}:[]};
   await new Promise(r=>setTimeout(r,100));
  });
  const root=page.locator("hassenger-card");
  async function typeCheck(selector,text){const input=root.locator(selector);await input.click();await page.keyboard.type(text,{delay:5});assert.equal(await input.inputValue(),text,selector);assert.equal(await input.evaluate(e=>e.getRootNode().activeElement===e),true,selector+" lost focus");}
  await typeCheck("[data-composer]","Composer typing");
  await page.evaluate(()=>{const c=window.focusCard,field=c.shadowRoot.querySelector("[data-composer]");field.setSelectionRange(3,3);c._focusComposer(field.dataset.focusKey);c._handleBackendUpdate({kind:"thread_read",thread_id:"t1",user_id:"person_2"});});
  await page.waitForTimeout(80);await page.keyboard.type("X");assert.equal(await root.locator("[data-composer]").inputValue(),"ComXposer typing","Background refresh moved the composer cursor");
  await root.locator('[data-action="search"]').click();
  await typeCheck("[data-action-dialog-value]","Find retained history");
  const isolated=await page.evaluate(()=>!Object.hasOwn(window.focusCard._drafts,"undefined"));assert.ok(isolated,"Dialog typing leaked into composer drafts");
  await page.evaluate(()=>{window.originalSend=window.focusCard._send;window.dialogSends=0;window.focusCard._send=()=>window.dialogSends++;});
  await page.keyboard.press("Enter");assert.equal(await page.evaluate(()=>window.dialogSends),0,"Enter in a dialog must not send a chat message");
  await page.keyboard.press("Backspace");await page.evaluate(()=>window.focusCard._send=window.originalSend);
  await page.evaluate(()=>window.focusCard._handleBackendUpdate({kind:"thread_read",thread_id:"t1",user_id:"person_2"}));
  await page.keyboard.type(" safely",{delay:5});assert.equal(await root.locator("[data-action-dialog-value]").inputValue(),"Find retained history safely");
  await root.locator("[data-action-dialog-cancel]").click();
  await page.evaluate(()=>{const c=window.focusCard;c._searchOpen=true;c._render();});
  await typeCheck(".search-row input","Hello there");
  await root.locator('[data-action="close-search"]').click();
  await root.locator("[data-contacts-toggle]").click();
  await typeCheck("[data-contact-search]","Person #2");
  await page.evaluate(()=>window.focusCard._presence.person_1={share_last_active:true});
  await root.locator("[data-presence-settings]").click();
  assert.ok(await root.locator('[data-presence-field="share_last_active"]').isChecked(),"Opening status must preserve last-used sharing");
  await typeCheck('[data-presence-field="away_message"]',"Away for a while");
  const away=root.locator('[data-presence-field="away_message"]');await away.evaluate(e=>e.setSelectionRange(5,8));
  await page.evaluate(()=>window.focusCard._handleBackendUpdate({kind:"thread_read",thread_id:"t1",user_id:"person_2"}));
  await page.keyboard.type("on");assert.equal(await away.inputValue(),"Away on a while");
  await root.locator("[data-presence-cancel]").click();
  await page.evaluate(()=>{const editor=document.createElement("hassenger-card-editor");document.body.append(editor);editor.setConfig({data_source:"hassenger"});});
  const editor=page.locator("hassenger-card-editor"),search=editor.locator("[data-editor-search]");await search.click();
  const hydratedFocus=await search.evaluate(e=>{const root=e.getRootNode();e.value="m";e.setSelectionRange(1,1);e.dispatchEvent(new Event("input",{bubbles:true}));const next=root.querySelector("[data-editor-search]");return {focused:root.activeElement===next,start:next.selectionStart,end:next.selectionEnd};});
  assert.deepEqual(hydratedFocus,{focused:true,start:1,end:1},"Lazy editor search must retain focus and selection before the next animation frame");
  await page.keyboard.type("icrophone",{delay:0});assert.equal(await search.inputValue(),"microphone");
  await search.evaluate(e=>e.setSelectionRange(0,5));await page.keyboard.type("mega");assert.equal(await search.inputValue(),"megaphone");
  await page.evaluate(()=>{const c=window.focusCard;c._focusComposer(c.shadowRoot.querySelector("[data-composer]").dataset.focusKey);});
  await page.waitForTimeout(80);assert.equal(await search.evaluate(e=>e.getRootNode().activeElement===e),true,"A pending composer focus retry must not steal focus from the editor");
  assert.deepEqual(errors,[]);console.log("Composer, retained-history search, loaded search, Contacts search, status selection and editor search typing/focus checks passed.");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
