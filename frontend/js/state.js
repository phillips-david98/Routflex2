// ROUTflex — Application State & Mutation Infrastructure
// Extracted from map.html — Phase 3 Wave 1
// Depends on: config.js (days constant)
// Forward ref: _schedulePlanningAutosave() — defined in map.html, called at runtime only

const state = {
  viewMode: 'territorial', // 'territorial' | 'operational' | 'analytics'
  mode: 'REAL',
  sourceOfTruth: 'CRM',
  sourceCustomers: [],
  invalidCustomers: [],
  filteredClientsCache: [],
  routeGroupsCache: [],
  selectedRouteCache: null,
  activeWeeks: new Set([1, 2, 3, 4]),
  weekCount: 4,
  weekStepperDirection: 1,
  activeDays: new Set(days),
  selectedDriverId: 'all',
  selectedDriverIds: new Set(),
  vehicleFilter: 'all',
  territoryFilter: 'all',
  curvFilters: new Set(['A', 'B', 'C']),
  densityProfile: 'balanced',
  selectedDDD: '65',
  activePlanningSessionId: 'DDD_65',
  activePlanningSessionByDDD: {},
  lastPromotionBackupByDDD: {},
  selectedRouteId: null,
  selectedStopId: null,
  plannerStatus: 'draft',
  panelLeftOpen: true,
  panelRightOpen: true,
  manualPlanningMode: false,
  mapMenuCollapsed: false,
  dragClientId: null,
  dragTargetWeek: null,
  dragTargetDay: null,
  dragHoverWeek: null,
  dragHoverDay: null,
  dragRouteTarget: null,
  dragHoverDriverId: null,
  roadRouteId: null,
  focusDriverId: null,
  showDriverBase: false,
  showActiveClients: true,
  showNewClients: true,
  showInactiveClients: false,
  territoryViewEnabled: false,
  territoryPdvDisplay: 'sequence',
  territoryTransferOps: 0,
  territoryTransferredClients: 0,
  _territoryDirty: true,
  instrumentsPanelOpen: false,
  navToolActive: false,
  rulerModeActive: false,
  rulerPoints: [],
  insightModeActive: false,
  clientInsights: {},
  weekColorMode: false,
  lassoModeActive: false,
  lassoSelectionIds: new Set(),
  lassoDrawingActive: false,
  lassoGroupDragActive: false,
  lassoHoverDriverId: null,
  lassoDragTarget: null,
  _lassoPointerX: null,
  _lassoPointerY: null,
  manualAdjustedDriverIds: new Set(),
  hasUnsavedPlanChanges: false,
  driverFormMode: 'create',
  driverEditingId: null,
  _lastBaseClickDriverId: null,
  _lastBaseClickTs: 0,
  _baseClickTimer: null,
  _popupClientId: null,
  _popupLatlng: null,
  _popupDragMoveHandler: null,
  _popupDragUpHandler: null,
  _clientClickTimer: null,
  _lassoWindowsOpenCount: 0,
  _lassoPopupClientIds: [],
  _lassoPopupIndex: -1,
  _inactiveManualConfirmedIds: new Set(),
  _geocodingQueue: [],
  _geocodingProcessing: false,
  _lastGeocodingRequestTime: 0,
  _geocodingSelectedIds: new Set(),
  _lastClickId: null,
  _lastClickTs: 0,
  _renderLimitHintShown: false,
  advancedHistoryItems: [],
  selectedHistoryId: null,
  selectedHistoryDetail: null,
  historyLoadError: null,
  drivers: [],
  driverSequence: 0,
  clients: [],
  markers: [],
  routeLines: [],
  driverMarkers: [],
  territoryShapes: [],
  roadRouteLayer: null,
  clusterLayer: null,
  lassoDrawLayer: null,
  lassoSelectionLayer: null,
  lassoDrawPoints: [],
  lassoPendingMove: null,
  lastFilterContext: null,
  viewportRefreshTimer: null,
  simulationSourceCustomers: [],
  simulationSyncTimer: null
};

function updateState(patch) {
  if (patch && patch.clients) {
    state._clientMutationCounter = (state._clientMutationCounter || 0) + 1;
    if (typeof invalidateClassifyCache === 'function') invalidateClassifyCache();
  }
  Object.assign(state, patch || {});
  return state;
}

// Helper: checks if a driver matches the current filter selection (single or multi)
function driverMatchesFilter(driverId) {
  if (state.selectedDriverIds.size > 0) return state.selectedDriverIds.has(driverId);
  return state.selectedDriverId === 'all' || state.selectedDriverId === driverId;
}

// ── Campos de planejamento — mutações nestes campos marcam o plano como dirty ──
var _PLANNING_KEYS = new Set(['week', 'day', 'driverId', 'sequence', 'manualRouteInclude', 'eligibleForRouting']);

// Hook interno chamado após qualquer mutação de cliente.
// Marca dirty quando algum campo de planejamento foi alterado e loga a mudança.
function _onClientMutated(client, changedKeys) {
  if (!client || !changedKeys || !changedKeys.length) return;
  // Invalidate single-pass classify cache on any mutation
  state._clientMutationCounter = (state._clientMutationCounter || 0) + 1;
  if (typeof invalidateClassifyCache === 'function') invalidateClassifyCache();
  var hasPlanningChange = false;
  for (var i = 0; i < changedKeys.length; i++) {
    if (_PLANNING_KEYS.has(changedKeys[i])) {
      hasPlanningChange = true;
      state.hasUnsavedPlanChanges = true;
      break;
    }
  }
  if (hasPlanningChange && client.ddd) {
    _schedulePlanningAutosave(client.ddd);
  }
  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[STATE] client mutated', {
      id: client.id,
      clientGroupId: client.clientGroupId,
      changedKeys: changedKeys
    });
  }
}

// Mutação atômica de um único cliente.
// Aceita busca por client.id OU client.clientGroupId.
// Aplica shallow patch e dispara hook de rastreabilidade.
function patchClient(clientIdOrGroupId, patch) {
  if (!patch || typeof patch !== 'object') return null;
  var target = null;
  for (var i = 0; i < state.clients.length; i++) {
    var c = state.clients[i];
    if (c.id === clientIdOrGroupId || c.clientGroupId === clientIdOrGroupId) {
      target = c;
      break;
    }
  }
  if (!target) return null;
  var keys = Object.keys(patch);
  for (var k = 0; k < keys.length; k++) {
    target[keys[k]] = patch[keys[k]];
  }
  _onClientMutated(target, keys);
  return target;
}

// Mutação centralizada de clientes em bulk dentro de state.clients.
// Todas as alterações em propriedades de clientes (driverId, week, day, sequence, etc.)
// devem passar por esta função para garantir rastreabilidade.
function patchClients(filterFn, patchFn) {
  let changed = 0;
  state.clients.forEach(function(client) {
    if (!filterFn(client)) return;
    var before = {};
    _PLANNING_KEYS.forEach(function(k) { before[k] = client[k]; });
    patchFn(client);
    var mutatedKeys = [];
    _PLANNING_KEYS.forEach(function(k) { if (client[k] !== before[k]) mutatedKeys.push(k); });
    if (mutatedKeys.length > 0) {
      _onClientMutated(client, mutatedKeys);
    }
    changed += 1;
  });
  return changed;
}
