const {chromium}=require("playwright");
const assert=require("assert");
const path=require("path");
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.HASSENGER_BROWSER_PATH?{executablePath:process.env.HASSENGER_BROWSER_PATH}:{})});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce"});
    await page.setContent("<style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444}body{margin:0}</style>");
    await page.addScriptTag({path:path.resolve(process.argv[2])});
    const result=await page.evaluate(async()=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms)),calls=[];
      const thread={id:"t1",title:"Group",participants:["person_1","person_2","person_3","person_4"]};
      const hass={user:{id:"person_1",name:"Person #1"},states:{},connection:{subscribeMessage:async()=>()=>{}},callWS:async m=>{calls.push(m);return m.type==="hassenger/threads/list"?[thread]:m.type==="hassenger/messages/list"?[]:m.type==="hassenger/diagnostics"?{integration_version:"1.0.0"}:[];}};
      const card=document.createElement("hassenger-card");document.body.append(card);card.setConfig({data_source:"hassenger",preset:"rgb"});card.hass=hass;await sleep(100);
      const root=card.shadowRoot,field=root.querySelector("textarea"),height=root.querySelector("footer").getBoundingClientRect().height;
      field.focus();field.value="private draft";field.dispatchEvent(new Event("input",{bubbles:true}));field.dispatchEvent(new Event("input",{bubbles:true}));
      const sent=calls.filter(m=>m.type==="hassenger/typing");
      const receive=(id,name,typing=true)=>card._handleBackendUpdate({kind:"typing",thread_id:"t1",sender_id:id,sender_name:name,typing});
      receive("person_2","Person #2");
      const label=()=>root.querySelector("[data-typing-label]").textContent;
      const single=label(),sameField=root.querySelector("textarea")===field,stableHeight=height===root.querySelector("footer").getBoundingClientRect().height;
      receive("person_3","Person #3");const pair=label();receive("person_4","Person #4");const group=label();
      receive("person_2","",false);receive("person_3","",false);receive("person_4","",false);
      receive("stranger","Intruder");receive("person_1","Self");const ignored=label()==="";
      const session=(id,typing)=>card._handleBackendUpdate({kind:"typing",thread_id:"t1",sender_id:"person_2",sender_name:"Person #2",session_id:id,typing});
      session("tab-a",true);session("tab-b",true);session("tab-a",false);
      const multipleSessions=label()==="Person #2 is typing…";session("tab-b",false);
      receive("person_2","<img src=x onerror=alert(1)>");const safe=!root.querySelector(".typing-status img")&&label().includes("<img");
      const reduced=getComputedStyle(root.querySelector(".typing-dots i")).animationName;
      for(const value of card._remoteTyping.values())value.until=0;card._updateTypingIndicator();const expired=label()==="";
      card.setConfig({...card._config,share_typing:false});await sleep(30);const stopped=calls.some(m=>m.type==="hassenger/typing"&&m.typing===false);
      const count=calls.length;card._notifyTyping(true);const privateOff=calls.length===count;
      card.setConfig({...card._config,show_typing:false});await sleep(30);const hidden=!root.querySelector(".typing-status");
      card.remove();const cleaned=card._typingTick===null&&!card._typingIdle;
      return {single,pair,group,sameField,stableHeight,ignored,safe,reduced,expired,stopped,privateOff,hidden,cleaned,sent,multipleSessions};
    });
    assert.equal(result.single,"Person #2 is typing…");assert.equal(result.pair,"Person #2 and Person #3 are typing…");assert.equal(result.group,"Several people are typing…");
    for(const key of ["sameField","stableHeight","ignored","safe","expired","stopped","privateOff","hidden","cleaned","multipleSessions"])assert.equal(result[key],true,key);
    assert.equal(result.reduced,"none");assert.equal(result.sent.length,1);assert.match(result.sent[0].session_id,/^[0-9a-f]{32}$/);assert.deepEqual(Object.keys(result.sent[0]).sort(),["session_id","thread_id","type","typing"]);assert.equal(result.sent[0].typing,true);
    console.log(JSON.stringify(result,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
