// Isolated UI regression: no real accounts, sessions, customers or business APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const artifacts = process.env.ROUTFLEX_QA_ARTIFACT_DIR
  ? path.resolve(process.env.ROUTFLEX_QA_ARTIFACT_DIR)
  : path.resolve(root, '../.tmp/planning-i18n-01/visual');
const customers = Array.from({ length: 3 }, (_, i) => ({
  id: 9600 + i, client_id: `TOOLBAR-QA-${i}`, name: `Toolbar QA ${i}`, ddd: 65,
  driver_base: 'MOT-CBA-01', lat: -15.59 + i * 0.006, lon: -56.12 + i * 0.004,
  city: 'Cuiabá', curva: 'C', frequencia: 'Mensal', dia: 'SEG', semana: 1, status: 'ATIVO'
}));
const writes = [];
const server = http.createServer((req, res) => {
  const pathname=new URL(req.url, 'http://localhost').pathname;
  if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  const base=pathname.startsWith('/crm/frontend/src/connected/')?path.resolve(root,'..'):root;
  const file = path.resolve(base, '.' + pathname);
  if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript; charset=utf-8'
    : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});
const protectedData = page => page.evaluate(() => JSON.stringify({
  clients: state.clients, drivers: state.drivers, session: state.activePlanningSessionId,
  storage: { ...planningLocalStorage }, dirty: state.hasUnsavedPlanChanges
}));
const geometry = page => page.evaluate(() => {
  const rect = el => {
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  };
  return {
    panels: ['.left-panel', '.right-panel', '#map'].map(s => rect(document.querySelector(s))),
    buttons: [...document.querySelectorAll('.map-command-bar button')].map(el => ({
      id: el.id, label: el.getAttribute('aria-label'), disabled: el.disabled, rect: rect(el)
    }))
  };
});
const hitTargets = page => page.locator('.map-command-bar .command-btn, .map-command-bar .instrument-btn')
  .evaluateAll(buttons => buttons.filter(el => !el.disabled && el.getClientRects().length
    && getComputedStyle(el).visibility === 'visible').map(el => {
    const r = el.getBoundingClientRect();
    return { label: el.getAttribute('aria-label'),
      hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === el };
  }));

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true,
      ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 1854, height: 1022 } });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.port === '3001' && url.pathname === '/customers') {
        const ddd = String(request.headers()['x-session-id'] || '').replace(/\D/g, '');
        const items = ddd === '65' ? customers : [];
        return route.fulfill({ json: { items, pages: 1, total: items.length } });
      }
      if (url.port === '8000' || url.port === '3001') {
        const bulkRead = request.method() === 'POST' && url.pathname === '/planning/customers/ins/bulk';
        if (!['GET', 'HEAD'].includes(request.method()) && !bulkRead) writes.push(`${request.method()} ${url.pathname}`);
        return route.fulfill({ json: { items: [], clients: [] } });
      }
      if (/tile\.openstreetmap/.test(url.hostname)) {
        return route.fulfill({ contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
      }
      if (/osrm|routing\.openstreetmap/.test(url.hostname)) return route.abort();
      if(url.hostname==='unpkg.com' && /leaflet(?:\.css|\.js)$/.test(url.pathname)) return route.fulfill({path:path.join(root,'../.tmp/browser-assets/leaflet-1.9.4'+(url.pathname.endsWith('.css')?'.css':'.js'))}); return route.continue();
    });
    const connectedFixture = await require('./planning-road-layer.fixture.cjs').install(context, {
      customers, insight: c => ({...c,persisted:false,categoria:'',status:'normal',operador:'',moeda:'BRL',faturamento:null,mix_produto:'',concorrente:'',observacoes:[],historico:[],ultima_atualizacao:null,logistics_profile:null}),
      snapshotClients: customers.map((c,i)=>({id:c.client_id+'-w1',customerKey:'CRM||'+c.client_id,driverId:'D1',day:'SEG',week:1,sequence:i+1})),
      snapshotDrivers: [{driverId:'D1',driverName:'Motorista NÃO TRADUZIR',label:'Motorista NÃO TRADUZIR',vehicle:'carro',operationalId:'01',operationalSlotId:'SLOT-65-01',lat:-15.6,lon:-56.1}]
    });
    await require('./integration-read.fixture.cjs').install(context);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      const scope={tenantId:'22222222-2222-4222-8222-222222222222',operationSessionId:'44444444-4444-4444-8444-444444444444',planningSessionId:'ps_manifest_production'};
      if(url.port==='8000'&&url.pathname.endsWith('/history'))return route.fulfill({json:{items:[],total:0}});
      if(url.port==='8000'&&url.pathname.endsWith('/integration-health'))return route.fulfill({json:{version:1,context:{...scope,userId:'11111111-1111-4111-8111-111111111111',membershipId:'33333333-3333-4333-8333-333333333333'},checkedAt:'2026-11-24T12:00:00Z',dependencies:{core:{status:'verified'},planning:{status:'available'},ops:{status:'notApplicable'}},catalog:{status:'available',count:3},synchronizedAt:null,adapters:{status:'notConfigured'}}});
      if(url.port==='8000'&&url.pathname.endsWith('/field-mission-assignees'))return route.fulfill({json:{version:1,...scope,items:[],nextCursor:null}});
      if(url.port==='8000'&&url.pathname.endsWith('/exports/operational')&&route.request().method()==='GET')return route.fulfill({json:{...scope,revision:1,label:'Controlled fixture',profile:'VISITS',weeks:4,occurrenceIds:customers.map(c=>c.client_id+'-w1'),scheduledCount:3,excludedCount:0,savedAt:'2026-11-24T12:00:00Z'}});
      if(url.port==='8000'&&url.pathname.endsWith('/exports/road-metrics')){
        const input=route.request().postDataJSON(),comparison=input.expectedJourney,points=comparison?.points||[];
        const legs=Array.from({length:Math.max(0,points.length-1)},()=>({km:1.7,minutes:5}));
        return route.fulfill({json:{source:'OSRM/driving/route-v1',fingerprint:'a'.repeat(64),calculatedAt:'2026-11-24T12:00:00Z',input:{version:1,...scope,revision:input.expectedRevision,driverId:input.driverId,week:input.week,day:input.day,deliveryDate:input.deliveryDate??null,comparison,waypoints:points},metrics:{legs,km:legs.length*1.7,minutes:legs.length*5}}});
      }
      if(url.hostname==='router.project-osrm.org')return route.fulfill({json:{code:'NoRoute',routes:[]}});
      if (/tile\.|basemaps\.cartocdn\.com/.test(url.hostname)) return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});
      if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) return route.fulfill({contentType:'text/css',body:''});
      return route.fallback();
    });
    await context.addInitScript(() => {
      window.__preferenceWrites=[];
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){window.__preferenceWrites.push(key);return original.call(this,key,value)};
    });
    await context.route('http://localhost:'+server.address().port+'/**',route=>route.continue()); const page = await context.newPage();
    const errors = [];
    const consoleErrors=[],failedResources=[];
    page.on('response',response=>{if(response.status()>=400)failedResources.push({url:response.url(),status:response.status()})});
    page.on('requestfailed',request=>failedResources.push({url:request.url(),failure:request.failure()?.errorText}));
    page.on('pageerror', error => errors.push(error.message)); page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
    let acceptDiscard=false;
    page.on('dialog', dialog => acceptDiscard&&dialog.type()==='confirm'?dialog.accept():dialog.dismiss());
    await page.goto(`http://localhost:${server.address().port}/map.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof state !== 'undefined' && state.clients.length === 3
      && window.ROUTFLEX_PLANNING_AUTH?.isReady());
    await page.locator('#entry-screen').waitFor({ state: 'hidden' });
    fs.mkdirSync(artifacts, { recursive: true });
    await page.locator('#mode-switcher [data-mode="operational"]').click();
    await page.locator('#day-buttons .chip-button').first().waitFor();
    await page.locator('#toggle-instruments-btn').click();
    await page.waitForTimeout(600);
    const measurements=[],focusAuthorityReads=[];
    const requests=[]; page.on('request', r=>requests.push({method:r.method(),url:r.url()}));
    await page.locator('#toggle-lasso-btn').click();
    await page.evaluate(()=>{
      const bounds=L.latLngBounds(state.clients.map(c=>[c.lat,c.lon])).pad(.3);
      beginLassoDraw(bounds.getSouthWest());updateLassoDraw(bounds.getNorthWest());updateLassoDraw(bounds.getNorthEast());updateLassoDraw(bounds.getSouthEast());finishLassoDraw();
    });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>state.lassoSelectionIds.size),3,'production lasso selection');
    await page.evaluate(() => {
      window.__i18nMarkers=[..._markerRegistry.values()];
      window.__i18nBefore={data:JSON.stringify({clients:state.clients,drivers:state.drivers,session:state.activePlanningSessionId,dirty:state.hasUnsavedPlanChanges,selection:[...state.lassoSelectionIds],days:[...state.activeDays],weeks:[...state.activeWeeks]}),zoom:map.getZoom(),center:map.getCenter(),colors:[...document.querySelectorAll('#day-buttons .chip-button')].map(el=>el.style.cssText)};
    });
    const expectations={'pt-BR':['SEG','TER','QUA','QUI','SEX','SÁB','DOM'],es:['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'],en:['MON','TUE','WED','THU','FRI','SAT','SUN']};
    for(const lang of ['pt-BR','es','en','pt-BR']) {
      const settingsRead=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/integration-health'));
      await page.locator('.tool-config').click();
      await page.locator('#planning-settings').waitFor({state:'visible'});
      await settingsRead;
      await page.waitForFunction(()=>document.getElementById('integration-panel')?.getAttribute('aria-busy')==='false');
      const requestCount=requests.length;
      await page.evaluate(()=>{window.__preferenceWrites=[];window.__switchStart=performance.now()});
      await page.locator('#planning-language').selectOption(lang);
      const elapsed=await page.evaluate(()=>performance.now()-window.__switchStart);
      await page.waitForTimeout(150);
      const during=requests.slice(requestCount);
      // Existing focus revalidation may read CORE identity. Never disable or
      // change authentication to make a presentation test pass.
      const authority=entry=>entry.method==='GET'&&/^\/core\/me(?:\/context\/[^/]+)?$/.test(new URL(entry.url).pathname);
      focusAuthorityReads.push(...during.filter(authority));
      assert.deepEqual(during.filter(entry=>!authority(entry)),[],'language change must not send operational requests');
      assert.equal(await page.evaluate(()=>__preferenceWrites.every(key=>key.startsWith('rfx:planning:language:v1:'))),true,'language writes only its preference');
      measurements.push({language:lang,changeMs:elapsed});
      await page.screenshot({path:path.join(artifacts,'settings-'+lang+'.png')});
      await page.locator('.planning-settings-close').click();
      await page.locator('#planning-settings').waitFor({state:'hidden'});
      assert.equal(await page.locator('html').getAttribute('lang'),lang);
      assert.equal(await page.evaluate(()=>document.body.innerText.includes('\uE000')),false,'no message tokens rendered as text');
      assert.deepEqual(await page.locator('#day-buttons .chip-button').allTextContents(),expectations[lang]);
      assert.equal(await page.evaluate(() => JSON.stringify({clients:state.clients,drivers:state.drivers,session:state.activePlanningSessionId,dirty:state.hasUnsavedPlanChanges,selection:[...state.lassoSelectionIds],days:[...state.activeDays],weeks:[...state.activeWeeks]})===window.__i18nBefore.data),true);
      assert.equal(await page.evaluate(() => __i18nMarkers.length>0&&_markerRegistry.size===__i18nMarkers.length&&map.getZoom()===__i18nBefore.zoom&&map.getCenter().equals(__i18nBefore.center)&&[..._markerRegistry.values()].every((m,i)=>m===__i18nMarkers[i])),true);
      assert.equal(await page.evaluate(()=>JSON.stringify([...document.querySelectorAll('#day-buttons .chip-button')].map(el=>el.style.cssText))===JSON.stringify(__i18nBefore.colors)),true);
      await page.screenshot({path:path.join(artifacts,'i18n-'+lang+'.png')});
    }
    // Both layouts share DOM nodes. A switch must preserve the expanded layout.
    await page.locator('#toggle-manual-mode-btn').click();
    for(const language of ['es','en','pt-BR']) {
      await page.evaluate(value=>PlanningI18n.setLanguage(value),language);
      assert.equal(await page.evaluate(()=>document.body.classList.contains('manual-planning-mode')),true);
      assert.deepEqual(await page.locator('#day-buttons .chip-button').allTextContents(),expectations[language]);
      await page.screenshot({path:path.join(artifacts,'expanded-'+language+'.png')});
    }
    await page.locator('#toggle-manual-mode-btn').click();
    // A real editor draft stays open and untouched during language changes.
    await page.evaluate(()=>openDriverEditModal(state.drivers.find(d=>d.id===state.clients[0].driverId).id));
    const name=page.locator('#driver-edit-name-input'); await name.fill('Salvar / Novo / SEG — draft');
    const editor=await name.evaluate(el=>{window.__editorNode=el;return el.closest('dialog')?.id||el.closest('.modal-backdrop')?.id});
    for(const language of ['es','en','pt-BR']) {
      await page.evaluate(value=>PlanningI18n.setLanguage(value),language);
      assert.equal(await name.inputValue(),'Salvar / Novo / SEG — draft');
      assert.equal(await name.evaluate(el=>el===window.__editorNode),true);
      assert.equal(await name.isVisible(),true);
      await page.screenshot({path:path.join(artifacts,'driver-draft-'+language+'.png')});
    }
    acceptDiscard=true;await page.evaluate(()=>closeDriverEditModal());acceptDiscard=false;
    assert.equal(await name.isVisible(),false);
    // Import/overnight dialogs and intelligent routing use newly created markup.
    for(const language of ['pt-BR','es','en']) {
      await page.evaluate(value=>PlanningI18n.setLanguage(value),language);
      await page.evaluate(()=>openImportStartModal());
      await page.screenshot({path:path.join(artifacts,'import-'+language+'.png')});
      await page.evaluate(()=>closeImportStartModal());
      await page.evaluate(()=>PlanningOvernightUI.open());
      assert.deepEqual(await page.locator('#overnight-day option').allTextContents(),expectations[language]);
      assert.deepEqual(await page.locator('#overnight-day option').evaluateAll(nodes=>nodes.map(n=>n.value)),['MON','TUE','WED','THU','FRI','SAT','SUN']);
      await page.screenshot({path:path.join(artifacts,'overnight-'+language+'.png')});
      await page.locator('#overnight-close').click();
      await page.evaluate(()=>getOperationalExportUI().open());
      await page.locator('#operational-export-modal').waitFor({state:'visible'});
      await page.screenshot({path:path.join(artifacts,'export-'+language+'.png')});
      await page.locator('#operational-export-close').click();
      await page.evaluate(()=>ROUTFLEX_DISTRIBUTION_UI.open());
      assert.equal(await page.locator('#planning-distribution-dialog').evaluate(el=>el.open),true,await page.locator('#planner-guidance').textContent());
      await page.locator('#planning-distribution-dialog').waitFor({state:'visible'});
      await page.screenshot({path:path.join(artifacts,'routing-'+language+'.png')});
      await page.locator('#planning-distribution-dialog [data-action="collapse"]').click();
    }
    // Additional existing surfaces, including the same map in all three modes.
    const surfaces=[];
    for(const language of ['pt-BR','es','en']) {
      await page.evaluate(value=>PlanningI18n.setLanguage(value),language);
      for(const mode of ['territorial','analytics','operational']) {
        await page.locator('#mode-switcher [data-mode="'+mode+'"]').click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(()=>document.body.innerText.includes('\uE000')),false);
        await page.screenshot({path:path.join(artifacts,mode+'-'+language+'.png')});
      }
      await page.locator('.tool-config').click();
      await page.locator('#planning-integration-open').click();
      await page.waitForFunction(()=>document.getElementById('integration-panel')?.getAttribute('aria-busy')==='false'&&!!document.querySelector('[data-connected-integration]'));
      await page.screenshot({path:path.join(artifacts,'integration-'+language+'.png')});
      await page.locator('.planning-settings-close').click();
      await page.locator('.tool-metrics').click();
      await page.locator('#planning-metrics-dialog').waitFor({state:'visible'});
      surfaces.push({language,surface:'metrics',text:await page.locator('#planning-metrics-dialog').innerText()});
      await page.screenshot({path:path.join(artifacts,'metrics-'+language+'.png')});
      await page.locator('#planning-metrics-dialog [data-close]').click();
      await page.evaluate(()=>openMaintenanceModal());
      await page.screenshot({path:path.join(artifacts,'maintenance-'+language+'.png')});
      await page.evaluate(()=>closeMaintenanceModal());
    }
    // A reload reads the same tenant/user preference without operational writes.
    await page.evaluate(()=>PlanningI18n.setLanguage('en'));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.ROUTFLEX_PLANNING_AUTH?.isReady()&&typeof state!=='undefined'&&state.clients.length===3);
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.equal(await page.evaluate(()=>PlanningI18n.getLanguage()),'en');
    assert.equal(writes.length,0,JSON.stringify(writes));
    assert.equal(connectedFixture.writeCount(),0,JSON.stringify(connectedFixture.forbiddenWrites));
    const directChangeMs=await page.evaluate(()=>{const start=performance.now();PlanningI18n.setLanguage('es');return performance.now()-start;});
    const result={errors,consoleErrors,failedResources,writes,operationalWriteCount:connectedFixture.writeCount(),focusAuthorityReads,measurements,directChangeMs,reloadLanguage:'en',surfaces,screenshots:fs.readdirSync(artifacts).filter(x=>x.endsWith('.png'))};
    fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
    assert.deepEqual(errors,[]);
    assert.deepEqual(consoleErrors,[]);
    assert.deepEqual(failedResources,[]);
  } finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
