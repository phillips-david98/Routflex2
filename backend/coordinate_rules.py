from typing import Optional, Tuple


KNOWN_INVALID_COORDS = {
    (-12.915927, 25.273623),
}

# Limites geograficos do Brasil (inclui Norte, ex.: RR/AP/AM).
# Mantido em um ponto central para evitar divergencia entre modulos.
EXPECTED_BOUNDS = {
    "lat_min": -34.0,
    "lat_max": 5.5,
    "lon_min": -74.0,
    "lon_max": -28.0,
}


def _normalize_coord(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def is_within_expected_bounds(lat: Optional[float], lon: Optional[float]) -> bool:
    lat_f = _normalize_coord(lat)
    lon_f = _normalize_coord(lon)

    if lat_f is None or lon_f is None:
        return False

    return (
        EXPECTED_BOUNDS["lat_min"] <= lat_f <= EXPECTED_BOUNDS["lat_max"]
        and EXPECTED_BOUNDS["lon_min"] <= lon_f <= EXPECTED_BOUNDS["lon_max"]
    )


def is_sem_coordenada(lat: Optional[float], lon: Optional[float]) -> bool:
    lat_f = _normalize_coord(lat)
    lon_f = _normalize_coord(lon)

    if lat_f is None or lon_f is None:
        return True

    rounded_pair: Tuple[float, float] = (round(lat_f, 6), round(lon_f, 6))
    if rounded_pair in KNOWN_INVALID_COORDS:
        return True

    if not is_within_expected_bounds(lat_f, lon_f):
        return True

    return False


def normalize_status_with_coordinates(status: str, lat: Optional[float], lon: Optional[float]) -> str:
    if is_sem_coordenada(lat, lon):
        return "SEM_COORDENADA"
    return (status or "ATIVO").upper().strip() or "ATIVO"
