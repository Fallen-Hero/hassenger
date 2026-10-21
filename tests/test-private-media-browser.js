const { chromium } = require("playwright");
const path = require("path"), assert = require("assert");

(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  await page.setContent("<!doctype html><body></body>");
  await page.addScriptTag({path:path.resolve(process.argv[2])});
  const result = await page.evaluate(async()=>{
    const card = document.createElement("hassenger-card");
    document.body.append(card);
    const url = "/api/hassenger/media/file/" + "a".repeat(32) + ".gif";
    const calls=[];
    card._render=()=>{};
    card._hass={user:{id:"member"},fetchWithAuth:async(value, options)=>{
      calls.push({value,options});
      return new Response("GIF89a",{status:200,headers:{"Content-Type":"image/gif"}});
    }};
    const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
    const initial=card._attachmentDisplayUrl({url});
    await wait();
    const resolved=card._attachmentDisplayUrl({url});
    const rendered=card._attachmentHtml({url,name:"Private",content_type:"image/gif"});
    const blobBytes=await (await fetch(resolved)).text();
    card._clearResolvedMedia();
    let revoked=false;try{await fetch(resolved);}catch(_){revoked=true;}
    card._hass.fetchWithAuth=async()=>new Response("Denied",{status:403});
    card._attachmentDisplayUrl({url});await wait();
    const denied=card._attachmentHtml({url,name:"Private",content_type:"image/gif"});
    card._clearResolvedMedia();
    let finish;
    card._hass.fetchWithAuth=()=>new Promise(resolve=>finish=resolve);
    card._attachmentDisplayUrl({url});
    // A pending download must not survive logout/account switch/disconnection.
    card.remove();
    finish(new Response("GIF89a",{status:200}));await wait();
    return {initial,resolved,rendered,blobBytes,revoked,denied,calls,cachedAfterDisconnect:card._resolvedMedia.size};
  });
  assert.equal(result.initial,"");
  assert.match(result.resolved,/^blob:/);
  assert.match(result.rendered,/blob:/);
  assert.equal(result.blobBytes,"GIF89a");
  assert.equal(result.revoked,true);
  assert.match(result.denied,/could not be loaded/);
  assert.equal(result.cachedAfterDisconnect,0);
  assert.equal(result.calls.length,1);
  assert.equal(result.calls[0].options.cache,"no-store");
  await browser.close();
  console.log("Private media uses authenticated downloads, handles denials, revokes blobs and discards stale account responses.");
})().catch(error=>{console.error(error);process.exit(1);});
