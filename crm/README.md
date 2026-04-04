# ROUTflex Mini CRM

Módulo CRM isolado, integrado ao sistema de roteirização ROUTflex.
Arquitetura modular — **não interfere** com o backend Python/FastAPI existente.

## Stack

| Camada    | Tecnologia              |
|-----------|-------------------------|
| Backend   | Node.js + Express       |
| Frontend  | React + Vite + Recharts |
| Banco     | PostgreSQL (mock padrão)|

---

## Estrutura de Pastas

```
crm/
├── backend/
│   ├── src/
│   │   ├── app.js                   # Servidor Express
│   │   ├── config/database.js       # Conexão PostgreSQL
│   │   ├── data/mockStore.js        # Mock in-memory (40 clientes)
│   │   ├── models/customer.model.js # CRUD (mock + DB)
│   │   ├── routes/
│   │   │   ├── customers.routes.js  # GET/POST/PUT/DELETE /api/customers
│   │   │   ├── dashboard.routes.js  # GET /api/dashboard/*
│   │   │   └── roteirizacao.routes.js # POST /api/roteirizacao/clientes
│   │   └── utils/validators.js      # CPF/CNPJ validation
│   ├── migrations/001_create_crm.sql
│   ├── seeds/mock_data.sql
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── styles/globals.css
│   │   ├── services/api.js          # Axios wrapper
│   │   ├── utils/validators.js      # CPF/CNPJ + máscaras
│   │   ├── components/
│   │   │   ├── Layout.jsx, Sidebar.jsx, Header.jsx
│   │   │   ├── Badge.jsx, CustomerForm.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx        # Gráficos + alertas
│   │       ├── Customers.jsx        # Listagem + CRUD
│   │       └── Roteirizacao.jsx     # Envio para rota
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## Como Rodar (Desenvolvimento)

### 1. Backend CRM (Node.js)

```powershell
cd crm\backend
npm install
copy .env.example .env      # editar se necessário
npm run dev
# Rodando em http://localhost:3001
```

### 2. Frontend CRM (React)

```powershell
cd crm\frontend
npm install
npm run dev
# Abrir http://localhost:5173
```

> **O frontend faz proxy `/api` → `localhost:3001`** via Vite. O backend deve estar rodando primeiro.

---

## Modo Mock vs. PostgreSQL

Por padrão `USE_MOCK=true` no `.env` — nenhum banco é necessário.
Os 40 clientes mock são carregados em memória e resetados ao reiniciar o servidor.

Para usar PostgreSQL real:
1. Criar banco: `createdb routflex_crm`
2. Executar migration: `psql -d routflex_crm -f migrations/001_create_crm.sql`
3. Executar seed: `psql -d routflex_crm -f seeds/mock_data.sql`
4. No `.env`: `USE_MOCK=false` e `DATABASE_URL=postgresql://...`

---

## Endpoints da API CRM

### Customers
| Método | Rota                      | Descrição               |
|--------|---------------------------|-------------------------|
| GET    | `/api/customers`          | Listar (filtros, busca) |
| GET    | `/api/customers/:id`      | Detalhe                 |
| POST   | `/api/customers`          | Criar                   |
| PUT    | `/api/customers/:id`      | Atualizar               |
| DELETE | `/api/customers/:id`      | Remover                 |

**Filtros GET /api/customers:**
- `ddd`, `status`, `eligible` (true/false), `search`, `page`, `per_page`

### Dashboard
| Método | Rota                            | Descrição                   |
|--------|---------------------------------|-----------------------------|
| GET    | `/api/dashboard/stats`          | Totais e contagens          |
| GET    | `/api/dashboard/ddd-distribution` | Clientes por DDD          |
| GET    | `/api/dashboard/ddd-issues`     | Ranking DDDs com problemas  |
| GET    | `/api/dashboard/quality`        | % válidos / inválidos       |
| GET    | `/api/dashboard/alerts`         | Alertas inteligentes        |

### Roteirização (mock)
| Método | Rota                         | Descrição                         |
|--------|------------------------------|-----------------------------------|
| POST   | `/api/roteirizacao/clientes` | Enviar clientes elegíveis p/ rota |
| GET    | `/api/roteirizacao/status`   | Status da integração              |

---

## Status de Cliente

| Status                | Elegível p/ Roteirização | Descrição                   |
|-----------------------|:------------------------:|-----------------------------|
| `ATIVO`               | ✅ (se tem coordenada)   | Operacional                 |
| `INATIVO`             | ❌                       | Baixa prioridade            |
| `SEM_COORDENADA`      | ❌                       | Não roteirizável            |
| `PENDENTE_INTEGRACAO` | ❌                       | Aguarda confirmação         |

---

## Funcionalidades

- ✅ CRUD completo de clientes
- ✅ Validação CPF/CNPJ (algoritmo oficial)
- ✅ Bloqueio de duplicidade por CPF/CNPJ
- ✅ Status automático `SEM_COORDENADA` quando sem lat/lon
- ✅ Flag de elegibilidade para roteirização
- ✅ Dashboard com gráficos (Recharts)
- ✅ Alertas inteligentes
- ✅ Filtros: DDD, status, elegibilidade, busca
- ✅ Envio para roteirização (mock → preparado para integração real)
- ✅ Paginação
- ✅ Identidade visual ROUTflex (inspirado Salesforce)
- ✅ Banco PostgreSQL com migration e views
