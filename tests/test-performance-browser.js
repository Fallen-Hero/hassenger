const { chromium } = require("playwright");
const path = require("path"), assert = require("assert");

(async()=>{
  const browser=await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page=await browser.newPage({viewport:{width:1100,height:900}});
  await page.setContent("<!doctype html><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444}</style>");
  await page.addScriptTag({path:path.resolve(process.argv[2])});
  const result=await page.evaluate(async()=>{
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const messages=Array.from({length:200},(_,i)=>({id:`m${i}`,thread_id:"t1",sender_id:i%2?"u1":"u2",sender_name:i%2?"Person #1":"Person #2",text:`Message ${i}`,type:"text",created_at:new Date(Date.UTC(2026,7,30,0,i)).toISOString(),read_by:["u1","u2"],reactions:{}}));
    let subscriber;const calls=[];
    const hass={user:{id:"u1",name:"Person #1",is_admin:true},states:{},locale:{language:"en"},connection:{subscribeMessage:async cb=>{subscriber=cb;return()=>{};}},callWS:async msg=>{calls.push(msg.type);if(msg.type==="hassenger/threads/list")return[{id:"t1",title:"Performance chat",participants:["u1","u2"],unread:0,last_message:messages.at(-1)}];if(msg.type==="hassenger/messages/list")return messages.slice(-msg.limit);if(msg.type==="hassenger/diagnostics")return{integration_version:"2.1.7"};if(msg.type==="hassenger/messages/send"){const sent={id:`m${messages.length}`,thread_id:"t1",sender_id:"u1",sender_name:"Person #1",text:msg.text,type:"text",created_at:new Date().toISOString(),read_by:["u1"],reactions:{}};messages.push(sent);subscriber?.({kind:"message_sent",thread_id:"t1",message_id:sent.id,sender_id:"u1",sender_name:"Person #1",text:sent.text,message_type:"text"});return sent;}return null;}};
    const config={type:"custom:hassenger-card",data_source:"hassenger",show_inbox:true,preserve_chat_height:true,chat_height:320,persistent_profiles:Array.from({length:6},(_,i)=>({match_name:`Person #${i+1}`,alignment:"auto"})),header_entities:Array.from({length:10},(_,i)=>({entity:`sensor.item_${i}`,name:`Item ${i}`})),quick_messages:Array.from({length:12},(_,i)=>({label:`Quick ${i}`,message:`Message ${i}`,group:i<6?"People":"Tools"}))};
    const card=document.createElement("hassenger-card");document.body.append(card);card.setConfig(config);card.hass=hass;await sleep(80);
    let renderCount=0;const originalRender=card._render.bind(card);card._render=(...args)=>{renderCount++;return originalRender(...args);};
    const start=performance.now();for(let i=0;i<30;i++)card.setConfig(config);const synchronousConfigMs=performance.now()-start,immediateRenders=renderCount;await sleep(35);const coalescedRenders=renderCount;

    const editor=document.createElement("hassenger-card-editor");document.body.append(editor);editor.setConfig(config);editor.hass={...hass,callWS:async msg=>msg.type==="hassenger/users/list"?Array.from({length:12},(_,i)=>({id:`u${i}`,name:`Person #${i+1}`})):msg.type==="hassenger/threads/list"?[{id:"t1",title:"Performance chat"}]:[]};await sleep(50);
    const summary=editor.shadowRoot.querySelector(".editor>details>summary"),subsection=editor.shadowRoot.querySelector(".editor-subsection"),toggle=editor.shadowRoot.querySelector(".setting-toggle");
    let editorChanges=0,previewConfigMs=0;editor.addEventListener("config-changed",event=>{editorChanges++;const previewStart=performance.now();card.setConfig(event.detail.config);previewConfigMs+=performance.now()-previewStart;});const title=editor.shadowRoot.querySelector('input[data-path="title"]');const editStart=performance.now();for(let i=0;i<20;i++){title.value=`Title ${i}`;title.dispatchEvent(new Event("change",{bubbles:true}));}const synchronousEditorMs=performance.now()-editStart,renderAfterEditorImmediate=renderCount;await sleep(35);const renderAfterEditorSettled=renderCount;

    calls.length=0;const composer=card.shadowRoot.querySelector("textarea");composer.value="Fast response test";composer.dispatchEvent(new Event("input",{bubbles:true}));await card._send(card._selected);await sleep(25);const sendCalls=[...calls],newest=card._backendMessages.at(-1)?.text;
    return {synchronousConfigMs,immediateRenders,coalescedRenders,synchronousEditorMs,previewConfigMs,editorOwnMs:synchronousEditorMs-previewConfigMs,editorChanges,editorRenderDeltaImmediate:renderAfterEditorImmediate-coalescedRenders,editorRenderDeltaSettled:renderAfterEditorSettled-coalescedRenders,summaryHeight:summary.getBoundingClientRect().height,subsectionPadding:getComputedStyle(subsection).padding,toggleMinHeight:getComputedStyle(toggle).minHeight,sendCalls,newest,renderCount};
  });
  console.log(JSON.stringify(result,null,2));
  assert.ok(result.synchronousConfigMs<200,`30 duplicate preview echoes blocked for ${result.synchronousConfigMs}ms`);assert.equal(result.immediateRenders,0);assert.equal(result.coalescedRenders,0);
  assert.ok(result.synchronousEditorMs<75,`20 editor commits blocked for ${result.synchronousEditorMs}ms`);assert.equal(result.editorChanges,20);assert.equal(result.editorRenderDeltaImmediate,0);assert.equal(result.editorRenderDeltaSettled,1);
  assert.ok(result.summaryHeight<=42);assert.equal(result.subsectionPadding,"8px");assert.equal(result.toggleMinHeight,"38px");
  assert.deepEqual(result.sendCalls,["hassenger/typing","hassenger/typing","hassenger/messages/send"]);assert.equal(result.newest,"Fast response test");
  console.log("Editor compactness, non-blocking coalesced preview updates, and single-request message response passed.");
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
