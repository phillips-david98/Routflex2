// Isolated UI regression: no real accounts, sessions, customers or business APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const artifacts = process.env.ROUTFLEX_QA_ARTIFACT_DIR
  ? path.resolve(process.env.ROUTFLEX_QA_ARTIFACT_DIR)
  : path.resolve(root, '../.tmp/planning-finalization-01/browser');
const customers = Array.from({ length: Number(process.env.MANIFEST_CLIENT_COUNT || 800) }, (_, i) => ({
  id: 9600 + i, client_id: `TOOLBAR-QA-${i}`, name: `Toolbar QA ${i}`, ddd: 65,
  driver_base: 'MOT-CBA-01', lat: i<6 ? -15.59+i*.006 : -25+i*.0001, lon: i<6 ? -56.12+i*.004 : -45+i*.0001,
  city: 'Cuiabá', curva: 'C', frequencia: 'Mensal', dia: i < 3 ? 'SEG' : 'TER', semana: 1, status: 'ATIVO'
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
      snapshotClients: customers.map((c,i)=>({id:c.client_id+'-w1',customerKey:'CRM||'+c.client_id,driverId:'D1',day:i<3?'SEG':'TER',week:1,sequence:i%3+1})),
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
    await page.waitForFunction(() => typeof state !== 'undefined' && state.clients.length >= 6
      && window.ROUTFLEX_PLANNING_AUTH?.isReady());
    await page.locator('#entry-screen').waitFor({ state: 'hidden' });
    fs.mkdirSync(artifacts, { recursive: true });
    await page.locator('#mode-switcher [data-mode="operational"]').click();
    await page.locator('#day-buttons .chip-button').first().waitFor();
    await page.locator('#toggle-instruments-btn').click();
    await page.waitForTimeout(600);
    const checks = [], roadRequests = [], interactionMs = [];
    let sequenceFailure = false;
    await context.route('https://router.project-osrm.org/**', async route => {
      const url = new URL(route.request().url());
      const coordinates = url.pathname.split('/driving/')[1].split(';').map(s => s.split(',').map(Number));
      roadRequests.push(coordinates);
      if (sequenceFailure) return route.fulfill({ json: { code: 'NoRoute', routes: [] } });
      const km = coordinates[0][0] < -56.11 ? 11 : 20.4;
      return route.fulfill({ json: { code: 'Ok', routes: [{ distance: km * 1000, duration: 900,
        geometry: { coordinates }, legs: coordinates.slice(1).map(() => ({ distance: km * 1000 / (coordinates.length - 1), duration: 450 })) }] } });
    });
    const data = () => page.evaluate(() => JSON.stringify({ clients: state.clients.map(c=>Object.fromEntries(['id','customerKey','lat','lon','driverId','day','week','sequence','curva','frequencia','serviceTime','window','vehicle','priority'].map(key=>[key,c[key]]))), drivers: state.drivers,
      session: state.activePlanningSessionId, dirty: state.hasUnsavedPlanChanges }));
    await page.evaluate(() => { state.hasUnsavedPlanChanges = true; });
    const before = await data();
    const snapshot = async name => {
      await page.mouse.move(5, 5); await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(artifacts, name + '.png') });
    };
    const focusMap = () => page.locator('#map').focus();
    const escape = async () => { await focusMap(); await page.keyboard.press('Escape'); };
    const pickRoute = async day => {
      const routeId = await page.evaluate(day => getRouteGroupsSafe().find(r => r.day === day)?.routeId, day);
      assert.ok(routeId, 'route exists: ' + day);
      await page.evaluate(id => { state.selectedRouteId = id; applyFilters({ skipFitBounds: true }); }, routeId);
      return routeId;
    };

    await pickRoute('SEG');
    const target = async (marker = false) => page.evaluate(marker => {
      const entry=_polylineRegistry.get(getRouteGroupsSafe().find(r=>r.day==='SEG').routeId);
      const p=entry.polyline.getLatLngs(),a=p[0],b=p[1];
      const q=map.latLngToContainerPoint(marker?a:[(a.lat+b.lat)/2,(a.lng+b.lng)/2]);
      const r=map.getContainer().getBoundingClientRect();return {x:r.x+q.x,y:r.y+q.y};
    },marker);
    const checkOpen = async label => {
      const pos=await target();await page.mouse.dblclick(pos.x,pos.y,{delay:100});
      await page.waitForFunction(()=>document.getElementById('logistics-manifest-dialog').open,{},{timeout:5000});
      assert.match(await page.locator('#logistics-manifest-dialog-title').innerText(),/SEG/);
      await snapshot(label);await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.getElementById('logistics-manifest-dialog').open);
      checks.push(label);
    };
    for(const layout of ['normal','expanded']) {
      if(layout==='expanded')await page.locator('#toggle-manual-mode-btn').click();
      await page.evaluate(()=>{map.fitBounds(state.clients.filter(c=>c.day==='SEG').map(c=>[c.lat,c.lon]),{padding:[120,150],animate:false});});
      await page.waitForTimeout(400);
      await checkOpen('manifest-'+layout);
      for(const tool of ['lasso','ruler','swap']) {
        await page.locator('#toggle-'+tool+'-btn').click();
        if(tool==='ruler')await page.locator('#ruler-straight-mode-btn').click();
        if(tool==='lasso') {
          const box=await page.locator('#map').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.35);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.4,{steps:4});
          await page.keyboard.press('Escape');await page.mouse.up();
        } else await escape();
        assert.equal(await page.evaluate(()=>!state.lassoModeActive&&!state.lassoDrawingActive&&!state.rulerModeActive&&!state.swapModeActive&&!state.dragClientId&&!state.lassoGroupDragActive),true);
        assert.equal(await page.evaluate(()=>state.manualPlanningMode),layout==='expanded');
        await checkOpen('after-'+tool+'-'+layout);
      }
      await page.evaluate(async()=>{await fetchRoadRoute({skipFitBounds:true});});
      await page.waitForFunction(()=>!!roadRouteLayer);
      await page.waitForTimeout(400);
      await checkOpen('road-manifest-'+layout);
      await page.evaluate(()=>{clearRoadRoute();});
      const markerPos=await target(true);await page.mouse.dblclick(markerPos.x,markerPos.y,{delay:100});
      assert.equal(await page.locator('#logistics-manifest-dialog').evaluate(el=>el.open),false,'marker keeps priority over route');
      if(await page.locator('.pdv-popup-close').isVisible())await page.locator('.pdv-popup-close').click();
      await escape();
      checks.push('marker-priority-'+layout);
    }
    assert.equal(await data(),before,'clients, drivers, session and dirty flag preserved');
    assert.equal(connectedFixture.writeCount(),0);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
    const result={clientCount:customers.length,checks,errors,consoleErrors,failedResources,businessWrites:connectedFixture.writeCount(),dataPreserved:true};
    fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
