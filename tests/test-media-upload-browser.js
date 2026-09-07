const { chromium } = require("playwright");
const path = require("path"), assert = require("assert");

(async()=>{
  const browser=await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page=await browser.newPage({viewport:{width:430,height:780},isMobile:true,hasTouch:true});
  await page.setContent("<!doctype html><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444}</style>");
  await page.addScriptTag({path:path.resolve(process.argv[2])});
  const result=await page.evaluate(async()=>{
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const calls=[],notices=[];
    let responses=[];
    const hass={
      user:{id:"person_1",name:"Person #1",is_admin:false},states:{},locale:{language:"en"},
      connection:{subscribeMessage:async()=>()=>{}},
      callWS:async msg=>msg.type==="hassenger/threads/list"?[{id:"thread_1",title:"Person #1 & Person #2",participants:["person_1","person_2"]}]:msg.type==="hassenger/messages/list"?[]:msg.type==="hassenger/diagnostics"?{integration_version:"2.1.7"}:[],
      fetchWithAuth:async(url,init)=>{const fields={};for(const [key,value] of init.body.entries())fields[key]=value instanceof File?{name:value.name,type:value.type,size:value.size}:String(value);calls.push({url,method:init.method,fields,hasContentType:new Headers(init.headers||{}).has("content-type")});return responses.shift();}
    };
    const card=document.createElement("hassenger-card");card.addEventListener("hass-notification",event=>notices.push(event.detail.message));document.body.append(card);card.setConfig({type:"custom:hassenger-card",data_source:"hassenger",show_inbox:false});card.hass=hass;await sleep(60);
    const image=new File([new Uint8Array([71,73,70,56,57,97])],"tiny.gif",{type:"image/gif"});

    responses=[new Response(JSON.stringify({media_content_id:"media-source://media_source/local/hassenger/safe.gif",name:"tiny.gif",content_type:"image/gif"}),{status:200,headers:{"content-type":"application/json"}})];
    await card._uploadAttachment(image,card._selected);await sleep(5);
    const firstKey=Object.keys(card._attachmentDrafts)[0],successAttachment=card._attachmentDrafts[firstKey],successNotice=notices.at(-1);

    delete card._attachmentDrafts[firstKey];responses=[new Response("Not found",{status:404}),new Response("Unauthorized",{status:401})];
    await card._uploadAttachment(image,card._selected);const adminOnlyNotice=notices.at(-1);

    responses=[new Response("Conversation not found or access denied",{status:403})];
    await card._uploadAttachment(image,card._selected);const forbiddenNotice=notices.at(-1);

    const beforeOversized=calls.length,oversized={name:"large.gif",type:"image/gif",size:10*1024*1024+1};
    await card._uploadAttachment(oversized,card._selected);const oversizedNotice=notices.at(-1);
    return{version:window.HassengerCardUtils.VERSION,calls,successAttachment,successNotice,adminOnlyNotice,forbiddenNotice,oversizedNotice,oversizedRequests:calls.length-beforeOversized};
  });
  console.log(JSON.stringify(result,null,2));
  assert.equal(result.version,require("../package.json").version);
  assert.deepEqual(result.successAttachment,{url:"media-source://media_source/local/hassenger/safe.gif",content_type:"image/gif",name:"tiny.gif"});
  assert.match(result.successNotice,/ready to send/i);
  assert.equal(result.calls[0].url,"/api/hassenger/media/upload");
  assert.equal(result.calls[0].method,"POST");
  assert.equal(result.calls[0].fields.thread_id,"thread_1");
  assert.equal(result.calls[0].fields.media_content_id,"media-source://media_source/local");
  assert.deepEqual(result.calls[0].fields.file,{name:"tiny.gif",type:"image/gif",size:6});
  assert.equal(result.calls[0].hasContentType,false,"browser must generate the multipart boundary");
  assert.equal(result.calls[1].url,"/api/hassenger/media/upload");
  assert.equal(result.calls[2].url,"/api/media_source/local_source/upload");
  assert.equal(result.calls[2].fields.thread_id,undefined,"the strict Home Assistant fallback must not receive Hassenger-only fields");
  assert.match(result.adminOnlyNotice,/only allows administrators.*update and restart the Hassenger integration/i);
  assert.match(result.forbiddenNotice,/not allowed.*conversation/i);
  assert.match(result.oversizedNotice,/limited to 10 MB/i);
  assert.equal(result.oversizedRequests,0);
  console.log("Mobile authenticated upload, multipart fields, legacy fallback, permission errors, and client size limit tests passed.");
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
