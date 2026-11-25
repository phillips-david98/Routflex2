// Isolated UI regression: no real accounts, sessions, customers or business APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const artifacts = process.env.ROUTFLEX_QA_ARTIFACT_DIR
  ? path.resolve(process.env.ROUTFLEX_QA_ARTIFACT_DIR)
  : path.resolve(root, '../.tmp/planning-map-ux-01/visual');
const customers = Array.from({ length: 6 }, (_, i) => ({
  id: 9600 + i, client_id: `TOOLBAR-QA-${i}`, name: `Toolbar QA ${i}`, ddd: 65,
  driver_base: 'MOT-CBA-01', lat: -15.59 + i * 0.006, lon: -56.12 + i * 0.004,
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
    await page.waitForFunction(() => typeof state !== 'undefined' && state.clients.length === 6
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
    const data = () => page.evaluate(() => JSON.stringify({ clients: state.clients, drivers: state.drivers,
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
    await page.locator('#toggle-ruler-btn').click();
    await page.locator('#ruler-sequence-km-mode-btn').click();
    await page.waitForFunction(() => document.getElementById('sequence-km-toast').textContent.includes('11,0 km'));
    for (const lang of ['pt-BR', 'es', 'en']) {
      await page.evaluate(lang => PlanningI18n.setLanguage(lang), lang);
      const expected = { 'pt-BR': 'KM da sequência selecionada: 11,0 km', es: 'Distancia de la secuencia seleccionada: 11,0 km', en: 'Selected sequence distance: 11.0 km' }[lang];
      assert.ok((await page.locator('#sequence-km-toast').innerText()).includes(expected));
      assert.equal(await page.locator('#planner-guidance').evaluate(el => el.open), false);
      await snapshot('sequence-normal-' + lang);
      await page.locator('#toggle-manual-mode-btn').click();
      await snapshot('sequence-expanded-' + lang);
      await escape();
      assert.equal(await page.evaluate(() => state.manualPlanningMode && !sequenceKmModeActive), true);
      assert.equal(await page.locator('#sequence-km-toast').isVisible(), false);
      await page.locator('#toggle-ruler-btn').click(); await page.locator('#ruler-sequence-km-mode-btn').click();
      await page.waitForFunction(() => !document.getElementById('sequence-km-toast').hidden);
      await page.locator('#toggle-manual-mode-btn').click();
      checks.push('sequence visible/localized, Esc and reactivation: ' + lang);
    }
    await pickRoute('TER');
    await page.waitForFunction(() => document.getElementById('sequence-km-toast').textContent.includes('20.4 km'));
    await snapshot('sequence-different-route');
    await pickRoute('SEG');
    await page.waitForFunction(() => document.getElementById('sequence-km-toast').textContent.includes('11.0 km'));
    checks.push('route A → B → A updates total and scope');
    await escape();
    sequenceFailure = true;
    await page.evaluate(() => _roadGeomCache.clear());
    await page.locator('#toggle-ruler-btn').click(); await page.locator('#ruler-sequence-km-mode-btn').click();
    await page.waitForFunction(() => document.getElementById('sequence-km-toast').textContent.includes('distance unavailable'));
    for (const lang of ['pt-BR', 'es', 'en']) {
      await page.evaluate(lang => PlanningI18n.setLanguage(lang), lang);
      await snapshot('sequence-unavailable-' + lang);
      assert.doesNotMatch(await page.locator('#sequence-km-toast').innerText(), /11[,.]0 km|0[,.]0 km/);
    }
    await escape(); sequenceFailure = false;
    checks.push('provider unavailable clears total; localized feedback in all languages');

    // Exercise genuine pointer input and keyboard Escape in both layouts.
    for (const expanded of [false, true]) {
      if (expanded) await page.locator('#toggle-manual-mode-btn').click();
      const layout = expanded ? 'expanded' : 'normal';
      await page.locator('#toggle-ruler-btn').click(); await page.locator('#ruler-straight-mode-btn').click();
      const box = await page.locator('#map').boundingBox();
      await page.mouse.click(box.x + box.width * .5, box.y + box.height * .35);
      await page.mouse.click(box.x + box.width * .62, box.y + box.height * .4);
      assert.equal(await page.evaluate(() => state.rulerPoints.length), 2);
      await snapshot('ruler-active-' + layout);
      await escape();
      assert.equal(await page.evaluate(() => !state.rulerModeActive && !state.rulerPoints.length && !map.getContainer().classList.contains('ruler-mode')), true);
      assert.equal(await page.locator('#toggle-ruler-btn').evaluate(el => el.classList.contains('is-active')), false);
      assert.equal(await page.locator('#ruler-straight-mode-btn').getAttribute('aria-pressed'), 'false');
      await page.locator('#toggle-ruler-btn').click(); await page.locator('#ruler-straight-mode-btn').click();
      assert.equal(await page.evaluate(() => state.rulerModeActive), true); await escape();
      checks.push('ruler pointer points, Esc, cursor/button, reactivation: ' + layout);

      await page.locator('#toggle-lasso-btn').click();
      // Draw a closed contour through genuine mouse input and Leaflet events.
      const contour = await page.evaluate(() => {
        const bounds = L.latLngBounds(state.clients.filter(c => c.day === 'SEG').map(c => [c.lat, c.lon])).pad(.3);
        map.fitBounds(bounds, { animate: false, paddingTopLeft: [280, 170], paddingBottomRight: [90, 180] });
        const origin = map.getContainer().getBoundingClientRect();
        return [bounds.getSouthWest(), bounds.getNorthWest(), bounds.getNorthEast(), bounds.getSouthEast(), bounds.getSouthWest()]
          .map(c => { const p = map.latLngToContainerPoint(c); return { x: p.x + origin.x, y: p.y + origin.y }; });
      });
      await page.mouse.move(contour[0].x, contour[0].y); await page.mouse.down();
      for (const point of contour.slice(1)) await page.mouse.move(point.x, point.y, { steps: 5 });
      await page.mouse.up();
      const selection = await page.evaluate(() => [...state.lassoSelectionIds]);
      assert.equal(selection.length, 3);
      await snapshot('lasso-selected-' + layout);
      const escapedAt = Date.now(); await escape(); interactionMs.push({ layout, lassoEscape: Date.now() - escapedAt });
      assert.equal(await page.evaluate(() => state.lassoModeActive), false);
      assert.deepEqual(await page.evaluate(() => [...state.lassoSelectionIds]), []);
      assert.equal(await page.evaluate(() => lassoSelectionLayer === null), true);
      assert.equal(await page.locator('.is-lasso-selected').count(), 0);
      assert.equal(await page.locator('#toggle-lasso-btn').evaluate(el => el.classList.contains('is-active')), false);
      assert.equal(await page.evaluate(() => map.getContainer().classList.contains('lasso-mode')), false);
      await snapshot('lasso-escaped-' + layout);
      await page.locator('#toggle-lasso-btn').click();
      assert.deepEqual(await page.evaluate(() => [...state.lassoSelectionIds]), [], 'reactivation starts without residual selection');
      await page.locator('#clear-selection-btn').click();
      await page.mouse.move(box.x + box.width * .5, box.y + box.height * .35); await page.mouse.down();
      await page.mouse.move(box.x + box.width * .6, box.y + box.height * .38, { steps: 5 });
      assert.equal(await page.evaluate(() => state.lassoDrawingActive), true);
      await page.keyboard.press('Escape'); await page.mouse.up();
      assert.equal(await page.evaluate(() => !state.lassoModeActive && !state.lassoDrawingActive && !lassoDrawLayer && !state._lassoDocumentMoveHandler && !state._lassoDocumentUpHandler), true);
      checks.push('lasso selection and polygon cleared; pointer draft cancelled; clean reactivation: ' + layout);

      // Completed barriers remain; only the current draft is discarded.
      await page.locator('#toggle-barrier-btn').click();
      await page.evaluate(() => {
        handleBarrierClick({latlng:L.latLng(-15.6,-56.12)}); handleBarrierClick({latlng:L.latLng(-15.59,-56.12)});
        handleBarrierClick({latlng:L.latLng(-15.59,-56.11)}); finishBarrierPolygon();
        handleBarrierClick({latlng:L.latLng(-15.6,-56.10)});
      });
      const barriers = await page.evaluate(() => state.barriers.length);
      await escape();
      assert.equal(await page.evaluate(() => !state.barrierMode && !state.barrierDrawPoints.length && !state.barrierDrawLayer), true);
      assert.equal(await page.evaluate(() => state.barriers.length), barriers);
      await page.locator('#toggle-barrier-btn').click(); assert.equal(await page.evaluate(() => state.barrierMode), true); await escape();
      await page.locator('#toggle-barrier-btn').click(); await page.locator('#toggle-barrier-btn').click();
      assert.equal(await page.evaluate(() => state.barrierMode), false, 'second real toolbar click closes barrier');
      await page.locator('#toggle-swap-btn').click();
      const swapMarker = await page.evaluate(() => {
        const marker = [..._markerRegistry.values()].find(entry => entry.marker._rfxClient.day === 'SEG').marker;
        const p = map.latLngToContainerPoint(marker.getLatLng()), rect = map.getContainer().getBoundingClientRect();
        return { x: rect.x + p.x, y: rect.y + p.y };
      });
      await page.mouse.click(swapMarker.x, swapMarker.y);
      assert.equal(await page.evaluate(() => !!state.swapSourceId && !!state.swapHighlightLayer), true);
      await escape();
      assert.equal(await page.evaluate(() => !state.swapModeActive && !state.swapSourceId && !state.swapSourceRouteId && !state.swapHighlightLayer), true);
      await page.locator('#toggle-swap-btn').click(); assert.equal(await page.evaluate(() => state.swapModeActive), true); await escape();
      await page.locator('#toggle-swap-btn').click(); await page.locator('#toggle-swap-btn').click();
      assert.equal(await page.evaluate(() => state.swapModeActive), false, 'second real toolbar click closes swap');
      await page.locator('#toggle-nav-btn').click(); assert.equal(await page.evaluate(() => map.dragging.enabled()), true); await escape();
      assert.equal(await page.evaluate(() => !state.navToolActive && !map.dragging.enabled()), true);
      await page.locator('#toggle-nav-btn').click(); assert.equal(await page.evaluate(() => state.navToolActive), true); await escape();
      assert.equal(await page.evaluate(() => state.manualPlanningMode), expanded);
      assert.equal(await data(), before, 'operational draft preserved');
      checks.push('barrier, swap, navigation, normal navigation policy and expanded state: ' + layout);
      await snapshot('tools-escaped-' + layout);
    }
    // Editing fields and modal/menu Escape must never disable the underlying tool.
    await page.locator('#toggle-ruler-btn').click(); await page.locator('#ruler-straight-mode-btn').click();
    await page.evaluate(() => { const input = document.createElement('input'); input.id = 'map-ux-field'; document.body.appendChild(input); input.focus(); });
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => state.rulerModeActive), true);
    await page.evaluate(() => document.getElementById('map-ux-field').remove());
    await page.evaluate(() => openDriverEditModal(state.drivers.find(d => d.id === state.clients[0].driverId).id));
    await page.locator('#driver-edit-name-input').fill('Pending draft preserved'); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#driver-edit-name-input').inputValue(), 'Pending draft preserved');
    assert.equal(await page.evaluate(() => state.rulerModeActive), true);
    await snapshot('editing-draft-preserved');
    acceptDiscard = true; await page.locator('#cancel-driver-edit-btn').click(); acceptDiscard = false;
    await page.locator('#toggle-ruler-btn').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#ruler-mode-menu').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.evaluate(() => state.rulerModeActive), true);
    const settingsRead = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/integration-health'));
    await page.locator('.tool-config').click(); await settingsRead;
    await page.keyboard.press('Escape'); await page.locator('#planning-settings').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(() => state.rulerModeActive), true); await escape();
    checks.push('input, driver draft, ruler menu and Settings own Escape without closing tool');
    await page.locator('#toggle-ruler-btn').click(); await page.locator('#ruler-straight-mode-btn').click();
    await page.evaluate(() => L.popup().setLatLng(map.getCenter()).setContent('Synthetic popup').openOn(map));
    await escape();
    await page.locator('.leaflet-popup').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => state.rulerModeActive), true); await escape();
    checks.push('Leaflet popup owns first Escape; second Escape deactivates ruler');
    await page.locator('#toggle-insight-btn').click(); assert.equal(await page.evaluate(() => state.insightModeActive), true);
    await escape(); assert.equal(await page.evaluate(() => state.insightModeActive), false);
    await page.locator('#toggle-insight-btn').click(); assert.equal(await page.evaluate(() => state.insightModeActive), true); await escape();
    checks.push('INS Escape and immediate reactivation');
    assert.equal(await data(), before);
    assert.deepEqual(writes, []); assert.equal(connectedFixture.writeCount(), 0);
    const result = { checks, errors, consoleErrors, failedResources, writes,
      operationalWriteCount: connectedFixture.writeCount(), roadRequests, interactionMs,
      screenshots: fs.readdirSync(artifacts).filter(x => x.endsWith('.png')) };
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(failedResources, []);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
