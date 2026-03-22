from enum import Enum
from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class ClientStatus(str, Enum):
    ATIVO = "ATIVO"
    VALIDADO = "VALIDADO"
    CREDENCIADO = "CREDENCIADO"
    NOVO = "NOVO"
    INATIVO = "INATIVO"
    SEM_COORDENADA = "SEM_COORDENADA"


class CustomerBase(BaseModel):
    name: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    segmento: str
    frequencia: str
    curva: str
    tempo_atendimento: int


class CustomerCreate(CustomerBase):
    session_id: Optional[int]


class Customer(CustomerBase):
    id: int
    session_id: Optional[int]

    class Config:
        orm_mode = True


class VehicleBase(BaseModel):
    name: str
    cost_per_km: float
    autonomia_km: float
    ev: bool = False


class VehicleCreate(VehicleBase):
    pass


class Vehicle(VehicleBase):
    id: int

    class Config:
        orm_mode = True


class RouteReport(BaseModel):
    start_address: str
    route_order: List[int]
    total_distance_km: float
    total_time_min: float
    total_cost: float
    weekly_plan: Optional[dict] = None


class SessionRegionBase(BaseModel):
    code: str
    name: str
    ddd: str


class SessionRegionCreate(SessionRegionBase):
    pass


class SessionRegion(SessionRegionBase):
    id: int

    class Config:
        orm_mode = True


class ManualPlanClientSnapshot(BaseModel):
    id: str
    week: int
    day: str
    driverId: str
    sequence: int


class ManualPlanSnapshot(BaseModel):
    version: int = 1
    savedAt: str
    clients: List[ManualPlanClientSnapshot]


class AdvancedDepot(BaseModel):
    lat: float
    lon: float
    label: str = "Base"


class AdvancedVehicle(BaseModel):
    id: str
    name: str
    capacity: int = Field(default=100, ge=1)
    max_route_time_min: int = Field(default=600, ge=60)
    max_distance_km: Optional[float] = Field(default=None, ge=1)
    speed_kmh: float = Field(default=35.0, gt=0)
    start_time_min: int = Field(default=480, ge=0, le=1440)
    end_time_min: int = Field(default=1080, ge=0, le=1440)
    cost_per_km: float = Field(default=2.2, ge=0)


class AdvancedCustomer(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    service_time_min: int = Field(default=10, ge=0, le=300)
    demand: int = Field(default=1, ge=0)
    priority: int = Field(default=5, ge=1, le=10)
    time_window_start_min: Optional[int] = Field(default=None, ge=0, le=1440)
    time_window_end_min: Optional[int] = Field(default=None, ge=0, le=1440)


class AdvancedPlannerOptions(BaseModel):
    allow_drop_nodes: bool = True
    return_to_depot: bool = True
    balance_routes: bool = True
    drop_penalty_base: int = Field(default=20_000, ge=0)
    priority_penalty_factor: int = Field(default=4_000, ge=0)
    search_time_limit_sec: int = Field(default=10, ge=1, le=120)


class AdvancedPlanRequest(BaseModel):
    depot: AdvancedDepot
    vehicles: List[AdvancedVehicle]
    customers: List[AdvancedCustomer]
    options: AdvancedPlannerOptions = AdvancedPlannerOptions()
    scenario_name: Optional[str] = None
    selected_ddd: Optional[str] = None
    persist_history: bool = True


class VehicleRouteReport(BaseModel):
    vehicle_id: str
    vehicle_name: str
    route_order: List[str]
    total_distance_km: float
    total_drive_time_min: float
    total_service_time_min: float
    total_route_time_min: float
    estimated_cost: float
    utilization_pct: float


class AdvancedPlanSummary(BaseModel):
    vehicles_used: int
    customers_planned: int
    customers_dropped: int
    total_distance_km: float
    total_drive_time_min: float
    total_service_time_min: float
    total_cost: float


class AdvancedPlanResponse(BaseModel):
    status: str
    objective_value: int
    routes: List[VehicleRouteReport]
    dropped_customers: List[str]
    summary: AdvancedPlanSummary
    diagnostics: Dict[str, str]


class AdvancedPlanHistoryItem(BaseModel):
    id: int
    scenario_name: Optional[str]
    status: str
    selected_ddd: Optional[str]
    customers_count: int
    vehicles_count: int
    customers_planned: int
    customers_dropped: int
    total_distance_km: float
    total_cost: float
    created_at: str


class AdvancedPlanHistoryResponse(BaseModel):
    items: List[AdvancedPlanHistoryItem]


class AdvancedPlanHistoryDetailResponse(BaseModel):
    id: int
    scenario_name: Optional[str]
    status: str
    selected_ddd: Optional[str]
    customers_count: int
    vehicles_count: int
    created_at: str
    payload: Dict
    result: Dict


class BatchRoutingCustomer(BaseModel):
    id: str
    name: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    region: str
    driver_id: str
    status: ClientStatus = ClientStatus.ATIVO
    eligible_for_routing: bool = False
    service_time_min: int = Field(default=10, ge=0, le=300)


class BatchRoutingDepot(BaseModel):
    region: str
    driver_id: str
    lat: float
    lon: float
    label: Optional[str] = None


class BatchRoutingOptions(BaseModel):
    vehicle_speed_kmh: float = Field(default=40.0, gt=0)
    cost_per_km: float = Field(default=2.2, ge=0)
    include_new_when_eligible: bool = True


class BatchRoutingRequest(BaseModel):
    customers: List[BatchRoutingCustomer]
    depots: List[BatchRoutingDepot] = []
    options: BatchRoutingOptions = BatchRoutingOptions()


class BatchRoutingGroupResult(BaseModel):
    group_id: str
    region: str
    driver_id: str
    customers_count: int
    route_order: List[str]
    total_distance_km: float
    total_time_min: float
    total_cost: float
    depot_source: str


class BatchRoutingSummary(BaseModel):
    groups_processed: int
    customers_processed: int
    customers_skipped: int
    skipped_by_status: Dict[str, int]
    total_distance_km: float
    total_time_min: float
    total_cost: float


class BatchRoutingResponse(BaseModel):
    status: str
    groups: List[BatchRoutingGroupResult]
    summary: BatchRoutingSummary


class RouteEligibilityRequest(BaseModel):
    customer_id: str
    status: ClientStatus
    lat: Optional[float] = None
    lon: Optional[float] = None
    has_valid_coordinates: bool = True
    eligible_for_routing: bool = False


class RouteEligibilityResponse(BaseModel):
    eligible: bool
    reason: str


class ManualIncludeRouteRequest(BaseModel):
    customer_id: str
    status: ClientStatus
    confirm_inactive: bool = False
    user: str = "frontend"


class ManualIncludeRouteResponse(BaseModel):
    allowed: bool
    append_as_last: bool
    reason: str


class EventLogRecord(BaseModel):
    customer_id: str
    action: str
    user: str
    timestamp: str
    metadata: Dict = {}


class CustomerCoordinateUpdateRequest(BaseModel):
    lat: float
    lon: float
    user: str = "frontend"


class CustomerCoordinateUpdateResponse(BaseModel):
    customer_id: str
    status: ClientStatus
    lat: float
    lon: float


class CustomerGeocodingRequest(BaseModel):
    address: Optional[str] = None
    number: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    user: str = "frontend"


class CustomerGeocodingResponse(BaseModel):
    customer_id: int
    success: bool
    message: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    address_built: str
    display_name: Optional[str] = None
    timestamp: str


class ExportCustomersRequest(BaseModel):
    customers: List[BatchRoutingCustomer]
    user: str = "frontend"


class ExportCustomersResponse(BaseModel):
    status: str
    rows: int
    generated_at: str
