from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from sqlalchemy.orm import Session
from pathlib import Path
import json
import os
import uuid
from typing import Optional
from datetime import datetime
from event_logger import append_event, read_events
from logging_manager import set_request_id
from coordinate_rules import is_sem_coordenada, normalize_status_with_coordinates
from geocoding_service import get_geocoding_service

from db import engine, Base, get_db
from models import SessionRegion as SessionRegionModel, Customer as CustomerModel, Vehicle as VehicleModel, AdvancedPlanHistory
from schemas import (CustomerCreate, Customer as CustomerSchema, VehicleCreate, Vehicle as VehicleSchema,
                     SessionRegionCreate, SessionRegion as SessionRegionSchema, RouteReport,
                     ManualPlanSnapshot, AdvancedPlanRequest,
                     AdvancedPlanResponse, AdvancedPlanHistoryResponse,
                     AdvancedPlanHistoryItem, AdvancedPlanHistoryDetailResponse,
                     BatchRoutingRequest, BatchRoutingResponse,
                     RouteEligibilityRequest, RouteEligibilityResponse,
                     ManualIncludeRouteRequest, ManualIncludeRouteResponse,
                     ClientStatus, EventLogRecord,
                     ExportCustomersRequest, ExportCustomersResponse,
                     CustomerCoordinateUpdateRequest, CustomerCoordinateUpdateResponse,
                     CustomerGeocodingRequest, CustomerGeocodingResponse,
                     HealthResponse, GenericStatusResponse,
                     ManualPlanSaveResponse, CustomerStatusEventResponse,
                     CustomerVisitDayEventResponse, SimulationScenarioResponse)
from route_planner import plan_route, plan_advanced_routes, plan_batch_routes
from logging_manager import app_logger

def get_cors_settings():
    raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    if not origins:
        origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3001", "http://127.0.0.1:3001"]

    has_wildcard = "*" in origins
    return {
        "allow_origins": origins,
        "allow_credentials": not has_wildcard,
    }



Base.metadata.create_all(bind=engine)

app = FastAPI(title="Routflex Backend")


# CORS Middleware fixo para frontend local
CORS_ALLOW_ORIGINS = [
    "http://127.0.0.1:8080",
    "http://localhost:8080"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MANUAL_PLAN_FILE = Path(__file__).resolve().parent / "manual_plan_snapshot.json"


# Middleware para rastreabilidade: injeta request_id no contexto
class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Tenta extrair request_id do header ou gera um novo
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        set_request_id(request_id)
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response


app.add_middleware(RequestIdMiddleware)



@app.on_event("startup")
async def _on_startup() -> None:
    app_logger.info(
        "Routflex backend iniciado",
        extra={"cors_origins": CORS_ALLOW_ORIGINS},
    )


@app.get("/health", response_model=HealthResponse)
def health():
    db_enabled = os.getenv("DB_ENABLED", "false").lower() in ["1", "true", "yes"]
    return {"status": "ok", "db_enabled": db_enabled}


def read_manual_plan_snapshot():
    if not MANUAL_PLAN_FILE.exists():
        return None

    try:
        return json.loads(MANUAL_PLAN_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def write_manual_plan_snapshot(payload: dict):
    MANUAL_PLAN_FILE.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


# ── Persistência DDD-scoped ────────────────────────────────────────────────
MANUAL_PLAN_DATA_DIR = Path(__file__).resolve().parent / "data"


def _get_ddd_plan_file(ddd: str) -> Path:
    # Valida DDD: apenas 2 dígitos numéricos — previne path traversal
    if not ddd.isdigit() or len(ddd) != 2:
        raise ValueError(f"DDD invalido: {ddd!r}")
    return MANUAL_PLAN_DATA_DIR / f"manual_plan_{ddd}.json"


def read_manual_plan_snapshot_ddd(ddd: str):
    try:
        plan_file = _get_ddd_plan_file(ddd)
    except ValueError:
        return None
    if not plan_file.exists():
        return None
    try:
        return json.loads(plan_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def write_manual_plan_snapshot_ddd(ddd: str, payload: dict):
    plan_file = _get_ddd_plan_file(ddd)
    MANUAL_PLAN_DATA_DIR.mkdir(parents=True, exist_ok=True)
    plan_file.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


def delete_manual_plan_snapshot_ddd(ddd: str) -> bool:
    try:
        plan_file = _get_ddd_plan_file(ddd)
    except ValueError:
        return False
    if plan_file.exists():
        plan_file.unlink()
        return True
    return False


@app.get("/manual-plan")
def get_manual_plan():
    snapshot = read_manual_plan_snapshot()
    if snapshot is None:
        return {"version": 1, "savedAt": None, "clients": []}
    return snapshot


@app.put("/manual-plan", response_model=ManualPlanSaveResponse)
def save_manual_plan(snapshot: ManualPlanSnapshot):
    payload = snapshot.model_dump()
    write_manual_plan_snapshot(payload)
    return {"status": "saved", "savedAt": payload["savedAt"], "count": len(payload["clients"])}


@app.delete("/manual-plan", response_model=GenericStatusResponse)
def delete_manual_plan():
    if MANUAL_PLAN_FILE.exists():
        MANUAL_PLAN_FILE.unlink()
    return {"status": "deleted"}


# ── Endpoints DDD-scoped ───────────────────────────────────────────────────
@app.get("/manual-plan/{ddd}")
def get_manual_plan_ddd(ddd: str):
    try:
        _get_ddd_plan_file(ddd)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"DDD invalido: {ddd!r}")
    snapshot = read_manual_plan_snapshot_ddd(ddd)
    if snapshot is None:
        return {"version": 1, "savedAt": None, "clients": []}
    app_logger.info(f"[PLAN][DDD {ddd}] loaded", extra={"clients_count": len(snapshot.get("clients", []))})
    return snapshot


@app.put("/manual-plan/{ddd}", response_model=ManualPlanSaveResponse)
def save_manual_plan_ddd(ddd: str, snapshot: ManualPlanSnapshot):
    try:
        _get_ddd_plan_file(ddd)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"DDD invalido: {ddd!r}")
    payload = snapshot.model_dump()
    write_manual_plan_snapshot_ddd(ddd, payload)
    app_logger.info(f"[PLAN][DDD {ddd}] saved", extra={"clients_count": len(payload.get("clients", []))})
    return {"status": "saved", "savedAt": payload["savedAt"], "count": len(payload["clients"])}


@app.delete("/manual-plan/{ddd}", response_model=GenericStatusResponse)
def delete_manual_plan_ddd(ddd: str):
    try:
        _get_ddd_plan_file(ddd)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"DDD invalido: {ddd!r}")
    delete_manual_plan_snapshot_ddd(ddd)
    app_logger.info(f"[PLAN][DDD {ddd}] deleted")
    return {"status": "deleted"}


# ── Planejamento publicado (read-only, consumo externo: CRM / Palm / Torre) ──

def _build_current_planning_response(ddd: str, snapshot: dict | None) -> dict:
    """Transforma o snapshot bruto do manual-plan em payload estruturado para consumo externo."""
    if snapshot is None or not snapshot.get("clients"):
        return {
            "ddd": ddd,
            "status": "draft_available",
            "source": "manual-plan",
            "savedAt": None,
            "totalAssignments": 0,
            "assignments": [],
        }

    assignments = [
        {
            "clientId": c.get("id", ""),
            "driverId": c.get("driverId", ""),
            "driverName": c.get("driverName", ""),
            "week": c.get("week", 1),
            "day": str(c.get("day", "")).upper(),
            "sequence": c.get("sequence", 0),
        }
        for c in snapshot.get("clients", [])
    ]

    return {
        "ddd": ddd,
        "status": "draft_available",
        "source": "manual-plan",
        "savedAt": snapshot.get("savedAt"),
        "totalAssignments": len(assignments),
        "assignments": assignments,
    }


@app.get("/planning/{ddd}/current")
def get_current_planning(ddd: str):
    """
    Retorna o planejamento atual do DDD em formato estruturado para consumo externo
    (CRM, Palm, Torre). Read-only — não altera o manual-plan persistido.
    """
    try:
        _get_ddd_plan_file(ddd)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"DDD invalido: {ddd!r}")

    snapshot = read_manual_plan_snapshot_ddd(ddd)
    response = _build_current_planning_response(ddd, snapshot)
    app_logger.info(
        f"[PLANNING][DDD {ddd}] current fetched",
        extra={"total_assignments": response["totalAssignments"]},
    )
    return response


@app.post("/sessions", response_model=SessionRegionSchema)
def create_session(session: SessionRegionCreate, db: Session = Depends(get_db)):
    db_session = SessionRegionModel(code=session.code, name=session.name, ddd=session.ddd)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@app.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    return db.query(SessionRegionModel).all()


@app.post("/customers", response_model=CustomerSchema)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    resolved_status = normalize_status_with_coordinates("ATIVO", customer.lat, customer.lon)
    db_customer = CustomerModel(
        name=customer.name,
        lat=customer.lat,
        lon=customer.lon,
        segmento=customer.segmento,
        frequencia=customer.frequencia,
        curva=customer.curva,
        tempo_atendimento=customer.tempo_atendimento,
        session_id=customer.session_id,
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    append_event(
        customer_id=db_customer.id,
        action="CLIENTE_CRIADO",
        user="backend",
        metadata={"name": db_customer.name, "status": resolved_status},
    )
    return db_customer


@app.get("/customers")
def list_customers(db: Session = Depends(get_db)):
    return db.query(CustomerModel).all()


@app.post("/vehicles", response_model=VehicleSchema)
def create_vehicle(vehicle: VehicleCreate, db: Session = Depends(get_db)):
    db_vehicle = VehicleModel(
        name=vehicle.name,
        cost_per_km=vehicle.cost_per_km,
        autonomia_km=vehicle.autonomia_km,
        ev=vehicle.ev,
    )
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle


@app.get("/vehicles")
def list_vehicles(db: Session = Depends(get_db)):
    return db.query(VehicleModel).all()


@app.post("/plan", response_model=RouteReport)
def plan(
    start_address: str,
    start_lat: float,
    start_lon: float,
    vehicle_id: int,
    session_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    vehicle = db.get(VehicleModel, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    customer_query = db.query(CustomerModel)
    if session_id is not None:
        customer_query = customer_query.filter(CustomerModel.session_id == session_id)
    customers = customer_query.all()
    valid_customers = [c for c in customers if not is_sem_coordenada(c.lat, c.lon)]
    if not valid_customers:
        raise HTTPException(status_code=400, detail="Nenhum cliente com coordenada valida para roteirizacao.")

    clients = [
        {
            "id": c.id,
            "name": c.name,
            "lat": c.lat,
            "lon": c.lon,
            "segmento": c.segmento,
            "frequencia": c.frequencia,
            "curva": c.curva,
            "tempo_atendimento": c.tempo_atendimento,
        }
        for c in valid_customers
    ]

    plan_result = plan_route([start_lat, start_lon], clients, vehicle_speed_kmh=40.0)
    total_cost = plan_result["total_distance_km"] * vehicle.cost_per_km
    total_service_time_min = sum(int(c.get("tempo_atendimento", 0) or 0) for c in clients)
    total_time_min = round(plan_result["total_time_min"] + total_service_time_min, 1)

    return RouteReport(
        start_address=start_address,
        route_order=plan_result["route_order"],
        total_distance_km=plan_result["total_distance_km"],
        total_time_min=total_time_min,
        total_cost=total_cost,
    )


@app.post("/plan/advanced", response_model=AdvancedPlanResponse)
def plan_advanced(request: AdvancedPlanRequest, db: Session = Depends(get_db)):
    payload = request.model_dump()
    result = plan_advanced_routes(
        depot=payload["depot"],
        vehicles=payload["vehicles"],
        customers=payload["customers"],
        options=payload["options"],
    )

    if payload.get("persist_history", True):
        history = AdvancedPlanHistory(
            scenario_name=payload.get("scenario_name") or "Plano avancado",
            status=result.get("status", "unknown"),
            selected_ddd=payload.get("selected_ddd"),
            customers_count=len(payload.get("customers", [])),
            vehicles_count=len(payload.get("vehicles", [])),
            payload_json=json.dumps(payload, ensure_ascii=True),
            result_json=json.dumps(result, ensure_ascii=True),
        )
        db.add(history)
        db.commit()

    return result


@app.post("/plan/batch", response_model=BatchRoutingResponse)
def plan_batch(request: BatchRoutingRequest):
    payload = request.model_dump()
    try:
        return plan_batch_routes(
            customers=payload.get("customers", []),
            depots=payload.get("depots", []),
            options=payload.get("options", {}),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/routes/eligibility", response_model=RouteEligibilityResponse)
def validate_route_eligibility(request: RouteEligibilityRequest):
    status = request.status
    has_valid_coordinates = bool(request.has_valid_coordinates)
    if request.lat is not None or request.lon is not None:
        has_valid_coordinates = has_valid_coordinates and (not is_sem_coordenada(request.lat, request.lon))

    if status == ClientStatus.INATIVO:
        return RouteEligibilityResponse(eligible=False, reason="Cliente inativo nao entra automaticamente em rota.")

    if status == ClientStatus.SEM_COORDENADA or not has_valid_coordinates:
        return RouteEligibilityResponse(eligible=False, reason="Cliente sem coordenada valida nao pode entrar em roteirizacao.")

    if status == ClientStatus.NOVO and not request.eligible_for_routing:
        return RouteEligibilityResponse(eligible=False, reason="Cliente novo precisa de habilitacao manual para roteirizacao.")

    return RouteEligibilityResponse(eligible=True, reason="Cliente elegivel para roteirizacao.")


@app.post("/routes/manual-include", response_model=ManualIncludeRouteResponse)
def manual_include_in_route(request: ManualIncludeRouteRequest):
    if request.status == ClientStatus.INATIVO and not request.confirm_inactive:
        raise HTTPException(
            status_code=400,
            detail="Cliente inativo. Deseja incluir manualmente na rota?",
        )

    append_event(
        customer_id=request.customer_id,
        action="INCLUSAO_MANUAL_ROTA",
        user=request.user,
        metadata={
            "status": request.status.value,
            "append_as_last": True,
        },
    )

    return ManualIncludeRouteResponse(
        allowed=True,
        append_as_last=True,
        reason="Inclusao manual autorizada. Cliente inserido ao final da rota.",
    )


@app.post("/customers/{customer_id}/status", response_model=CustomerStatusEventResponse)
def update_customer_status_event(customer_id: str, status: ClientStatus, user: str = "frontend"):
    action = "CLIENTE_INATIVADO" if status == ClientStatus.INATIVO else "STATUS_CLIENTE_ALTERADO"
    append_event(
        customer_id=customer_id,
        action=action,
        user=user,
        metadata={"status": status.value},
    )
    return {"status": "logged", "customer_id": customer_id, "new_status": status.value}


@app.post("/customers/{customer_id}/visit-day", response_model=CustomerVisitDayEventResponse)
def log_visit_day_change(customer_id: str, day: str, week: int, user: str = "frontend"):
    append_event(
        customer_id=customer_id,
        action="ALTERACAO_DIA_VISITA",
        user=user,
        metadata={"day": day, "week": week},
    )
    return {"status": "logged", "customer_id": customer_id, "day": day, "week": week}


@app.post("/customers/{customer_id}/coordinates", response_model=CustomerCoordinateUpdateResponse)
def update_customer_coordinates(customer_id: int, payload: CustomerCoordinateUpdateRequest, db: Session = Depends(get_db)):
    customer = db.get(CustomerModel, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if is_sem_coordenada(payload.lat, payload.lon):
        raise HTTPException(status_code=400, detail="Coordenadas invalidas para area geografica esperada.")

    customer.lat = float(payload.lat)
    customer.lon = float(payload.lon)
    db.add(customer)
    db.commit()
    db.refresh(customer)

    append_event(
        customer_id=customer_id,
        action="COORDENADA_ATUALIZADA",
        user=payload.user,
        metadata={"lat": customer.lat, "lon": customer.lon},
    )

    return CustomerCoordinateUpdateResponse(
        customer_id=str(customer_id),
        status=ClientStatus.ATIVO,
        lat=float(customer.lat),
        lon=float(customer.lon),
    )


@app.post("/customers/{customer_id}/geocode", response_model=CustomerGeocodingResponse)
async def geocode_customer_address(customer_id: int, payload: CustomerGeocodingRequest, db: Session = Depends(get_db)):
    """
    Geocodifica endereço de cliente usando Nominatim (OpenStreetMap).
    
    - Converte endereço em coordenadas lat/lon
    - Valida coordenadas (dentro do Brasil, não em lista de inválidas)
    - Atualiza cliente se sucesso
    - Registra evento de geocoding
    """
    customer = db.get(CustomerModel, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    def _preferred_value(payload_value: Optional[str], fallback_attr: str) -> Optional[str]:
        # Prioriza o payload; se ausente, usa fallback seguro do modelo (se existir).
        if payload_value is not None and str(payload_value).strip() != "":
            return str(payload_value).strip()
        model_value = getattr(customer, fallback_attr, None)
        if model_value is None:
            return None
        model_value_str = str(model_value).strip()
        return model_value_str or None

    address = _preferred_value(payload.address, "address")
    number = _preferred_value(payload.number, "number")
    neighborhood = _preferred_value(payload.neighborhood, "neighborhood")
    city = _preferred_value(payload.city, "city")
    state = _preferred_value(payload.state, "state")

    if not any([address, number, neighborhood, city, state]):
        raise HTTPException(
            status_code=422,
            detail="Endereco insuficiente para geocoding. Informe ao menos um campo de endereco no payload.",
        )
    
    geocoding_svc = get_geocoding_service()
    result = await geocoding_svc.geocode(
        customer_id=customer_id,
        address=address,
        number=number,
        neighborhood=neighborhood,
        city=city,
        state=state,
        user=payload.user,
    )
    
    # Se geocoding bem-sucedido, atualiza cliente
    if result.get("success"):
        customer.lat = float(result["lat"])
        customer.lon = float(result["lon"])
        db.add(customer)
        db.commit()
        db.refresh(customer)
    else:
        # Geocoding falhou: endereço não encontrado ou coordenada inválida (422 semântico).
        raise HTTPException(status_code=422, detail=result.get("message", "Geocoding falhou."))

    return CustomerGeocodingResponse(**result)


@app.get("/events", response_model=list[EventLogRecord])
def list_events(limit: int = 200):
    return read_events(limit=limit)


@app.post("/exportar-clientes", response_model=ExportCustomersResponse)
def export_customers_backend(request: ExportCustomersRequest):
    append_event(
        customer_id="bulk",
        action="EXPORTACAO_CLIENTES",
        user=request.user,
        metadata={"rows": len(request.customers)},
    )
    return ExportCustomersResponse(
        status="queued",
        rows=len(request.customers),
        generated_at=datetime.utcnow().isoformat(),
    )


@app.get("/simulation/scenario", response_model=SimulationScenarioResponse)
def simulation_scenario():
    return {
        "status": "ready",
        "clients": {
            "ATIVO": 120,
            "NOVO": 18,
            "INATIVO": 14,
            "SEM_COORDENADA": 9,
        },
        "checks": [
            "integracao_crm",
            "alteracao_status",
            "atalhos_alt_u_alt_i",
            "tentativa_roteirizacao_invalida",
            "exportacao_base",
        ],
    }


@app.get("/plan/advanced/history", response_model=AdvancedPlanHistoryResponse)
def list_advanced_plan_history(limit: int = 30, db: Session = Depends(get_db)):
    safe_limit = max(1, min(limit, 200))
    records = (
        db.query(AdvancedPlanHistory)
        .order_by(AdvancedPlanHistory.created_at.desc())
        .limit(safe_limit)
        .all()
    )

    items = []
    for record in records:
        parsed_result = {}
        try:
            parsed_result = json.loads(record.result_json or "{}")
        except json.JSONDecodeError:
            parsed_result = {}

        summary = parsed_result.get("summary", {})

        items.append(
            AdvancedPlanHistoryItem(
                id=record.id,
                scenario_name=record.scenario_name,
                status=record.status,
                selected_ddd=record.selected_ddd,
                customers_count=record.customers_count,
                vehicles_count=record.vehicles_count,
                customers_planned=int(summary.get("customers_planned", 0) or 0),
                customers_dropped=int(summary.get("customers_dropped", 0) or 0),
                total_distance_km=float(summary.get("total_distance_km", 0) or 0),
                total_cost=float(summary.get("total_cost", 0) or 0),
                created_at=(record.created_at or datetime.utcnow()).isoformat(),
            )
        )
    return AdvancedPlanHistoryResponse(items=items)


@app.get("/plan/advanced/history/{history_id}", response_model=AdvancedPlanHistoryDetailResponse)
def get_advanced_plan_history_item(history_id: int, db: Session = Depends(get_db)):
    record = db.get(AdvancedPlanHistory, history_id)
    if not record:
        raise HTTPException(status_code=404, detail="History entry not found")

    try:
        payload = json.loads(record.payload_json or "{}")
    except json.JSONDecodeError:
        payload = {}

    try:
        result = json.loads(record.result_json or "{}")
    except json.JSONDecodeError:
        result = {}

    return AdvancedPlanHistoryDetailResponse(
        id=record.id,
        scenario_name=record.scenario_name,
        status=record.status,
        selected_ddd=record.selected_ddd,
        customers_count=record.customers_count,
        vehicles_count=record.vehicles_count,
        created_at=(record.created_at or datetime.utcnow()).isoformat(),
        payload=payload,
        result=result,
    )
