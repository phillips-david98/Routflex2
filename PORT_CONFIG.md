# ROUTflex - Configuração Padrão de Portas

## Resumo Executivo
Sistema padronizado com uma única configuração que funciona em todos os ambientes de desenvolvimento.

---

## Portas Padrão (Dev Local)

| Serviço | Porta | URL | Ambiente |
|---------|-------|-----|----------|
| **CRM Backend (Node.js)** | 3001 | `http://localhost:3001` | `.env: PORT=3001` |
| **CRM Frontend (Vite React)** | 5173 | `http://localhost:5173` | `vite.config.js: port: 5173` |
| **Backend Python (FastAPI)** | 8000 | `http://localhost:8000` | `.env: ROTEIRIZACAO_API_URL=http://localhost:8000` |

---

## Fluxo de Requisições

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (Port 5173)                                            │
│       ↓ (fetch /api/...)                                         │
│       ↓ (Vite proxy: /api → 3001)                              │
│       ↓                                                          │
│ CRM Backend Node.js (Port 3001)                                 │
│       ├─ /api/customers                                         │
│       ├─ /api/dashboard                                         │
│       └─ POST /api/roteirizacao → (ROTEIRIZACAO_API_URL)       │
│                                   ↓                             │
│           Backend Python (Port 8000)                            │
│           /plan/advanced                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos de Configuração

### CRM Backend (`crm/backend/.env.example` → `.env`)
```env
PORT=3001
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3001,http://localhost:3001
ROTEIRIZACAO_API_URL=http://localhost:8000
```

### CRM Frontend (`crm/frontend/.env.example` → `.env`)
```env
VITE_API_URL=http://localhost:3001
```

### Backend Python (`backend/.env` ou variáveis)
```
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001
```

---

## Como Iniciar o Sistema (Dev Local)

### Opção 1: Script PowerShell (Recomendado)
```powershell
cd crm
./start.ps1
# Abre automaticamente:
# - Backend CRM em http://localhost:3001
# - Frontend em http://localhost:5173
```

### Opção 2: Manual (Terminal separado para cada serviço)
```bash
# Terminal 1: Backend Python (raiz do projeto)
cd backend
uvicorn main:app --port 8000 --reload

# Terminal 2: CRM Backend
cd crm/backend
npm run dev
# (usa PORT=3001 do .env)

# Terminal 3: CRM Frontend
cd crm/frontend
npm run dev
# (usa porta 5173 do vite.config.js)
```

---

## Validação de Conectividade

### Health Checks
```bash
# Backend Python
curl http://localhost:8000/health

# CRM Backend
curl http://localhost:3001/health

# Frontend (apenas localizado)
# Acesse http://localhost:5173 no navegador
```

### Verificar CORS
O Frontend deve conseguir chamar:
```javascript
fetch('http://localhost:3001/api/customers')
```

O CRM Backend deve conseguir chamar:
```javascript
fetch('http://localhost:8000/plan/advanced')
```

---

## Produção

Para produção, ajuste:
- **CRM Frontend**: `VITE_API_URL` → domínio da API
- **CRM Backend**: `PORT` → porta fornecida pelo orquestrador (Railway, Heroku, etc)
- **CRM Backend**: `CORS_ORIGINS` → URLs reais
- **Backend Python**: `CORS_ORIGINS` → URLs reais

---

## Histórico de Mudanças

| Data | Mudança | Motivo |
|------|---------|--------|
| 2026-03-24 | Padronizou CRM Backend para porta 3001 | Harmonia com vite proxy e start.ps1 |
| 2026-03-24 | Padronizou Frontend API URL para 3001 | Consistência com backend |
| 2026-03-24 | Criado este documento | Centralizar referência de portas |
