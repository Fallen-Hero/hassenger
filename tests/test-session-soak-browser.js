const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const path=require("node:path");

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.HASSENGER_BROWSER_PATH?{executablePath:process.env.HASSENGER_BROWSER_PATH}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1100,height:850}});
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    const duration=Math.max(3000,Math.min(600000,Number(process.env.HASSENGER_SOAK_MS)||3000));
    await page.setContent('<style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444}hassenger-card{display:inline-block;width:360px;vertical-align:top}</style>');
    await page.addScriptTag({path:path.resolve(process.argv[2])});
    const result=await page.evaluate(async duration=>{
      const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),subscriptions=new Set();
      const now=Date.now(),message=index=>({id:"m"+index,thread_id:"t1",sender_id:"person_2",sender_name:"Person #2",text:"Message "+index,created_at:new Date(now+index).toISOString(),read_by:[],reactions:{}});
      let counter=1100,messages=Array.from({length:1100},(_,index)=>message(index)),listCalls=0;
      const hass={user:{id:"person_1",name:"Person #1",is_admin:true},states:{},locale:{language:"en"},connection:{subscribeMessage:async callback=>{subscriptions.add(callback);return ()=>subscriptions.delete(callback);}},callWS:async request=>{
        if(request.type==="hassenger/diagnostics")return {integration_version:"1.0.0"};
        if(request.type==="hassenger/threads/list")return [{id:"t1",title:"Session test",participants:["person_1","person_2"]}];
        if(request.type==="hassenger/messages/list"){listCalls++;await sleep(2);return messages.slice(-201);}
        return request.type==="hassenger/presence/list"?{}:[];
      }};
      const config={data_source:"hassenger",show_contacts:false,show_inbox:false,height_mode:"fixed",height:360};
      const cards=[];
      for(let i=0;i<4;i++){const card=document.createElement("hassenger-card");document.body.append(card);card.setConfig(config);card.hass=hass;cards.push(card);}
      await sleep(100);
      // Verify automatic growth is bounded without needing thousands of expensive initial renders.
      cards[0]._backendMessages=messages.slice();cards[0]._loadedThreadId="t1";cards[0]._nearBottom=true;
      await cards[0]._loadBackendMessages(false);const historyCap=cards[0]._backendMessages.length;
      // Keep the continuous fixture compact so it stresses updates/lifecycle instead of just layout size.
      messages=messages.slice(-100);for(const card of cards)await card._loadBackendMessages();
      const nodeCount=()=>cards.reduce((total,card)=>total+card.shadowRoot.querySelectorAll("*").length,0),baselineNodes=nodeCount();
      const start=performance.now();let cycles=0,peakSubscriptions=subscriptions.size,peakNodes=baselineNodes;
      while(performance.now()-start<duration){
        const added=message(counter++);messages.push(added);messages=messages.slice(-100);
        const event={kind:"message_sent",thread_id:"t1",message_id:added.id,sender_id:"person_2",sender_name:"Person #2",text:added.text,created_at:added.created_at};
        for(const callback of [...subscriptions]){callback(event);callback(event);} // duplicate delivery
        await sleep(20);
        for(const callback of subscriptions)callback({kind:"thread_read",thread_id:"t1",user_id:"person_2",read_at:added.created_at});
        if(cycles%5===0){const card=cards[cycles%cards.length];card.remove();document.body.append(card);await sleep(15);}
        peakSubscriptions=Math.max(peakSubscriptions,subscriptions.size);peakNodes=Math.max(peakNodes,nodeCount());cycles++;
      }
      await sleep(100);
      const liveSubscriptions=subscriptions.size,unique=cards.every(card=>new Set(card._backendMessages.map(item=>item.id)).size===card._backendMessages.length),boundedEvents=cards.every(card=>(card._seenMessageEvents?.size||0)<=512),newest=cards.every(card=>card._backendMessages.at(-1)?.id===messages.at(-1).id),nodes=nodeCount();
      cards.forEach(card=>card.remove());await sleep(100);
      return {durationMs:Math.round(performance.now()-start),cycles,historyCap,liveSubscriptions,remainingSubscriptions:subscriptions.size,peakSubscriptions,unique,boundedEvents,newest,baselineNodes,nodes,peakNodes,listCalls};
    },duration);
    assert.ok(result.cycles>=2);assert.equal(result.historyCap,1000);
    assert.equal(result.liveSubscriptions,4);assert.equal(result.remainingSubscriptions,0);assert.equal(result.peakSubscriptions,4);
    assert.ok(result.unique&&result.boundedEvents&&result.newest,JSON.stringify(result));
    assert.ok(result.nodes<=result.baselineNodes+1000,JSON.stringify(result));
    assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
