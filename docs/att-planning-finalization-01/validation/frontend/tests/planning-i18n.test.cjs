'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dir = path.join(__dirname, '../js');
function fixture(storage = new Map()) {
  const writes = [];
  const context = vm.createContext({ Intl, Date, WeakRef, console, localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { writes.push([key, value]); storage.set(key, value); }
  }});
  for (const file of ['planning-i18n-pt-BR.js', 'planning-i18n-es.js', 'planning-i18n-en.js', 'planning-i18n.js'])
    vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), context, {filename:file});
  return { i:context.PlanningI18n, dictionaries:context.ROUTFLEX_PLANNING_TRANSLATIONS, storage, writes, context };
}
test('language persists across reload and isolates stable users and tenants', () => {
  const f = fixture(), a = { tenantId:'routflex-dev', userId:'operator-1' };
  assert.equal(f.i.getLanguage(), 'pt-BR');
  f.i.bindIdentity(a); f.i.setLanguage('en');
  const reloaded = fixture(f.storage); reloaded.i.bindIdentity(a);
  assert.equal(reloaded.i.getLanguage(), 'en');
  reloaded.i.bindIdentity({ ...a, userId:'operator-2' });
  assert.equal(reloaded.i.getLanguage(), 'pt-BR'); reloaded.i.setLanguage('es');
  reloaded.i.bindIdentity(a); assert.equal(reloaded.i.getLanguage(), 'en');
  reloaded.i.bindIdentity({ ...a, tenantId:'isolated-test-tenant' });
  assert.equal(reloaded.i.getLanguage(), 'pt-BR');
  assert.equal(f.storage.size, 2);
  assert.ok([...f.storage.keys()].every(key => key.startsWith('rfx:planning:language:v1:')));
  assert.notEqual(f.i.scopeKey({tenantId:'a:b',userId:'c'}), f.i.scopeKey({tenantId:'a',userId:'b:c'}));
});
test('invalid preferences, absent identity, unavailable storage and missing translations fall back safely', () => {
  const f=fixture(), identity={tenantId:'dev',userId:'one'};
  f.storage.set(f.i.scopeKey(identity), 'xx'); f.i.bindIdentity(identity);
  assert.equal(f.i.getLanguage(), 'pt-BR');
  f.i.setLanguage('es'); f.i.bindIdentity(null); assert.equal(f.i.getLanguage(), 'pt-BR');
  const count=f.writes.length; f.i.setLanguage('en'); assert.equal(f.writes.length,count);
  f.context.localStorage={getItem(){throw Error('disabled')},setItem(){throw Error('quota')}};
  assert.doesNotThrow(()=>{f.i.bindIdentity(identity); f.i.setLanguage('es')});
  f.dictionaries.es={};
  assert.equal(f.i.t('common.save'),'Salvar');
  assert.equal(f.i.t('missing',{},'Portuguese fallback'),'Portuguese fallback');
});
test('dictionaries have complete keys, interpolation parity and no technical markup translations', () => {
  const {dictionaries:d}=fixture();
  const placeholders=value=>[...String(value).matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort();
  for(const lang of ['es','en']) {
    assert.deepEqual(Object.keys(d[lang]).sort(),Object.keys(d['pt-BR']).sort());
    for(const key of Object.keys(d['pt-BR'])) {
      const source=d['pt-BR'][key], target=d[lang][key];
      if(typeof source==='object') {
        for(const form of Object.keys(source))assert.deepEqual(placeholders(target[form]),placeholders(source[form]),lang+':'+key+':'+form);
      } else {
        assert.ok(target.trim(),lang+':'+key);
        assert.deepEqual(placeholders(target),placeholders(source),lang+':'+key);
        assert.ok(!/^(disabled|checked|selected|driverId|label)$/.test(source),'Technical value in dictionary: '+key);
      }
    }
  }
});
test('message recipes switch language, preserve interpolated business data and plural forms', () => {
  const {i}=fixture();
  const business='Salvar / Novo / SEG / Motorista & <empresa>';
  const key='fixture.message';
  // Explicit fallback interpolation keeps operator-owned strings opaque.
  assert.equal(i.t(key,{name:business},'Cliente {name}'),'Cliente '+business);
  const token=i.message('common.save');
  assert.equal(i.plain(token),'Salvar'); i.setLanguage('es'); assert.equal(i.plain(token),'Guardar');
  i.setLanguage('en'); assert.equal(i.plain(token),'Save');
  assert.equal(i.source(token),'Salvar'); assert.equal(i.plain(business),business);
  assert.equal(i.t('counts.customers',{count:1}),'1 customer');
  assert.equal(i.t('counts.customers',{count:2}),'2 customers');
  assert.equal(i.plain(i.upper(token)),'SAVE');
});
test('weekday, enum, route and number localisation never mutates canonical inputs', () => {
  const {i}=fixture(); const days=['SEG','TER','QUA','QUI','SEX','SAB','DOM'];
  const raw=JSON.stringify(days), route={week:1,day:'SEG',routeId:'65-D1-1-SEG'};
  i.setLanguage('es');assert.deepEqual(days.map(d=>i.plain(i.day(d))),['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM']);
  i.setLanguage('en');assert.deepEqual(days.map(d=>i.plain(i.day(d))),['MON','TUE','WED','THU','FRI','SAT','SUN']);
  assert.equal(i.plain(i.routeLabel('S1 | 65 | Cuiabá | SEG',route)),'W1 | 65 | Cuiabá | MON');
  assert.equal(i.plain(i.enumValue('frequency','Quinzenal')),'Fortnightly');
  assert.equal(JSON.stringify(days),raw);assert.equal(route.routeId,'65-D1-1-SEG');
  assert.equal(i.plain(i.numberText(1234.5,{minimumFractionDigits:1})),'1,234.5');
  i.setLanguage('pt-BR');assert.equal(i.plain(i.numberText(1234.5,{minimumFractionDigits:1})),'1.234,5');
});
test('bindings retain recipes across language changes and detached panels without overwriting later writes',()=>{
  const f=fixture(),i=f.i;
  f.context.document={documentElement:{},getElementById:()=>null,querySelectorAll:()=>[],createTreeWalker:()=>({nextNode:()=>false})};
  const node={isConnected:true,textContent:'',removeAttribute(){}};
  node.textContent=i.text(node,i.message('common.save'));i.setLanguage('en');assert.equal(node.textContent,'Save');
  node.isConnected=false;i.setLanguage('es');assert.equal(node.textContent,'Save');
  node.isConnected=true;i.apply();assert.equal(node.textContent,'Guardar');
  node.textContent='Customer named Salvar';i.setLanguage('pt-BR');assert.equal(node.textContent,'Customer named Salvar');
});
test('known validation and handoff text is localised only at the feedback boundary',()=>{
  const {i}=fixture();i.setLanguage('en');
  const error=new Error('Selecione pelo menos um dia para preparar a proposta.');
  assert.equal(i.plain(i.diagnostic(error.message)),'Select at least one day to prepare the proposal.');
  assert.equal(error.message,'Selecione pelo menos um dia para preparar a proposta.');
  assert.equal(i.plain(i.diagnostic('HTTP 400 em /Salvar/SEG')),'HTTP 400 at /Salvar/SEG');
  assert.equal(i.diagnostic('UNKNOWN_VENDOR_ERROR — trace 123'),'UNKNOWN_VENDOR_ERROR — trace 123');
  const receipt={status:'REJECTED',rejection:{reason:'Nome comercial Salvar / SEG'}};
  assert.equal(i.plain(i.deliveryMessage(receipt)),'Rejected by OPS. Reason: Nome comercial Salvar / SEG');
  assert.equal(receipt.status,'REJECTED');
});
test('actual lasso and day/week assignment preserve identity and canonical values with every language active',()=>{
  const {fixture:mapFixture,client,picture}=require('./planning-map-fixture.cjs');
  for(const language of ['pt-BR','es','en']){
    const {i}=fixture();i.setLanguage(language);
    const c=mapFixture([client('a',{driverId:'d1',day:'MON',week:1}),client('b',{driverId:'d1',day:'MON',week:1})],{viewMode:'operational'});
    c.PlanningI18n=i;picture(c);
    const identity=JSON.stringify(c.clients.map(row=>[row.id,row.customerKey,row.lat,row.lon]));
    c.lassoDrawPoints=[{lat:-16,lng:-57},{lat:-15,lng:-57},{lat:-15,lng:-55},{lat:-16,lng:-55}];
    c.state.lassoDrawingActive=true;c.finishLassoDraw();assert.equal(c.state.lassoSelectionIds.size,2);
    c.moveLassoSelectionToDriver('d2',{skipConfirm:true,targetDay:'TUE',targetWeek:3});
    assert.equal(JSON.stringify(c.clients.map(row=>[row.id,row.customerKey,row.lat,row.lon])),identity);
    assert.deepEqual(Array.from(c.clients,row=>[row.day,row.week,row.driverId]),[['TUE',3,'d2'],['TUE',3,'d2']]);
  }
});

test('language changes preserve pending Save generations and Autosave timers; both confirm canonical payloads',async()=>{
  const {fixture:saveFixture}=require('./planning-save-flow.fixture.cjs');
  const payloads=[];
  for(const language of ['pt-BR','es','en'])for(const origin of ['manual','autosave']){
    const f=saveFixture(),{i}=fixture();f.c.PlanningI18n=i;
    i.bindIdentity(f.c.identity);f.c.autosave=true;
    f.c.ROUTFLEX_PLANNING_SAVE.schedule();
    const before=JSON.stringify({state:f.state,entry:f.entry,remote:f.remote,cache:[...f.cache]});
    const timers=[...f.timers];
    i.setLanguage(language);
    assert.equal(JSON.stringify({state:f.state,entry:f.entry,remote:f.remote,cache:[...f.cache]}),before);
    assert.deepEqual([...f.timers],timers);assert.equal(f.calls.writes.length,0);
    if(origin==='manual')f.dispatch();
    else [...f.timers.values()].find(item=>item.ms===5000).fn();
    await new Promise(setImmediate);assert.equal(f.calls.writes.length,1);
    payloads.push(JSON.stringify(f.calls.writes[0].payload));
    i.setLanguage(language==='en'?'es':'en');assert.equal(f.entry.status,'saving');
    f.acknowledge();await new Promise(setImmediate);await f.settled();
    assert.equal(f.entry.status,'saved');assert.equal(f.state.hasUnsavedPlanChanges,false);
    assert.equal(f.c.ROUTFLEX_PLANNING_SAVE.journal().origin,origin);
  }
  assert.equal(new Set(payloads).size,1,'same contractual Save payload for every language and trigger');
});

test('integration labels and locale formatting preserve status codes and normalized data',async()=>{
  const {i}=fixture(),previous=globalThis.PlanningI18n;globalThis.PlanningI18n=i;
  try {
    const models=await import(require('node:url').pathToFileURL(path.join(dir,'integration/models.mjs')).href+'?i18n-test');
    const raw={status:'HEALTHY',model:'MANAGED',environment:'Salvar / SEG',lastSuccessAt:'2026-11-24T12:00:00Z',warningCount:0,errorCount:0};
    const canonical=JSON.stringify(models.normalizeHealth(raw));
    for(const language of ['pt-BR','es','en']) {
      i.setLanguage(language);
      assert.equal(JSON.stringify(models.normalizeHealth(raw)),canonical);
      assert.equal(models.deliveryInfo({deliveryStatus:'FAILED'}).status,'ERROR');
      assert.equal(i.plain(models.STATUS.ERROR.label),{'pt-BR':'Falha',es:'Fallo',en:'Failure'}[language]);
      assert.equal(i.plain(models.numberLabel(1234.5)),new Intl.NumberFormat(i.getLocale()).format(1234.5));
      assert.ok(!i.plain(models.dateLabel(raw.lastSuccessAt)).includes('\uE000'));
      assert.equal(raw.environment,'Salvar / SEG');
    }
  } finally {globalThis.PlanningI18n=previous;}
});
