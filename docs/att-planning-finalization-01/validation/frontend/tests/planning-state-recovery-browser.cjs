'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/ROUTflex/.tmp/attack4b1-tools/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'.tmp/planning-state-recovery-01/audit-ui/native');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(root,'map.html'),'utf8');
const extract=name=>{const found=source.match(new RegExp('^(?:async )?function '+name+'\\([^]*?^}','m'));assert.ok(found,name);return found[0];};
const declarations='const PLANNING_AUTOSAVE_STORAGE_PREFIX="ROUTflex:planning:autosave:v1:";\n'+[
  'getPlanningPersistenceSessionId','getPlanningPersistenceEntry','isActivePlanningPersistenceSession','isPlanningAutosaveEnabled',
  'markPlanningPersistenceAsDirty','beginPlanningPersistence','markPlanAsDirty','markPlanAsSaved','markPlanSaveError','restoreConnectedPlanningSnapshot'].map(extract).join('\n');
const modules=['planning-i18n-pt-BR','planning-i18n-es','planning-i18n-en','planning-i18n','palm-contract','planning-snapshot-store','planning-insight-drafts',
  'planning-ins-stage','planning-driver-editors','planning-save-bases','planning-save-coordinator','planning-work-registry','planning-work-registry-v2',
  'planning-work-indexeddb','planning-work-session','planning-work-adapters','planning-work-runtime','planning-work-recovery','planning-local-recovery','planning-save-bridge'];
const css=source.match(/\.planning-recovery-dialog \{[^]*?(?=\s*<\/style>)/)?.[0]||'';
const html='<!doctype html><html><head><meta charset="utf-8"><title>Controlled Planning recovery test</title><style>body{font:15px system-ui;background:#e8eef4;color:#1e293b;padding:24px}.test-banner{max-width:920px;margin:auto;padding:20px;border-radius:12px;background:white}'+css+'</style></head><body><div class="test-banner"><strong>Planning · sessão controlada de teste</strong><p>2.500 clientes sintéticos. Transporte simulado, armazenamento IndexedDB real.</p><div id="hint"></div></div>'+modules.map(name=>'<script src="/js/'+name+'.js"></script>').join('')+'<script src="/declarations.js"></script><script src="/fixture.js"></script></body></html>';
const records=new Map(),writes=[];let browserHandle;
const makeRemote=scenario=>({version:1,revision:14,tenantId:'synthetic-tenant',operationSessionId:'synthetic-operation',savedAt:'2026-11-24T18:00:00Z',savedBy:'synthetic-user',
  session:{sessionId:scenario,planningProfile:'VISITS',cycleLength:4},drivers:[{driverId:'driver-1',label:'Motorista NÃO TRADUZIR A'},{driverId:'driver-2',label:'Motorista NÃO TRADUZIR B'}],routes:[],
  clients:Array.from({length:2500},(_,i)=>({id:'visit-'+i,customerKey:'IMPORT||'+String(i).padStart(6,'0'),week:1,day:'MON',driverId:'driver-1',sequence:i+1}))});
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');res.setHeader('cache-control','no-store');
  if(url.pathname==='/'){res.setHeader('content-type','text/html');return res.end(html);}
  if(url.pathname==='/declarations.js'){res.setHeader('content-type','text/javascript');return res.end(declarations);}
  if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync(path.join(__dirname,'planning-state-recovery-browser.fixture.js')));}
  const name=url.pathname.match(/^\/js\/([a-zA-Z0-9-]+)\.js$/)?.[1];
  if(name&&modules.includes(name)){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync(path.join(root,'js',name+'.js')));}
  if(url.pathname==='/api/snapshot'){
    const scenario=url.searchParams.get('scenario');if(!records.has(scenario))records.set(scenario,makeRemote(scenario));
    if(req.method==='POST'){
      let body='';for await(const chunk of req)body+=chunk;const sent=JSON.parse(body),base=records.get(scenario);
      if(sent.expectedRevision!==base.revision){res.statusCode=409;return res.end(JSON.stringify({code:'SNAPSHOT_REVISION_CONFLICT'}));}
      assert.equal(sent.snapshot.clients.length,2500);assert.equal(sent.snapshot.session.sessionId,scenario);
      records.set(scenario,{...sent.snapshot,revision:base.revision+1,tenantId:base.tenantId,operationSessionId:base.operationSessionId,savedAt:new Date().toISOString(),savedBy:'synthetic-user'});
      writes.push({scenario,revision:base.revision+1,customers:sent.snapshot.clients.length});
    }
    res.setHeader('content-type','application/json');return res.end(JSON.stringify(records.get(scenario)));
  }
  res.statusCode=204;res.end();
}catch(error){res.statusCode=500;res.end(JSON.stringify({code:error.message}));}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://localhost:'+server.address().port;
 const browser=browserHandle=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],confirmations=[],results=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',async dialog=>{confirmations.push(dialog.message());await dialog.accept();});
 const ready=async()=>{await page.waitForFunction(()=>window.ready||window.bootError);const error=await page.evaluate(()=>window.bootError);assert.equal(error,undefined);};
 const reload=async()=>{await page.reload();await ready();};
 const status=()=>page.evaluate(()=>controlled.status());
 for(const [lang,serverLabel,restoreLabel,title]of [['pt-BR','Manter versão do servidor','Recuperar alterações','Recuperação de alterações'],['es','Conservar versión del servidor','Recuperar cambios','Recuperación de cambios'],['en','Keep server version','Restore changes','Recover changes']]){
  const scenario='discard-'+lang;await page.goto(origin+'/?scenario='+scenario+'&lang='+lang);await ready();
  const edited=await page.evaluate(()=>controlled.edit());assert.equal(edited.count,2500);assert.equal(edited.recoveries,0);
  await reload();const before=await status();assert.equal(before.recoveries,1);assert.equal(before.first.day,'MON');
  assert.equal(await page.locator('#planning-recovery-title').textContent(),title);
  assert.equal(await page.getByRole('button',{name:serverLabel,exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:restoreLabel,exact:true}).count(),1);
  assert.equal(await page.locator('tbody tr').count(),0);
  await page.screenshot({path:path.join(out,'recovery-'+lang+'-open.png')});
  await page.locator('.planning-recovery-help').click();await page.screenshot({path:path.join(out,'recovery-'+lang+'-help.png')});
  const reviewStart=await page.evaluate(()=>performance.now());
  await page.locator('[data-recovery-action="review"]').click();await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length>0);
  const reviewWallMs=await page.evaluate(start=>performance.now()-start,reviewStart);
  assert.equal(await page.locator('tbody tr').count(),100);
  await page.screenshot({path:path.join(out,'recovery-'+lang+'-review.png')});
  // Reopen the panel to prove keep-server is independent from a prior preview.
  await page.locator('.planning-recovery-footer button').last().click();await page.evaluate(()=>controlled.open());
  const start=Date.now();await page.getByRole('button',{name:serverLabel,exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog'));
  const decisionWallMs=Date.now()-start;
  const kept=await status();assert.equal(kept.recoveries,0);assert.equal(kept.count,2500);assert.equal(kept.first.day,'MON');
  const browserMetrics=await page.evaluate(()=>({...recoveryBrowserMetrics,maxHeartbeatGapMs:Math.max(0,...recoveryBrowserMetrics.beats.slice(1).map((beat,index)=>beat-recoveryBrowserMetrics.beats[index]))}));
  await reload();const firstReload=await status();assert.equal(firstReload.recoveries,0);
  await reload();const secondReload=await status();assert.equal(secondReload.recoveries,0);assert.equal(secondReload.count,2500);
  const editOne=await page.evaluate(()=>controlled.edit(false));assert.equal(editOne.recoveries,0);
  const saved=await page.evaluate(()=>controlled.save());assert.equal(saved.result,true,JSON.stringify(saved));
  await reload();const final=await status();assert.equal(final.recoveries,0);assert.equal(final.first.week,2);assert.equal(final.revision,15);
  results.push({scenario,language:lang,edited,before,kept,firstReload,secondReload,saved,final,decisionWallMs,reviewWallMs,browserMetrics});
 }
 // A deliberately delayed read proves that the server decision remains clickable.
 await page.goto(origin+'/?scenario=deferred-review&lang=en');await ready();await page.evaluate(()=>controlled.edit());await reload();
 await page.locator('.planning-recovery-footer button').last().click();await page.evaluate(()=>controlled.open(500));
 await page.locator('[data-recovery-action="review"]').click();
 assert.equal(await page.locator('[data-recovery-action="server"]').isEnabled(),true);
 const deferredStarted=Date.now();await page.locator('[data-recovery-action="server"]').click();await page.waitForFunction(()=>!document.querySelector('dialog'));
 const deferredDecisionMs=Date.now()-deferredStarted;await page.waitForTimeout(600);
 assert.equal(await page.locator('dialog').count(),0);assert.equal((await status()).recoveries,0);
 await reload();assert.equal((await status()).recoveries,0);
 results.push({scenario:'deferred-review',reviewDelayMs:500,deferredDecisionMs,lateReviewIgnored:true,customers:2500});
 for(const autosave of ['off','on']){
  const scenario='restore-'+autosave;await page.goto(origin+'/?scenario='+scenario+'&lang=en&autosave='+autosave);await ready();
  await page.evaluate(()=>controlled.edit());await reload();assert.equal((await status()).recoveries,1);
  const countBefore=writes.length,start=Date.now();await page.locator('[data-recovery-action="restore"]').click();await page.waitForFunction(()=>!document.querySelector('dialog'));
  const restoreWallMs=Date.now()-start;
  const restored=await status();assert.equal(restored.count,2500);assert.equal(restored.first.day,'TER');assert.equal(restored.first.week,2);assert.equal(restored.first.driverId,'driver-2');assert.equal(restored.first.sequence,2500);
  assert.equal(restored.persistence.status,'pending');assert.equal(restored.recoveries,0);assert.equal(writes.length,countBefore);
  assert.equal(restored.autosave,false); // Existing recovery protection requires the first manual Save.
  const saved=await page.evaluate(()=>controlled.save());assert.equal(saved.result,true,JSON.stringify(saved));
  await reload();const final=await status();assert.equal(final.recoveries,0);assert.equal(final.count,2500);assert.equal(final.first.day,'TUE');assert.equal(final.revision,15);
  assert.equal(final.autosave,autosave==='on');
  results.push({scenario,autosave,restored,saved,final,restoreWallMs,restoreSaveReloadWallMs:Date.now()-start});
 }
 assert.deepEqual(errors,[]);assert.equal(writes.length,5);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Production UI, work runtime/session/registry/IndexedDB, recovery, snapshot store and Save coordinator/bridge in isolated browser origin; mocked auth and in-memory HTTP server, no DEV tenant or business data. Native page.reload and IndexedDB durability are real.',results,writes,confirmations,errors},null,2));
 console.log(JSON.stringify({scenarios:results.length,screenshots:9,writes:writes.length,errors}));await browser.close();server.close();
})().catch(async error=>{console.error(error);await browserHandle?.close();server.close();process.exitCode=1;});
