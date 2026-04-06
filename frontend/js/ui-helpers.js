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

function getScheduledWeeksForCurve(curva, seed) {
  if (curva === 'B') {
    // Semanal: todos os ciclos 1-4.
    return [1, 2, 3, 4];
  }

  if (curva === 'A') {
    // Quinzenal: alterna para distribuir carga entre 1/3 e 2/4.
    return seed % 2 === 0 ? [1, 3] : [2, 4];
  }

  // Mensal (Curva C): um único ciclo entre 1-4.
  return [(seed % 4) + 1];
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
