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

function getClientMapVisibility(client, options = {}) {
  const respectDdd = options.respectDdd !== false;
  const respectDriverFilter = options.respectDriverFilter !== false;
  const includeDayFilter = options.includeDayFilter !== false;
  const selectedDDD = Number(options.selectedDDD != null ? options.selectedDDD : state.selectedDDD);

  if (!client) {
    return {
      visible: false,
      bucket: null,
      noCoord: false,
      hiddenByStatus: false,
      matchesBaseFilters: false,
      inactive: false
    };
  }

  if (respectDdd && client.ddd !== selectedDDD) {
    return {
      visible: false,
      bucket: null,
      noCoord: false,
      hiddenByStatus: false,
      matchesBaseFilters: false,
      inactive: false
    };
  }

  if (respectDriverFilter && !driverMatchesFilter(client.driverId)) {
    return {
      visible: false,
      bucket: null,
      noCoord: false,
      hiddenByStatus: false,
      matchesBaseFilters: false,
      inactive: false
    };
  }

  const ct = client.clientType || 'ativo';
  const hasCoord = hasValidCoordinate(client);
  const isSemCoord = ct === 'sem_coordenada';
  const isInativo = ct === 'inativo';
  const isNovo = ct === 'novo';
  const isActiveEq = isActiveEquivalentClientType(ct);

  if (isSemCoord || !hasCoord) {
    return {
      visible: false,
      bucket: null,
      noCoord: true,
      hiddenByStatus: false,
      matchesBaseFilters: false,
      inactive: isInativo
    };
  }

  const _clientDriver = getDriverById(client.driverId);
  const vehicleOk = state.vehicleFilter === 'all'
    || ((_clientDriver ? _clientDriver.vehicle : client.vehicle) === state.vehicleFilter);
  const territoryOk = state.territoryFilter === 'all' || client.territory === state.territoryFilter;
  const curvOk = state.curvFilters.size === 0 || state.curvFilters.has(client.curva);
  const weekOk = state.activeWeeks.has(client.week);
  const matchesBaseFilters = vehicleOk && territoryOk && curvOk && weekOk;

  if (!matchesBaseFilters) {
    return {
      visible: false,
      bucket: null,
      noCoord: false,
      hiddenByStatus: false,
      matchesBaseFilters: false,
      inactive: isInativo
    };
  }

  const dayOk = !includeDayFilter || state.activeDays.has(client.day);

  if (isActiveEq && !client.day) {
    const visible = true;
    return {
      visible,
      bucket: 'special',
      noCoord: false,
      hiddenByStatus: false,
      matchesBaseFilters: true,
      inactive: false
    };
  }

  if (isActiveEq) {
    const visible = state.showActiveClients && dayOk;
    return {
      visible,
      bucket: visible ? 'filtered' : null,
      noCoord: false,
      hiddenByStatus: !state.showActiveClients && dayOk,
      matchesBaseFilters: true,
      inactive: false
    };
  }

  if (isInativo) {
    if (client.manualRouteInclude) {
      const visible = state.showActiveClients && dayOk;
      return {
        visible,
        bucket: visible ? 'filtered' : null,
        noCoord: false,
        hiddenByStatus: !state.showActiveClients && dayOk,
        matchesBaseFilters: true,
        inactive: true
      };
    }

    const visible = state.showInactiveClients;
    return {
      visible,
      bucket: visible ? 'special' : null,
      noCoord: false,
      hiddenByStatus: !state.showInactiveClients,
      matchesBaseFilters: true,
      inactive: true
    };
  }

  if (isNovo) {
    if (client.eligibleForRouting) {
      const visible = state.showActiveClients && dayOk;
      return {
        visible,
        bucket: visible ? 'filtered' : null,
        noCoord: false,
        hiddenByStatus: !state.showActiveClients && dayOk,
        matchesBaseFilters: true,
        inactive: false
      };
    }

    const visible = state.showNewClients;
    return {
      visible,
      bucket: visible ? 'special' : null,
      noCoord: false,
      hiddenByStatus: !state.showNewClients,
      matchesBaseFilters: true,
      inactive: false
    };
  }

  return {
    visible: false,
    bucket: null,
    noCoord: false,
    hiddenByStatus: false,
    matchesBaseFilters: true,
    inactive: false
  };
}

function isClientVisibleOnMap(client, options = {}) {
  return getClientMapVisibility(client, options).visible;
}

function getClientsVisibleOnMap() {
  const classified = classifyClients();
  return classified.filtered.concat(classified.special);
}

function getDriverPortfolio(driverId) {
  const selectedDDD = Number(state.selectedDDD);
  const allClients = clients.filter((client) => client.driverId === driverId && client.ddd === selectedDDD);
  const classified = classifyClients();
  const operationalClientIds = new Set(
    classified.filtered
      .filter((client) => {
        const clientType = String(client.clientType || 'ativo').toLowerCase();
        if (clientType === 'inativo') return false;
        if (client.autoRoutingBlocked) return false;
        return true;
      })
      .filter((client) => client.driverId === driverId && client.ddd === selectedDDD)
      .map((client) => client.id)
  );
  const noCoordClientIds = new Set(
    classified.noCoord
      .filter((client) => client.driverId === driverId && client.ddd === selectedDDD)
      .map((client) => client.id)
  );
  const mapVisibleClients = allClients.filter((client) => operationalClientIds.has(client.id));
  const noCoord = allClients.filter((client) => noCoordClientIds.has(client.id));
  const hiddenByStatus = allClients.filter((client) => {
    if (operationalClientIds.has(client.id) || noCoordClientIds.has(client.id)) return false;
    const clientType = String(client.clientType || 'ativo').toLowerCase();
    if (client.autoRoutingBlocked) {
      return true;
    }
    if (clientType === 'inativo') {
      return true;
    }
    if (clientType === 'novo') {
      return !client.eligibleForRouting && !state.showNewClients;
    }
    return isActiveEquivalentClientType(clientType) && !state.showActiveClients;
  });
  const inactiveClients = allClients.filter((client) => (client.clientType || 'ativo') === 'inativo');
  const territories = Array.from(new Set(allClients.map((client) => client.territory)));
  const totalDistance = mapVisibleClients.reduce((sum, client) => sum + (client.distance || 0), 0);
  return {
    stopCount: mapVisibleClients.length,
    mapCount: mapVisibleClients.length,
    totalCount: allClients.length,
    noCoordCount: noCoord.length,
    inactiveCount: inactiveClients.length,
    hiddenByStatusCount: hiddenByStatus.length,
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

    const visibility = getClientMapVisibility(client, {
      respectDdd: false,
      respectDriverFilter: false
    });

    if (visibility.noCoord) {
      noCoord.push(client);
      continue;
    }

    if (!visibility.matchesBaseFilters) {
      if (isActiveEquivalentClientType((client.clientType || 'ativo').toLowerCase()) && (!client.day || !client.week)) {
        if (state.showNewClients) {
          special.push(client);
        }
      }
      continue;
    }

    const ct = (client.clientType || 'ativo').toLowerCase();
    if (ct !== 'inativo' && client.day) {
      territorial.push(client);
    }

    if (visibility.bucket === 'filtered') {
      filtered.push(client);
      continue;
    }

    if (visibility.bucket === 'special') {
      special.push(client);
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

// ================================================================
// AUDITORIA DE INTEGRIDADE - SOMENTE LEITURA
// Funcoes de diagnostico. Nao alteram estado, nao renderizam nada.
// Uso: console do browser -> _rfxAudit() ou _rfxAuditDetail('drv_id')
// ================================================================

function _buildDriverIntegrityReport(driverId) {
  const portfolio = getDriverPortfolio(driverId);
  const driver = getDriverById(driverId);

  const integrityPct = portfolio.totalCount > 0
    ? Math.round((portfolio.stopCount / portfolio.totalCount) * 100)
    : 100;

  let integrityStatus;
  if (integrityPct >= 85) {
    integrityStatus = 'OK';
  } else if (integrityPct >= 60) {
    integrityStatus = 'ATENCAO';
  } else {
    integrityStatus = 'DIVERGENTE';
  }

  const warnings = [];
  if (portfolio.noCoordCount > 5) {
    warnings.push({ code: 'HIGH_NO_COORD', severity: 'warn', message: `${portfolio.noCoordCount} clientes sem coordenada` });
  } else if (portfolio.noCoordCount > 0) {
    warnings.push({ code: 'HAS_NO_COORD', severity: 'info', message: `${portfolio.noCoordCount} cliente(s) sem coordenada` });
  }
  if (portfolio.inactiveCount > 10) {
    warnings.push({ code: 'HIGH_INACTIVE', severity: 'warn', message: `${portfolio.inactiveCount} clientes inativos` });
  } else if (portfolio.inactiveCount > 0) {
    warnings.push({ code: 'HAS_INACTIVE', severity: 'info', message: `${portfolio.inactiveCount} cliente(s) inativo(s)` });
  }
  if (portfolio.hiddenByStatusCount > 0) {
    warnings.push({ code: 'HAS_HIDDEN', severity: 'info', message: `${portfolio.hiddenByStatusCount} oculto(s) por status/bloqueio` });
  }
  if (integrityStatus === 'DIVERGENTE') {
    warnings.push({ code: 'LOW_INTEGRITY', severity: 'error', message: `Integridade baixa: apenas ${integrityPct}% dos clientes estão operacionais` });
  }

  return {
    driverId,
    driverCode: getDriverShortCode(driverId),
    driverName: driver ? driver.name : '(motorista não encontrado)',
    totalCount: portfolio.totalCount,
    stopCount: portfolio.stopCount,
    noCoordCount: portfolio.noCoordCount,
    inactiveCount: portfolio.inactiveCount,
    hiddenByStatusCount: portfolio.hiddenByStatusCount,
    integrityPct,
    integrityStatus,
    warnings
  };
}

window._rfxAudit = function () {
  const ddd = Number(state.selectedDDD);
  const dddDrivers = (typeof getDriversByDDD === 'function') ? getDriversByDDD(ddd) : [];

  if (!dddDrivers.length) {
    console.warn('[_rfxAudit] Nenhum motorista encontrado para DDD', ddd);
    return [];
  }

  const reports = dddDrivers.map((driver) => _buildDriverIntegrityReport(driver.id));

  const tableRows = reports.map((r) => ({
    'Código': r.driverCode,
    'Nome': r.driverName,
    'Total CRM': r.totalCount,
    'Operacionais': r.stopCount,
    'Sem Coord': r.noCoordCount,
    'Inativos': r.inactiveCount,
    'Ocultos': r.hiddenByStatusCount,
    'Integridade %': r.integrityPct,
    'Status': r.integrityStatus,
    'Alertas': r.warnings.map((w) => w.message).join(' | ') || '-'
  }));

  console.groupCollapsed('[_rfxAudit] DDD ' + ddd + ' - ' + reports.length + ' motoristas');
  console.table(tableRows);
  const totalOp = reports.reduce((s, r) => s + r.stopCount, 0);
  const totalCrm = reports.reduce((s, r) => s + r.totalCount, 0);
  const totalNoCoord = reports.reduce((s, r) => s + r.noCoordCount, 0);
  const totalInactive = reports.reduce((s, r) => s + r.inactiveCount, 0);
  const totalHidden = reports.reduce((s, r) => s + r.hiddenByStatusCount, 0);
  console.log(`TOTAL — CRM: ${totalCrm} | Operacionais: ${totalOp} | Sem coord: ${totalNoCoord} | Inativos: ${totalInactive} | Ocultos: ${totalHidden}`);
  const atencao = reports.filter((r) => r.integrityStatus === 'ATENCAO').length;
  const divergente = reports.filter((r) => r.integrityStatus === 'DIVERGENTE').length;
  if (divergente > 0) {
    console.warn('[!] ' + divergente + ' motorista(s) com status DIVERGENTE');
  } else if (atencao > 0) {
    console.info('[i] ' + atencao + ' motorista(s) com status ATENCAO');
  } else {
    console.log('[OK] Todos os motoristas com integridade OK');
  }
  console.groupEnd();

  return reports;
};

window._rfxAuditDetail = function (driverId) {
  if (!driverId) {
    console.warn('[_rfxAuditDetail] Informe um driverId. Use _rfxAudit() para listar os disponíveis.');
    return null;
  }

  const ddd = Number(state.selectedDDD);
  const allForDriver = clients.filter((c) => c.driverId === driverId && c.ddd === ddd);

  if (!allForDriver.length) {
    console.warn(`[_rfxAuditDetail] Nenhum cliente encontrado para driverId="${driverId}" no DDD ${ddd}`);
    return null;
  }

  const classified = classifyClients();
  const operationalIds = new Set(
    classified.filtered
      .filter((c) => {
        const ct = String(c.clientType || 'ativo').toLowerCase();
        if (ct === 'inativo') return false;
        if (c.autoRoutingBlocked) return false;
        return c.driverId === driverId && c.ddd === ddd;
      })
      .map((c) => c.id)
  );
  const noCoordIds = new Set(
    classified.noCoord
      .filter((c) => c.driverId === driverId && c.ddd === ddd)
      .map((c) => c.id)
  );

  const operational = allForDriver.filter((c) => operationalIds.has(c.id));
  const noCoord = allForDriver.filter((c) => noCoordIds.has(c.id));
  const inactive = allForDriver.filter((c) => (c.clientType || 'ativo') === 'inativo');
  const hidden = allForDriver.filter((c) => {
    if (operationalIds.has(c.id) || noCoordIds.has(c.id)) return false;
    const ct = String(c.clientType || 'ativo').toLowerCase();
    return ct === 'inativo' || c.autoRoutingBlocked || ct === 'novo';
  });

  const report = _buildDriverIntegrityReport(driverId);

  const pick = (c) => ({
    id: c.id,
    nome: c.nomeFantasia || c.name,
    endereco: c.address,
    clientType: c.clientType,
    lat: c.lat,
    lon: c.lon,
    week: c.week,
    day: c.day,
    manualRouteInclude: c.manualRouteInclude || false,
    autoRoutingBlocked: c.autoRoutingBlocked || false
  });

  const detail = {
    driverCode: report.driverCode,
    driverName: report.driverName,
    integrityStatus: report.integrityStatus,
    integrityPct: report.integrityPct,
    operational: operational.map(pick),
    noCoord: noCoord.map(pick),
    inactive: inactive.map(pick),
    hidden: hidden.map(pick)
  };

  console.groupCollapsed('[_rfxAuditDetail] ' + report.driverCode + ' - ' + report.driverName);
  console.log('Status de integridade:', report.integrityStatus, `(${report.integrityPct}%)`);
  console.log(`Operacionais (${detail.operational.length}):`); console.table(detail.operational);
  console.log(`Sem coordenada (${detail.noCoord.length}):`); console.table(detail.noCoord);
  console.log(`Inativos (${detail.inactive.length}):`); console.table(detail.inactive);
  console.log(`Ocultos/outros (${detail.hidden.length}):`); console.table(detail.hidden);
  if (report.warnings.length) {
    console.warn('Alertas:', report.warnings);
  }
  console.groupEnd();

  return detail;
};

function _createVisitScheduleWeekMatrix(weeks, weekdays) {
  const matrix = {};
  weeks.forEach((week) => {
    const weekKey = 'S' + week;
    matrix[weekKey] = {};
    weekdays.forEach((day) => {
      matrix[weekKey][day] = 0;
    });
  });
  return matrix;
}

function _normalizeVisitScheduleDriverValue(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function _normalizeVisitScheduleDriverMatch(client, input) {
  const val = _normalizeVisitScheduleDriverValue(input);
  const technicalDriverId = String(client && client.driverId || '').toLowerCase();
  const territory = _normalizeVisitScheduleDriverValue(client && client.territory_code);
  const seller = _normalizeVisitScheduleDriverValue((client && (client.seller_name || client._sellerName)) || '');
  const shortCode = typeof getDriverShortCode === 'function'
    ? _normalizeVisitScheduleDriverValue(getDriverShortCode(client && client.driverId || ''))
    : '';
  const visualCode = shortCode ? ('mt' + shortCode) : '';

  return (
    technicalDriverId === val ||
    territory === val ||
    seller === val ||
    shortCode === val ||
    visualCode === val
  );
}

function _resolveVisitScheduleDriver(driverId) {
  const normalizedInput = _normalizeVisitScheduleDriverValue(driverId);
  const dddDrivers = typeof getDriversByDDD === 'function' ? getDriversByDDD(Number(state.selectedDDD)) : [];
  return dddDrivers.find((candidate) => {
    const technicalDriverId = String(candidate && candidate.id || '').toLowerCase();
    const shortCode = typeof getDriverShortCode === 'function'
      ? _normalizeVisitScheduleDriverValue(getDriverShortCode(candidate && candidate.id || ''))
      : '';
    const visualCode = shortCode ? ('mt' + shortCode) : '';
    return technicalDriverId === normalizedInput || shortCode === normalizedInput || visualCode === normalizedInput;
  }) || (typeof getDriverById === 'function' ? getDriverById(driverId) : null);
}

function _collectVisitScheduleIgnoredCounts(driverId) {
  const selectedDDD = Number(state.selectedDDD);
  const counts = { noCoord: 0, inactive: 0, blocked: 0 };

  clients.forEach((client) => {
    if (!client) return;
    if (client.ddd !== selectedDDD) return;
    if (!_normalizeVisitScheduleDriverMatch(client, driverId)) return;

    const clientType = String(client.clientType || 'ativo').toLowerCase();
    if (client.autoRoutingBlocked) {
      counts.blocked += 1;
      return;
    }
    if (clientType === 'inativo') {
      counts.inactive += 1;
      return;
    }
    if (clientType === 'sem_coordenada' || !hasValidCoordinate(client)) {
      counts.noCoord += 1;
    }
  });

  return counts;
}

function _collectVisitScheduleEligibleClients(driverId, options = {}) {
  const selectedDDD = Number(state.selectedDDD);
  const respectOperationalFilters = options.respectOperationalFilters === true;

  return clients.filter((client) => {
    if (!client) return false;
    if (client.ddd !== selectedDDD) return false;
    if (!_normalizeVisitScheduleDriverMatch(client, driverId)) return false;
    if (!hasValidCoordinate(client)) return false;

    const clientType = String(client.clientType || 'ativo').toLowerCase();
    if (clientType === 'inativo') return false;
    if (clientType === 'sem_coordenada') return false;
    if (client.autoRoutingBlocked) return false;

    if (respectOperationalFilters) {
      const visibility = getClientMapVisibility(client, {
        respectDdd: false,
        respectDriverFilter: false,
        includeDayFilter: false
      });
      if (!visibility.matchesBaseFilters) return false;
      if (!isActiveEquivalentClientType(clientType) && !(clientType === 'novo' && client.eligibleForRouting)) {
        return false;
      }
    }

    return true;
  });
}

// ── Panel day/cycle matrix — same scope as _collectVisitScheduleEligibleClients ──
// Returns { matrix, weekTotals, dayTotals, totalCount, totalDistance }
// Used by renderManualDayDetail to replace the route-load-based dayStats count.
function _buildDayMatrixForPanel(driverId) {
  const weeks = [1, 2, 3, 4];
  const weekdays = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
  const eligibleClients = _collectVisitScheduleEligibleClients(driverId, {});
  const driver = _resolveVisitScheduleDriver(driverId);
  const baseLat = driver ? driver.lat : null;
  const baseLon = driver ? driver.lon : null;
  const hasBase = baseLat != null && baseLon != null
    && typeof distanceKm === 'function';

  // Initialize matrix
  const matrix = {};
  weeks.forEach((w) => {
    matrix[w] = {};
    weekdays.forEach((d) => {
      matrix[w][d] = { clients: [], count: 0, distance: 0 };
    });
  });

  // Assign clients to matrix cells
  eligibleClients.forEach((client) => {
    const w = Number(client.week);
    const d = String(client.day || '').toUpperCase();
    if (matrix[w] && matrix[w][d]) {
      matrix[w][d].clients.push(client);
      matrix[w][d].count++;
    }
  });

  // Calculate distance per cell (same formula as buildRouteGroups)
  weeks.forEach((w) => {
    weekdays.forEach((d) => {
      const cell = matrix[w][d];
      if (cell.clients.length > 0 && hasBase) {
        const ordered = [...cell.clients].sort(
          (a, b) => (a.sequence || 0) - (b.sequence || 0) || a.id.localeCompare(b.id)
        );
        let lastLat = baseLat;
        let lastLon = baseLon;
        let dist = 0;
        ordered.forEach((c) => {
          dist += distanceKm(lastLat, lastLon, c.lat, c.lon);
          lastLat = c.lat;
          lastLon = c.lon;
        });
        dist += distanceKm(lastLat, lastLon, baseLat, baseLon);
        cell.distance = dist;
      }
    });
  });

  // Week totals
  const weekTotals = {};
  weeks.forEach((w) => {
    let count = 0;
    let distance = 0;
    weekdays.forEach((d) => {
      count += matrix[w][d].count;
      distance += matrix[w][d].distance;
    });
    weekTotals[w] = { count, distance };
  });

  // Day totals
  const dayTotals = {};
  weekdays.forEach((d) => {
    let count = 0;
    let distance = 0;
    weeks.forEach((w) => {
      count += matrix[w][d].count;
      distance += matrix[w][d].distance;
    });
    dayTotals[d] = { count, distance };
  });

  const totalCount = eligibleClients.length;
  const totalDistance = weeks.reduce((s, w) => s + weekTotals[w].distance, 0);

  return { matrix, weekTotals, dayTotals, totalCount, totalDistance };
}

function _buildVisitScheduleAudit(driverId, options = {}) {
  const weeks = Array.isArray(options.weeks) && options.weeks.length
    ? options.weeks.map((week) => Number(week)).filter((week) => Number.isFinite(week))
    : [1, 2, 3, 4];
  const weekdays = Array.isArray(options.weekdays) && options.weekdays.length
    ? options.weekdays.map((day) => String(day || '').toUpperCase())
    : ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
  const semanas = _createVisitScheduleWeekMatrix(weeks, weekdays);
  const eligibleClients = _collectVisitScheduleEligibleClients(driverId, options);
  const avisos = [];
  const resolvedDriver = _resolveVisitScheduleDriver(driverId)
    || (eligibleClients[0] && typeof getDriverById === 'function' ? getDriverById(eligibleClients[0].driverId) : null);

  let outsideAnalysisCount = 0;
  eligibleClients.forEach((client) => {
    const weekKey = 'S' + Number(client.week);
    const dayKey = String(client.day || '').toUpperCase();
    if (!semanas[weekKey] || !Object.prototype.hasOwnProperty.call(semanas[weekKey], dayKey)) {
      outsideAnalysisCount += 1;
      return;
    }
    semanas[weekKey][dayKey] += 1;
  });

  const windowCounts = [];
  weeks.forEach((week) => {
    const weekKey = 'S' + week;
    weekdays.forEach((day) => {
      windowCounts.push(semanas[weekKey][day]);
    });
  });

  const totalJanelas = windowCounts.length;
  const mediaPorJanela = totalJanelas > 0
    ? Number((eligibleClients.length / totalJanelas).toFixed(2))
    : 0;
  const menorJanela = windowCounts.length ? Math.min.apply(null, windowCounts) : 0;
  const maiorJanela = windowCounts.length ? Math.max.apply(null, windowCounts) : 0;
  const variance = totalJanelas > 0
    ? windowCounts.reduce((sum, count) => sum + Math.pow(count - mediaPorJanela, 2), 0) / totalJanelas
    : 0;
  const desvioCarga = Number(Math.sqrt(variance).toFixed(2));
  const janelasVazias = windowCounts.filter((count) => count === 0).length;
  const overloadThreshold = Math.ceil(mediaPorJanela + 1);
  const janelasSobrecarregadas = windowCounts.filter((count) => count > overloadThreshold).length;

  if (!resolvedDriver) {
    avisos.push('Motorista nao encontrado no cadastro atual.');
  }
  if (!eligibleClients.length) {
    avisos.push('Nenhum cliente apto para visita encontrado no escopo informado.');
  }
  if (outsideAnalysisCount > 0) {
    avisos.push(outsideAnalysisCount + ' cliente(s) aptos estao fora da grade SEG-SEX / S1-S4 e nao entraram na matriz.');
  }
  if (janelasVazias > 0) {
    avisos.push(janelasVazias + ' janela(s) sem clientes.');
  }
  if (janelasSobrecarregadas > 0) {
    avisos.push(janelasSobrecarregadas + ' janela(s) acima da faixa media de carga.');
  }

  return {
    driverId: resolvedDriver ? resolvedDriver.id : driverId,
    driverCode: resolvedDriver && typeof getDriverShortCode === 'function' ? getDriverShortCode(resolvedDriver.id) : driverId,
    driverName: resolvedDriver ? resolvedDriver.name : null,
    totalClientesAptos: eligibleClients.length,
    semanas,
    metricas: {
      totalJanelas,
      mediaPorJanela,
      menorJanela,
      maiorJanela,
      desvioCarga,
      janelasVazias,
      janelasSobrecarregadas
    },
    avisos
  };
}

window._rfxVisitScheduleAudit = function (driverId, options = {}) {
  if (!driverId) {
    console.warn('[_rfxVisitScheduleAudit] Informe um driverId.');
    return null;
  }

  const report = _buildVisitScheduleAudit(driverId, options);
  const tableRows = [];
  Object.keys(report.semanas).forEach((weekKey) => {
    const daysMap = report.semanas[weekKey];
    tableRows.push({
      Semana: weekKey,
      SEG: daysMap.SEG || 0,
      TER: daysMap.TER || 0,
      QUA: daysMap.QUA || 0,
      QUI: daysMap.QUI || 0,
      SEX: daysMap.SEX || 0
    });
  });

  console.groupCollapsed('[_rfxVisitScheduleAudit] ' + report.driverCode + ' - ' + (report.driverName || 'Sem nome'));
  console.table(tableRows);
  console.log('Metricas:', report.metricas);
  if (report.avisos.length) {
    console.warn('Avisos:', report.avisos);
  }
  console.groupEnd();

  return report;
};

window._rfxVisitScheduleAuditAll = function (options = {}) {
  const ddd = Number(state.selectedDDD);
  const dddDrivers = typeof getDriversByDDD === 'function' ? getDriversByDDD(ddd) : [];

  if (!dddDrivers.length) {
    console.warn('[_rfxVisitScheduleAuditAll] Nenhum motorista encontrado para DDD', ddd);
    return [];
  }

  const reports = dddDrivers.map((driver) => _buildVisitScheduleAudit(driver.id, options));
  const summaryRows = reports.map((report) => ({
    Codigo: report.driverCode,
    Nome: report.driverName || '-',
    Aptos: report.totalClientesAptos,
    'Media/Janela': report.metricas.mediaPorJanela,
    'Menor Janela': report.metricas.menorJanela,
    'Maior Janela': report.metricas.maiorJanela,
    'Desvio': report.metricas.desvioCarga,
    Vazias: report.metricas.janelasVazias,
    Sobrecarregadas: report.metricas.janelasSobrecarregadas,
    Avisos: report.avisos.join(' | ') || '-'
  }));

  console.groupCollapsed('[_rfxVisitScheduleAuditAll] DDD ' + ddd + ' - ' + reports.length + ' motoristas');
  console.table(summaryRows);
  console.groupEnd();

  return reports;
};

function _createVisitScheduleArrayMatrix(weeks, weekdays) {
  const matrix = {};
  weeks.forEach((week) => {
    const weekKey = 'S' + week;
    matrix[weekKey] = {};
    weekdays.forEach((day) => {
      matrix[weekKey][day] = [];
    });
  });
  return matrix;
}

function _countVisitScheduleDistribution(clientsList, weeks, weekdays) {
  const matrix = _createVisitScheduleWeekMatrix(weeks, weekdays);
  (clientsList || []).forEach((client) => {
    const weekKey = 'S' + Number(client.week);
    const dayKey = String(client.day || '').toUpperCase();
    if (!matrix[weekKey] || !Object.prototype.hasOwnProperty.call(matrix[weekKey], dayKey)) {
      return;
    }
    matrix[weekKey][dayKey] += 1;
  });
  return matrix;
}

function _orderVisitScheduleClientsForPreview(eligibleClients, driver) {
  const scoped = Array.isArray(eligibleClients) ? eligibleClients.slice() : [];
  if (!scoped.length) {
    return [];
  }

  const hasDriverBase = driver && Number.isFinite(Number(driver.lat)) && Number.isFinite(Number(driver.lon));
  if (!hasDriverBase || typeof distanceKm !== 'function') {
    return scoped.sort((first, second) => {
      if ((first.sequence || 0) !== (second.sequence || 0)) return (first.sequence || 0) - (second.sequence || 0);
      if ((first.week || 0) !== (second.week || 0)) return (first.week || 0) - (second.week || 0);
      return String(first.id || '').localeCompare(String(second.id || ''));
    });
  }

  const remaining = scoped.slice().sort((first, second) => {
    const firstDist = distanceKm(driver.lat, driver.lon, first.lat, first.lon);
    const secondDist = distanceKm(driver.lat, driver.lon, second.lat, second.lon);
    if (firstDist !== secondDist) return firstDist - secondDist;
    return String(first.id || '').localeCompare(String(second.id || ''));
  });

  const ordered = [];
  let pivot = remaining.shift();
  if (!pivot) {
    return ordered;
  }
  ordered.push(pivot);

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const candidateDistance = distanceKm(pivot.lat, pivot.lon, candidate.lat, candidate.lon);
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance;
        bestIndex = index;
      }
    }
    pivot = remaining.splice(bestIndex, 1)[0];
    ordered.push(pivot);
  }

  return ordered;
}

function _buildVisitScheduleSuggestion(driverId, options = {}) {
  const weeks = [1, 2, 3, 4];
  const weekdays = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
  const resolvedDriver = _resolveVisitScheduleDriver(driverId);
  const audit = _buildVisitScheduleAudit(driverId, options);
  const ignored = _collectVisitScheduleIgnoredCounts(driverId);
  const eligibleClients = _collectVisitScheduleEligibleClients(driverId, options);
  const orderedClients = _orderVisitScheduleClientsForPreview(eligibleClients, resolvedDriver);
  const distribuicaoAtual = _countVisitScheduleDistribution(eligibleClients, weeks, weekdays);
  const distribuicao = _createVisitScheduleArrayMatrix(weeks, weekdays);
  const windowKeys = [];

  weeks.forEach((week) => {
    weekdays.forEach((day) => {
      windowKeys.push({ week, day, weekKey: 'S' + week });
    });
  });

  const totalClientes = orderedClients.length;
  const totalJanelas = windowKeys.length;
  const baseTarget = totalJanelas > 0 ? Math.floor(totalClientes / totalJanelas) : 0;
  const remainder = totalJanelas > 0 ? totalClientes % totalJanelas : 0;
  const targets = windowKeys.map((_, index) => baseTarget + (index < remainder ? 1 : 0));

  let cursor = 0;
  windowKeys.forEach((windowEntry, index) => {
    const targetCount = targets[index];
    for (let assigned = 0; assigned < targetCount && cursor < orderedClients.length; assigned += 1) {
      distribuicao[windowEntry.weekKey][windowEntry.day].push(orderedClients[cursor].id);
      cursor += 1;
    }
  });

  const counts = windowKeys.map((windowEntry) => distribuicao[windowEntry.weekKey][windowEntry.day].length);
  const mediaPorJanela = totalJanelas > 0 ? Number((totalClientes / totalJanelas).toFixed(2)) : 0;
  const menorJanela = counts.length ? Math.min.apply(null, counts) : 0;
  const maiorJanela = counts.length ? Math.max.apply(null, counts) : 0;
  const variance = totalJanelas > 0
    ? counts.reduce((sum, count) => sum + Math.pow(count - mediaPorJanela, 2), 0) / totalJanelas
    : 0;
  const desvio = Number(Math.sqrt(variance).toFixed(2));
  const diff = orderedClients.map((client) => {
    let weekSugerida = client.week;
    let daySugerido = client.day;

    for (let index = 0; index < windowKeys.length; index += 1) {
      const windowEntry = windowKeys[index];
      if (distribuicao[windowEntry.weekKey][windowEntry.day].includes(client.id)) {
        weekSugerida = windowEntry.week;
        daySugerido = windowEntry.day;
        break;
      }
    }

    const mudou = Number(client.week) !== Number(weekSugerida) || String(client.day || '').toUpperCase() !== String(daySugerido || '').toUpperCase();
    return {
      clientId: client.id,
      nome: client.nomeFantasia || client.tradeName || client.name || client.id,
      weekAtual: client.week,
      dayAtual: client.day,
      weekSugerida,
      daySugerido,
      mudou
    };
  });
  const totalMudancas = diff.filter((item) => item.mudou).length;
  const totalPreservados = diff.length - totalMudancas;
  const percentualMudanca = totalClientes > 0 ? Number(((totalMudancas / totalClientes) * 100).toFixed(2)) : 0;

  return {
    driverId: resolvedDriver ? resolvedDriver.id : driverId,
    driverCode: resolvedDriver && typeof getDriverShortCode === 'function' ? getDriverShortCode(resolvedDriver.id) : driverId,
    driverName: resolvedDriver ? resolvedDriver.name : null,
    totalClientes,
    totalJanelas,
    mediaPorJanela,
    distribuicaoAtual,
    distribuicaoSugerida: _countVisitScheduleDistribution(diff.map((item) => ({ week: item.weekSugerida, day: item.daySugerido })), weeks, weekdays),
    distribuicao,
    diff,
    impacto: {
      totalClientes,
      totalMudancas,
      totalPreservados,
      percentualMudanca
    },
    resumo: {
      menorJanela,
      maiorJanela,
      desvio
    },
    auditBase: {
      totalClientesAptos: audit.totalClientesAptos,
      avisos: audit.avisos.slice(),
      ignorados: ignored
    }
  };
}

window._rfxSuggestVisitSchedule = function (driverId, options = {}) {
  if (!driverId) {
    console.warn('[_rfxSuggestVisitSchedule] Informe um driverId.');
    return null;
  }

  const preview = _buildVisitScheduleSuggestion(driverId, options);
  const tableRows = [];
  Object.keys(preview.distribuicao).forEach((weekKey) => {
    const daysMap = preview.distribuicao[weekKey];
    tableRows.push({
      Semana: weekKey,
      SEG: daysMap.SEG.length,
      TER: daysMap.TER.length,
      QUA: daysMap.QUA.length,
      QUI: daysMap.QUI.length,
      SEX: daysMap.SEX.length
    });
  });

  console.groupCollapsed('[_rfxSuggestVisitSchedule] ' + (preview.driverCode || preview.driverId) + ' - ' + (preview.driverName || 'Sem nome'));
  console.table(tableRows);
  console.log('Resumo:', {
    totalClientes: preview.totalClientes,
    mediaPorJanela: preview.mediaPorJanela,
    menorJanela: preview.resumo.menorJanela,
    maiorJanela: preview.resumo.maiorJanela,
    desvio: preview.resumo.desvio
  });
  if (preview.auditBase.avisos.length) {
    console.warn('Avisos da auditoria base:', preview.auditBase.avisos);
  }
  console.groupEnd();

  return preview;
};

window._rfxApplyVisitScheduleSuggestion = function (preview) {
  if (!preview || !preview.distribuicao || typeof preview.distribuicao !== 'object') {
    return { ok: false, changed: 0, message: 'Preview de agenda invalido ou ausente.' };
  }
  if (!Array.isArray(preview.diff)) {
    return { ok: false, changed: 0, message: 'Preview invalido: diff ausente.' };
  }

  const resolvedDriverId = preview.driverId;
  const eligibleClients = _collectVisitScheduleEligibleClients(resolvedDriverId, {});
  if (!eligibleClients.length) {
    return { ok: false, changed: 0, message: 'Nao ha clientes aptos para aplicar a sugestao informada.' };
  }
  if (eligibleClients.length !== Number(preview.totalClientes || 0)) {
    return { ok: false, changed: 0, message: 'O cenário mudou desde que a sugestão foi gerada. Gere uma nova sugestão antes de aplicar.' };
  }

  const eligibleIds = new Set(eligibleClients.map((client) => client.id));
  const assignmentMap = new Map();
  Object.keys(preview.distribuicao).forEach((weekKey) => {
    const weekNumber = Number(String(weekKey).replace(/\D/g, ''));
    const daysMap = preview.distribuicao[weekKey] || {};
    Object.keys(daysMap).forEach((day) => {
      (daysMap[day] || []).forEach((clientId) => {
        assignmentMap.set(clientId, { week: weekNumber, day: String(day || '').toUpperCase() });
      });
    });
  });

  let changed = 0;
  patchClients(
    function(client) {
      return eligibleIds.has(client.id) && assignmentMap.has(client.id);
    },
    function(client) {
      const next = assignmentMap.get(client.id);
      if (!next) return;
      if (client.week === next.week && client.day === next.day) return;
      client.week = next.week;
      client.day = next.day;
      changed += 1;
    }
  );

  if (!changed) {
    return {
      ok: true,
      changed: 0,
      message: 'Nenhum cliente precisou ser redistribuido. A agenda sugerida ja coincide com o estado atual.'
    };
  }

  if (typeof markPlanAsDirty === 'function') {
    markPlanAsDirty();
  }
  if (typeof applyFilters === 'function') {
    applyFilters({ skipFitBounds: true });
  }

  return {
    ok: true,
    changed,
    total: eligibleClients.length,
    message: 'Balanceamento aplicado com sucesso. ' + changed + ' clientes redistribuidos entre S1-S4 e SEG-SEX.'
  };
};
