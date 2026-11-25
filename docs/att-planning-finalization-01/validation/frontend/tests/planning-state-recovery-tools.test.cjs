'use strict';
// Real map tool lifecycle and pointer handlers over isolated synthetic state.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { fixture, client, picture, extract, sources } = require('./planning-map-fixture.cjs');
const { setup: pointerFixture } = require('./planning-marker-pointer-fixture.cjs');
const noop = () => {};
function node() {
  const classes = new Set();
  return { attrs: {}, classList: { add: x => classes.add(x), remove: x => classes.delete(x),
    contains: x => classes.has(x), toggle: (x, on) => on ? classes.add(x) : classes.delete(x) },
    setAttribute(key, value) { this.attrs[key] = value; }, getClientRects: () => [1] };
}
function setup(overrides = {}) {
  const c = fixture([client('first', { day: 'MON', driverId: 'd1', customerKey: 'first' }),
    client('second', { day: 'MON', driverId: 'd1', sequence: 2, customerKey: 'second' })],
    { viewMode: 'operational', dragClientId: null, hasUnsavedPlanChanges: true, ...overrides });
  const nodes = new Map(), listeners = new Map(), layers = new Set();
  const getNode = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const controls = () => ({ enabled: true, enable() { this.enabled = true; }, disable() { this.enabled = false; } });
  Object.assign(c.document, { getElementById: getNode, querySelectorAll: () => [],
    addEventListener(name, handler) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(handler); },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler); } });
  Object.assign(c.map, { getContainer: () => getNode('map'), dragging: controls(), scrollWheelZoom: controls(),
    doubleClickZoom: controls(), removeLayer: layer => layers.delete(layer) });
  const layer = () => ({ addTo() { layers.add(this); return this; } });
  Object.assign(c.L, { circleMarker: layer, polyline: layer, polygon: layer });
  c._ensureBarrierControls = () => getNode('barrier-controls');
  c._isInsightPanelOpen = () => false; c._insHasUnsavedChanges = () => false;
  c.closeInsightPanel = noop; c.setInsightButtonState = noop;
  c._getInsightCategoryColor = () => null; c._getInsightClass = () => '';
  c.toggleInsightMode = active => c._setInsightModeActive(active);
  c.hideAssignmentDragGhost = noop;
  c.sequenceKmModeActive = false;
  c.toggleSequenceKmMode = active => { c.sequenceKmModeActive = active; };
  c._integrationContextPending = false;
  vm.runInContext('var _rulerShadowLine=null, _rulerLine=null, _rulerTooltip=null, _rulerStartMarker=null, _rulerEndMarker=null;', c);
  for (const name of ['clearLassoLayers', 'detachLassoDocumentListeners', 'attachLassoDocumentListeners',
    'syncLassoInteractionState', 'setLassoButtonState', 'syncMapDragging', 'setNavButtonState',
    'toggleNavTool', 'deactivateNavTool', 'syncRulerModeMenuState', 'closeRulerModeMenu', '_clearRulerLayers',
    'clearRuler', 'toggleRulerMode', 'toggleBarrierMode', '_clearSwapHighlightLayer', '_clearSwapSelection',
    '_showSwapHighlight', 'handleSwapModeMarkerClick', 'toggleSwapMode', '_setInsightModeActive',
    'clearClientMarkerAssignmentPointerSession', 'clearManualRebalanceState', 'cancelAssignmentPointerDrag',
    'toggleLassoMode', 'endMapToolInteractions', 'mapToolEscapeOwnedByInterface'])
    vm.runInContext(extract('map.html', name), c);
  const start = sources['map.html'].indexOf("document.addEventListener('keydown', (event) => {", sources['map.html'].indexOf('function endMapToolInteractions'));
  const end = sources['map.html'].indexOf('\n});', start) + 4;
  vm.runInContext(sources['map.html'].slice(start, end), c);
  const escape = (target = {}, overrides = {}) => {
    const event = { key: 'Escape', target, prevented: false, preventDefault() { this.prevented = true; }, ...overrides };
    for (const handler of listeners.get('keydown') || []) handler(event);
    return event;
  };
  picture(c);
  return { c, getNode, layers, listeners, escape };
}
const data = c => JSON.stringify({ clients: c.clients, dirty: c.state.hasUnsavedPlanChanges, session: c.state.activePlanningSessionId });

test('Escape clears completed lasso IDs, polygons, marker icons and residual references without reverting edits', () => {
  for (const expanded of [false, true]) {
    const { c, layers, escape, getNode } = setup({ manualPlanningMode: expanded });
    c.toggleLassoMode(); c.state.lassoSelectionIds.add('first'); c.state.lassoSelectionIds.add('second');
    c.updateMarkerIconsOnly();
    const markers = [...c._markerRegistry.values()].map(entry => entry.marker);
    c.lassoSelectionLayer = {}; layers.add(c.lassoSelectionLayer);
    Object.assign(c.state, { _weekMoveOwner: {}, _weekMoveTargets: new Map(), _weekMoveSourceIds: ['first'],
      dragRouteTarget: {}, dragHoverDriverId: 'd2', _lassoPopupClientIds: ['first'], _lassoPopupIndex: 0 });
    c._dragGrid = {}; const before = data(c);
    assert.equal(escape().prevented, true);
    assert.equal(c.state.lassoModeActive, false); assert.equal(c.state.lassoSelectionIds.size, 0);
    assert.equal(c.lassoSelectionLayer, null); assert.equal(layers.size, 0);
    assert.equal(c.state._weekMoveOwner, null); assert.equal(c.state._weekMoveSourceIds, null);
    assert.equal(c.state._weekMoveTargets, null); assert.equal(c.state.dragRouteTarget, null);
    assert.equal(c.state.dragHoverDriverId, null); assert.equal(c.state._lassoPopupClientIds.length, 0);
    assert.equal(c._dragGrid, null); assert.equal(getNode('map').classList.contains('lasso-mode'), false);
    assert.equal(getNode('toggle-lasso-btn').classList.contains('is-active'), false);
    assert.ok([...c._markerRegistry.values()].every(entry => entry.iconKey.split('|')[3] === '0'));
    assert.deepEqual([...c._markerRegistry.values()].map(entry => entry.marker), markers);
    assert.equal(data(c), before); assert.equal(c.state.manualPlanningMode, expanded);
    c.toggleLassoMode(); assert.equal(c.state.lassoSelectionIds.size, 0);
  }
});

test('lasso button exit detaches drawing listeners, removes unfinished contour and restores zoom', () => {
  const { c, layers, listeners } = setup(); c.toggleLassoMode();
  c.state.lassoDrawingActive = true; c.attachLassoDocumentListeners();
  c.lassoDrawLayer = {}; layers.add(c.lassoDrawLayer);
  c.map.scrollWheelZoom.disable(); c.map.doubleClickZoom.disable();
  c.toggleLassoMode();
  assert.equal(listeners.get('mousemove').size, 0); assert.equal(listeners.get('mouseup').size, 0);
  assert.equal(c.state._lassoDocumentMoveHandler, null); assert.equal(c.state._lassoDocumentUpHandler, null);
  assert.equal(c.state.lassoDrawingActive, false); assert.equal(c.lassoDrawLayer, null);
  assert.equal(c.map.scrollWheelZoom.enabled, true); assert.equal(c.map.doubleClickZoom.enabled, true);
  assert.equal(c.map.dragging.enabled, false, 'normal operational map keeps its intentional navigation lock');
});

test('an operational day change applied through lasso survives Escape and clean reactivation', () => {
  const { c, escape } = setup(); c.toggleLassoMode(); c.state.lassoSelectionIds.add('first');
  c.moveLassoSelectionToDay('TUE'); assert.equal(c.clients[0].day, 'TUE');
  const before = data(c); escape(); c.toggleLassoMode();
  assert.equal(data(c), before); assert.equal(c.state.lassoSelectionIds.size, 0);
});

test('cancelling an actual lasso pointer drag prevents late mouseup from applying a driver or week change', () => {
  const f = pointerFixture(true, { lassoModeActive: true, hasUnsavedPlanChanges: true }); const c = f.c;
  for (const name of ['clearLassoLayers', 'toggleLassoMode']) vm.runInContext(extract('map.html', name), c);
  c.state.lassoSelectionIds.add(c.clients[0].id);
  const before = data(c); f.down(); f.move();
  assert.equal(c.state.lassoGroupDragActive, true); assert.equal(c.map.scrollWheelZoom.enabled, false);
  assert.ok(c.state._clientMarkerPointerDragSession);
  c.toggleLassoMode(); f.up(); f.frame();
  assert.equal(c.state._clientMarkerPointerDragSession, null); assert.equal(c.state.lassoGroupDragActive, false);
  assert.equal(c.state.lassoSelectionIds.size, 0); assert.equal(c.state._weekMoveOwner, null);
  assert.equal(c.map.scrollWheelZoom.enabled, true); assert.equal(c.map.doubleClickZoom.enabled, true);
  assert.equal(data(c), before); assert.equal(c.state._assignmentDragVisual.el.classList.contains('is-active'), false);
});

test('gesture tools are mutually exclusive, including switching away from swap and barrier', () => {
  const activate = { lasso: c => c.toggleLassoMode(), nav: c => c.toggleNavTool(), ruler: c => c.toggleRulerMode(true),
    barrier: c => c.toggleBarrierMode(true), swap: c => c.toggleSwapMode(true), insight: c => c._setInsightModeActive(true) };
  const keys = { lasso: 'lassoModeActive', nav: 'navToolActive', ruler: 'rulerModeActive', barrier: 'barrierMode', swap: 'swapModeActive', insight: 'insightModeActive' };
  for (const [first, a] of Object.entries(activate)) for (const [second, b] of Object.entries(activate)) {
    if (first === second) continue;
    const { c } = setup(); a(c); b(c);
    assert.equal(c.state[keys[first]], false, first + ' → ' + second);
    assert.equal(c.state[keys[second]], true, first + ' → ' + second);
  }
});

test('one Escape ends coexisting KM and gesture tools while keeping expanded layout and saved barriers', () => {
  const { c, layers, escape } = setup({ manualPlanningMode: true });
  c.toggleBarrierMode(true); c.state.barrierDrawPoints = [[1, 1]];
  c.state.barrierDrawLayer = {}; layers.add(c.state.barrierDrawLayer);
  const completed = { id: 'completed', layer: {} }; c.state.barriers = [completed]; layers.add(completed.layer);
  c.sequenceKmModeActive = true;
  escape(); assert.equal(c.sequenceKmModeActive, false); assert.equal(c.state.barrierMode, false);
  assert.equal(c.state.barrierDrawLayer, null); assert.equal(c.state.barrierDrawPoints.length, 0);
  assert.deepEqual(c.state.barriers, [completed]); assert.ok(layers.has(completed.layer));
  assert.equal(c.state.manualPlanningMode, true); assert.equal(c.map.doubleClickZoom.enabled, true);
});

test('swap Escape clears first-click indicators and preserves an already applied second-click sequence', () => {
  const { c, escape, layers } = setup();
  c.getRouteGroupsSafe = () => [{ routeId: 'same', clients: c.clients.slice().sort((a, b) => a.sequence - b.sequence) }];
  for (const name of ['commitRouteSequence', 'swapStopSequence']) vm.runInContext(extract('map.html', name), c);
  const marker = row => ({ _rfxClient: row, _rfxRoute: { routeId: 'same' } });
  c.toggleSwapMode(true); c.handleSwapModeMarkerClick(marker(c.clients[0]));
  assert.equal(layers.size, 1); escape(); assert.equal(layers.size, 0);
  assert.equal(c.state.swapSourceId, null); assert.equal(c.state.swapSourceRouteId, null);
  assert.deepEqual(c.clients.map(row => row.sequence), [1, 2]);
  c.toggleSwapMode(true); c.handleSwapModeMarkerClick(marker(c.clients[0])); c.handleSwapModeMarkerClick(marker(c.clients[1]));
  assert.deepEqual(c.clients.map(row => row.sequence), [2, 1]); escape();
  assert.deepEqual(c.clients.map(row => row.sequence), [2, 1]); assert.equal(c.state.swapModeActive, false);
});

test('toolbar click wrappers deactivate swap and barrier on their second click', () => {
  const { c, getNode } = setup();
  for (const id of ['swap', 'barrier']) {
    const line = sources['map.html'].split('\n').find(line => line.startsWith("document.getElementById('toggle-" + id + "-btn').onclick ="));
    vm.runInContext(line, c);
    getNode('toggle-' + id + '-btn').onclick({ type: 'click' });
    const key = id === 'swap' ? 'swapModeActive' : 'barrierMode'; assert.equal(c.state[key], true);
    getNode('toggle-' + id + '-btn').onclick({ type: 'click' }); assert.equal(c.state[key], false);
  }
});

test('input, visible modal and component-owned Escape retain their contextual behavior', () => {
  const { c, escape, getNode } = setup(); c.toggleLassoMode();
  getNode('ruler-mode-menu').classList.add('is-open');
  assert.equal(escape().prevented, true); assert.equal(c.state.lassoModeActive, true);
  assert.equal(getNode('ruler-mode-menu').classList.contains('is-open'), false);
  for (const target of [{ matches: () => true }]) assert.equal(escape(target).prevented, false);
  c.document.querySelectorAll = () => [{ getClientRects: () => [1] }];
  assert.equal(escape().prevented, false); assert.equal(c.state.lassoModeActive, true);
  c.document.querySelectorAll = () => [];
  assert.equal(escape({}, { defaultPrevented: true }).prevented, false);
  assert.equal(c.state.lassoModeActive, true);
});
