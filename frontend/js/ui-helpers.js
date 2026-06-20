// ui-helpers.js - Pure utility functions (math, text, color, predicates)
// Extracted from map.html (Wave 4). No DOM access, no state mutation.
// Depends on: config.js (LARGE_DATASET_THRESHOLD)

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sanitizeText(value) {
  return String(value || '').replace(/[<>]/g, '').trim();
}

function getVehicleOptions(baseVehicle) {
  const catalog = ['carro', 'moto', 'pickup', 'pesado', 'eletrico'];
  return [baseVehicle, ...catalog.filter((item) => item !== baseVehicle)];
}

function hslToHex(hue, saturation, lightness) {
  const sat = Math.max(0, Math.min(100, saturation)) / 100;
  const lig = Math.max(0, Math.min(100, lightness)) / 100;
  const chroma = (1 - Math.abs((2 * lig) - 1)) * sat;
  const huePrime = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma; green = x; blue = 0;
  } else if (huePrime < 2) {
    red = x; green = chroma; blue = 0;
  } else if (huePrime < 3) {
    red = 0; green = chroma; blue = x;
  } else if (huePrime < 4) {
    red = 0; green = x; blue = chroma;
  } else if (huePrime < 5) {
    red = x; green = 0; blue = chroma;
  } else {
    red = chroma; green = 0; blue = x;
  }

  const match = lig - (chroma / 2);
  const toHex = (value) => {
    const component = Math.round((value + match) * 255);
    return component.toString(16).padStart(2, '0');
  };

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function generateAdditionalTerritoryColor(index) {
  // Golden-angle hue spacing creates visually distinct colors as fleet grows.
  const hue = (index * 137.508) % 360;
  return hslToHex(hue, 58, 52);
}

// ── Modelagem operacional: 4 eixos INDEPENDENTES ───────────────────────────
// Curva       = importância comercial (A/B/C). NÃO determina semana nem frequência.
// Frequência  = quantidade de visitas (Semanal / Quinzenal / Mensal).
// Semana      = distribuição operacional (quais ciclos 1..4).
// Dia         = agenda (dia da semana).
//
// Compatibilidade retroativa: dados legados só possuem `curva`. Quando o cliente
// NÃO traz `frequencia` explícita, derivamos um DEFAULT a partir da curva (mesma
// tabela histórica) — preservando 100% do comportamento existente. Assim que uma
// `frequencia` real chega da origem, ela passa a comandar a distribuição de
// semanas, sem qualquer acoplamento direto Curva→Frequência / Curva→Semana.
const FREQ_SEMANAL = 'Semanal';
const FREQ_QUINZENAL = 'Quinzenal';
const FREQ_MENSAL = 'Mensal';

function normalizeFrequencyLabel(frequencia) {
  const f = String(frequencia || '').trim().toLowerCase();
  if (f === 'semanal') return FREQ_SEMANAL;
  if (f === 'quinzenal') return FREQ_QUINZENAL;
  if (f === 'mensal') return FREQ_MENSAL;
  return null;
}

// DEFAULT de compatibilidade (não é regra de negócio): só usado quando a
// frequência real é desconhecida. Mantém a tabela histórica A/B/C.
function getDefaultFrequencyForCurve(curva) {
  const c = String(curva || 'C').toUpperCase();
  if (c === 'B') return FREQ_SEMANAL;
  if (c === 'A') return FREQ_QUINZENAL;
  return FREQ_MENSAL;
}

// Fonte única da frequência: explícita do cliente > default por curva (compat).
function resolveVisitFrequency(client) {
  if (!client) return FREQ_MENSAL;
  return normalizeFrequencyLabel(client.frequencia)
    || getDefaultFrequencyForCurve(client.curva);
}

// Semanas a partir da FREQUÊNCIA (eixo independente da curva).
function getScheduledWeeksForFrequency(frequencia, seed) {
  const f = normalizeFrequencyLabel(frequencia) || FREQ_MENSAL;
  if (f === FREQ_SEMANAL) {
    // Semanal: todos os ciclos 1-4.
    return [1, 2, 3, 4];
  }
  if (f === FREQ_QUINZENAL) {
    // Quinzenal: alterna para distribuir carga entre 1/3 e 2/4.
    return seed % 2 === 0 ? [1, 3] : [2, 4];
  }
  // Mensal: um único ciclo entre 1-4.
  return [(seed % 4) + 1];
}

// Compat: assinatura antiga preservada. Agora delega via frequência-default,
// produzindo resultado idêntico ao histórico para dados sem frequência.
function getScheduledWeeksForCurve(curva, seed) {
  return getScheduledWeeksForFrequency(getDefaultFrequencyForCurve(curva), seed);
}

function getClientGroupId(client) {
  if (!client) {
    return null;
  }
  return client.clientGroupId || String(client.id || '').replace(/-w\d+$/i, '');
}

function isActiveEquivalentClientType(clientType) {
  const ct = String(clientType || 'ativo').toLowerCase();
  return ct === 'ativo' || ct === 'validado' || ct === 'credenciado';
}

function isLargeDatasetMode(filteredClients) {
  return Array.isArray(filteredClients) && filteredClients.length > LARGE_DATASET_THRESHOLD;
}

function createRouteId(ddd, driverId, week, day) {
  return `${ddd}-${driverId}-${week}-${day}`;
}

// Haversine — distância em km entre dois pontos geográficos
function distanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
          * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
