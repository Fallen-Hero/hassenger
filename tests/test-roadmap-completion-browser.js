const {chromium} = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.HASSENGER_BROWSER_PATH?{executablePath:process.env.HASSENGER_BROWSER_PATH}:{})});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444}body{margin:0}hassenger-card{display:block;width:390px}</style>');
    await page.addScriptTag({path:path.resolve(process.argv[2])});
    const result=await page.evaluate(async()=>{
      const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),calls=[],subscriptions=new Set(),favorites={},reminders={},presence={person_1:{mode:"available",share_last_active:false},person_2:{mode:"away",share_last_active:true,last_active_at:"2026-09-06T12:00:00+00:00"}},pins=[];
      const baseMessage={id:"m1",thread_id:"t1",sender_id:"person_2",sender_name:"Person #2",text:"Shared note",created_at:new Date().toISOString(),read_by:[],reactions:{}};
      const emit=(event)=>{for(const {user,callback} of subscriptions)if(!event.user_id||event.user_id===user||["activity_updated","presence_updated"].includes(event.kind))callback(event);};
      const makeHass=(user)=>({
        user:{id:user,name:user==="person_1"?"Person #1":"Person #2",is_admin:true},states:{},locale:{language:"en"},
        connection:{subscribeMessage:async callback=>{const entry={user,callback};subscriptions.add(entry);return ()=>subscriptions.delete(entry);}},
        callWS:async request=>{
          calls.push({user,...request});
          if(request.type==="hassenger/diagnostics")return {integration_version:"1.0.0"};
          if(request.type==="hassenger/threads/list")return [{id:"t1",title:"Test conversation",participants:["person_1","person_2"],pinned_message_ids:[...pins]}];
          if(request.type==="hassenger/messages/list")return [{...baseMessage,pinned:pins.includes("m1")}];
          if(request.type==="hassenger/contacts/list")return ["person_1","person_2","person_3"].map((id,index)=>({id,name:"Person #"+(index+1),is_self:id===user}));
          if(request.type==="hassenger/presence/list")return structuredClone(presence);
          if(request.type==="hassenger/favorites/list")return [...(favorites[user]||[])];
          if(request.type==="hassenger/favorites/set"){favorites[user]=request.enabled?[request.target_user_id]:[];emit({kind:"favorites_updated",thread_id:"*",user_id:user});return [...favorites[user]];}
          if(request.type==="hassenger/activity/ping"){if(presence[user]?.share_last_active)emit({kind:"activity_updated",thread_id:"*",user_id:user,last_active_at:"2026-09-06T12:01:00+00:00"});return null;}
          if(request.type==="hassenger/pins/set"){if(request.enabled&&!pins.includes(request.message_id))pins.push(request.message_id);else if(!request.enabled)pins.splice(pins.indexOf(request.message_id),1);emit({kind:"pins_updated",thread_id:"t1"});return null;}
          if(request.type==="hassenger/pins/list")return pins.length?[baseMessage]:[];
          if(request.type==="hassenger/reminders/list")return structuredClone(Object.values(reminders).filter(item=>item.user_id===user));
          if(request.type==="hassenger/reminders/create"){const item={id:"r"+Object.keys(reminders).length,user_id:user,text:request.text,due_at:new Date(Date.now()+60000).toISOString(),state:"pending",repeat_minutes:request.repeat_minutes};reminders[item.id]=item;emit({kind:"reminders_updated",thread_id:"*",user_id:user});return item;}
          if(request.type==="hassenger/reminders/update"){const item=reminders[request.reminder_id];if(item.user_id!==user)throw Error("Denied");if(request.action==="snooze")item.state="pending";else delete reminders[item.id];emit({kind:"reminders_updated",thread_id:"*",user_id:user});return null;}
          return null;
        }
      });
      const config={data_source:"hassenger",show_contacts:true,contacts_default_open:true,contacts_placement:"overlay",preset:"rgb",height_mode:"fixed",height:500};
      const make=async(user)=>{const card=document.createElement("hassenger-card");document.body.append(card);card.setConfig(config);card.hass=makeHass(user);await sleep(100);return card;};
      const a=await make("person_1"),b=await make("person_2"),root=a.shadowRoot;
      const activityBefore=calls.filter(call=>call.type==="hassenger/activity/ping").length;
      a._recordActivity();const optOut=calls.filter(call=>call.type==="hassenger/activity/ping").length===activityBefore;
      a._presence.person_1.share_last_active=true;a._recordActivity();a._recordActivity();
      const throttled=calls.filter(call=>call.type==="hassenger/activity/ping").length===activityBefore+1;
      const activityLabel=[...root.querySelectorAll("[data-last-active-user]")].some(node=>node.textContent.includes("Last used Hassenger"));
      root.querySelector('[data-favorite-user="person_3"]').click();await sleep(100);
      const favoriteBeforeChat=a._favoriteContacts.includes("person_3")&&!calls.some(call=>call.type==="hassenger/direct_thread/open");
      const favoriteIsPrivate=!(b._favoriteContacts||[]).includes("person_3");
      const favoriteFirst=root.querySelector("[data-contact-index]").textContent.includes("Person #3");
      await a._handleMessageAction("pin-message","m1");await sleep(100);
      const pinShared=!!b._backendMessages.find(item=>item.id==="m1")?.pinned;
      let boardOptions;const original=a._showActionDialog.bind(a);a._showActionDialog=async options=>{boardOptions=options;return false;};
      await a._showSharedPins(a._backendThreads[0]);const board=boardOptions.items[0].value==="m1";
      let answers=["Private reminder <script>","1","0"];a._showActionDialog=async()=>answers.shift();
      await a._createReminder();await sleep(80);
      const reminderPrivate=a._reminders.length===1&&b._reminders.length===0&&!a._backendMessages.some(item=>item.text.includes("Private reminder"));
      reminders.r0.state="due";emit({kind:"reminder_due",thread_id:"*",user_id:"person_1",reminder_id:"r0"});await sleep(80);
      const dueBadge=!!root.querySelector('[aria-label="Reminders due"]')&&!b.shadowRoot.querySelector('[aria-label="Reminders due"]');
      answers=["r0","snooze:15"];await a._manageReminders();await sleep(80);
      const snoozed=reminders.r0.state==="pending"&&!root.querySelector('[aria-label="Reminders due"]');
      a._showActionDialog=original;const dialog=a._manageReminders();await sleep(100);
      const escaped=!root.querySelector(".action-dialog script")&&root.querySelector(".action-dialog").textContent.includes("<script>");
      root.querySelector("[data-action-dialog-confirm]").click();await dialog;
      // Every preset must contain star buttons and the due-reminder header at phone width.
      const geometry=[];reminders.r0.state="due";
      for(const width of [240,280,390])for(const preset of ["home_assistant","modern_chat","minimal","terminal","industrial","retro_messenger","midnight","oled","rgb","glass","paper","playful","high_contrast","custom"]){
        a.style.width=width+"px";
        a.setConfig({...config,preset});await a._loadPersonalState(true);await sleep(35);
        const surface=root.querySelector("ha-card"),star=root.querySelector("[data-favorite-user]"),sr=star.getBoundingClientRect(),panel=root.querySelector(".contacts-panel").getBoundingClientRect();
        geometry.push({preset,width,overflow:surface.scrollWidth-surface.clientWidth,starInside:sr.right<=panel.right+1&&sr.left>=panel.left-1});
      }
      a.remove();b.remove();await sleep(50);
      // Approved compact composer: closed by default, group chips, safe draft filling, and optional voice.
      const compact=await make("person_1");const cr=compact.shadowRoot;const checks=[];
      const shortcuts=Array.from({length:35},(_,i)=>({label:"Quick reply "+i,message:"Prepared message "+i,group:i<30?"General":"Assist"}));
      shortcuts.push({label:"L".repeat(160),message:"Long-label message",group:"G".repeat(160)});
      for(const width of [240,390,700])for(const preset of ["home_assistant","modern_chat","minimal","terminal","industrial","retro_messenger","midnight","oled","rgb","glass","paper","playful","high_contrast","custom"]){
        compact.style.width=width+"px";compact._quickOpen=false;compact.setConfig({...config,preset,contacts_placement:width>600?"right":"overlay",quick_messages:shortcuts,show_voice_input:true});await sleep(25);
        const closed=!cr.querySelector(".quick-drawer")&&!!cr.querySelector(".composer [data-quick-toggle]")&&!cr.querySelector("[data-quick-message]");
        cr.querySelector("[data-quick-toggle]").click();await sleep(10);
        const drawer=cr.querySelector(".quick-drawer"),surface=cr.querySelector("ha-card"),voice=cr.querySelector(".voice"),send=cr.querySelector(".send");
        const heading=getComputedStyle(cr.querySelector(".contacts-heading")),header=getComputedStyle(cr.querySelector("header"));
        const d=drawer.getBoundingClientRect(),r=surface.getBoundingClientRect(),v=voice.getBoundingClientRect(),sr=send.getBoundingClientRect();
        const bounded=d.left>=r.left-1&&d.right<=r.right+1&&drawer.scrollWidth<=drawer.clientWidth+1;
        const retro=preset!=="retro_messenger"||(heading.backgroundImage===header.backgroundImage&&heading.color==="rgb(255, 255, 255)");
        cr.querySelector('[data-quick-tab="Assist"]').click();cr.querySelector("[data-quick]").click();await sleep(15);
        const draft=cr.querySelector("[data-composer]").value==="Prepared message 30"&&!cr.querySelector(".quick-drawer");
        checks.push({width,preset,closed,bounded,retro,draft,voiceNextToSend:sr.left>=v.right-1&&sr.left-v.right<15,overflow:surface.scrollWidth-surface.clientWidth});
      }
      compact.setConfig({...config,quick_messages:shortcuts});await sleep(20);
      const voiceHidden=!cr.querySelector(".voice");
      let searchedThread=null;compact._extendedThreadAction=async(action,thread)=>{searchedThread=action+":"+thread.id;};cr.querySelector('[data-action="search"]').click();
      const activeSearch=searchedThread==="search-all:t1"&&!cr.querySelector(".search-row.open");
      compact.remove();await sleep(20);
      // A pending subscription must be cleaned up even if the card is removed before it resolves.
      let finishSubscribe,unsubscribed=0;
      const pending=makeHass("person_1");pending.connection.subscribeMessage=()=>new Promise(resolve=>finishSubscribe=()=>resolve(()=>unsubscribed++));
      const delayed=document.createElement("hassenger-card");document.body.append(delayed);delayed.setConfig(config);delayed.hass=pending;await sleep(0);delayed.remove();finishSubscribe();await sleep(50);
      return {optOut,throttled,activityLabel,favoriteBeforeChat,favoriteIsPrivate,favoriteFirst,pinShared,board,reminderPrivate,dueBadge,snoozed,escaped,geometry,checks,voiceHidden,activeSearch,subscriptions:subscriptions.size,unsubscribed};
    });
    for(const key of ["optOut","throttled","activityLabel","favoriteBeforeChat","favoriteIsPrivate","favoriteFirst","pinShared","board","reminderPrivate","dueBadge","snoozed","escaped"])assert.equal(result[key],true,key);
    for(const item of result.geometry)assert.ok(item.overflow<=1&&item.starInside,JSON.stringify(item));
    for(const item of result.checks)assert.ok(item.closed&&item.bounded&&item.retro&&item.draft&&item.voiceNextToSend&&item.overflow<=1,JSON.stringify(item));
    assert.ok(result.voiceHidden&&result.activeSearch);
    assert.equal(result.subscriptions,0);assert.equal(result.unsubscribed,1);assert.deepEqual(errors,[]);
    console.log(JSON.stringify(result,null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
