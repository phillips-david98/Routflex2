"""
Serviço de Geocoding com suporte a múltiplos providers.
MVP: Nominatim (OpenStreetMap) - Gratuito
Futuro: Abstraído para trocar por Google Maps, Mapbox, etc.
"""

import asyncio
import time
import requests
from typing import Optional, Dict, Tuple, List
from datetime import datetime
from collections import deque
from event_logger import append_event
from coordinate_rules import is_within_expected_bounds
from logging_manager import setup_logger

_logger = setup_logger("geocoding")

# Coordenadas conhecidas como inválidas
KNOWN_INVALID_COORDS = {
    (-12.915927, 25.273623),
    # Adicionar mais conforme identificado em produção
}

# Configuração de rate limiting
RATE_LIMIT_DELAY = 1.0  # minutos entre requisições (1 req/seg)
MAX_BATCH_SIZE = 20     # máximo de clientes por lote

# Configuração de retry para Nominatim
MAX_GEOCODE_RETRIES = 3
GEOCODE_BACKOFF_FACTOR = 2  # exponential: 1s, 2s, 4s


class GeocodingQueue:
    """Fila simples de processamento com rate limiting."""
    
    def __init__(self):
        self.queue: deque = deque()
        self.last_request_time: float = 0
        self.processing = False
    
    def add(self, item: Dict) -> None:
        """Adiciona cliente à fila."""
        self.queue.append(item)
    
    def add_batch(self, items: List[Dict]) -> None:
        """Adiciona múltiplos clientes à fila."""
        for item in items[:MAX_BATCH_SIZE]:
            self.queue.append(item)
    
    async def process_next(self) -> Optional[Dict]:
        """Processa próximo item da fila com rate limiting."""
        if not self.queue:
            return None
        
        # Espera rate limit
        elapsed = time.time() - self.last_request_time
        if elapsed < RATE_LIMIT_DELAY:
            await asyncio.sleep(RATE_LIMIT_DELAY - elapsed)
        
        self.last_request_time = time.time()
        return self.queue.popleft()
    
    def size(self) -> int:
        return len(self.queue)
    
    def clear(self) -> None:
        self.queue.clear()


class GeocodingService:
    """Serviço de geocoding com provider plugável."""
    
    def __init__(self, provider: str = "nominatim"):
        self.provider = provider
        self.queue = GeocodingQueue()
        self.app_name = "ROUTflex"  # Para User-Agent
        
        if provider != "nominatim":
            raise ValueError(f"Provider '{provider}' não implementado. Use 'nominatim'.")
    
    def build_address(self, 
                      address: Optional[str],
                      number: Optional[str],
                      neighborhood: Optional[str],
                      city: Optional[str],
                      state: Optional[str]) -> str:
        """Constrói string de endereço completo."""
        parts = []
        if address:
            parts.append(str(address).strip())
        if number:
            parts.append(str(number).strip())
        if neighborhood:
            parts.append(str(neighborhood).strip())
        if city:
            parts.append(str(city).strip())
        if state:
            parts.append(str(state).strip())
        
        parts.append("Brasil")
        return ", ".join(filter(None, parts))
    
    def is_within_bounds(self, lat: float, lon: float) -> bool:
        """Valida se coordenadas estão dentro do limite geografico configurado."""
        # Reusa regra central para manter consistencia com o restante da API.
        return is_within_expected_bounds(lat, lon)
    
    def is_known_invalid(self, lat: float, lon: float) -> bool:
        """Verifica se é coordenada conhecida como inválida."""
        lat_rounded = round(lat, 6)
        lon_rounded = round(lon, 6)
        return (lat_rounded, lon_rounded) in KNOWN_INVALID_COORDS
    
    def validate_coordinates(self, lat: float, lon: float) -> Tuple[bool, str]:
        """Valida par lat/lon."""
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
            return False, "Coordenadas devem ser números"
        
        if self.is_known_invalid(lat, lon):
            return False, "Coordenada conhecida como inválida"
        
        if not self.is_within_bounds(lat, lon):
            return False, f"Coordenada fora do Brasil: ({lat}, {lon})"
        
        return True, "OK"
    
    async def geocode_nominatim(self, address: str) -> Optional[Dict]:
        """
        Geocodifica usando Nominatim com retry e backoff exponencial.

        Não bloqueante: HTTP executado em thread pool (asyncio.to_thread),
        backoff via asyncio.sleep — nenhuma thread fica parada durante esperas.

        Retorna:
            {'lat': float, 'lon': float, 'display_name': str} ou None após retries esgotados.
        """
        headers = {"User-Agent": f"{self.app_name}/1.0"}
        params = {"q": address, "format": "json", "limit": 1}

        for attempt in range(1, MAX_GEOCODE_RETRIES + 1):
            try:
                # O requests.get é síncrono; executá-lo em thread pool libera o event loop
                # durante toda a duração da chamada HTTP sem bloquear outros coroutines.
                response = await asyncio.to_thread(
                    requests.get,
                    "https://nominatim.openstreetmap.org/search",
                    params=params,
                    headers=headers,
                    timeout=5,
                )

                # Rate limit (429): backoff e retry
                if response.status_code == 429:
                    if attempt < MAX_GEOCODE_RETRIES:
                        wait_time = GEOCODE_BACKOFF_FACTOR ** (attempt - 1)
                        _logger.warning(
                            "Rate limit Nominatim; backoff %.0fs (attempt %d/%d)",
                            wait_time, attempt, MAX_GEOCODE_RETRIES,
                        )
                        await asyncio.sleep(wait_time)
                        continue
                    _logger.warning("Rate limit Nominatim; tentativas esgotadas")
                    return None

                # Erros de servidor (5xx): backoff e retry
                if response.status_code >= 500:
                    if attempt < MAX_GEOCODE_RETRIES:
                        wait_time = GEOCODE_BACKOFF_FACTOR ** (attempt - 1)
                        _logger.warning(
                            "Erro servidor Nominatim (%d); backoff %.0fs (attempt %d/%d)",
                            response.status_code, wait_time, attempt, MAX_GEOCODE_RETRIES,
                        )
                        await asyncio.sleep(wait_time)
                        continue
                    _logger.warning(
                        "Erro servidor Nominatim (%d); tentativas esgotadas",
                        response.status_code,
                    )
                    return None

                # Outros erros HTTP não recuperáveis (4xx)
                response.raise_for_status()

                results = response.json()
                if not results:
                    return None

                result = results[0]
                lat = float(result.get("lat"))
                lon = float(result.get("lon"))

                is_valid, _ = self.validate_coordinates(lat, lon)
                if not is_valid:
                    return None

                return {
                    "lat": lat,
                    "lon": lon,
                    "display_name": result.get("display_name", address),
                }

            except (requests.ConnectionError, requests.Timeout) as e:
                if attempt < MAX_GEOCODE_RETRIES:
                    wait_time = GEOCODE_BACKOFF_FACTOR ** (attempt - 1)
                    _logger.warning(
                        "Conexão Nominatim falhou: %s; backoff %.0fs (attempt %d/%d)",
                        e, wait_time, attempt, MAX_GEOCODE_RETRIES,
                    )
                    await asyncio.sleep(wait_time)
                    continue
                _logger.error(
                    "Conexão Nominatim falhou após %d tentativas: %s",
                    MAX_GEOCODE_RETRIES, e,
                )
                return None

            except requests.RequestException as e:
                _logger.error("Erro HTTP Nominatim não recuperável: %s", e)
                return None

            except (ValueError, KeyError) as e:
                _logger.error("Erro ao parsear resposta Nominatim: %s", e)
                return None

        return None
    
    async def geocode(self,
                      customer_id: int,
                      address: Optional[str],
                      number: Optional[str],
                      neighborhood: Optional[str],
                      city: Optional[str],
                      state: Optional[str],
                      user: str = "system") -> Optional[Dict]:
        """
        Geocodifica endereço e retorna resultado validado.
        
        Retorna:
            {
                'customer_id': int,
                'lat': float,
                'lon': float,
                'success': bool,
                'message': str,
                'timestamp': str,
                'address_built': str
            }
        """
        address_full = self.build_address(address, number, neighborhood, city, state)
        
        result_obj = {
            "customer_id": str(customer_id),
            "address_built": address_full,
            "timestamp": datetime.now().isoformat(),
            "user": user,
        }
        
        # Geocodifica
        result = await self.geocode_nominatim(address_full)
        
        if result:
            result_obj.update({
                "lat": result["lat"],
                "lon": result["lon"],
                "success": True,
                "message": "Geocoding bem-sucedido",
                "display_name": result.get("display_name"),
            })
            
            # Log de sucesso
            append_event(
                customer_id=customer_id,
                action="GEOCODING_SUCESSO",
                user=user,
                metadata={
                    "lat": result["lat"],
                    "lon": result["lon"],
                    "endereco": address_full,
                }
            )
        else:
            result_obj.update({
                "success": False,
                "message": "Geocoding falhou ou coordenada inválida",
            })
            
            # Log de falha
            append_event(
                customer_id=customer_id,
                action="GEOCODING_FALHA",
                user=user,
                metadata={
                    "endereco": address_full,
                    "motivo": "Sem resultado ou coordenadas inválidas",
                }
            )
        
        return result_obj


# Instância global (singleton)
_geocoding_service: Optional[GeocodingService] = None

def get_geocoding_service(provider: str = "nominatim") -> GeocodingService:
    """Factory para obter serviço de geocoding."""
    global _geocoding_service
    if _geocoding_service is None:
        _geocoding_service = GeocodingService(provider=provider)
    return _geocoding_service
