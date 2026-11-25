'use strict';
// Read-only diagnosis: execute selected, unmodified production functions over
// synthetic in-memory state. No browser, network, storage or operational data.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const sources = Object.fromEntries(['map.html','js/filters.js','js/state.js','js/ui-helpers.js','js/geo-utils.js'].map(p => [p,read('frontend/'+p)]));
function extract(file, name) {
  const result = sources[file].match(new RegExp('^(?:async )?function '+name+'\\([^]*?^}', 'm'));
  assert.ok(result, name); return result[0];
}
const noop = () => {};
function fixture(items, overrides = {}) {
  const state = {clients:structuredClone(items), selectedDDD:65, selectedDriverId:'all', selectedDriverIds:new Set(),
    vehicleFilter:'all',territoryFilter:'all',curvFilters:new Set(),activeWeeks:new Set([1,2,3,4]),activeDays:new Set(['MON','TUE']),
    showActiveClients:true,showInactiveClients:false,showNewClients:true,viewMode:'territorial',lassoSelectionIds:new Set(),
    routeGroupsCache:[],filteredClientsCache:[],_clientMutationCounter:0,weekCount:4,activePlanningSessionId:'fixture',...overrides};
  const ctx = {state,drivers:[{id:'d1',name:'One',vehicle:'carro',ddd:65},{id:'d2',name:'Two',vehicle:'van',ddd:65}],
    PlanningVisits:require('../js/planning-visits.js'),PlanningRoadLayer:require('../js/planning-road-layer.js'),
    buildClientCanonicalKey:require('../js/client-identity.js').buildClientCanonicalKey,
    console:{debug:noop,warn:noop,error:noop}, window:{}, days:['MON','TUE','WED','THU','FRI'], CURVE_FILTER_NONE:'none', FREQ_MENSAL:'Mensal',
    getPlanningSessionProfile:()=> 'visits', hasCanonicalPlanningContext:()=>true, matchesPlanningScopeDDD:c=>c.ddd==null||c.ddd===65,
    getDriverById:id=>ctx.drivers.find(d=>d.id===id),getRouteGroupsSafe:()=>[],
    normalizeFrequencyLabel:value=>value, requirePlanningCapability:()=>true,
    _schedulePlanningAutosave:noop,markPlanningPersistenceAsDirty:noop,markPlanAsDirty:noop,markDriverAsAdjusted:noop,
    ensureInactiveManualConfirmation:()=>true, updatePlannerHint:s=>ctx.hint=s,
    applyFilters:noop,postBackendEvent:noop,_scheduleScenarioPersist:noop,
    hasCurrentPdvDraftBaseline:()=>true,getPdvDraftDrivers:()=>ctx.drivers,invalidateRoadKmCacheForDriver:noop,
    getDriverShortCode:id=>id,createRouteId:(...a)=>a.join('|'),renderDriverManagerPanel:noop,
    syncMapDragging:noop,syncDriverListDragState:noop,_clearDropTargetRectsCache:noop,triggerAssignmentDropFeedback:noop,
    clearManualRebalanceState:s=>ctx.hint=s,handleWeekMoveDrop:()=>false,_integrationContextPending:false,
    document:{body:{classList:{remove:noop}},getElementById:()=>({hidden:true})},
    map:{scrollWheelZoom:{enable:noop},doubleClickZoom:{enable:noop},removeLayer:noop,
      latLngToContainerPoint:p=>Array.isArray(p)?{x:p[1],y:p[0]}:{x:p.lng,y:p.lat}},
    L:{polygon:()=>({addTo(){return this;}})},detachLassoDocumentListeners:noop,setLassoButtonState:noop,
    clearLassoLayers:noop,clearClientMarkerAssignmentPointerSession:noop,syncAssignmentDragVisualState:noop,syncPlannerDropState:noop,
    lassoDrawLayer:null,lassoSelectionLayer:null,
    lassoDrawPoints:[{lat:-16,lng:-57},{lat:-15,lng:-57},{lat:-15,lng:-55},{lat:-16,lng:-55}]};
  Object.defineProperty(ctx,'clients',{get:()=>state.clients,set:v=>state.clients=v});
  vm.createContext(ctx);
  vm.runInContext('var _PLANNING_KEYS = new Set(["week","day","driverId","sequence","manualRouteInclude","eligibleForRouting"]); var _PERSISTED_PLANNING_KEYS = new Set(["week","day","driverId","sequence"]);',ctx);
  for(const name of ['driverMatchesFilter','_onClientMutated','patchClient','patchClients']) vm.runInContext(extract('js/state.js',name),ctx);
  for(const name of ['normalizeCurveCode','getClientGroupId','isActiveEquivalentClientType','resolveVisitFrequency']) vm.runInContext(extract('js/ui-helpers.js',name),ctx);
  for(const name of ['isKnownInvalidCoordinate','isWithinExpectedArea','hasValidCoordinate']) vm.runInContext(extract('js/geo-utils.js',name),ctx);
  vm.runInContext(sources['js/filters.js'],ctx);
  ctx.getRouteGroupsSafe=()=>[];
  ctx._territorialColorCache = new Map();
  for(const name of ['getTerritorialMapColor','getPlanningMapScheduleColor','getClientMapColor','getClientMarkerVisual','_applyVisitSave','normalizeCurveScheduleForClient',
      'normalizeCurveSchedulesForClients','assignmentVisibilityHint','createLassoSequenceAllocator','moveLassoSelectionToDriver','moveLassoSelectionToDay',
      'clearLassoSelection','handleMarkerDragEnd','pointInPolygon','getLassoSelectionProjection','finishLassoDraw','_isCurrentClientMarker'])
    vm.runInContext(extract('map.html',name),ctx);
  // Real marker reconciliation; only Leaflet and cosmetic side effects stubbed.
  const layer={items:new Set(),addLayer(m){this.items.add(m);},removeLayer(m){this.items.delete(m);},hasLayer(m){return this.items.has(m);}};
  Object.assign(ctx,{performance,MAX_MAP_RENDER_POINTS:1800,LARGE_DATASET_THRESHOLD:2500,
    _markerRegistry:new Map(),_polylineRegistry:new Map(),_territoryRegistry:new Map(),clusterLayer:layer,
    roadRouteLayer:null,_roadDrawingRequest:null,getRoadVisualLayer:()=>({reconcile:noop}),
    routeLines:[],dayColors:{MON:'#111111'},weekCycleColors:{},
    _markerRenderEpoch:1,_markerRenderIdentity:()=>null,isLargeDatasetMode:()=>false,
    _invalidateMarkerRenderBatch:()=>1,_createMarkerRenderToken:()=>({sessionId:state.activePlanningSessionId,clients:state.clients,identity:null,epoch:1}),
    syncDriverBaseMarkers:noop,_bindClientMarkerEvents:noop,_syncClientMarkerInteractionMode:noop,
    createMarkerIcon:()=>({}),getMarkerDisplayContent:()=> '1',syncRoadRouteVisibility:noop,
    renderTerritoryShapes:noop,logApplyFiltersPerf:noop,
    addMarkersToLayerInBatches:(ms,l,e,done)=>{ms.forEach(m=>l.addLayer(m));done(0);},
    _recordMarkerRenderFailure:(token,error)=>{throw error;}});
  ctx.window.__rfxPerf={count:noop,snapshot:noop,calls:{}};
  ctx.L.marker=(latlng,options)=>({options,point:{lat:latlng[0],lng:latlng[1]},getLatLng(){return this.point;},
    setLatLng(p){this.point={lat:p[0],lng:p[1]};},setIcon:noop,isPopupOpen:()=>false});
  for(const name of ['getValidDriverBaseForRoadDrawing','buildRoadDrawingWaypoints','roadGeometryKey',
    'selectClientsForMapRender','renderMap','updateMarkerIconsOnly'])vm.runInContext(extract('map.html',name),ctx);
  return ctx;
}
const client=(id='pink-w1',extra={})=>({id,clientGroupId:id.replace(/-w\d+$/,''),customerKey:'["IMPORT","ATT04C","000123"]',
  clientType:'ativo',ddd:65,driverId:'unassigned',day:null,week:1,lat:-15.6,lon:-56.1,vehicle:'carro',territory:'A',curveCode:'A',curva:'C',
  frequencia:'Mensal',sequence:1,...extra});
function picture(c){
  const b=c.classifyClients();
  const groups=b.filtered.map(x=>({routeId:x.id,clients:[x],driver:c.getDriverById(x.driverId)||{id:'unassigned'},day:x.day,week:x.week,ddd:x.ddd}));
  c.renderMap(b.filtered,groups);
  return {clients:structuredClone(c.state.clients),filtered:b.filtered.map(x=>x.id),special:b.special.map(x=>x.id),
    noCoord:b.noCoord.map(x=>x.id),visible:c.getClientsVisibleOnMap().map(x=>x.id),
    renderedMarkerIds:Array.from(c._markerRegistry.keys()),layerMarkerCount:c.clusterLayer.items.size,
    individual:c.state.clients.map(x=>({id:x.id,...c.getClientMapVisibility(x)})),
    filters:{driver:c.state.selectedDriverId,drivers:[...c.state.selectedDriverIds],weeks:[...c.state.activeWeeks],days:[...c.state.activeDays]},
    portfolio:c.getDriverPortfolio('d2')};
}

module.exports = { fixture, client, picture, extract, sources };
