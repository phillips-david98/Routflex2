// sessions-core.js - Session registry, snapshot helpers, driver/DDD identity functions
// Extracted from map.html (Wave 3). No DOM access - pure data operations.
// Depends on: config.js (dddRegions, dddStates, driverBases, inferStateCodeByDDD, etc.)
//             state.js (state, patchClients) + defineStateAlias aliases (drivers, driverSequence, clients)

const planningSessionRegistry = new Map();
const planningSessionSnapshots = new Map();

function buildDriverId(ddd) {
  driverSequence += 1;
  return `DRV-${ddd}-${String(driverSequence).padStart(3, '0')}`;
}

function getDriversByDDD(ddd) {
  return drivers.filter((driver) => driver.ddd === ddd).sort((first, second) => first.name.localeCompare(second.name));
}

function getDriverById(driverId) {
  return drivers.find((driver) => driver.id === driverId) || null;
}

function getRealSessionIdForDDD(ddd) {
  return `DDD_${ddd}`;
}

// Formato de session_id esperado pelo CRM backend ("DDD 65" com espaço)
function getCrmSessionIdForDDD(ddd) {
  const safeDDD = ddd || (typeof state !== 'undefined' && state.selectedDDD) || '65';
  return `DDD ${safeDDD}`;
}

function getDDDOptionLabel(ddd) {
  const dddText = String(ddd);
  const region = dddRegions[dddText] || dddRegions[Number(dddText)] || 'Nova sessão';
  return `DDD: ${dddText} - ${region}`;
}

function ensureDDDOperationalContext(ddd, seedDDD = state.selectedDDD) {
  const dddText = String(ddd);
  const dddNumber = Number(dddText);
  if (!Number.isFinite(dddNumber)) return;

  const seedKey = String(seedDDD || dddText);
  const seedNumber = Number(seedKey);
  const fallbackBase = driverBases[seedNumber] || driverBases[65] || {
    city: `Cidade ${dddText}`,
    neighborhood: 'Centro',
    address: `Base Operacional ${dddText}`,
    lat: -15.6014,
    lon: -56.0979,
    vehicle: 'carro'
  };

  const inferredState = inferStateCodeByDDD(dddNumber);
  const inferredRegion = inferRegionLabelByDDD(dddNumber);
  const referenceBase = getReferenceBaseByDDD(dddNumber);
  const currentBase = driverBases[dddNumber] || null;

  const currentRegion = String(dddRegions[dddNumber] || '').trim();
  if (!currentRegion || /^Opera(c|ç)ão\s+\d{2,3}$/i.test(currentRegion) || /^Nova sess(ã|a)o$/i.test(currentRegion)) {
    dddRegions[dddNumber] = inferredRegion;
  }

  dddStates[dddNumber] = inferredState || dddStates[seedNumber] || 'BR';

  const hasCurrentCoords = Boolean(currentBase && Number.isFinite(Number(currentBase.lat)) && Number.isFinite(Number(currentBase.lon)));
  const genericCurrentAddress = Boolean(currentBase && /^Base Operacional\s+\d{2,3}$/i.test(String(currentBase.address || '').trim()));
  const isFarFromReference = Boolean(
    referenceBase
    && hasCurrentCoords
    && (Math.abs(Number(currentBase.lat) - Number(referenceBase.lat)) > 1.2
      || Math.abs(Number(currentBase.lon) - Number(referenceBase.lon)) > 1.2)
  );
  const shouldApplyReference = Boolean(referenceBase && (!currentBase || genericCurrentAddress || !hasCurrentCoords || isFarFromReference));

  if (shouldApplyReference) {
    driverBases[dddNumber] = {
      city: referenceBase.city,
      neighborhood: referenceBase.neighborhood,
      address: referenceBase.address,
      lat: Number(referenceBase.lat),
      lon: Number(referenceBase.lon),
      vehicle: (currentBase && currentBase.vehicle) || referenceBase.vehicle || fallbackBase.vehicle || 'carro'
    };
    return;
  }

  if (!driverBases[dddNumber]) {
    const delta = (dddNumber - (Number.isFinite(seedNumber) ? seedNumber : dddNumber)) * 0.002;
    driverBases[dddNumber] = {
      city: fallbackBase.city || `Cidade ${dddText}`,
      neighborhood: fallbackBase.neighborhood || 'Centro',
      address: `Base Operacional ${dddText}`,
      lat: Number((Number(fallbackBase.lat || -15.6014) + delta).toFixed(5)),
      lon: Number((Number(fallbackBase.lon || -56.0979) - delta).toFixed(5)),
      vehicle: fallbackBase.vehicle || 'carro'
    };
  }
}

function buildPlanningSnapshotFromCurrentClients(ddd) {
  return clients
    .filter((client) => client.ddd === Number(ddd))
    .map((client) => ({
      id: client.id,
      week: client.week,
      day: client.day,
      driverId: client.driverId,
      sequence: client.sequence,
    }));
}

function applyPlanningSnapshotToCurrentClients(snapshot, ddd) {
  const byId = new Map((snapshot || []).map((item) => [item.id, item]));
  const numDdd = Number(ddd);
  patchClients(
    function(client) { return client.ddd === numDdd && byId.has(client.id); },
    function(client) {
      var item = byId.get(client.id);
      if (typeof item.week === 'number') client.week = item.week;
      if (typeof item.day === 'string') client.day = item.day;
      if (typeof item.driverId === 'string' && getDriverById(item.driverId)) {
        client.driverId = item.driverId;
        client.driverName = (getDriverById(item.driverId) || {}).name || client.driverName;
      }
      if (typeof item.sequence === 'number') client.sequence = item.sequence;
    }
  );
}

function captureActivePlanningSessionSnapshot() {
  const sessionId = state.activePlanningSessionId;
  if (!sessionId) return;
  const meta = planningSessionRegistry.get(sessionId);
  if (!meta) return;
  planningSessionSnapshots.set(sessionId, buildPlanningSnapshotFromCurrentClients(meta.ddd));
}

function getPlanningSessionsForDDD(ddd) {
  return Array.from(planningSessionRegistry.values())
    .filter((item) => String(item.ddd) === String(ddd))
    .sort((a, b) => {
      if (a.tipo_sessao !== b.tipo_sessao) return a.tipo_sessao === 'REAL' ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    });
}

function getSessionDisplayLabel(sessionMeta) {
  if (!sessionMeta) return '';
  if (sessionMeta.tipo_sessao === 'REAL') {
    return `DDD ${sessionMeta.ddd}`;
  }
  const simulationId = String(sessionMeta.id || '');
  const simMatch = simulationId.match(/^SIMULACAO_DDD_(\d+)_V(\d+)$/);
  if (simMatch) {
    const version = Number(simMatch[2]);
    return version > 1
      ? `Simulação DDD ${simMatch[1]} #${version}`
      : `Simulação DDD ${simMatch[1]}`;
  }
  return `Simulação DDD ${sessionMeta.ddd}`;
}

function getSourceSessionDisplayLabel(sourceSessionId) {
  if (!sourceSessionId) return '';
  const sourceMeta = planningSessionRegistry.get(sourceSessionId);
  if (sourceMeta) return getSessionDisplayLabel(sourceMeta);
  const match = String(sourceSessionId).match(/^DDD_(\d+)$/);
  return match ? `DDD ${match[1]}` : String(sourceSessionId);
}

function getSessionBadgeText(sessionMeta) {
  return sessionMeta && sessionMeta.tipo_sessao === 'SIMULACAO' ? 'SIMULAÇÃO' : 'PRODUÇÃO';
}

function getSessionBadgeIcon(sessionMeta) {
  return sessionMeta && sessionMeta.tipo_sessao === 'SIMULACAO' ? '🟡' : '🟢';
}

function clonePlanningSnapshot(snapshot) {
  return (snapshot || []).map((item) => ({ ...item }));
}

function getNextSimulationIdForDDD(ddd) {
  const pattern = new RegExp(`^SIMULACAO_DDD_${ddd}_V(\\d+)$`);
  const nextVersion = Array.from(planningSessionRegistry.keys())
    .map((id) => {
      const match = id.match(pattern);
      return match ? Number(match[1]) : 0;
    })
    .reduce((maxV, current) => Math.max(maxV, current), 0) + 1;

  return `SIMULACAO_DDD_${ddd}_V${nextVersion}`;
}

function createSimulationSessionFromSnapshot(ddd, sourceSessionId, sourceSnapshot) {
  const simulationId = getNextSimulationIdForDDD(ddd);
  planningSessionRegistry.set(simulationId, {
    id: simulationId,
    ddd,
    tipo_sessao: 'SIMULACAO',
    createdAt: new Date().toISOString(),
    sourceSessionId: sourceSessionId || getRealSessionIdForDDD(ddd),
  });
  planningSessionSnapshots.set(simulationId, clonePlanningSnapshot(sourceSnapshot));
  return simulationId;
}
