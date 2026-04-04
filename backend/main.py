from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from sqlalchemy.orm import Session
from pathlib import Path
import json
import os
import uuid
from typing import Optional
from fastapi import Request
from datetime import datetime
from event_logger import append_event, read_events
from logging_manager import set_request_id
from coordinate_rules import is_sem_coordenada, normalize_status_with_coordinates
from geocoding_service import get_geocoding_service

from db import engine, Base, get_db
from models import SessionRegion as SessionRegionModel, Customer as CustomerModel, Vehicle as VehicleModel, AdvancedPlanHistory, RouteVersion
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
                     CustomerVisitDayEventResponse, SimulationScenarioResponse,
                     RouteVersionItem, RouteVersionListResponse,
                     RouteVersionDetailResponse, RouteVersionCompareResponse,
                     RouteVersionRestoreResponse)
from route_planner import plan_route, plan_advanced_routes, plan_batch_routes
from logging_manager import app_logger
from simulation_store import (
    get_simulation_customers,
    apply_assignment_updates,
    get_simulation_summary,
)
from validate_env import validate_env
from jwt_utils import require_auth

validate_env()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Routflex Backend")
MANUAL_PLAN_FILE = Path(__file__).resolve().parent / "manual_plan_snapshot.json"


def get_cors_settings():
    raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001")
    env = os.getenv("NODE_ENV", "development")
    if env == "production":
        origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "https://app.routflex.com").split(",") if o.strip()]
    else:
        origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    if not origins:
        origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3001", "http://127.0.0.1:3001"]
    has_wildcard = "*" in origins
    return {
        "allow_origins": origins,
        "allow_credentials": not has_wildcard,
    }


cors_settings = get_cors_settings()


class PermissiveDevCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        allowed_origins = set(cors_settings["allow_origins"])
        allow_this_origin = (origin in allowed_origins) or (origin == "null")

        if request.method == "OPTIONS":
            response = Response(status_code=200)
        else:
            response = await call_next(request)

        if allow_this_origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Vary"] = "Origin"
        return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_settings["allow_origins"],
    allow_credentials=cors_settings["allow_credentials"],
    allow_methods=["*"],
    allow_headers=["*"],
)
if os.getenv("NODE_ENV") != "production":
    app.add_middleware(PermissiveDevCORSMiddleware)


# Middleware para rastreabilidade: injeta request_id no contexto
class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        set_request_id(request_id)
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response


app.add_middleware(RequestIdMiddleware)


@app.on_event("startup")
async def _on_startup() -> None:
    env = os.getenv("NODE_ENV", "development")
    use_mock = os.getenv("USE_MOCK", "false").lower() in ["1", "true", "yes"]
    app_logger.info(
        "Routflex backend iniciado",
        extra={"cors_origins": cors_settings["allow_origins"], "env": env, "use_mock": use_mock},
    )
    if env == "production" and use_mock:
        app_logger.error("USE_MOCK=true não permitido em produção. Abortando.")
        import sys
        sys.exit(1)


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


@app.get("/manual-plan")
def get_manual_plan():
    snapshot = read_manual_plan_snapshot()
    if snapshot is None:
        return {"version": 1, "savedAt": None, "clients": []}
    return snapshot


@app.put("/manual-plan", response_model=ManualPlanSaveResponse)
def save_manual_plan(snapshot: ManualPlanSnapshot, user=Depends(require_auth)):
    payload = snapshot.model_dump()
    write_manual_plan_snapshot(payload)
    return {"status": "saved", "savedAt": payload["savedAt"], "count": len(payload["clients"])}


@app.delete("/manual-plan", response_model=GenericStatusResponse)
def delete_manual_plan(user=Depends(require_auth)):
    if MANUAL_PLAN_FILE.exists():
        MANUAL_PLAN_FILE.unlink()
    return {"status": "deleted"}


@app.post("/sessions", response_model=SessionRegionSchema)
def create_session(session: SessionRegionCreate, db: Session = Depends(get_db), user=Depends(require_auth)):
    db_session = SessionRegionModel(code=session.code, name=session.name, ddd=session.ddd)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@app.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    return db.query(SessionRegionModel).all()


@app.post("/customers", response_model=CustomerSchema)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db), user=Depends(require_auth)):
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
def create_vehicle(vehicle: VehicleCreate, db: Session = Depends(get_db), user=Depends(require_auth)):
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


# ── Route Versioning helper ─────────────────────────────────────────────────────

def _next_route_version(db_session: Session, session_id: Optional[int], route_type: str) -> int:
    from sqlalchemy import func
    q = db_session.query(func.coalesce(func.max(RouteVersion.version), 0)).filter(
        RouteVersion.route_type == route_type,
    )
    if session_id is not None:
        q = q.filter(RouteVersion.session_id == session_id)
    return q.scalar() + 1


def _save_route_version(
    db_session: Session,
    *,
    session_id: Optional[int],
    route_type: str,
    driver_id: Optional[str],
    customers: list,
    route_order: list,
    result: dict,
    total_distance_km: Optional[float] = None,
    total_time_min: Optional[float] = None,
    total_cost: Optional[float] = None,
    label: Optional[str] = None,
) -> RouteVersion:
    version_num = _next_route_version(db_session, session_id, route_type)
    rv = RouteVersion(
        session_id=session_id,
        version=version_num,
        route_type=route_type,
        driver_id=driver_id,
        customers_json=json.dumps(customers, ensure_ascii=False),
        route_order_json=json.dumps(route_order, ensure_ascii=False),
        result_json=json.dumps(result, ensure_ascii=False),
        total_distance_km=total_distance_km,
        total_time_min=total_time_min,
        total_cost=total_cost,
        label=label,
    )
    db_session.add(rv)
    db_session.commit()
    db_session.refresh(rv)
    return rv


@app.post("/plan", response_model=RouteReport)
def plan(
    start_address: str,
    start_lat: float,
    start_lon: float,
    vehicle_id: int,
    session_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user=Depends(require_auth),
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

    _save_route_version(
        db,
        session_id=session_id,
        route_type="plan",
        driver_id=vehicle.name,
        customers=clients,
        route_order=plan_result["route_order"],
        result=plan_result,
        total_distance_km=plan_result["total_distance_km"],
        total_time_min=total_time_min,
        total_cost=total_cost,
    )

    return RouteReport(
        start_address=start_address,
        route_order=plan_result["route_order"],
        total_distance_km=plan_result["total_distance_km"],
        total_time_min=total_time_min,
        total_cost=total_cost,
    )


@app.post("/plan/advanced", response_model=AdvancedPlanResponse)
def plan_advanced(request: AdvancedPlanRequest, db: Session = Depends(get_db), user=Depends(require_auth)):
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

    summary = result.get("summary", {})
    for route in result.get("routes", []):
        _save_route_version(
            db,
            session_id=None,
            route_type="advanced",
            driver_id=route.get("vehicle_id"),
            customers=payload.get("customers", []),
            route_order=route.get("route_order", []),
            result=route,
            total_distance_km=route.get("total_distance_km"),
            total_time_min=route.get("total_route_time_min"),
            total_cost=route.get("estimated_cost"),
            label=payload.get("scenario_name"),
        )

    return result


@app.post("/plan/batch", response_model=BatchRoutingResponse)
def plan_batch(request: BatchRoutingRequest, db: Session = Depends(get_db), user=Depends(require_auth)):
    payload = request.model_dump()
    try:
        result = plan_batch_routes(
            customers=payload.get("customers", []),
            depots=payload.get("depots", []),
            options=payload.get("options", {}),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    for group in result.get("groups", []):
        _save_route_version(
            db,
            session_id=None,
            route_type="batch",
            driver_id=group.get("driver_id") or group.get("group_id"),
            customers=payload.get("customers", []),
            route_order=group.get("route_order", []),
            result=group,
            total_distance_km=group.get("total_distance_km"),
            total_time_min=group.get("total_time_min"),
            total_cost=group.get("total_cost"),
        )

    return result


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
def manual_include_in_route(request: ManualIncludeRouteRequest, user=Depends(require_auth)):
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
def update_customer_status_event(customer_id: str, status: ClientStatus, user: str = "frontend", _auth=Depends(require_auth)):
    action = "CLIENTE_INATIVADO" if status == ClientStatus.INATIVO else "STATUS_CLIENTE_ALTERADO"
    append_event(
        customer_id=customer_id,
        action=action,
        user=user,
        metadata={"status": status.value},
    )
    return {"status": "logged", "customer_id": customer_id, "new_status": status.value}


@app.post("/customers/{customer_id}/visit-day", response_model=CustomerVisitDayEventResponse)
def log_visit_day_change(customer_id: str, day: str, week: int, user: str = "frontend", _auth=Depends(require_auth)):
    append_event(
        customer_id=customer_id,
        action="ALTERACAO_DIA_VISITA",
        user=user,
        metadata={"day": day, "week": week},
    )
    return {"status": "logged", "customer_id": customer_id, "day": day, "week": week}


@app.post("/customers/{customer_id}/coordinates", response_model=CustomerCoordinateUpdateResponse)
def update_customer_coordinates(customer_id: int, payload: CustomerCoordinateUpdateRequest, db: Session = Depends(get_db), user=Depends(require_auth)):
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
async def geocode_customer_address(customer_id: int, payload: CustomerGeocodingRequest, db: Session = Depends(get_db), user=Depends(require_auth)):
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
def export_customers_backend(request: ExportCustomersRequest, user=Depends(require_auth)):
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
    # Endpoints /simulation/* são para teste isolado do mapa com simulation_store.py.
    # Eles não substituem o fluxo de integração CRM -> /plan/*.
    summary = get_simulation_summary()
    return {
        "status": "ready",
        "clients": {
            "ATIVO": summary.get("ativos", 0),
            "INATIVO": summary.get("inativos", 0),
            "SEM_COORDENADA": 0,
        },
        "checks": [
            "integracao_crm",
            "alteracao_status",
            "atalhos_alt_u_alt_i",
            "tentativa_roteirizacao_invalida",
            "exportacao_base",
        ],
    }


@app.get("/simulation/customers")
def simulation_customers():
    # Fonte dedicada de dados simulados (standalone) para o modo SIMULATION do mapa.
    customers = get_simulation_customers()
    app_logger.info(
        "simulation_customers_delivered",
        extra={
            "total": len(customers),
            "ddds": sorted(list({str(item.get("ddd")) for item in customers if item.get("ddd") is not None})),
        },
    )
    return {
        "items": customers,
        "total": len(customers),
    }


@app.put("/simulation/assignments")
def simulation_assignments(payload: dict):
    updates = payload.get("updates") if isinstance(payload, dict) else []
    updates = updates if isinstance(updates, list) else []
    updated_count = apply_assignment_updates(updates)
    sample_ids = [str(item.get("client_id")) for item in updates[:5] if isinstance(item, dict)]
    app_logger.info(
        "simulation_assignments_updated",
        extra={
            "received": len(updates),
            "updated": updated_count,
            "sample_client_ids": sample_ids,
        },
    )
    return {"status": "ok", "updated": updated_count}


@app.get("/simulation/summary")
def simulation_summary():
    summary = get_simulation_summary()
    app_logger.info(
        "simulation_summary_requested",
        extra={
            "total": int(summary.get("total", 0)),
            "ativos": int(summary.get("ativos", 0)),
            "inativos": int(summary.get("inativos", 0)),
        },
    )
    return summary


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


# ── Route Versioning Endpoints ──────────────────────────────────────────────────

def _rv_to_item(rv: RouteVersion) -> RouteVersionItem:
    return RouteVersionItem(
        id=rv.id,
        session_id=rv.session_id,
        version=rv.version,
        route_type=rv.route_type,
        driver_id=rv.driver_id,
        total_distance_km=rv.total_distance_km,
        total_time_min=rv.total_time_min,
        total_cost=rv.total_cost,
        created_at=(rv.created_at or datetime.utcnow()).isoformat(),
        label=rv.label,
    )


def _rv_to_detail(rv: RouteVersion) -> RouteVersionDetailResponse:
    try:
        customers = json.loads(rv.customers_json or "[]")
    except json.JSONDecodeError:
        customers = []
    try:
        route_order = json.loads(rv.route_order_json or "[]")
    except json.JSONDecodeError:
        route_order = []
    try:
        result = json.loads(rv.result_json or "{}")
    except json.JSONDecodeError:
        result = {}

    item = _rv_to_item(rv)
    return RouteVersionDetailResponse(
        **item.model_dump(),
        customers=customers,
        route_order=route_order,
        result=result,
    )


@app.get("/routes/versions", response_model=RouteVersionListResponse)
def list_route_versions(
    session_id: Optional[int] = None,
    route_type: Optional[str] = None,
    driver_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    safe_limit = max(1, min(limit, 200))
    q = db.query(RouteVersion)
    if session_id is not None:
        q = q.filter(RouteVersion.session_id == session_id)
    if route_type:
        q = q.filter(RouteVersion.route_type == route_type)
    if driver_id:
        q = q.filter(RouteVersion.driver_id == driver_id)
    records = q.order_by(RouteVersion.created_at.desc()).limit(safe_limit).all()
    return RouteVersionListResponse(items=[_rv_to_item(r) for r in records])


@app.get("/routes/versions/{version_id}", response_model=RouteVersionDetailResponse)
def get_route_version(version_id: int, db: Session = Depends(get_db)):
    rv = db.get(RouteVersion, version_id)
    if not rv:
        raise HTTPException(status_code=404, detail="Route version not found")
    return _rv_to_detail(rv)


@app.get("/routes/versions/compare/{id_a}/{id_b}", response_model=RouteVersionCompareResponse)
def compare_route_versions(id_a: int, id_b: int, db: Session = Depends(get_db)):
    rv_a = db.get(RouteVersion, id_a)
    rv_b = db.get(RouteVersion, id_b)
    if not rv_a or not rv_b:
        raise HTTPException(status_code=404, detail="One or both versions not found")

    detail_a = _rv_to_detail(rv_a)
    detail_b = _rv_to_detail(rv_b)

    set_a = set(str(c.get("id", "")) for c in detail_a.customers)
    set_b = set(str(c.get("id", "")) for c in detail_b.customers)

    diff = {
        "distance_delta_km": round((detail_b.total_distance_km or 0) - (detail_a.total_distance_km or 0), 2),
        "time_delta_min": round((detail_b.total_time_min or 0) - (detail_a.total_time_min or 0), 2),
        "cost_delta": round((detail_b.total_cost or 0) - (detail_a.total_cost or 0), 2),
        "customers_added": list(set_b - set_a),
        "customers_removed": list(set_a - set_b),
        "route_order_changed": detail_a.route_order != detail_b.route_order,
    }

    return RouteVersionCompareResponse(version_a=detail_a, version_b=detail_b, diff=diff)


@app.post("/routes/versions/{version_id}/restore", response_model=RouteVersionRestoreResponse)
def restore_route_version(version_id: int, db: Session = Depends(get_db), user=Depends(require_auth)):
    original = db.get(RouteVersion, version_id)
    if not original:
        raise HTTPException(status_code=404, detail="Route version not found")

    new_rv = _save_route_version(
        db,
        session_id=original.session_id,
        route_type=original.route_type,
        driver_id=original.driver_id,
        customers=json.loads(original.customers_json or "[]"),
        route_order=json.loads(original.route_order_json or "[]"),
        result=json.loads(original.result_json or "{}"),
        total_distance_km=original.total_distance_km,
        total_time_min=original.total_time_min,
        total_cost=original.total_cost,
        label=f"Restaurado da v{original.version} (id={original.id})",
    )

    return RouteVersionRestoreResponse(
        status="restored",
        restored_version_id=original.id,
        new_version_id=new_rv.id,
    )
