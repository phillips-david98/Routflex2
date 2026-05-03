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

    const mapped = items.map(mapSimulationCustomerToClient);
    _logTerritoryAuditSummary(`simulation/${items.length}`);
    return mapped;
  } catch (error) {
    logger.error('[FLOW SIMULATION] falha ao carregar clientes do Python', {
      message: error && error.message ? error.message : String(error)
    });
    // Separação estrita: não mistura com CRM automaticamente em modo SIMULATION.
    return [];
  }
}

// ════════════════════════════════════════════════════════════════
// TERRITORY → DRIVER RESOLUTION
// Converts territory_code (e.g. "MT-65-03") to the correct driverId.
// Round-robin is used ONLY as a final fallback with a console.warn.
// ════════════════════════════════════════════════════════════════

// Audit counters — reset per load batch, logged after the batch finishes.
const _territoryAudit = { matched: 0, fallback: 0 };

// Normalizes any territory/driver code to a comparable canonical string.
// Examples: "MT-65-03" → "MT-65-03", "MT 65 - 3" → "MT-65-03", "03" → "03"
function normalizeTerritoryKey(value) {
  if (!value) return '';
  return String(value)
    .toUpperCase()
    .replace(/\s+/g, '')                  // remove spaces
    .replace(/_/g, '-')                   // underscore → dash
    .replace(/MT65/g, 'MT-65')            // "MT65" → "MT-65"
    .replace(/([A-Z]{2})(\d{2,3})-/g, '$1-$2-') // "MT65-" → "MT-65-" (already handled above, safety)
    .replace(/-0*(\d+)$/, (_, n) => '-' + String(parseInt(n, 10)).padStart(2, '0')) // normalize trailing number: -3 → -03
    .trim();
}

// Returns the numeric slot suffix from a territory/driver code (e.g. "MT-65-03" → "03", "DRV-65-003" → "03").
function _extractSlotFromCode(code) {
  const m = String(code || '').match(/(\d{1,3})$/);
  if (!m) return null;
  return String(parseInt(m[1], 10)).padStart(2, '0');
}

// Tries to resolve the correct driver from source territory fields.
// Priority:
//   1. source.territory_code
//   2. source.territoryCode
//   3. source.driver_base (if it encodes a driver code like MOT-CBA-03)
//   4. source.seller_name (if it matches a driver name)
//   5. Round-robin fallback (with warning)
function resolveDriverFromTerritory(source, dddDrivers, fallbackIndex) {
  if (!dddDrivers || dddDrivers.length === 0) return null;

  const candidateCodes = [
    source.territory_code,
    source.territoryCode,
  ].filter(Boolean);

  // Build a lookup: normalized slot ("03") → driver, and normalized full code → driver.
  // Driver name format: "MT 65 - 03" → slot "03"; driver id: "DRV-65-003" → slot "003" → int 3 → "03".
  const bySlot = new Map();
  const byNormFull = new Map();
  dddDrivers.forEach((driver) => {
    const nameSlot = _extractSlotFromCode(driver.name);   // "MT 65 - 03" → "03"
    const idSlot = _extractSlotFromCode(driver.id);       // "DRV-65-003" → "03"
    const normId = normalizeTerritoryKey(driver.id);
    const normName = normalizeTerritoryKey(driver.name);
    if (nameSlot && !bySlot.has(nameSlot)) bySlot.set(nameSlot, driver);
    if (idSlot && !bySlot.has(idSlot)) bySlot.set(idSlot, driver);
    byNormFull.set(normId, driver);
    byNormFull.set(normName, driver);
  });

  for (const raw of candidateCodes) {
    const norm = normalizeTerritoryKey(raw);
    if (!norm) continue;

    // 1a. Exact normalized full match (e.g. "MT-65-03" matches driver name "MT 65 - 03" normalized)
    if (byNormFull.has(norm)) {
      _territoryAudit.matched++;
      return byNormFull.get(norm);
    }

    // 1b. Slot-only match: extract trailing number and look up
    const slot = _extractSlotFromCode(norm);
    if (slot && bySlot.has(slot)) {
      _territoryAudit.matched++;
      return bySlot.get(slot);
    }

    // 1c. Partial suffix match: check if any driver's normalized code ends with norm
    for (const [key, driver] of byNormFull) {
      if (key.endsWith(norm) || norm.endsWith(key)) {
        _territoryAudit.matched++;
        return driver;
      }
    }
  }

  // Try driver_base: "MOT-CBA-03" → slot "03"
  if (source.driver_base) {
    const slot = _extractSlotFromCode(source.driver_base);
    if (slot && bySlot.has(slot)) {
      _territoryAudit.matched++;
      return bySlot.get(slot);
    }
  }

  // Try seller_name exact match against driver name
  if (source.seller_name) {
    const normSeller = normalizeTerritoryKey(source.seller_name);
    for (const [key, driver] of byNormFull) {
      if (key === normSeller) {
        _territoryAudit.matched++;
        return driver;
      }
    }
  }

  // ── Fallback: round-robin (original behavior) ──
  const fallback = dddDrivers[fallbackIndex % Math.max(dddDrivers.length, 1)] || dddDrivers[0];
  _territoryAudit.fallback++;
  const clientGroupId = source.client_id || source.id || `#${fallbackIndex}`;
  console.warn('[DATA MAP] territory_code sem match; usando fallback round-robin', {
    clientGroupId,
    territory_code: source.territory_code || source.territoryCode || null,
    driver_base: source.driver_base || null,
    seller_name: source.seller_name || null,
    fallbackDriver: fallback ? fallback.name : null
  });
  return fallback;
}

// Logs a summary of territory resolution quality after a batch load.
function _logTerritoryAuditSummary(batchLabel) {
  const total = _territoryAudit.matched + _territoryAudit.fallback;
  const matchPct = total > 0 ? Math.round((_territoryAudit.matched / total) * 100) : 0;
  if (total > 0) {
    console.info(`[DATA MAP] territory mapping (${batchLabel})`, {
      matchedByTerritory: _territoryAudit.matched,
      matchedByFallback: _territoryAudit.fallback,
      total,
      matchPct: matchPct + '%',
    });
    if (_territoryAudit.fallback > 0) {
      console.warn(`[DATA MAP] ${_territoryAudit.fallback} cliente(s) sem territory_code — polígonos podem ficar distorcidos`);
    }
  }
  _territoryAudit.matched = 0;
  _territoryAudit.fallback = 0;
}

// ── Mapeamento: formato simulation_store.py → formato interno do mapa ──────
function mapSimulationCustomerToClient(source, index) {
  const ddd = Number(source.ddd || state.selectedDDD || 65);
  const dddDrivers = getDriversByDDD(ddd);
  const assignedDriver = resolveDriverFromTerritory(source, dddDrivers, index);
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

    const mapped = allItems.map(mapRealCustomerToClient);
    _logTerritoryAuditSummary(`crm/${allItems.length}`);
    return mapped;
  } catch (error) {
    logger.error(`[FLOW REAL] falha ao carregar clientes do CRM`, {
      page: currentPage,
      loaded: allItems.length,
      message: error && error.message ? error.message : String(error)
    });
    if (allItems.length > 0) {
      logger.warn(`[FLOW REAL] retornando ${allItems.length} clientes parciais`);
      const partial = allItems.map(mapRealCustomerToClient);
      _logTerritoryAuditSummary(`crm-partial/${allItems.length}`);
      return partial;
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
  const assignedDriver = resolveDriverFromTerritory(source, dddDrivers, index);
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
