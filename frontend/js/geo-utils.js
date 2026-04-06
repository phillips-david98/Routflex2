// ROUTflex — Geo Utilities
// Extracted from map.html — Phase 3 Wave 2
// No dependencies. Pure functions.

function seededRandom(seed) {
  const value = Math.sin(seed * 999.91) * 10000;
  return value - Math.floor(value);
}

function isKnownInvalidCoordinate(lat, lon) {
  const knownBad = [
    [-12.915927, 25.273623]
  ];
  return knownBad.some((pair) => Math.abs((lat || 0) - pair[0]) < 1e-6 && Math.abs((lon || 0) - pair[1]) < 1e-6);
}

function isWithinExpectedArea(lat, lon) {
  // Faixa operacional Brasil (inclui Norte para cenários PA como Santarém/Aveiro)
  return lat >= -34.0 && lat <= 6.5 && lon >= -74.5 && lon <= -32.0;
}

function hasValidCoordinate(client) {
  const lat = Number(client.lat);
  const lon = Number(client.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }
  if (isKnownInvalidCoordinate(lat, lon)) {
    return false;
  }
  if (!isWithinExpectedArea(lat, lon)) {
    return false;
  }
  return true;
}
