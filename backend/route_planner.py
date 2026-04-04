import math
import threading
import time
from collections import OrderedDict
from statistics import mean
from typing import Dict, List, Tuple

from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from coordinate_rules import is_sem_coordenada


EARTH_RADIUS_M = 6_371_000
# Máximo de clientes por chamada OR-Tools; acima disso aplica-se pré-clusterização geográfica.
CLUSTER_MAX_SIZE = 120

# Cache LRU com TTL para haversine_meters.
# Limite por worker: 1024 × ~160 bytes ≈ 160 KB — não cresce indefinidamente.
# TTL de 24h garante que coordenadas desatualizadas (retrofit ou correcção de dados)
# são descartadas sem precisar reiniciar o worker.
_HAVERSINE_MAXSIZE = 1024
_HAVERSINE_TTL_SEC = 86_400  # 24 h


class _TtlLruCache:
    """
    Cache LRU com expiração por entrada (TTL). Thread-safe via threading.Lock.

    Implementado sobre OrderedDict para manter ordem de acesso em O(1).
    Ausente de dependências externas — usa apenas stdlib.

    Multi-worker (Gunicorn): cada worker tem sua própria instância em memória.
    Idéntico ao comportamento original do lru_cache, porém com tamanho e
    tempo de vida controlados.
    """

    def __init__(self, maxsize: int, ttl: float) -> None:
        self._maxsize = maxsize
        self._ttl = ttl
        self._store: OrderedDict = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key):
        """Retorna (value, True) se hit válido; (None, False) se miss ou expirado."""
        with self._lock:
            if key not in self._store:
                return None, False
            value, ts = self._store[key]
            if time.monotonic() - ts > self._ttl:
                # Entrada expirada: remove e reporta miss
                del self._store[key]
                return None, False
            self._store.move_to_end(key)  # marca como recentemente usado
            return value, True

    def set(self, key, value) -> None:
        """Armazena entrada; evicta LRU se capacidade atingida."""
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            elif len(self._store) >= self._maxsize:
                self._store.popitem(last=False)  # remove o menos recentemente usado
            self._store[key] = (value, time.monotonic())

    def cache_info(self) -> dict:
        """Inspeciona estado do cache (useful para health/debug endpoints)."""
        with self._lock:
            now = time.monotonic()
            live = sum(1 for _, ts in self._store.values() if now - ts <= self._ttl)
            return {"size": len(self._store), "live": live, "maxsize": self._maxsize, "ttl_sec": self._ttl}


_haversine_cache = _TtlLruCache(maxsize=_HAVERSINE_MAXSIZE, ttl=_HAVERSINE_TTL_SEC)

def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    key = (lat1, lon1, lat2, lon2)
    cached, hit = _haversine_cache.get(key)
    if hit:
        return cached
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    d_lat = lat2_rad - lat1_rad
    d_lon = lon2_rad - lon1_rad

    a = (math.sin(d_lat / 2) ** 2) + math.cos(lat1_rad) * math.cos(lat2_rad) * (math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    result = int(EARTH_RADIUS_M * c)
    _haversine_cache.set(key, result)
    return result


def compute_haversine_distance_matrix(locations: List[List[float]]) -> List[List[int]]:
    size = len(locations)
    matrix = [[0] * size for _ in range(size)]
    # Percorre só o triângulo superior e espelha: ~50% menos chamadas a haversine_meters.
    for i in range(size):
        for j in range(i + 1, size):
            d = haversine_meters(locations[i][0], locations[i][1], locations[j][0], locations[j][1])
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix


def _nearest_neighbor_route(distance_matrix: List[List[int]]) -> List[int]:
    node_count = len(distance_matrix)
    if node_count <= 2:
        return [idx for idx in range(1, node_count)]

    unvisited = set(range(1, node_count))
    route = []
    current = 0

    while unvisited:
        next_node = min(unvisited, key=lambda idx: distance_matrix[current][idx])
        route.append(next_node)
        unvisited.remove(next_node)
        current = next_node

    return route


def _route_distance(order: List[int], distance_matrix: List[List[int]]) -> int:
    if not order:
        return 0

    total = distance_matrix[0][order[0]]
    for idx in range(len(order) - 1):
        total += distance_matrix[order[idx]][order[idx + 1]]
    total += distance_matrix[order[-1]][0]
    return total


def _two_opt(route: List[int], distance_matrix: List[List[int]]) -> List[int]:
    best = route[:]
    improved = True

    while improved:
        improved = False
        best_distance = _route_distance(best, distance_matrix)
        for i in range(0, len(best) - 1):
            for j in range(i + 1, len(best)):
                if j - i == 1:
                    continue
                candidate = best[:]
                candidate[i:j] = reversed(candidate[i:j])
                candidate_distance = _route_distance(candidate, distance_matrix)
                if candidate_distance < best_distance:
                    best = candidate
                    improved = True
                    break
            if improved:
                break

    return best


def _geographic_clusters(customers: List[Dict], k: int) -> List[List[Dict]]:
    """Divide customers em k clusters geograficos com carga aproximada equilibrada."""
    if k <= 1:
        return [list(customers)]

    sorted_c = sorted(customers, key=lambda c: (float(c.get("lat", 0)), float(c.get("lon", 0))))
    if not sorted_c:
        return [[] for _ in range(k)]

    def _customer_load(c: Dict) -> float:
        # Pondera tempo de atendimento e demanda para reduzir concentracao desigual.
        service = float(c.get("service_time_min", 10) or 0)
        demand = float(c.get("demand", 1) or 0)
        return max(1.0, service + (demand * 10.0))

    total_load = sum(_customer_load(c) for c in sorted_c)
    target_load = max(1.0, total_load / k)

    clusters: List[List[Dict]] = []
    current_cluster: List[Dict] = []
    current_load = 0.0

    for idx, customer in enumerate(sorted_c):
        current_cluster.append(customer)
        current_load += _customer_load(customer)

        remaining_customers = len(sorted_c) - (idx + 1)
        remaining_clusters = k - (len(clusters) + 1)
        enough_to_split = remaining_customers >= remaining_clusters

        if enough_to_split and current_load >= target_load and len(clusters) < (k - 1):
            clusters.append(current_cluster)
            current_cluster = []
            current_load = 0.0

    clusters.append(current_cluster)

    # Garante quantidade fixa de k clusters para manter mapeamento estavel com frota.
    while len(clusters) < k:
        clusters.append([])

    return clusters


def _vehicle_capacity_score(vehicle: Dict) -> float:
    """Estimativa simples de capacidade operacional relativa de um vendedor/veiculo."""
    cap = float(vehicle.get("capacity", 100) or 100)
    max_route = float(vehicle.get("max_route_time_min", 600) or 600)
    speed = float(vehicle.get("speed_kmh", 35.0) or 35.0)
    return max(1.0, cap) * max(0.25, max_route / 600.0) * max(0.25, speed / 35.0)


def _customer_cluster_load(cluster: List[Dict]) -> float:
    load = 0.0
    for c in cluster:
        service = float(c.get("service_time_min", 10) or 0)
        demand = float(c.get("demand", 1) or 0)
        load += max(1.0, service + (demand * 10.0))
    return load


def _vehicles_by_cluster_load(vehicles: List[Dict], clusters: List[List[Dict]]) -> List[List[Dict]]:
    """Distribui veiculos por cluster proporcionalmente a carga estimada."""
    n_clusters = len(clusters)
    if n_clusters == 0:
        return []

    # Cada cluster recebe ao menos 1 veiculo; o restante vai para os mais carregados.
    assignment: List[List[Dict]] = [[] for _ in range(n_clusters)]
    cluster_loads = [_customer_cluster_load(c) for c in clusters]
    load_order = sorted(range(n_clusters), key=lambda i: cluster_loads[i], reverse=True)

    vehicles_sorted = sorted(vehicles, key=_vehicle_capacity_score, reverse=True)
    for i in range(min(n_clusters, len(vehicles_sorted))):
        assignment[load_order[i]].append(vehicles_sorted[i])

    for vehicle in vehicles_sorted[n_clusters:]:
        best_idx = max(
            range(n_clusters),
            key=lambda idx: cluster_loads[idx] / max(1.0, sum(_vehicle_capacity_score(v) for v in assignment[idx])),
        )
        assignment[best_idx].append(vehicle)

    return assignment


def _vehicles_ordered_for_clusters(vehicles: List[Dict], clusters: List[List[Dict]]) -> List[Dict]:
    """Pareia os veiculos mais fortes aos clusters mais carregados (1:1)."""
    if not vehicles or not clusters:
        return vehicles

    load_order = sorted(range(len(clusters)), key=lambda i: _customer_cluster_load(clusters[i]), reverse=True)
    vehicles_sorted = sorted(vehicles, key=_vehicle_capacity_score, reverse=True)
    ordered = list(vehicles)
    for vehicle_idx, cluster_idx in enumerate(load_order[: len(vehicles_sorted)]):
        if vehicle_idx < len(vehicles_sorted) and cluster_idx < len(ordered):
            ordered[cluster_idx] = vehicles_sorted[vehicle_idx]
    return ordered


def plan_route(start: List[float], clients: List[Dict], vehicle_speed_kmh: float = 40.0) -> Dict:
    locations = [start] + [[c["lat"], c["lon"]] for c in clients]
    distance_matrix = compute_haversine_distance_matrix(locations)

    visit_order = _nearest_neighbor_route(distance_matrix)
    if len(visit_order) > 3:
        visit_order = _two_opt(visit_order, distance_matrix)

    route_order = [clients[node_idx - 1]["id"] for node_idx in visit_order]
    total_distance_m = _route_distance(visit_order, distance_matrix)
    total_distance_km = total_distance_m / 1000.0
    total_time_min = (total_distance_km / max(1.0, vehicle_speed_kmh)) * 60.0

    return {
        "route_order": route_order,
        "total_distance_km": round(total_distance_km, 2),
        "total_time_min": round(total_time_min, 1),
        "total_cost": 0,
    }


def _planner_status_name(status_code: int) -> str:
    def _status(attr_name: str, fallback: int) -> int:
        return int(getattr(pywrapcp.RoutingModel, attr_name, fallback))

    status_map = {
        _status("ROUTING_NOT_SOLVED", 0): "not_solved",
        _status("ROUTING_SUCCESS", 1): "success",
        _status("ROUTING_PARTIAL_SUCCESS_LOCAL_OPTIMUM_NOT_REACHED", 2): "partial_success",
        _status("ROUTING_FAIL", 3): "fail",
        _status("ROUTING_FAIL_TIMEOUT", 4): "timeout",
        _status("ROUTING_INVALID", 5): "invalid",
        _status("ROUTING_INFEASIBLE", 6): "infeasible",
        _status("ROUTING_OPTIMAL", 7): "optimal",
    }
    return status_map.get(status_code, f"status_{status_code}")


def _ensure_time_window(start_min: int, end_min: int) -> Tuple[int, int]:
    start_clamped = max(0, min(1440, start_min))
    end_clamped = max(start_clamped, min(1440, end_min))
    return start_clamped, end_clamped


def _heuristic_plan(depot: Dict, vehicles: List[Dict], customers: List[Dict], avg_speed: float) -> Dict:
    """Fallback heurístico: divide customers geograficamente, roda NN+2-opt por veículo."""
    k = len(vehicles)
    clusters = _geographic_clusters(customers, k)
    vehicles = _vehicles_ordered_for_clusters(vehicles, clusters)
    routes: List[Dict] = []
    planned_ids: List[str] = []
    total_dist = 0.0
    total_drive = 0.0
    total_service = 0.0
    total_cost = 0.0
    vehicles_used = 0

    for vehicle, cluster in zip(vehicles, clusters):
        if not cluster:
            continue
        payload = [
            {
                "id": str(c["id"]),
                "lat": float(c["lat"]),
                "lon": float(c["lon"]),
                "tempo_atendimento": int(c.get("service_time_min", 10) or 0),
            }
            for c in cluster
        ]
        speed = max(1.0, float(vehicle.get("speed_kmh", avg_speed)))
        result = plan_route([float(depot["lat"]), float(depot["lon"])], payload, vehicle_speed_kmh=speed)
        service = sum(int(c.get("service_time_min", 10) or 0) for c in cluster)
        dist_km = float(result["total_distance_km"])
        drive_min = float(result["total_time_min"])
        cost = round(dist_km * float(vehicle.get("cost_per_km", 2.2)), 2)
        max_min = max(1, int(vehicle.get("max_route_time_min", 600)))
        util = round(min(100.0, ((drive_min + service) / max_min) * 100.0), 1)

        planned_ids.extend(str(c["id"]) for c in cluster)
        vehicles_used += 1
        total_dist += dist_km
        total_drive += drive_min
        total_service += service
        total_cost += cost

        routes.append({
            "vehicle_id": str(vehicle["id"]),
            "vehicle_name": str(vehicle.get("name", vehicle["id"])),
            "route_order": [str(r) for r in result["route_order"]],
            "total_distance_km": dist_km,
            "total_drive_time_min": drive_min,
            "total_service_time_min": float(service),
            "total_route_time_min": round(drive_min + service, 1),
            "estimated_cost": cost,
            "utilization_pct": util,
        })

    dropped = [str(c["id"]) for c in customers if str(c["id"]) not in set(planned_ids)]
    return {
        "status": "fallback_heuristic",
        "objective_value": 0,
        "routes": routes,
        "dropped_customers": dropped,
        "summary": {
            "vehicles_used": vehicles_used,
            "customers_planned": len(planned_ids),
            "customers_dropped": len(dropped),
            "total_distance_km": round(total_dist, 2),
            "total_drive_time_min": round(total_drive, 1),
            "total_service_time_min": round(total_service, 1),
            "total_cost": round(total_cost, 2),
        },
        "diagnostics": {
            "reason": "ortools_no_solution",
            "routing_status": "fallback_heuristic",
        },
    }


def plan_advanced_routes(depot: Dict, vehicles: List[Dict], customers: List[Dict], options: Dict, *, _split: bool = False) -> Dict:
    if not vehicles:
        return {
            "status": "invalid",
            "objective_value": 0,
            "routes": [],
            "dropped_customers": [str(item["id"]) for item in customers],
            "summary": {
                "vehicles_used": 0,
                "customers_planned": 0,
                "customers_dropped": len(customers),
                "total_distance_km": 0.0,
                "total_drive_time_min": 0.0,
                "total_service_time_min": 0.0,
                "total_cost": 0.0,
            },
            "diagnostics": {"reason": "empty_fleet"},
        }

    if not customers:
        return {
            "status": "success",
            "objective_value": 0,
            "routes": [],
            "dropped_customers": [],
            "summary": {
                "vehicles_used": 0,
                "customers_planned": 0,
                "customers_dropped": 0,
                "total_distance_km": 0.0,
                "total_drive_time_min": 0.0,
                "total_service_time_min": 0.0,
                "total_cost": 0.0,
            },
            "diagnostics": {"reason": "empty_demand"},
        }

    # Pré-clusterização: divide inputs grandes em sub-grupos geográficos para manter OR-Tools escalável.
    if not _split and len(customers) > CLUSTER_MAX_SIZE:
        k_target = max(1, math.ceil(len(customers) / CLUSTER_MAX_SIZE))
        k = max(1, min(len(vehicles), k_target))
        sub_groups = _geographic_clusters(customers, k)
        grouped_vehicles = _vehicles_by_cluster_load(vehicles, sub_groups)
        all_routes: List[Dict] = []
        all_dropped: List[str] = []
        agg: Dict = {
            "vehicles_used": 0, "customers_planned": 0, "customers_dropped": 0,
            "total_distance_km": 0.0, "total_drive_time_min": 0.0,
            "total_service_time_min": 0.0, "total_cost": 0.0,
        }
        statuses: List[str] = []
        for i, sub_cust in enumerate(sub_groups):
            if not sub_cust:
                continue
            v_slice = grouped_vehicles[i] if i < len(grouped_vehicles) and grouped_vehicles[i] else vehicles[:1]
            sub = plan_advanced_routes(depot, v_slice, sub_cust, options, _split=True)
            all_routes.extend(sub["routes"])
            all_dropped.extend(sub["dropped_customers"])
            for key in ("vehicles_used", "customers_planned", "customers_dropped"):
                agg[key] += int(sub["summary"][key])
            for key in ("total_distance_km", "total_drive_time_min", "total_service_time_min", "total_cost"):
                agg[key] += float(sub["summary"][key])
            statuses.append(sub["status"])
        agg["total_distance_km"] = round(agg["total_distance_km"], 2)
        agg["total_drive_time_min"] = round(agg["total_drive_time_min"], 1)
        agg["total_service_time_min"] = round(agg["total_service_time_min"], 1)
        agg["total_cost"] = round(agg["total_cost"], 2)
        ok = {"success", "optimal", "partial_success", "fallback_heuristic"}
        final_status = "success" if all(s in ok for s in statuses) else (statuses[-1] if statuses else "unknown")
        return {
            "status": final_status,
            "objective_value": 0,
            "routes": all_routes,
            "dropped_customers": all_dropped,
            "summary": agg,
            "diagnostics": {"routing_status": "clustered", "clusters": k},
        }

    locations = [[depot["lat"], depot["lon"]]] + [[item["lat"], item["lon"]] for item in customers]
    distance_matrix = compute_haversine_distance_matrix(locations)

    if not options.get("return_to_depot", True):
        for node_idx in range(1, len(distance_matrix)):
            distance_matrix[node_idx][0] = 0

    num_vehicles = len(vehicles)
    manager = pywrapcp.RoutingIndexManager(len(locations), num_vehicles, [0] * num_vehicles, [0] * num_vehicles)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    distance_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(distance_callback_index)

    avg_speed = max(5.0, mean([float(v.get("speed_kmh", 35.0)) for v in vehicles]))
    service_times = [0] + [int(item.get("service_time_min", 10)) for item in customers]

    def time_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        distance_km = distance_matrix[from_node][to_node] / 1000.0
        drive_min = (distance_km / avg_speed) * 60.0
        return int(round(drive_min + service_times[from_node]))

    time_callback_index = routing.RegisterTransitCallback(time_callback)

    routing.AddDimension(
        time_callback_index,
        240,
        2880,
        False,
        "Time",
    )
    time_dimension = routing.GetDimensionOrDie("Time")

    for customer_idx, customer in enumerate(customers, start=1):
        index = manager.NodeToIndex(customer_idx)
        start_tw = customer.get("time_window_start_min")
        end_tw = customer.get("time_window_end_min")
        if start_tw is None or end_tw is None:
            start_bound, end_bound = 0, 1440
        else:
            start_bound, end_bound = _ensure_time_window(int(start_tw), int(end_tw))
        time_dimension.CumulVar(index).SetRange(start_bound, end_bound)

    for vehicle_idx, vehicle in enumerate(vehicles):
        start_index = routing.Start(vehicle_idx)
        end_index = routing.End(vehicle_idx)
        start_time = int(vehicle.get("start_time_min", 480))
        end_time = int(vehicle.get("end_time_min", 1080))
        max_route_time_min = int(vehicle.get("max_route_time_min", 600))
        start_time, end_time = _ensure_time_window(start_time, max(start_time, end_time))
        latest_end_time = min(end_time, start_time + max_route_time_min)
        time_dimension.CumulVar(start_index).SetRange(start_time, start_time)
        time_dimension.CumulVar(end_index).SetRange(start_time, latest_end_time)
        routing.AddVariableMinimizedByFinalizer(time_dimension.CumulVar(end_index))

    demands = [0] + [int(item.get("demand", 1)) for item in customers]

    def demand_callback(from_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        return demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,
        [int(vehicle.get("capacity", 100)) for vehicle in vehicles],
        True,
        "Capacity",
    )

    routing.AddDimension(
        distance_callback_index,
        0,
        int(max([vehicle.get("max_distance_km", 1_000) or 1_000 for vehicle in vehicles]) * 1000),
        True,
        "Distance",
    )
    distance_dimension = routing.GetDimensionOrDie("Distance")

    for vehicle_idx, vehicle in enumerate(vehicles):
        max_distance_km = vehicle.get("max_distance_km")
        if max_distance_km is not None:
            distance_dimension.CumulVar(routing.End(vehicle_idx)).SetRange(0, int(float(max_distance_km) * 1000))

    if options.get("balance_routes", True):
        distance_dimension.SetGlobalSpanCostCoefficient(100)

    if options.get("allow_drop_nodes", True):
        base_penalty = int(options.get("drop_penalty_base", 20_000))
        priority_factor = int(options.get("priority_penalty_factor", 4_000))
        for customer_idx, customer in enumerate(customers, start=1):
            node_index = manager.NodeToIndex(customer_idx)
            priority = int(customer.get("priority", 5))
            penalty = base_penalty + (priority * priority_factor)
            routing.AddDisjunction([node_index], penalty)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.seconds = int(options.get("search_time_limit_sec", 10))

    solution = routing.SolveWithParameters(search_parameters)
    status_name = _planner_status_name(routing.status())

    if solution is None:
        # OR-Tools não encontrou solução; aciona o heurístico (NN+2-opt) como fallback.
        return _heuristic_plan(depot, vehicles, customers, avg_speed)

    routes = []
    total_distance_km = 0.0
    total_drive_time_min = 0.0
    total_service_time_min = 0.0
    total_cost = 0.0
    vehicles_used = 0
    planned_customer_ids: List[str] = []

    for vehicle_idx, vehicle in enumerate(vehicles):
        index = routing.Start(vehicle_idx)
        route_order: List[str] = []
        route_distance_m = 0
        route_service_min = 0
        speed_kmh = max(1.0, float(vehicle.get("speed_kmh", 35.0)))

        while not routing.IsEnd(index):
            node_idx = manager.IndexToNode(index)
            next_index = solution.Value(routing.NextVar(index))
            next_node_idx = manager.IndexToNode(next_index)

            route_distance_m += distance_matrix[node_idx][next_node_idx]
            if node_idx != 0:
                customer = customers[node_idx - 1]
                route_order.append(str(customer["id"]))
                planned_customer_ids.append(str(customer["id"]))
                route_service_min += int(customer.get("service_time_min", 10))

            index = next_index

        if route_order:
            vehicles_used += 1

        route_distance_km = round(route_distance_m / 1000.0, 2)
        route_drive_min = round((route_distance_km / speed_kmh) * 60.0, 1)
        route_total_min = round(route_drive_min + route_service_min, 1)
        max_route_min = max(1, int(vehicle.get("max_route_time_min", 600)))
        utilization_pct = round(min(100.0, (route_total_min / max_route_min) * 100.0), 1)
        estimated_cost = round(route_distance_km * float(vehicle.get("cost_per_km", 2.2)), 2)

        total_distance_km += route_distance_km
        total_drive_time_min += route_drive_min
        total_service_time_min += route_service_min
        total_cost += estimated_cost

        routes.append(
            {
                "vehicle_id": str(vehicle["id"]),
                "vehicle_name": str(vehicle.get("name", vehicle["id"])),
                "route_order": route_order,
                "total_distance_km": route_distance_km,
                "total_drive_time_min": route_drive_min,
                "total_service_time_min": float(route_service_min),
                "total_route_time_min": route_total_min,
                "estimated_cost": estimated_cost,
                "utilization_pct": utilization_pct,
            }
        )

    planned_set = set(planned_customer_ids)
    dropped_customers = [str(item["id"]) for item in customers if str(item["id"]) not in planned_set]

    return {
        "status": status_name,
        "objective_value": int(solution.ObjectiveValue()),
        "routes": routes,
        "dropped_customers": dropped_customers,
        "summary": {
            "vehicles_used": vehicles_used,
            "customers_planned": len(planned_set),
            "customers_dropped": len(dropped_customers),
            "total_distance_km": round(total_distance_km, 2),
            "total_drive_time_min": round(total_drive_time_min, 1),
            "total_service_time_min": round(total_service_time_min, 1),
            "total_cost": round(total_cost, 2),
        },
        "diagnostics": {
            "routing_status": status_name,
            "search_time_limit_sec": int(options.get("search_time_limit_sec", 10)),
            "return_to_depot": bool(options.get("return_to_depot", True)),
            "allow_drop_nodes": bool(options.get("allow_drop_nodes", True)),
        },
    }


def _batch_group_key(region: str, driver_id: str) -> str:
    return f"{region}::{driver_id}"


def _is_customer_eligible_for_batch(customer: Dict, include_new_when_eligible: bool) -> bool:
    status = str(customer.get("status", "ATIVO") or "ATIVO").upper().strip()

    if status == "INATIVO":
        return False

    if status == "SEM_COORDENADA":
        return False

    if status == "NOVO":
        if not include_new_when_eligible:
            return False
        return bool(customer.get("eligible_for_routing", False))

    return True


def plan_batch_routes(customers: List[Dict], depots: List[Dict], options: Dict) -> Dict:
    if not customers:
        return {
            "status": "success",
            "groups": [],
            "summary": {
                "groups_processed": 0,
                "customers_processed": 0,
                "customers_skipped": 0,
                "skipped_by_status": {"ATIVO": 0, "NOVO": 0, "INATIVO": 0, "SEM_COORDENADA": 0},
                "total_distance_km": 0.0,
                "total_time_min": 0.0,
                "total_cost": 0.0,
            },
        }

    seen_ids = set()
    grouped: Dict[str, List[Dict]] = {}
    include_new_when_eligible = bool(options.get("include_new_when_eligible", True))
    skipped_by_status = {"ATIVO": 0, "NOVO": 0, "INATIVO": 0, "SEM_COORDENADA": 0}
    skipped_total = 0

    for customer in customers:
        customer_id = str(customer.get("id", "")).strip()
        if not customer_id:
            raise ValueError("Customer id is required for all records.")
        if customer_id in seen_ids:
            raise ValueError(f"Duplicate customer id found: {customer_id}")
        seen_ids.add(customer_id)

        status = str(customer.get("status", "ATIVO") or "ATIVO").upper().strip()
        if status not in skipped_by_status:
            status = "ATIVO"

        # Centralized eligibility rules by status.
        if not _is_customer_eligible_for_batch(customer, include_new_when_eligible):
            skipped_by_status[status] += 1
            skipped_total += 1
            continue

        if is_sem_coordenada(customer.get("lat"), customer.get("lon")):
            skipped_by_status["SEM_COORDENADA"] += 1
            skipped_total += 1
            continue

        region = str(customer.get("region", "")).strip()
        driver_id = str(customer.get("driver_id", "")).strip()
        if not region or not driver_id:
            raise ValueError(f"Customer {customer_id} must include region and driver_id.")

        key = _batch_group_key(region, driver_id)
        grouped.setdefault(key, []).append(customer)

    depots_by_key: Dict[str, Dict] = {}
    for depot in depots:
        region = str(depot.get("region", "")).strip()
        driver_id = str(depot.get("driver_id", "")).strip()
        if not region or not driver_id:
            continue
        key = _batch_group_key(region, driver_id)
        depots_by_key[key] = depot

    speed = float(options.get("vehicle_speed_kmh", 40.0) or 40.0)
    cost_per_km = float(options.get("cost_per_km", 2.2) or 2.2)

    group_results: List[Dict] = []
    total_distance_km = 0.0
    total_time_min = 0.0
    total_cost = 0.0

    for key, group_customers in grouped.items():
        region, driver_id = key.split("::", 1)
        depot = depots_by_key.get(key)

        if depot:
            start_lat = float(depot["lat"])
            start_lon = float(depot["lon"])
            depot_source = "provided"
        else:
            start_lat = mean([float(item["lat"]) for item in group_customers])
            start_lon = mean([float(item["lon"]) for item in group_customers])
            depot_source = "centroid"

        route_payload = [
            {
                "id": str(item["id"]),
                "lat": float(item["lat"]),
                "lon": float(item["lon"]),
                "tempo_atendimento": int(item.get("service_time_min", 10) or 0),
            }
            for item in group_customers
        ]

        plan_result = plan_route([start_lat, start_lon], route_payload, vehicle_speed_kmh=speed)
        service_total = sum(int(item.get("service_time_min", 10) or 0) for item in group_customers)
        route_time_min = round(float(plan_result["total_time_min"]) + service_total, 1)
        route_cost = round(float(plan_result["total_distance_km"]) * cost_per_km, 2)

        group_results.append(
            {
                "group_id": key,
                "region": region,
                "driver_id": driver_id,
                "customers_count": len(group_customers),
                "route_order": [str(item_id) for item_id in plan_result["route_order"]],
                "total_distance_km": float(plan_result["total_distance_km"]),
                "total_time_min": route_time_min,
                "total_cost": route_cost,
                "depot_source": depot_source,
            }
        )

        total_distance_km += float(plan_result["total_distance_km"])
        total_time_min += route_time_min
        total_cost += route_cost

    return {
        "status": "success",
        "groups": group_results,
        "summary": {
            "groups_processed": len(group_results),
            "customers_processed": len(customers) - skipped_total,
            "customers_skipped": skipped_total,
            "skipped_by_status": skipped_by_status,
            "total_distance_km": round(total_distance_km, 2),
            "total_time_min": round(total_time_min, 1),
            "total_cost": round(total_cost, 2),
        },
    }
