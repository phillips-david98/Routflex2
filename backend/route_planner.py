import math
from statistics import mean
from typing import Dict, List, Tuple

from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from coordinate_rules import is_sem_coordenada


EARTH_RADIUS_M = 6_371_000


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    d_lat = lat2_rad - lat1_rad
    d_lon = lon2_rad - lon1_rad

    a = (math.sin(d_lat / 2) ** 2) + math.cos(lat1_rad) * math.cos(lat2_rad) * (math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return int(EARTH_RADIUS_M * c)


def compute_haversine_distance_matrix(locations: List[List[float]]) -> List[List[int]]:
    size = len(locations)
    matrix = [[0] * size for _ in range(size)]
    for i in range(size):
        for j in range(size):
            if i == j:
                continue
            matrix[i][j] = haversine_meters(locations[i][0], locations[i][1], locations[j][0], locations[j][1])
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


def plan_advanced_routes(depot: Dict, vehicles: List[Dict], customers: List[Dict], options: Dict) -> Dict:
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
        dropped = [str(item["id"]) for item in customers]
        return {
            "status": status_name,
            "objective_value": 0,
            "routes": [],
            "dropped_customers": dropped,
            "summary": {
                "vehicles_used": 0,
                "customers_planned": 0,
                "customers_dropped": len(dropped),
                "total_distance_km": 0.0,
                "total_drive_time_min": 0.0,
                "total_service_time_min": 0.0,
                "total_cost": 0.0,
            },
            "diagnostics": {
                "message": "solver_failed",
                "routing_status": status_name,
            },
        }

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
            "search_time_limit_sec": str(int(options.get("search_time_limit_sec", 10))),
            "return_to_depot": str(bool(options.get("return_to_depot", True))),
            "allow_drop_nodes": str(bool(options.get("allow_drop_nodes", True))),
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
