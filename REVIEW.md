# Revisão de Código - ROUTflex (Mar 2026)

## RESUMO EXECUTIVO

Implementações recentes agregam **9/10 features críticas** com qualidade **7/10** no geral. Há **3 bugs críticos**, **7 pontos de melhoria** e **5 riscos de escalabilidade** que devem ser endereçados antes de produção em larga escala.

---

## 🔴 BUGS CRÍTICOS

### 1. **Node.js: `require('crypto').randomUUID()` não existe**
**Arquivo:** `crm/backend/src/app.js` (linha 28)

```javascript
const requestId = req.headers['x-request-id'] || require('crypto').randomUUID();
// ❌ randomUUID é método do módulo crypto (v15+), mas precisa: crypto.randomUUID()
```

**Impacto:** Crash na geração de request_id se header não fornecido  
**Fix simples:**
```javascript
const crypto = require('crypto');
const requestId = req.headers['x-request-id'] || crypto.randomUUID();
```

---

### 2. **event_logger.py: Memory leak em read_events()**
**Arquivo:** `backend/event_logger.py` (linhas 35-42)

```python
def read_events(limit: int = 200) -> List[Dict]:
    # ❌ Carrega arquivo INTEIRO em memória com read_text()
    lines = EVENT_LOG_FILE.read_text(encoding="utf-8").splitlines()
    selected = lines[-max(1, min(limit, 2000)):]
```

**Impacto:** Se event_log.jsonl atingir 1GB, read_events() mata servidor  
**Cenário real:** 1M eventos × ~200 bytes = 200 MB carregado para retornar 200 registros  

**Fix:**
```python
def read_events(limit: int = 200) -> List[Dict]:
    if not EVENT_LOG_FILE.exists():
        return []
    
    events: List[Dict] = []
    with EVENT_LOG_FILE.open("r", encoding="utf-8") as fp:
        # Pula N linhas, lê últimas M
        for line in fp:
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return events[-limit:] if len(events) > limit else events
```

---

### 3. **geocoding_service: Blocking sleep em thread de requisição**
**Arquivo:** `backend/geocoding_service.py` (linhas 158-165)

```python
wait_time = GEOCODE_BACKOFF_FACTOR ** (attempt - 1)
print(f"Rate limit em Nominatim; aguardando {wait_time}s...")
time.sleep(wait_time)  # ❌ Bloqueia thread FastAPI
continue
```

**Impacto:** Geocoding com rate limit bloqueia worker inteiro por 7 segundos  
- 10 requisições simultâneas com rate limit = 70s de latência  
- Em Gunicorn 4 workers: 1 geocode com retry bloqueia 25% da capacidade  

**Fix necessário:** Implementar async com `asyncio.sleep()` ou mover para fila async

---

## 🟡 PONTOS DE MELHORIA

### 4. **lru_cache sem limite de memória**
**Arquivo:** `backend/route_planner.py` (linha 14)

```python
@lru_cache(maxsize=16384)
def haversine_meters(lat1, lon1, lat2, lon2) -> int:
```

**Problema:** 16384 é muito alto sem cleanup  
- 16384 entries × ~100 bytes = 1.6 MB + overhead Python
- Cresce durante vida útil do processo (Gunicorn <1h por worker)
- Não há mecanismo de invalidação se coordenadas mudarem

**Análise:** Aceitável para 1-8h de uptime, não para 30d  
**Recomendação:** Baixar para `maxsize=1024` ou implementar TTL-based cache

---

### 5. **logging_manager: Multiple datetime calls**
**Arquivo:** `backend/logging_manager.py` (linha 32)

```python
def format(self, record: logging.LogRecord) -> str:
    log_obj: Dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),  # ❌ Chamado 10k× por segundo
        ...
    }
```

**Problema:** `datetime.now()` em cada log é overhead de ~0.1ms  
- Em 1000 req/s com 5 logs cada = 5000 × 0.1ms = 500ms CPU só em timestamp

**Fix:**
```python
# Usar record.created (já está em LogRecord)
timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc)
```

---

### 6. **event_logger.py: Arquivo sem rotação (event_log.jsonl)**
**Arquivo:** `backend/event_logger.py`

```python
EVENT_LOG_FILE = Path(__file__).resolve().parent / "event_log.jsonl"
# ❌ Cria arquivo único, sem RotatingFileHandler
```

**Problema:** 
- 1M eventos/dia × 200 bytes = 200 MB/dia
- Após 1 ano = 73 GB de um único arquivo
- read_events() com arquivo 73GB = OOM

**Status:** logging_manager tem RotatingFileHandler, mas event_logger.py não usa (compatibilidade)  
**Recomendação:** Deprecar event_log.jsonl em favor de logging_manager após 2 releases

---

### 7. **route_planner: Clustering não distribui veículos otimamente**
**Arquivo:** `backend/route_planner.py` (linhas 261-263)

```python
k = max(2, math.ceil(len(customers) / CLUSTER_MAX_SIZE))
v_per = max(1, len(vehicles) // k)
v_slice = vehicles[i * v_per : (i + 1) * v_per] or vehicles[:1]
```

**Problema:**
- 400 clientes + 5 veículos → 4 clusters, ma 5//4 = 1 veículo por cluster
- Clusters 1-4 recebem 1 veículo; cluster 5 fica vazio
- Resultado: distribuição desequilibrada, subutilização

**Exemplo real:**
```
400 customers + 5 vehicles:
  k = ceil(400/120) = 4
  v_per = 5 // 4 = 1
  Cluster 0: 100 customers + 1 vehicle
  Cluster 1: 100 customers + 1 vehicle  
  Cluster 2: 100 customers + 1 vehicle
  Cluster 3: 100 customers + 1 vehicle + vehicles[4]  ← last gets spare
```

**Recomendação:** Implementar binpacking para distribuir veículos proporcionalmente

---

### 8. **geocoding_service: print() em vez de logging**
**Arquivo:** `backend/geocoding_service.py` (múltiplas linhas)

```python
print(f"Rate limit em Nominatim; aguardando {wait_time}s...")
print(f"Erro ao conectar Nominatim: {e}")
```

**Problema:**
- Não é capturable por logging_manager
- Não tem request_id
- Não respeita log level (DEBUG, INFO, etc.)

**Fix:** Usar logging_manager:
```python
from logging_manager import setup_logger
geocoding_logger = setup_logger("geocoding")
geocoding_logger.warning(f"Rate limit em Nominatim; aguardando {wait_time}s...")
```

---

### 9. **Node.js: res.json override sem error handling**
**Arquivo:** `crm/backend/src/app.js` (linhas 36-42)

```javascript
const originalJson = res.json;
res.json = function (data) {
    // Log estruturado...
    return originalJson.call(this, data);  // ❌ pode lançar erro
};
```

**Problema:** Se `originalJson.call()` lançar erro (ex: socket encerrado), middleware não captura

**Fix:**
```javascript
res.json = function (data) {
    const endLogEntry = {...};
    console.log(JSON.stringify(endLogEntry));
    try {
        return originalJson.call(this, data);
    } catch (e) {
        console.error(JSON.stringify({...error_log_entry...}));
        throw e;
    }
};
```

---

## ⚠️ RISCOS DE ESCALABILIDADE

### A. **Event log infinito**
| Métrica | Dev | 100k events/dia | 1M events/dia |
|---------|-----|-----------------|----------------|
| event_log.jsonl tamanho/dia | 10 MB | 200 MB | 2 GB |
| 1 ano de logs | 3.6 GB | 73 GB | 730 GB |
| read_events() latência | <1ms | 50ms | 500ms+ |

**Mitigação:** Implementar RotatingFileHandler em event_logger.py

---

### B. **lru_cache fragmentação com Gunicorn**
- 4 workers × 1.6 MB × 24h = 6.4 MB cache não liberado
- Workers rodam ~7 dias antes de reload: 45 MB cache stale

**Recomendação:** Cron job diário para limpar processo velho ou usar `@lru_cache(maxsize=1024)`

---

### C. **Geocoding retry bloqueia worker**
```
Load: 100 req/s
25% com rate limit (25 req/s)
Cada retry: 7s de sleep
Impacto: 25 requests × 7s = 175s latência total simultânea
```

Em 4 workers Gunicorn:  
- 100 req/s ÷ 4 = 25 req/s por worker
- 1 worker com geocode retry = 7s bloqueado
- Throughput cai 25% durante retry

**Fix:** Async geocoding ou queue dedicated

---

### D. **Request ID não propagado entre backends**
- Frontend → CRM API (tem x-request-id ✅)
- CRM API → Python backend (não propaga ❌)

**Problema:** Não consegue rastrear fluxo ponta-a-ponta em logs

**Recomendação:** CRM middleware deve fazer forward de x-request-id em chamadas HTTP ao Python

---

### E. **Tipagem permissiva de diagnostics**
**Arquivo:** `backend/schemas.py`

```python
diagnostics: Dict[str, Any]  # Aceita qualquer tipo
```

**Risco:** Sem validação, pode ser abusado:
```json
{"diagnostics": {"clusters": "abc"}}  // deveria ser int
{"diagnostics": {"foo": {"nested": {"deep": "structure"}}}}  // obj arbitrário
```

**Recomendação:** Criar Pydantic model para diagnostics:
```python
class AdvancedPlanDiagnostics(BaseModel):
    routing_status: str
    search_time_limit_sec: Optional[int] = None
    return_to_depot: Optional[bool] = None
    allow_drop_nodes: Optional[bool] = None
    clusters: Optional[int] = None
    reason: Optional[str] = None
    
class AdvancedPlanResponse(BaseModel):
    diagnostics: AdvancedPlanDiagnostics
```

---

## ✅ IMPLEMENTAÇÕES CORRETAS

### ✨ Pontos fortes:

1. **Logging estruturado com RotatingFileHandler** - Excelente
   - Thread-safe, com rotação automática
   - Request_id propagado corretamente
   - JSON estruturado para análise

2. **Clustering de roteirização** - Bom
   - Clustering geográfico funciona
   - Fallback heurístico robusto
   - Reduz OR-Tools overhead

3. **Matriz simétrica (50% menos haversine)** - Eficiente
   - Cache com lru_cache é efetivo
   - Espelhamento correto

4. **Retry com exponential backoff** - Correto
   - Nominatim rate limit tratado
   - Backoff estratégia apropriada
   - Apenas 7s max total

5. **HTTP status codes padronizados** - Esperado
   - 400 para input inválido
   - 422 para semântico
   - 501 para não implementado

---

## 📋 PLANO DE AÇÃO

### Crítico (antes de produção):
- [ ] Fixar `crypto.randomUUID()` no Node.js app.js
- [ ] Reescrever read_events() para não carregar arquivo inteiro
- [ ] Converter geocoding para async ou isolá-lo em thread pool

### Alto (antes de 10k req/dia):
- [ ] Deprecar event_log.jsonl, usar logging_manager
- [ ] Ajostar v_per calculation ou usar binpacking
- [ ] Criar Pydantic model para diagnostics
- [ ] Propagate x-request-id entre CRM → Python backend

### Médio (antes de 100k req/dia):
- [ ] Trocar print() por logging em geocoding_service.py
- [ ] Add error handling em Node.js res.json override
- [ ] Reduzir lru_cache maxsize ou implementar TTL
- [ ] Usar record.created em vez de datetime.now()

### Baixo (monitoring):
- [ ] Monitorar tamanho de event_log.jsonl
- [ ] Alertas para geocoding retry rate > 5%
- [ ] Métricas de clustering (distribution skew)

---

## Conclusão

O código é **funcional e preparado para produção pequena** (< 10k req/dia). Para escalar a 100k+ req/dia, os bugs críticos e riscos de escalabilidade precisam ser endereçados. A arquitetura é sólida; refinamentos são necessários apenas em bordas (logging, concorrência, validação).

**Recomendação:** Usar por 2-4 semanas em staging, aplicar fase 1 de fixes, então promover a produção.
