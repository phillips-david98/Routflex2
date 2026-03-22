# Backend Routflex

Estrutura do backend (FastAPI + OR-Tools + SQLite/PostgreSQL+PostGIS opcional).

Arquivos:
- main.py
- models.py
- schemas.py
- db.py
- route_planner.py
- requirements.txt
- .env

## Rodando local (sem DB externo)

1. Abra o terminal em `c:\Users\jphil\OneDrive\Desktop\ROUTflex`
2. entre na pasta:
   - `cd backend`
3. crie e ative virtualenv:
   - `python -m venv .venv`
   - `.venv\Scripts\activate`
4. instale dependências:
   - `pip install -r requirements.txt`
5. rode o servidor:
   - `uvicorn main:app --reload --host 127.0.0.1 --port 8000`

## Endpoints principais

- GET `/health`
- GET `/sessions`
- POST `/sessions`
- GET `/customers`
- POST `/customers`
- GET `/vehicles`
- POST `/vehicles`
- POST `/plan` (roteirizador rapido para 1 veiculo)
- POST `/plan/advanced` (roteirizador profissional com multiplos veiculos e restricoes)
- POST `/plan/batch` (processamento em lote por regiao/motorista)
- POST `/routes/eligibility` (validacao centralizada de elegibilidade por status)
- POST `/routes/manual-include` (inclusao manual de cliente inativo como ultimo da rota)
- POST `/customers/{id}/status` (registro de alteracao de status)
- POST `/customers/{id}/visit-day` (registro de alteracao de dia/semana de visita)
- POST `/customers/{id}/coordinates` (correcao de latitude/longitude com validacao geografica)
- GET `/events` (log operacional para auditoria)
- POST `/exportar-clientes` (endpoint opcional para evolucao de exportacoes em grande volume)
- GET `/simulation/scenario` (cenario padrao de simulacao para homologacao)
- GET `/plan/advanced/history` (historico de execucoes do planejador profissional)
- GET `/plan/advanced/history/{id}` (detalhe completo de uma execucao)

## Planejamento profissional (`/plan/advanced`)

Este endpoint permite:

- frota multipla;
- capacidade por veiculo;
- jornada por veiculo (inicio/fim);
- janelas de atendimento por cliente;
- tempo de servico por parada;
- limite de distancia/tempo de rota;
- prioridade de clientes e descarte com penalidade;
- balanceamento entre rotas;
- retorno opcional para base.
- persistencia automatica de historico para auditoria.

Campos adicionais aceitos em `/plan/advanced`:

- `scenario_name` (string opcional): nome legivel do cenario executado;
- `selected_ddd` (string opcional): recorte operacional de origem;
- `persist_history` (bool, padrao true): salva execucao no historico.

Historico:

- Endpoint: `GET /plan/advanced/history?limit=30`
- Retorna as ultimas execucoes com status, volume de clientes/frota, km, custo e timestamp.
- Endpoint: `GET /plan/advanced/history/{id}`
- Retorna payload e resultado completos para auditoria e reprocessamento.

Exemplo de payload:

```json
{
   "depot": { "lat": -15.6014, "lon": -56.0979, "label": "Base Cuiaba" },
   "vehicles": [
      {
         "id": "V1",
         "name": "Truck 01",
         "capacity": 90,
         "max_route_time_min": 600,
         "max_distance_km": 280,
         "speed_kmh": 38,
         "start_time_min": 480,
         "end_time_min": 1080,
         "cost_per_km": 2.8
      },
      {
         "id": "V2",
         "name": "Van 02",
         "capacity": 60,
         "max_route_time_min": 540,
         "speed_kmh": 35,
         "start_time_min": 510,
         "end_time_min": 1050,
         "cost_per_km": 2.1
      }
   ],
   "customers": [
      {
         "id": "C001",
         "name": "Cliente A",
         "lat": -15.55,
         "lon": -56.08,
         "service_time_min": 15,
         "demand": 3,
         "priority": 10,
         "time_window_start_min": 540,
         "time_window_end_min": 720
      }
   ],
   "options": {
      "allow_drop_nodes": true,
      "return_to_depot": true,
      "balance_routes": true,
      "drop_penalty_base": 20000,
      "priority_penalty_factor": 4000,
      "search_time_limit_sec": 10
   }
}
```

## Processamento em lote (`/plan/batch`)

Objetivo:

- calcular rotas por grupo operacional (regiao + motorista);
- validar dados minimos para escala (id unico, lat, lon);
- retornar rota, distancia, tempo e custo agregados por grupo e no total.

Regras atuais:

- agrupamento automatico por `region` + `driver_id`;
- se existir base no grupo (`depots`), usa essa base;
- sem base explicita, usa centroide do proprio grupo;
- tempo total inclui deslocamento + soma de atendimento (`service_time_min`).
- validacao central de status:
   - `INATIVO`: nunca entra automaticamente em calculo;
   - `SEM_COORDENADA`: nunca entra em calculo, roteirizacao ou otimizacao;
   - `NOVO`: entra apenas quando `eligible_for_routing=true`.

Regras de coordenada invalida (backend):

- sem latitude/longitude;
- coordenada conhecida invalida (`-12.915927, 25.273623`);
- ponto fora da area geografica esperada para a operacao inicial.

Enum padrao de status (backend):

- `ATIVO`
- `NOVO`
- `INATIVO`
- `SEM_COORDENADA`

Regra unica de excecao para inativo:

- ao incluir manualmente, o backend exige confirmacao explicita;
- com confirmacao, o retorno informa `append_as_last=true`.

Log operacional (auditoria):

- eventos registrados com `customer_id`, `action`, `user`, `timestamp`, `metadata`;
- inclui criacao de cliente, mudanca de status, alteracao de visita e inclusao manual em rota.

Exemplo de payload:

```json
{
   "customers": [
      {
         "id": "C001",
         "name": "PDV A",
         "lat": -15.6001,
         "lon": -56.0902,
         "region": "MT-65",
         "driver_id": "DRV-01",
         "service_time_min": 20
      },
      {
         "id": "C002",
         "name": "PDV B",
         "lat": -15.6055,
         "lon": -56.1010,
         "region": "MT-65",
         "driver_id": "DRV-01",
         "service_time_min": 15
      }
   ],
   "depots": [
      {
         "region": "MT-65",
         "driver_id": "DRV-01",
         "lat": -15.6014,
         "lon": -56.0979,
         "label": "Base MT65-01"
      }
   ],
   "options": {
      "vehicle_speed_kmh": 40.0,
      "cost_per_km": 2.2
   }
}
```

## Configuração do DB

No `.env` (padrão sqlite, DB_ENABLED=false):

`DATABASE_URL=sqlite:///./routflex.db`
`DB_ENABLED=false`

Para usar PostgreSQL/PostGIS:

`DATABASE_URL=postgresql://user:senha@localhost:5432/routflex`
`DB_ENABLED=true`

Observacao de compatibilidade espacial:

- Em SQLite, colunas espaciais sao degradadas para texto automaticamente para evitar erro de SpatiaLite (`RecoverGeometryColumn`).
- Em PostgreSQL/PostGIS, o backend usa colunas `Geometry` normalmente.
