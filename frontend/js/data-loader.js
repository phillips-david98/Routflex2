// ROUTflex — Data Loading & Client Mapping
// Extracted from map.html — Phase 3 Wave 2
// Runtime deps (global scope): state, BACKEND_API_BASE, CRM_API_BASE,
//   getDriversByDDD, getCrmSessionIdForDDD, logger, config constants,
//   seededRandom, hasValidCoordinate (geo-utils.js)

async function loadCustomers() {
  // ══ SEPARAÇÃO DE FONTES ══════════════════════════════════════════════════
  // SIMULATION → Python backend (simulation_store.py) — dados isolados de teste
  // REAL       → CRM backend (mockStore.js ou PostgreSQL) — dados de integração
  // ═════════════════════════════════════════════════════════════════════════
  if (state.mode === 'SIMULATION') {
    return await loadCustomersFromSimulation();
  }
  return await loadCustomersFromCRM();
}

// ── SIMULATION: carrega de Python /simulation/customers ────────────────────
async function loadCustomersFromSimulation() {
  const endpoint = `${BACKEND_API_BASE}/simulation/customers`;
  logger.info('[FLOW SIMULATION] carregando clientes do Python simulation_store');

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} em ${endpoint}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.items)
      ? payload.items
      : (Array.isArray(payload) ? payload : []);

    logger.info('[FLOW SIMULATION] clientes carregados do Python', {
      total: items.length,
      source: 'simulation_store.py'
    });

    return items.map(mapSimulationCustomerToClient);
  } catch (error) {
    logger.error('[FLOW SIMULATION] falha ao carregar clientes do Python', {
      message: error && error.message ? error.message : String(error)
    });
    // Separação estrita: não mistura com CRM automaticamente em modo SIMULATION.
    return [];
  }
}

// ── Mapeamento: formato simulation_store.py → formato interno do mapa ──────
function mapSimulationCustomerToClient(source, index) {
  const ddd = Number(source.ddd || state.selectedDDD || 65);
  const dddDrivers = getDriversByDDD(ddd);
  const assignedDriver = dddDrivers[index % Math.max(dddDrivers.length, 1)] || dddDrivers[0] || null;
  const rawStatus = String(source.status || 'ATIVO').toUpperCase();
  const clientType = rawStatus === 'SEM_COORDENADA'
    ? 'sem_coordenada'
    : rawStatus === 'INATIVO'
      ? 'inativo'
      : rawStatus === 'NOVO'
        ? 'novo'
        : 'ativo';
  const clientGroupId = String(source.client_id || source.id || `SIM-${String(index + 1).padStart(6, '0')}`);
  const id = `${clientGroupId}-w${source.visit_week || 1}`;
  const lat = source.lat === null || source.lat === undefined ? null : Number(source.lat);
  const lon = source.lon === null || source.lon === undefined ? null : Number(source.lon);

  return {
    id,
    clientGroupId,
    name: source.name || `Cliente ${clientGroupId}`,
    nomeFantasia: source.name || `Cliente ${clientGroupId}`,
    ddd,
    region: dddRegions[ddd] || `DDD ${ddd}`,
    driverId: assignedDriver ? assignedDriver.id : 'unassigned',
    territory: territories[index % territories.length],
    city: source.city || (driverBases[ddd] || {}).city || `DDD ${ddd}`,
    neighborhood: source.neighborhood || (driverBases[ddd] || {}).neighborhood || 'Centro',
    week: source.visit_week || 1,
    day: source.visit_day || days[index % days.length],
    vehicle: assignedDriver ? assignedDriver.vehicle : 'carro',
    priority: source.priority || priorities[index % priorities.length],
    curva: source.curve || 'C',
    serviceTime: 20,
    distance: Number((3 + seededRandom(index + 70) * 24).toFixed(1)),
    lat,
    lon,
    fixedLat: lat,
    fixedLon: lon,
    window: windows[index % windows.length],
    address: source.address || `${source.city || 'Centro'} ${index + 1}`,
    status: clientType === 'inativo' || clientType === 'sem_coordenada' ? 'atencao' : 'ok',
    driverName: assignedDriver ? assignedDriver.name : 'Sem motorista',
    sequence: index + 1,
    clientType,
    eligibleForRouting: rawStatus === 'ATIVO' && Boolean(source.eligible_for_routing !== false),
    accessMode: source.access_mode || null,
    // Metadados de simulação — usados para rastreabilidade
    _source: 'SIMULATION',
    _sellerName: source.seller_name || null,
    _driverBase: source.driver_base || null,
  };
}

// ── REAL/INTEGRATION: carrega do CRM paginado ──────────────────────────────
async function loadCustomersFromCRM() {
  return loadCustomersFromCRMForDDD(state.selectedDDD);
}

async function loadCustomersFromCRMForDDD(ddd) {
  const PAGE_SIZE = 200;
  const allItems = [];
  let currentPage = 1;
  let totalPages = 1;

  const crmSessionId = getCrmSessionIdForDDD(ddd);
  logger.info(`[FLOW REAL] carregando clientes do CRM (session: "${crmSessionId}", ddd: ${ddd}, per_page=${PAGE_SIZE})`);

  try {
    while (currentPage <= totalPages) {
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-session-id': crmSessionId,
      };
      const response = await fetch(`${CRM_API_BASE}/customers?per_page=${PAGE_SIZE}&page=${currentPage}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} na página ${currentPage}`);
      }

      const payload = await response.json();
      const items = Array.isArray(payload?.items)
        ? payload.items
        : (Array.isArray(payload) ? payload : []);

      allItems.push(...items);

      if (typeof payload?.pages === 'number') {
        totalPages = payload.pages;
      } else if (typeof payload?.total === 'number') {
        totalPages = Math.ceil(payload.total / PAGE_SIZE);
      } else {
        break;
      }

      if (items.length < PAGE_SIZE) {
        break;
      }

      currentPage += 1;
    }

    logger.info(`[FLOW REAL] clientes carregados do CRM`, {
      total: allItems.length,
      pages: totalPages,
      source: 'CRM mockStore/PostgreSQL'
    });

    return allItems.map(mapRealCustomerToClient);
  } catch (error) {
    logger.error(`[FLOW REAL] falha ao carregar clientes do CRM`, {
      page: currentPage,
      loaded: allItems.length,
      message: error && error.message ? error.message : String(error)
    });
    if (allItems.length > 0) {
      logger.warn(`[FLOW REAL] retornando ${allItems.length} clientes parciais`);
      return allItems.map(mapRealCustomerToClient);
    }
    return [];
  }
}

function validateCustomer(customer) {
  const issues = [];
  const customerId = String(customer && customer.id ? customer.id : '').trim();
  const customerName = String(customer && customer.name ? customer.name : '').trim();

  if (!customerId) {
    issues.push({ code: 'missing_id', message: 'Cliente sem id.' });
  }

  if (!customerName) {
    issues.push({ code: 'missing_name', message: 'Cliente sem nome.' });
  }

  if (!hasValidCoordinate(customer)) {
    issues.push({ code: 'invalid_coordinates', message: 'Cliente sem coordenadas válidas.' });
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

function validateCustomers(sourceCustomers) {
  const validCustomers = [];
  const invalidCustomers = [];

  (sourceCustomers || []).forEach((customer) => {
    const result = validateCustomer(customer);
    if (result.isValid) {
      validCustomers.push(customer);
      return;
    }

    invalidCustomers.push({
      customer,
      issues: result.issues
    });
  });

  logger.info('[FLOW VALIDATION] clientes validados', {
    total: (sourceCustomers || []).length,
    validos: validCustomers.length,
    invalidos: invalidCustomers.length
  });

  return { validCustomers, invalidCustomers };
}

function applyFallbacks(validCustomers, invalidCustomers) {
  const nextCustomers = [...(validCustomers || [])];
  let _discardedCount = 0;
  let _semCoordCount = 0;

  (invalidCustomers || []).forEach(({ customer, issues }) => {
    const issueCodes = (issues || []).map((issue) => issue.code);
    const hasFatalIssue = issueCodes.includes('missing_id') || issueCodes.includes('missing_name');

    if (hasFatalIssue) {
      _discardedCount++;
      return;
    }

    const fallbackCustomer = {
      ...customer,
      lat: null,
      lon: null,
      fixedLat: null,
      fixedLon: null,
      clientType: 'sem_coordenada',
      eligibleForRouting: false,
      status: 'atencao'
    };

    nextCustomers.push(fallbackCustomer);
    _semCoordCount++;
  });

  if (_discardedCount > 0 || _semCoordCount > 0) {
    logger.warn('[FLOW FALLBACK] resumo', {
      descartados: _discardedCount,
      movidosSemCoordenada: _semCoordCount,
      totalResultante: nextCustomers.length
    });
  }

  return nextCustomers;
}

// Adaptador: converte formato canônico CRM → formato interno do mapa
// Formato canônico CRM: { id, name, lat, lon, status, ddd, city, state, ... }
// Formato interno mapa: { id, clientGroupId, name, ddd, driverId, lat, lon, clientType, ... }
function mapRealCustomerToClient(source, index) {
  const ddd = Number(source.ddd || state.selectedDDD || 65);
  const dddDrivers = getDriversByDDD(ddd);
  const assignedDriver = dddDrivers[index % Math.max(dddDrivers.length, 1)] || dddDrivers[0] || null;
  const rawStatus = String(source.status || 'ATIVO').toUpperCase();
  const clientType = rawStatus === 'SEM_COORDENADA'
    ? 'sem_coordenada'
    : rawStatus === 'INATIVO'
      ? 'inativo'
      : rawStatus === 'NOVO'
        ? 'novo'
        : 'ativo';
  const clientGroupId = String(source.client_id || source.id || `CRM-${String(index + 1).padStart(6, '0')}`);
  const id = `${clientGroupId}-w1`;
  const lat = source.lat === null || source.lat === undefined ? null : Number(source.lat);
  const lon = source.lon === null || source.lon === undefined ? null : Number(source.lon);

  return {
    id,
    clientGroupId,
    name: source.name || `Cliente ${clientGroupId}`,
    nomeFantasia: source.name || `Cliente ${clientGroupId}`,
    ddd,
    region: dddRegions[ddd] || `DDD ${ddd}`,
    driverId: assignedDriver ? assignedDriver.id : 'unassigned',
    territory: territories[index % territories.length],
    city: source.city || (driverBases[ddd] || {}).city || `DDD ${ddd}`,
    neighborhood: source.neighborhood || (driverBases[ddd] || {}).neighborhood || 'Centro',
    week: 1,
    day: days[index % days.length],
    vehicle: assignedDriver ? assignedDriver.vehicle : 'carro',
    priority: priorities[index % priorities.length],
    curva: 'C',
    serviceTime: 20,
    distance: Number((3 + seededRandom(index + 70) * 24).toFixed(1)),
    lat,
    lon,
    fixedLat: lat,
    fixedLon: lon,
    window: windows[index % windows.length],
    address: source.address || `${source.city || 'Centro'} ${index + 1}`,
    status: clientType === 'inativo' || clientType === 'sem_coordenada' ? 'atencao' : 'ok',
    driverName: assignedDriver ? assignedDriver.name : 'Sem motorista',
    sequence: index + 1,
    clientType,
    eligibleForRouting: rawStatus === 'ATIVO' && Boolean(source.eligible_for_routing !== false),
    accessMode: null,
    // Metadados de integração — origem CRM (mockStore/PostgreSQL)
    _source: 'CRM',
  };
}
