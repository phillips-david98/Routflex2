'use strict';
// Production sequence presentation/lifecycle with deterministic road responses.
// No provider, operational APIs, persisted sessions or routing changes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../map.html'), 'utf8');
const extract = name => {
  const match = source.match(new RegExp('^(?:async )?function ' + name + '\\([^]*?^}', 'm'));
  assert.ok(match, name); return match[0];
};
const noop = () => {};
function element() {
  const classes = new Set();
  return { children: [], hidden: false, isConnected: true, attrs: {},
    get textContent() { return (this.value || '') + this.children.map(c => c.textContent).join(''); },
    set textContent(value) { this.value = value; this.children = []; },
    replaceChildren(...children) { this.value = ''; this.children = children; },
    appendChild(child) { this.children.push(child); },
    setAttribute(key, value) { this.attrs[key] = value; }, removeAttribute: noop,
    classList: { add: v => classes.add(v), remove: v => classes.delete(v), contains: v => classes.has(v),
      toggle(v, on) { on ? classes.add(v) : classes.delete(v); } } };
}
const route = (id = 'A', coordinates = [[1, 1], [2, 2], [3, 3]]) => ({
  routeId: id, ddd: 65, week: 1, day: 'SEG', driver: { id: 'driver', name: 'Operator', lat: 9, lon: 9 },
  clients: coordinates.map(([lon, lat], index) => ({ id: id + index, sequence: index + 1, lat, lon }))
});
const road = (km = 11) => ({ ok: true, json: async () => ({ routes: [{ distance: km * 1000,
  duration: 900, geometry: { coordinates: [[1, 1], [2, 2], [3, 3]] } }] }) });
function fixture() {
  const nodes = new Map(), calls = [], shown = [], layers = new Set();
  const node = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const c = vm.createContext({ console: { warn: noop }, Intl, AbortController, WeakRef,
    addEventListener: noop,
    state: { viewMode: 'operational', activePlanningSessionId: 'session-A', selectedRouteId: 'A' },
    _roadGeomCache: new Map(), _ROAD_KM_MAX_WAYPOINTS: 100, _OSRM_ROUTE_BASE: 'https://fixture.invalid/',
    _trimRoadGeomCache: noop, updatePlannerHint: noop, toggleRulerMode: noop,
    getOperationalRouteLabel: r => 'S' + r.week + ' ' + r.day,
    hasValidCoordinate: c => typeof c.lat === 'number' && Number.isFinite(c.lat) && typeof c.lon === 'number' && Number.isFinite(c.lon),
    map: { removeLayer: l => layers.delete(l) },
    L: { polyline: (coords, options) => ({ coords, options }), layerGroup: items => ({ addTo() { layers.add(this); return this; }, items }) },
    fetch: (url, options) => new Promise(resolve => calls.push({ url, options, resolve })),
    document: { getElementById: node, createElement: element, querySelectorAll: () => [],
      addEventListener: noop, documentElement: element(),
      createTreeWalker: () => ({ nextNode: () => false }) }
  });
  for (const file of ['pt-BR', 'es', 'en']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/planning-i18n-' + file + '.js'), 'utf8'), c);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/planning-i18n.js'), 'utf8'), c);
  c.current = route(); c.getActiveOperationalRouteForRoadDrawing = () => c.current;
  vm.runInContext(extract('_roadKmOrderedValidClients'), c);
  vm.runInContext(source.slice(source.indexOf('let sequenceKmModeActive ='), source.indexOf('let _rulerShadowLine =')), c);
  vm.runInContext('sequenceKmModeActive = true;', c);
  const present = c.showSequenceKmSummary;
  c.showSequenceKmSummary = (...args) => { present(...args); shown.push(node('sequence-km-toast').textContent); };
  return { c, calls, shown, layers, node, text: () => node('sequence-km-toast').textContent };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('sequence follows selected route order, excludes base and never uses straight-line distance', async () => {
  const f = fixture(); f.c.current.clients.reverse();
  const before = JSON.stringify(f.c.current);
  const request = f.c.calculateSequenceKm();
  assert.match(f.calls[0].url, /1\.000000,1\.000000;2\.000000,2\.000000;3\.000000,3\.000000/);
  assert.doesNotMatch(f.calls[0].url, /9\.000000/);
  f.calls[0].resolve(road(11)); await request;
  assert.match(f.text(), /selecionada: 11,0 km/);
  assert.match(f.text(), /3 paradas.*sem base/);
  assert.equal(JSON.stringify(f.c.current), before);
});

test('visible total and scope relocalize in place in PT-BR, ES and EN', async () => {
  const f = fixture(), pending = f.c.calculateSequenceKm(); f.calls[0].resolve(road(11)); await pending;
  for (const [lang, label, km] of [['es', 'Distancia de la secuencia seleccionada', '11,0'], ['en', 'Selected sequence distance', '11.0'], ['pt-BR', 'KM da sequência selecionada', '11,0']]) {
    f.c.PlanningI18n.setLanguage(lang);
    assert.ok(f.text().includes(label + ': ' + km + ' km'), f.text());
  }
  assert.equal(f.calls.length, 1);
});

test('selection change removes old result immediately; late response cannot repaint', async () => {
  const f = fixture(); f.c.refreshSequenceKmIfActive();
  const old = f.calls[0]; f.c.current = route('B', [[4, 4], [5, 5]]); f.c.refreshSequenceKmIfActive();
  assert.equal(old.options.signal.aborted, true);
  f.calls[1].resolve(road(4.2)); await tick();
  old.resolve(road(99)); await tick();
  assert.match(f.text(), /4,2 km/); assert.doesNotMatch(f.text(), /99/);
  f.c.current = route('C', [[6, 6], [7, 7]]); f.c.refreshSequenceKmIfActive();
  assert.match(f.text(), /Calculando/); assert.doesNotMatch(f.text(), /4,2 km/);
  f.calls[2].resolve(road(6.8)); await tick(); assert.match(f.text(), /6,8 km/);
});

test('reorder and coordinate edits invalidate presentation while repeated geometry reuses cache', async () => {
  const f = fixture(); f.c.refreshSequenceKmIfActive(); f.calls[0].resolve(road()); await tick();
  f.c.refreshSequenceKmIfActive(); assert.equal(f.calls.length, 1);
  f.c.current.clients[0].sequence = 4; f.c.refreshSequenceKmIfActive();
  assert.match(f.text(), /Calculando/); assert.match(f.calls[1].url, /2\.000000,2\.000000;3\.000000,3\.000000;1\.000000,1\.000000/);
  f.calls[1].resolve(road(12)); await tick();
  f.c.current.clients[0].sequence = 1; f.c.refreshSequenceKmIfActive();
  assert.equal(f.calls.length, 2); assert.match(f.text(), /11,0 km/);
  f.c.current.clients[0].lat = 4; f.c.refreshSequenceKmIfActive(); assert.equal(f.calls.length, 3);
});

test('no route, insufficient stops and missing coordinates cannot retain previous total', async () => {
  const f = fixture(); f.c.refreshSequenceKmIfActive(); f.calls[0].resolve(road()); await tick();
  f.c.current.clients.push({ id: 'invalid', lat: null, lon: null }); f.c.refreshSequenceKmIfActive();
  assert.match(f.text(), /indisponível.*1 parada/); assert.doesNotMatch(f.text(), /11,0 km/);
  assert.equal(f.calls.length, 1);
  f.c.current = route('only', [[1, 1]]); f.c.refreshSequenceKmIfActive();
  assert.match(f.text(), /pelo menos 2/);
  f.c.current = null; f.c.refreshSequenceKmIfActive(); assert.match(f.text(), /Selecione uma rota/);
  assert.equal(f.layers.size, 0);
});

test('provider failure and returning to a failed selection show unavailable, never zero', async () => {
  const f = fixture(); f.c.refreshSequenceKmIfActive(); f.calls[0].resolve({ ok: false, status: 503 }); await tick();
  assert.match(f.text(), /distância indisponível/);
  const original = f.c.current; f.c.current = null; f.c.refreshSequenceKmIfActive();
  f.c.current = original; f.c.refreshSequenceKmIfActive(); assert.match(f.text(), /distância indisponível/);
  assert.equal(f.calls.length, 1);
});

test('invalid distances fail closed; a genuine zero remains a valid provider result', async () => {
  for (const distance of [undefined, null, '11000', -1, NaN, Infinity, 0]) {
    const f = fixture(), pending = f.c.calculateSequenceKm();
    f.calls[0].resolve({ ok: true, json: async () => ({ routes: [{ distance, geometry: { coordinates: [[1, 1], [2, 2]] } }] }) });
    await pending;
    assert.match(f.text(), distance === 0 ? /0,0 km/ : /distância indisponível/);
  }
});

test('deactivation aborts requests, hides status and permits immediate reactivation', async () => {
  const f = fixture(); f.c.refreshSequenceKmIfActive(); f.c.toggleSequenceKmMode(false);
  assert.equal(f.calls[0].options.signal.aborted, true); assert.equal(f.node('sequence-km-toast').hidden, true);
  f.calls[0].resolve(road(99)); await tick(); assert.equal(f.node('sequence-km-toast').hidden, true);
  f.c.toggleSequenceKmMode(true); f.calls[1].resolve(road(8)); await tick(); assert.match(f.text(), /8,0 km/);
});

test('session change cancels the prior session response even with identical route ids', async () => {
  const f = fixture(); f.c.refreshSequenceKmIfActive(); f.c.state.activePlanningSessionId = 'session-B';
  f.c.refreshSequenceKmIfActive(); assert.equal(f.calls[0].options.signal.aborted, true);
  f.calls[0].resolve(road(99)); await tick(); assert.match(f.text(), /Calculando/);
  f.calls[1].resolve(road(8)); await tick(); assert.match(f.text(), /8,0 km/);
});

test('lasso normal deactivation clears draft and completed selection, preserving operational edits', () => {
  const { fixture: mapFixture, client } = require('./planning-map-fixture.cjs');
  const c = mapFixture([client('pending', { day: 'TER', sequence: 4 })], {
    lassoModeActive: true, lassoDrawingActive: true, lassoSelectionIds: new Set(['pending']), hasUnsavedPlanChanges: true
  });
  c.lassoDrawLayer = {}; c.lassoSelectionLayer = { completed: true };
  let detached = false; c.detachLassoDocumentListeners = () => detached = true;
  for (const name of ['clearLassoLayers', 'toggleLassoMode']) vm.runInContext(extract(name), c);
  const before = JSON.stringify(c.state.clients); c.toggleLassoMode();
  assert.equal(c.state.lassoModeActive, false); assert.equal(c.state.lassoDrawingActive, false);
  assert.equal(c.lassoDrawLayer, null); assert.equal(c.lassoSelectionLayer, null);
  assert.deepEqual([...c.state.lassoSelectionIds], []); assert.equal(detached, true);
  assert.equal(JSON.stringify(c.state.clients), before); assert.equal(c.state.hasUnsavedPlanChanges, true);
  c.toggleLassoMode(); assert.equal(c.state.lassoModeActive, true);
  assert.deepEqual([...c.state.lassoSelectionIds], []);
});

test('editing fields, component-owned Escape and visible dialogs keep map tools intact', () => {
  const c = vm.createContext({ document: { querySelectorAll: () => [] }, _isInsightPanelOpen: () => false });
  vm.runInContext(extract('mapToolEscapeOwnedByInterface'), c);
  for (const property of ['defaultPrevented', 'repeat', 'isComposing']) assert.equal(c.mapToolEscapeOwnedByInterface({ [property]: true }), true);
  assert.equal(c.mapToolEscapeOwnedByInterface({ composedPath: () => [{ matches: () => true }] }), true);
  c.document.querySelectorAll = () => [{ getClientRects: () => [1] }];
  assert.equal(c.mapToolEscapeOwnedByInterface({}), true);
  c.document.querySelectorAll = () => [];
  assert.equal(c.mapToolEscapeOwnedByInterface({ target: {} }), false);
});
