from typing import Optional, Tuple


KNOWN_INVALID_COORDS = {
    (-12.915927, 25.273623),
}

# Faixa esperada para operacao inicial (Centro-Oeste/Brasil para DDD 61-66)
EXPECTED_BOUNDS = {
    "lat_min": -25.5,
    "lat_max": -8.0,
    "lon_min": -62.5,
    "lon_max": -42.0,
}


def _normalize_coord(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def is_sem_coordenada(lat: Optional[float], lon: Optional[float]) -> bool:
    lat_f = _normalize_coord(lat)
    lon_f = _normalize_coord(lon)

    if lat_f is None or lon_f is None:
        return True

    rounded_pair: Tuple[float, float] = (round(lat_f, 6), round(lon_f, 6))
    if rounded_pair in KNOWN_INVALID_COORDS:
        return True

    if not (EXPECTED_BOUNDS["lat_min"] <= lat_f <= EXPECTED_BOUNDS["lat_max"]):
        return True

    if not (EXPECTED_BOUNDS["lon_min"] <= lon_f <= EXPECTED_BOUNDS["lon_max"]):
        return True

    return False


def normalize_status_with_coordinates(status: str, lat: Optional[float], lon: Optional[float]) -> str:
    if is_sem_coordenada(lat, lon):
        return "SEM_COORDENADA"
    return (status or "ATIVO").upper().strip() or "ATIVO"
