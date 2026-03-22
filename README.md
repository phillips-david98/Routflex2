# Routflex

Solução backend inicial para roteirização logística com FastAPI, OR-Tools e PostgreSQL/PostGIS.

## Arquitetura
- FastAPI (API REST)
- SQLAlchemy + PostgreSQL/PostGIS (geodados)
- OR-Tools (VRP)

## Componentes implementados
- Sessões regionais (DDD / área específica)
- Clientes com atributos CRM
- Veículos com custo / autonomia
- Modo automático de roteirização (VRP) + cálculo de custo
- Endpoints de dashboard (clientes por dia/semana, distância/custo)
- Suporte a pernoites e zonas proibidas

## Como rodar
1. Configurar `DATABASE_URL` no `.env`, ex:

```
DATABASE_URL=postgresql://user:password@localhost:5432/routflex
```

2. Instalar dependências:

```
pip install -r requirements.txt
```

3. Rodar app:

```
uvicorn main:app --reload
```

4. Documentação interativa: `http://localhost:8000/docs`
