// filters.js - Read-only query and filter functions
// Extracted from map.html (Wave 4). No DOM access.
// Depends on: config.js, state.js, geo-utils.js, sessions-core.js, ui-helpers.js

function getDriverTerritoryColor(driverId) {
  const driver = getDriverById(driverId);
  return (driver && driver.territoryColor) || '#95a5a6';
}

function getNextAvailableTerritoryColor() {
  const usedColors = new Set(
    drivers
      .map((driver) => String(driver.territoryColor || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const paletteColor = driverTerritoryPalette.find((color) => !usedColors.has(color.toLowerCase()));
  if (paletteColor) {
    return paletteColor;
  }

  let generatedIndex = 0;
  let generatedColor = generateAdditionalTerritoryColor(generatedIndex);
  while (usedColors.has(generatedColor.toLowerCase())) {
    generatedIndex += 1;
    generatedColor = generateAdditionalTerritoryColor(generatedIndex);
  }
  return generatedColor;
}


function getDriverShortCode(driverId) {
  const driver = getDriverById(driverId);
  if (!driver) {
    return driverId;
  }
  const dddDrivers = getDriversByDDD(driver.ddd);
  const order = dddDrivers.findIndex((item) => item.id === driverId);
  return `${driver.ddd} - ${String(order >= 0 ? order + 1 : 1).padStart(2, '0')}`;
}

function getDriverPortfolio(driverId) {
  const portfolio = clients.filter((client) => client.driverId === driverId && client.ddd === Number(state.selectedDDD));
  const territories = Array.from(new Set(portfolio.map((client) => client.territory)));
  const totalDistance = portfolio.reduce((sum, client) => sum + (client.distance || 0), 0);
  return {
    stopCount: portfolio.length,
    territories,
    totalDistance
  };
}

// ════════════════════════════════════════════════════════════════
// UNIFIED SINGLE-PASS CLIENT CLASSIFIER
// ════════════════════════════════════════════════════════════════
// Replaces: getFilteredClients, getSpecialVisibleClients,
//           getTerritoryScopeClients, getNoCoordinateClients
// Single iteration over clients[] classifies into all 4 buckets.
// ════════════════════════════════════════════════════════════════
let _classifyCache = null;
let _classifyCacheKey = null;

function _buildClassifyCacheKey() {
  // Key captures ALL state that affects classification
  return [
    state.selectedDDD,
    state.selectedDriverId,
    Array.from(state.selectedDriverIds).sort().join(','),
    state.vehicleFilter,
    state.territoryFilter,
    Array.from(state.curvFilters).sort().join(','),
    Array.from(state.activeWeeks).sort().join(','),
    Array.from(state.activeDays).sort().join(','),
    state.showActiveClients ? 1 : 0,
    state.showInactiveClients ? 1 : 0,
    state.showNewClients ? 1 : 0,
    state._clientMutationCounter || 0
  ].join('|');
}

function classifyClients() {
  const key = _buildClassifyCacheKey();
  if (_classifyCacheKey === key && _classifyCache) {
    return _classifyCache;
  }

  const selectedDDD = Number(state.selectedDDD);
  const vehicleAll = state.vehicleFilter === 'all';
  const territoryAll = state.territoryFilter === 'all';
  const curvEmpty = state.curvFilters.size === 0;

  const filtered = [];
  const special = [];
  const territorial = [];
  const noCoord = [];

  for (let i = 0, len = clients.length; i < len; i++) {
    const client = clients[i];

    // ── Gate 1: DDD match (required for ALL buckets) ──
    if (client.ddd !== selectedDDD) continue;

    // ── Gate 2: Driver match (required for ALL buckets) ──
    if (!driverMatchesFilter(client.driverId)) continue;

    const ct = client.clientType || 'ativo';
    const hasCoord = hasValidCoordinate(client);
    const isSemCoord = ct === 'sem_coordenada';

    // ── noCoord bucket: sem_coordenada OR no valid coordinate ──
    if (isSemCoord || !hasCoord) {
      noCoord.push(client);
      continue;  // these clients cannot be in any other bucket
    }

    // From here: client has valid coordinates and is NOT sem_coordenada

    // ── Pre-compute shared filter conditions ──
    const vehicleOk = vehicleAll || client.vehicle === state.vehicleFilter;
    const territoryOk = territoryAll || client.territory === state.territoryFilter;
    const curvOk = curvEmpty || state.curvFilters.has(client.curva);
    const weekOk = state.activeWeeks.has(client.week);

    // ── territorial bucket: ddd + driver + vehicle + territory + curv + week ──
    if (vehicleOk && territoryOk && curvOk && weekOk) {
      territorial.push(client);
    }

    // ── Determine if client is active-equivalent for routing ──
    const isActiveEq = isActiveEquivalentClientType(ct);
    const isInativo = ct === 'inativo';
    const isNovo = ct === 'novo';

    // ── filtered bucket (routable active clients) ──
    if (state.showActiveClients) {
      const dayOk = state.activeDays.has(client.day);
      if (vehicleOk && territoryOk && curvOk && weekOk && dayOk) {
        let isRouted = false;
        if (isActiveEq) {
          isRouted = true;
        } else if (isInativo && client.manualRouteInclude) {
          isRouted = true;
        } else if (isNovo && client.eligibleForRouting) {
          isRouted = true;
        }
        if (isRouted) {
          filtered.push(client);
          continue;  // routed clients are NOT special — skip special check
        }
      }
    }

    // ── special bucket (visible non-routed inactive/new) ──
    if (!isActiveEq) {
      if (isInativo && !client.manualRouteInclude && state.showInactiveClients) {
        special.push(client);
      } else if (isNovo && !client.eligibleForRouting && state.showNewClients) {
        special.push(client);
      }
    }
  }

  _classifyCache = { filtered: filtered, special: special, territorial: territorial, noCoord: noCoord };
  _classifyCacheKey = key;
  // Territory shapes depend on territorial bucket — mark dirty on any classify rebuild
  state._territoryDirty = true;
  return _classifyCache;
}

// Invalidate cache on client mutations (called from patchClient/patchClients)
function invalidateClassifyCache() {
  _classifyCache = null;
  _classifyCacheKey = null;
  state._territoryDirty = true;
  // Also invalidate downstream route groups cache
  state.routeGroupsCache = [];
  state.filteredClientsCache = [];
}

// ── Legacy wrappers — preserve API for isolated call sites ──
function getFilteredClients() {
  return classifyClients().filtered;
}

function getSpecialVisibleClients() {
  return classifyClients().special;
}

function getTerritoryScopeClients() {
  return classifyClients().territorial;
}

// ── Safe accessor for cached route groups (avoids redundant buildRouteGroups) ──
function getRouteGroupsSafe() {
  if (state.routeGroupsCache && state.routeGroupsCache.length > 0) {
    return state.routeGroupsCache;
  }
  // Fallback: build from scratch if cache is empty (e.g. before first calculateRoutes)
  const groups = buildRouteGroups(classifyClients().filtered);
  state.routeGroupsCache = groups;
  state.filteredClientsCache = classifyClients().filtered;
  return groups;
}

function buildRouteGroups(filteredClients, options = {}) {
  const skipMetrics = options.skipMetrics || false;
  const groups = new Map();

  filteredClients.forEach((client) => {
    const routeId = createRouteId(client.ddd, client.driverId, client.week, client.day);
    if (!groups.has(routeId)) {
      const driver = getDriverById(client.driverId) || getDriversByDDD(client.ddd)[0];
      groups.set(routeId, {
        routeId,
        ddd: client.ddd,
        week: client.week,
        day: client.day,
        region: client.region,
        driver,
        clients: [],
        totalDistance: 0,
        totalTime: 0,
        totalServiceTime: 0,
        riskCount: 0,
        uniqueVehicles: new Set(),
        territories: new Set()
      });
    }

    const route = groups.get(routeId);
    route.clients.push(client);
    route.totalServiceTime += client.serviceTime;
    route.uniqueVehicles.add(client.vehicle);
    route.territories.add(client.territory);
    if (client.status === 'atencao' || client.priority === 'Alta') {
      route.riskCount += 1;
    }
  });

  return Array.from(groups.values()).map((route) => {
    const orderedClients = [...route.clients].sort((first, second) => first.sequence - second.sequence || first.id.localeCompare(second.id));
    let totalDistance = 0;
    let roadTime = 0;

    if (!skipMetrics) {
      let lastLat = route.driver.lat;
      let lastLon = route.driver.lon;

      orderedClients.forEach((client) => {
        totalDistance += distanceKm(lastLat, lastLon, client.lat, client.lon);
        lastLat = client.lat;
        lastLon = client.lon;
      });

      totalDistance += distanceKm(lastLat, lastLon, route.driver.lat, route.driver.lon);
      roadTime = totalDistance / 42 * 60;
    }

    return {
      ...route,
      clients: orderedClients,
      totalDistance,
      totalTime: Math.round(roadTime + route.totalServiceTime),
      uniqueVehicles: Array.from(route.uniqueVehicles),
      territories: Array.from(route.territories),
      routeLoad: orderedClients.length
    };
  }).sort((first, second) => first.week - second.week || second.routeLoad - first.routeLoad || first.ddd - second.ddd || first.day.localeCompare(second.day));
}

function getNextSequenceForRoute(clientId, ddd, week, day, driverId) {
  return clients
    .filter((client) => client.id !== clientId && client.ddd === ddd && client.week === week && client.day === day && client.driverId === driverId)
    .reduce((maxSequence, client) => Math.max(maxSequence, client.sequence || 0), 0) + 1;
}
