const { chromium } = require("playwright");
const path = require("path");
const assert = require("assert");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.HASSENGER_BROWSER_PATH ? { executablePath: process.env.HASSENGER_BROWSER_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await page.setContent("<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><style>:root{--primary-color:#03a9f4;--card-background-color:#181818;--primary-text-color:#fff;--secondary-text-color:#aaa;--divider-color:#444;--error-color:#f44336}body{margin:0}</style>");
  await page.addScriptTag({ path: path.resolve(process.argv[2]) });
  const result = await page.evaluate(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const thread = { id:"thread_1", title:"Person #1 and Person #2", participants:["person_1","person_2"], icon:"mdi:message", unread:0 };
    const calls = [];
    const hass = {
      connected:false,
      user:{id:"person_1",name:"Person #1",is_admin:true}, locale:{language:"en-US"}, states:{},
      connection:{connected:false,subscribeMessage:async()=>()=>{}},
      callWS:async msg=>{calls.push(msg);if(msg.type==="hassenger/diagnostics")return {integration_version:"2.2.1"};if(msg.type==="hassenger/contacts/list")return [{id:"person_1",name:"Person #1"},{id:"person_2",name:"Person #2"}];if(msg.type==="hassenger/threads/list")return [];if(msg.type==="hassenger/messages/list")return [];if(msg.type==="hassenger/messages/send")throw new Error("network unavailable");return null;}
    };
    const card=document.createElement("hassenger-card");document.body.append(card);card.setConfig({data_source:"hassenger",show_header:false,show_contacts:false,show_search:true,density:"compact"});card.hass=hass;await sleep(80);
    const root=card.shadowRoot;
    const initial={
      defaultHistory:window.HassengerCardUtils.DEFAULTS.history_days,
      density:card._config.density,
      offline:!!root.querySelector(".connection-warning"),
      firstConversation:!!root.querySelector(".first-conversation"),
      footerNew:!!root.querySelector('footer [data-action="new-thread"]'),
      footerArchive:!!root.querySelector('footer [data-action="archived"]')
    };
    card._backendThreads=[thread];card._selectedThreadId=thread.id;card._backendReady=true;card._backendMessages=[];card._searchOpen=true;card._search="missing";card._hasOlderMessages=true;card._render();
    const search={placeholder:root.querySelector(".search-row input")?.placeholder,empty:root.querySelector(".search-empty")?.textContent.trim()};
    card._drafts[thread.id]="draft survives";await card._send();
    const sendFailure={draft:card._drafts[thread.id],visible:!!root.querySelector(".composer-status.error"),retry:!!root.querySelector("[data-retry-send]")};
    hass.fetchWithAuth=(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener("abort",()=>reject(new DOMException("canceled","AbortError")),{once:true}));
    const pendingUpload=card._uploadAttachment(new File([new Uint8Array([71,73,70,56,57,97])],"photo.gif",{type:"image/gif"}),0);await sleep(10);
    const upload={visible:!!root.querySelector(".composer-status.uploading"),cancel:!!root.querySelector("[data-cancel-upload]")};root.querySelector("[data-cancel-upload]").click();await pendingUpload;upload.cleared=!card._uploadingAttachment[thread.id]&&!card._uploadControllers[thread.id];
    const cleanup={identityHidden:!root.querySelector('.send-identity'),headerClearAbsent:!root.querySelector('header [data-action="clear"]'),menuClearPresent:!!root.querySelector('[data-thread-action="clear"]')};
    card.setConfig({...card._config,show_send_identity:true});await sleep(30);cleanup.identityOptIn=!!root.querySelector('.send-identity');
    root.querySelector('.thread-menu summary').click();await sleep(10);document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));cleanup.outsideClosed=!root.querySelector('.thread-menu').open;
    const previousWS=hass.callWS;hass.callWS=async msg=>{if(msg.type==='hassenger/users/list')return [{id:'person_1',name:'Person #1'},{id:'person_2',name:'Person #2'}];if(msg.type==='hassenger/thread/update'){calls.push(msg);thread.title=msg.title;return thread;}return previousWS(msg);};
    await card._handleThreadAction('edit');await sleep(10);cleanup.editVisible=!!root.querySelector('[data-new-title]');cleanup.historyWarning=root.querySelector('.thread-dialog')?.textContent.includes('entire existing history');cleanup.appearanceHidden=getComputedStyle(root.querySelector('.thread-dialog .dialog-grid')).display==='none';
    const titleField=root.querySelector('[data-new-title]');titleField.value='Renamed conversation';titleField.dispatchEvent(new Event('input',{bubbles:true}));await card._createThreadFromDialog();cleanup.saved=calls.some(call=>call.type==='hassenger/thread/update'&&call.thread_id===thread.id&&call.title==='Renamed conversation'&&call.participants.length===2);card._backendThreads=[thread];card._render();
    window.__cleanupResult=cleanup;
    card._showConversationInfo(thread);await sleep(20);
    const info={text:root.querySelector(".action-dialog")?.textContent||"",cancel:!!root.querySelector(".action-dialog [data-dialog-cancel]")};

    const editor=document.createElement("hassenger-card-editor");document.body.append(editor);editor.hass=hass;editor.setConfig({data_source:"hassenger",title:"Custom",density:"compact"});await sleep(30);
    const appearance=editor.shadowRoot.querySelector('[data-editor-section="appearance"]');appearance.open=true;appearance.dispatchEvent(new Event("toggle"));await sleep(20);
    const basic={mode:editor._editorMode,advancedHidden:editor.shadowRoot.querySelector('[data-editor-section="typography"]')?.hidden,previewAbsent:!editor.shadowRoot.querySelector('[data-editor-section="preview"]'),modified:!!editor.shadowRoot.querySelector('[data-editor-section="basics"] .modified-badge'),density:editor.shadowRoot.querySelector('[data-path="density"]')?.value};
    const settingsSearch=editor.shadowRoot.querySelector('[data-editor-search]');settingsSearch.value="bubble borders";settingsSearch.dispatchEvent(new Event("input",{bubbles:true}));await sleep(20);const searchEditor={query:editor._editorSearch,typographyVisible:!editor.shadowRoot.querySelector('[data-editor-section="typography"]')?.hidden,borderField:!!editor.shadowRoot.querySelector('[data-path="typography.bubble_border_style"]')};editor.shadowRoot.querySelector('[data-clear-editor-search]').click();await sleep(20);
    editor.shadowRoot.querySelector('[data-editor-mode="advanced"]').click();await sleep(30);
    const advanced={typographyVisible:!editor.shadowRoot.querySelector('[data-editor-section="typography"]')?.hidden,historyMin:editor.shadowRoot.querySelector('[data-path="history_days"]')?.min,historyMax:editor.shadowRoot.querySelector('[data-path="history_days"]')?.max};
    const beforeReset=editor._config.title;editor.shadowRoot.querySelector('[data-reset-section="basics"]').click();await sleep(20);const afterReset=editor._config.title;editor.shadowRoot.querySelector('[data-editor-undo]').click();await sleep(20);
    const recovery={beforeReset,afterReset,afterUndo:editor._config.title};
    const quickEditor=document.createElement("hassenger-card-editor");document.body.append(quickEditor);quickEditor.setConfig({data_source:"hassenger",quick_messages:[{label:"Hello",message:"Hello",group:"General"}]});await sleep(20);quickEditor._loadedSections.add("composer");quickEditor._openSections.add("composer");quickEditor._render();quickEditor.shadowRoot.querySelector('[data-remove-quick]').click();await sleep(10);const removed=quickEditor._config.quick_messages.length;quickEditor.shadowRoot.querySelector('[data-editor-undo]').click();await sleep(10);const restored=quickEditor._config.quick_messages.length;
    return {initial,search,sendFailure,upload,info,basic,searchEditor,advanced,recovery,collectionUndo:{removed,restored}};
  });
  const cleanup=await page.evaluate(()=>window.__cleanupResult);
  assert.deepEqual(cleanup,{identityHidden:true,headerClearAbsent:true,menuClearPresent:true,identityOptIn:true,outsideClosed:true,editVisible:true,historyWarning:true,appearanceHidden:true,saved:true});
  console.log(JSON.stringify({cleanup},null,2));
  await browser.close();
  assert.equal(result.initial.defaultHistory,0);assert.equal(result.initial.density,"compact");assert.ok(result.initial.offline&&result.initial.firstConversation&&result.initial.footerNew&&result.initial.footerArchive);
  assert.equal(result.search.placeholder,"Search loaded messages");assert.match(result.search.empty,/No loaded messages match/);assert.match(result.search.empty,/Older messages/);
  assert.deepEqual(result.sendFailure,{draft:"draft survives",visible:true,retry:true});assert.deepEqual(result.upload,{visible:true,cancel:true,cleared:true});
  assert.match(result.info.text,/Conversation information/);assert.match(result.info.text,/Person #1[\s\S]*Person #2/);assert.equal(result.info.cancel,false);
  assert.deepEqual(result.basic,{mode:"basic",advancedHidden:true,previewAbsent:true,modified:true,density:"compact"});assert.equal(result.advanced.typographyVisible,true);assert.equal(result.advanced.historyMin,"0");assert.equal(result.advanced.historyMax,"3650");
  assert.deepEqual(result.searchEditor,{query:"bubble borders",typographyVisible:true,borderField:true});
  assert.deepEqual(result.recovery,{beforeReset:"Custom",afterReset:"",afterUndo:"Custom"});assert.deepEqual(result.collectionUndo,{removed:0,restored:1});
  console.log(JSON.stringify(result,null,2));console.log("Release recovery states, editor modes/search/reset/undo, density, history/search clarity, and management access passed.");
})().catch(error=>{console.error(error);process.exit(1);});
