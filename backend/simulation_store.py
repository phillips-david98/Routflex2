from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Dict, List, Any

DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"]

# ═══════════════════════════════════════════════════════════════════════════════
# Cenário DDD 65 — Cuiabá + Várzea Grande + Santo Antônio de Leverger
# 1328 clientes idênticos ao CRM (operationalScenario.js generateDdd65Scenario)
# ═══════════════════════════════════════════════════════════════════════════════

DDD65_PROFILES = [
    {
        "city": "Cuiaba",
        "state": "MT",
        "total": 780,
        "density": "DENSE",
        "lat": -15.6014,
        "lon": -56.0979,
        "drivers": ["MOT-CBA-01", "MOT-CBA-02", "MOT-CBA-03"],
        "neighborhoods": [
            "Centro Sul", "Jardim das Americas", "Bosque da Saude", "Duque de Caxias",
            "Boa Esperanca", "Coxipo", "Pedra 90", "CPA I", "CPA II", "CPA III",
            "Morada do Ouro", "Santa Rosa", "Grande Terceiro", "Bandeirantes",
            "Jardim Vitoria", "Jardim Presidente", "Planalto", "Pico do Amor",
        ],
        "streets": [
            "Av Historiador Rubens de Mendonca", "Av do CPA", "Av Isaac Povoas",
            "Rua Barao de Melgaco", "Av Fernando Correa da Costa", "Av Miguel Sutil",
            "Rua Cel Pimenta Bueno", "Rua Pedro Celestino", "Av Republica do Libano",
            "Rua Antonio Maria Coelho", "Rua 13 de Junho", "Av Tenente Cel Duarte",
        ],
    },
    {
        "city": "Varzea Grande",
        "state": "MT",
        "total": 420,
        "density": "DENSE",
        "lat": -15.6467,
        "lon": -56.1326,
        "drivers": ["MOT-VGD-01", "MOT-VGD-02"],
        "neighborhoods": [
            "Centro", "Cristo Rei", "Manga", "Jardim Gloria", "Agua Limpa",
            "Mapim", "Santa Isabel", "Vila Arthur", "Parque do Lago",
            "Costa Verde", "Novo Mundo", "Jardim Eldorado",
        ],
        "streets": [
            "Av Julio Campos", "Av da FEB", "Rua Aluizio Ferreira",
            "Rua Manoel J de Arruda", "Av Governador Julio Campos",
            "Rua Filinto Muller", "Av Castelo Branco", "Rua Dom Orlando Chaves",
        ],
    },
    {
        "city": "Santo Antonio de Leverger",
        "state": "MT",
        "total": 30,
        "density": "RURAL",
        "lat": -15.8618,
        "lon": -56.0790,
        "drivers": ["MOT-CBA-03"],
        "neighborhoods": ["Centro", "Beira Rio", "Mimoso"],
        "streets": ["Av Principal", "Rua Padre Agostinho", "Estrada Municipal MT-040"],
    },
]

DDD65_NO_COORD_COUNT = 98

COMPANY_PREFIX = [
    "Comercial", "Distribuidora", "Atacado", "Mercantil", "Rede", "Grupo", "Prime", "Nova",
]

COMPANY_SUFFIX = [
    "Alimentos", "Farmacia", "Suprimentos", "Logistica", "Servicos", "Varejo", "Tecnologia", "Atacadista",
]

DDD65_SELLERS = [
    "Marcos Oliveira", "Tatiana Ramos", "Felipe Azevedo", "Juliana Moura",
    "Ricardo Santos", "Priscila Lima", "Anderson Silva", "Camila Ferreira",
]

DDD65_PRIORITIES = ["ALTA", "MEDIA", "BAIXA"]

CURVE_CYCLE = ["A", "B", "C", "C", "B", "C", "A", "C"]

BASE_DIR = Path(__file__).resolve().parent
OVERRIDES_FILE = BASE_DIR / "simulation_overrides.json"

_BASE_CUSTOMERS: List[Dict[str, Any]] | None = None
_OVERRIDES: Dict[str, Dict[str, Any]] | None = None


# ── PRNG idêntica ao JS Math.sin(seed * 43758.5453) * 10000 ───────────────────
def _js_rand(seed: int) -> float:
    """Replica exatamente: function rand(seed) { const x = Math.sin(seed * 43758.5453) * 10000; return x - Math.floor(x); }"""
    x = math.sin(seed * 43758.5453) * 10000
    return x - math.floor(x)


def _js_random_in_range(seed: int, min_val: float, max_val: float) -> float:
    """Replica: function randomInRange(seed, min, max) { return min + (max - min) * rand(seed); }"""
    return min_val + (max_val - min_val) * _js_rand(seed)


def _density_spread(density: str) -> Dict[str, float]:
    """Replica: function densitySpread(profile) — mesmos valores que o JS."""
    if density == "DENSE":
        return {"lat": 0.03, "lon": 0.03}
    if density == "MIXED":
        return {"lat": 0.08, "lon": 0.08}
    if density == "RURAL":
        return {"lat": 0.14, "lon": 0.14}
    if density == "RIVER_CROSSING":
        return {"lat": 0.2, "lon": 0.2}
    return {"lat": 0.16, "lon": 0.16}


def _generate_cpf(index: int) -> str:
    """Replica: function generateCpf(index) do operationalScenario.js"""
    a = str(100 + (index % 900)).zfill(3)
    b = str(100 + ((index * 7) % 900)).zfill(3)
    c = str(10 + (index % 90)).zfill(2)
    return f"000.{a}.{b}-{c}"


def _pad(num: int, size: int = 6) -> str:
    return str(num).zfill(size)


def _build_base_customers() -> List[Dict[str, Any]]:
    """Gera os mesmos 1328 clientes que generateDdd65Scenario() do JS."""
    customers: List[Dict[str, Any]] = []
    cid = 1

    # Fase 1: clientes COM coordenadas (780 + 420 + 30 = 1230)
    for profile in DDD65_PROFILES:
        spread = _density_spread(profile["density"])
        drivers = profile["drivers"]
        streets = profile["streets"]
        neighborhoods = profile["neighborhoods"]

        for i in range(profile["total"]):
            is_inactive = (i % 11 == 0)
            status = "INATIVO" if is_inactive else "ATIVO"

            lat = round(profile["lat"] + _js_random_in_range(cid * 17, -spread["lat"], spread["lat"]), 6)
            lon = round(profile["lon"] + _js_random_in_range(cid * 31, -spread["lon"], spread["lon"]), 6)

            eligible = status == "ATIVO"
            street_idx = i % len(streets)
            neigh_idx = i % len(neighborhoods)
            priority_idx = cid % len(DDD65_PRIORITIES)

            prefix = COMPANY_PREFIX[cid % len(COMPANY_PREFIX)]
            suffix = COMPANY_SUFFIX[(cid * 3) % len(COMPANY_SUFFIX)]
            name = f"{prefix} {suffix} {_pad(cid, 4)}"
            phone = f"659{str(10000000 + cid)[-8:]}"

            week = (i % 4) + 1
            day = DAYS[i % len(DAYS)]
            curve = CURVE_CYCLE[i % len(CURVE_CYCLE)]

            customers.append({
                "id": cid,
                "client_id": f"SIM-{_pad(cid)}",
                "name": name,
                "phone": phone,
                "ddd": 65,
                "cpf_cnpj": _generate_cpf(cid),
                "address": f"{streets[street_idx]} {(i % 35) + 1}",
                "number": str((i % 900) + 100),
                "neighborhood": neighborhoods[neigh_idx],
                "city": profile["city"],
                "state": profile["state"],
                "zip_code": f"78{str(100 + ((i * 37) % 899)).zfill(3)}-{str((i * 19) % 1000).zfill(3)}",
                "lat": lat,
                "lon": lon,
                "status": status,
                "eligible_for_routing": eligible,
                "seller_name": DDD65_SELLERS[i % len(DDD65_SELLERS)],
                "region_key": "MT-65",
                "density_profile": profile["density"],
                "access_mode": None,
                "geocode_source": "CITY_CENTROID",
                "driver_base": drivers[i % len(drivers)],
                "priority": DDD65_PRIORITIES[priority_idx],
                "curve": curve,
                "visit_week": week,
                "visit_day": day,
            })
            cid += 1

    # Fase 2: 98 clientes SEM coordenadas (60 Cuiabá + 38 Várzea Grande)
    no_coord_cities = [DDD65_PROFILES[0], DDD65_PROFILES[1]]
    no_coord_split = [60, 38]
    split_idx = 0
    city_count = 0

    for k in range(DDD65_NO_COORD_COUNT):
        if city_count >= no_coord_split[split_idx] and split_idx < len(no_coord_split) - 1:
            split_idx += 1
            city_count = 0

        profile = no_coord_cities[split_idx]
        streets = profile["streets"]
        neighborhoods = profile["neighborhoods"]
        drivers = profile["drivers"]
        street_idx = k % len(streets)
        neigh_idx = k % len(neighborhoods)
        priority_idx = cid % len(DDD65_PRIORITIES)

        prefix = COMPANY_PREFIX[cid % len(COMPANY_PREFIX)]
        suffix = COMPANY_SUFFIX[(cid * 3) % len(COMPANY_SUFFIX)]
        name = f"{prefix} {suffix} {_pad(cid, 4)}"
        phone = f"659{str(10000000 + cid)[-8:]}"

        week = (k % 4) + 1
        day = DAYS[k % len(DAYS)]
        curve = CURVE_CYCLE[k % len(CURVE_CYCLE)]

        customers.append({
            "id": cid,
            "client_id": f"SIM-{_pad(cid)}",
            "name": name,
            "phone": phone,
            "ddd": 65,
            "cpf_cnpj": _generate_cpf(cid),
            "address": f"{streets[street_idx]} {(k % 35) + 1}",
            "number": str((k % 900) + 100),
            "neighborhood": neighborhoods[neigh_idx],
            "city": profile["city"],
            "state": profile["state"],
            "zip_code": f"78{str(100 + ((k * 37) % 899)).zfill(3)}-{str((k * 19) % 1000).zfill(3)}",
            "lat": None,
            "lon": None,
            "status": "SEM_COORDENADA",
            "eligible_for_routing": False,
            "seller_name": DDD65_SELLERS[k % len(DDD65_SELLERS)],
            "region_key": "MT-65",
            "density_profile": profile["density"],
            "access_mode": None,
            "geocode_source": "UNRESOLVED",
            "driver_base": drivers[k % len(drivers)],
            "priority": DDD65_PRIORITIES[priority_idx],
            "curve": curve,
            "visit_week": week,
            "visit_day": day,
        })
        cid += 1
        city_count += 1

    return customers


def _load_overrides() -> Dict[str, Dict[str, Any]]:
    if not OVERRIDES_FILE.exists():
        return {}

    try:
        data = json.loads(OVERRIDES_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    if not isinstance(data, dict):
        return {}

    normalized: Dict[str, Dict[str, Any]] = {}
    for client_id, payload in data.items():
        if not isinstance(payload, dict):
            continue
        normalized[str(client_id)] = payload
    return normalized


def _persist_overrides(overrides: Dict[str, Dict[str, Any]]) -> None:
    OVERRIDES_FILE.write_text(json.dumps(overrides, ensure_ascii=True, indent=2), encoding="utf-8")


def _ensure_loaded() -> None:
    global _BASE_CUSTOMERS, _OVERRIDES
    if _BASE_CUSTOMERS is None:
        _BASE_CUSTOMERS = _build_base_customers()
    if _OVERRIDES is None:
        _OVERRIDES = _load_overrides()


def get_simulation_customers() -> List[Dict[str, Any]]:
    _ensure_loaded()
    assert _BASE_CUSTOMERS is not None
    assert _OVERRIDES is not None

    merged: List[Dict[str, Any]] = []
    for customer in _BASE_CUSTOMERS:
        override = _OVERRIDES.get(customer["client_id"], {})
        merged.append({**customer, **override})
    return merged


def apply_assignment_updates(updates: List[Dict[str, Any]]) -> int:
    _ensure_loaded()
    assert _BASE_CUSTOMERS is not None
    assert _OVERRIDES is not None

    known_ids = {item["client_id"] for item in _BASE_CUSTOMERS}
    changed = 0

    for item in updates:
        client_id = str(item.get("client_id") or "").strip()
        if not client_id or client_id not in known_ids:
            continue

        next_override = _OVERRIDES.get(client_id, {}).copy()

        if "seller_name" in item and item["seller_name"]:
            next_override["seller_name"] = str(item["seller_name"])
        if "visit_week" in item and item["visit_week"] is not None:
            next_override["visit_week"] = int(item["visit_week"])
        if "visit_day" in item and item["visit_day"]:
            next_override["visit_day"] = str(item["visit_day"])
        if "lat" in item and item["lat"] is not None:
            next_override["lat"] = float(item["lat"])
        if "lon" in item and item["lon"] is not None:
            next_override["lon"] = float(item["lon"])
        if "status" in item and item["status"]:
            status = str(item["status"]).upper()
            next_override["status"] = status
            next_override["eligible_for_routing"] = status == "ATIVO"

        if next_override != _OVERRIDES.get(client_id, {}):
            _OVERRIDES[client_id] = next_override
            changed += 1

    if changed:
        _persist_overrides(_OVERRIDES)

    return changed


def get_simulation_summary() -> Dict[str, Any]:
    customers = get_simulation_customers()
    ativos = sum(1 for c in customers if str(c.get("status", "")).upper() == "ATIVO")
    inativos = sum(1 for c in customers if str(c.get("status", "")).upper() == "INATIVO")
    sem_coordenada = sum(1 for c in customers if str(c.get("status", "")).upper() == "SEM_COORDENADA")

    by_seller: Dict[str, int] = {}
    by_ddd: Dict[str, int] = {}
    for customer in customers:
        seller = str(customer.get("seller_name") or "SEM_VENDEDOR")
        by_seller[seller] = by_seller.get(seller, 0) + 1
        ddd = str(customer.get("ddd") or "SEM_DDD")
        by_ddd[ddd] = by_ddd.get(ddd, 0) + 1

    return {
        "total": len(customers),
        "ativos": ativos,
        "inativos": inativos,
        "sem_coordenada": sem_coordenada,
        "customers_by_seller": sorted(
            [{"seller_name": seller, "total": total} for seller, total in by_seller.items()],
            key=lambda row: row["total"],
            reverse=True,
        ),
        "customers_by_region": sorted(
            [{"ddd": ddd, "total": total} for ddd, total in by_ddd.items()],
            key=lambda row: row["total"],
            reverse=True,
        ),
    }
