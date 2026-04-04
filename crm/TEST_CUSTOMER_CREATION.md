# Teste: Criação de Cliente no CRM

## Pré-requisito
Backend CRM em execução:
```bash
cd crm/backend
npm run dev
# Deve estar em http://localhost:3001
```

## Caso 1: Criação com sucesso (Mock Mode)
```bash
curl -X POST http://localhost:3001/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "phone": "(11) 99999-9999",
    "ddd": "11",
    "cpf_cnpj": "12345678901",
    "address": "Rua das Flores",
    "number": "123",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP",
    "zip_code": "01310-100",
    "lat": -23.5505,
    "lon": -46.6333
  }'
```

**Resposta esperada:**
```json
{
  "id": <número>,
  "client_id": "CRM-<número>",
  "name": "João Silva",
  "status": "ATIVO",
  "eligible_for_routing": true,
  ...
}
```

## Caso 2: Erro - Nome vazio
```bash
curl -X POST http://localhost:3001/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'
```

**Resposta esperada (400):**
```json
{
  "error": "Nome é obrigatório (mínimo 2 caracteres)."
}
```

## Caso 3: Erro - Coordenadas inválidas (tipo)
```bash
curl -X POST http://localhost:3001/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste",
    "lat": "não-é-número",
    "lon": "também-não"
  }'
```

**Resposta esperada (400):**
```json
{
  "error": "Campo \"lat\" (latitude) deve ser um número."
}
```

## Caso 4: Erro - DDD inválido
```bash
curl -X POST http://localhost:3001/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste",
    "ddd": "111"
  }'
```

**Resposta esperada (400):**
```json
{
  "error": "DDD deve ter 2 dígitos."
}
```

## Caso 5: Erro - CPF duplicado
```bash
# Primeiro, crie um cliente com CPF
curl -X POST http://localhost:3001/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cliente Único",
    "cpf_cnpj": "12345678901234"
  }'

# Depois tente criar outro com o mesmo CPF
curl -X POST http://localhost:3001/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Outro Cliente",
    "cpf_cnpj": "12345678901234"
  }'
```

**Resposta esperada (409):**
```json
{
  "error": "CPF/CNPJ já cadastrado no sistema."
}
```

## Validação de Respostas
- ✅ Cliente criado retorna status 201
- ✅ Erro de validação retorna status 400 (Bad Request)
- ✅ Conflito (duplicado) retorna status 409 (Conflict)
- ✅ Erro de servidor retorna status 500 com `{"error": "..."}` detalhado
- ✅ Logs estruturados em JSON no console do backend
