const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');

const { validateEnv } = require('./validateEnv');
const customersRouter = require('./routes/customers.routes');
const dashboardRouter = require('./routes/dashboard.routes');
const roteirizacaoRouter = require('./routes/roteirizacao.routes');
const sessionsRouter = require('./routes/sessions.routes');

validateEnv();

const logger = Object.freeze({
  info(message) {
    console.info(message);
  },
  warn(message) {
    console.warn(message);
  },
  error(message) {
    console.error(message);
  },
});

const app = express();
const PORT = process.env.PORT || 3001;
const IS_MOCK = process.env.USE_MOCK !== 'false';

// ── Middlewares ────────────────────────────────────────────────────────────────
// CORS_ORIGINS aceita lista separada por vírgula. Fallback cobre dev local.
// Inclui 'null' para permitir file:// (map.html aberto localmente).
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem origin (file://, curl, Postman) e origens na whitelist
    if (!origin || origin === 'null' || CORS_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json());

// Middleware: rastreabilidade com request_id (gerado automaticamente ou extraído do header)
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  // Log estruturado no início da requisição
  const logEntry = {
    timestamp: new Date().toISOString(),
    request_id: requestId,
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
  };
  logger.info(JSON.stringify(logEntry));

  // Captura do status para log ao final
  const originalJson = res.json;
  res.json = function (data) {
    const endLogEntry = {
      timestamp: new Date().toISOString(),
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - req._start,
    };
    logger.info(JSON.stringify(endLogEntry));
    try {
      return originalJson.call(this, data);
    } catch (err) {
      logger.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        request_id: requestId,
        level: 'ERROR',
        message: 'res.json falhou ao serializar resposta',
        error: err?.message || String(err),
      }));
      throw err;
    }
  };

  req._start = Date.now();
  next();
});

// ── Rotas ──────────────────────────────────────────────────────────────────────
const healthHandler = (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ROUTflex CRM API',
    version: '1.0.0',
    mode: IS_MOCK ? 'mock' : 'database',
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Middleware: rejeita requisições de escrita sem x-session-id.
// GET/HEAD/OPTIONS passam livremente; POST/PUT/DELETE/PATCH exigem sessão.
function requireSessionId(req, res, next) {
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (safeMethod) return next();

  const sessionId = req.headers['x-session-id'] || req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Header x-session-id é obrigatório para esta rota.' });
  }
  next();
}

// Rotas de sessão são públicas (não exigem session_id)
app.use('/sessions', sessionsRouter);
app.use('/api/sessions', sessionsRouter);

// Rotas principais — GET livre, escrita exige session_id
app.use('/', requireSessionId, dashboardRouter);
app.use('/customers', requireSessionId, customersRouter);
app.use('/roteirizacao', requireSessionId, roteirizacaoRouter);

// Compatibilidade com clientes legados ainda usando /api
app.use('/api/dashboard', requireSessionId, dashboardRouter);
app.use('/api/customers', requireSessionId, customersRouter);
app.use('/api/roteirizacao', requireSessionId, roteirizacaoRouter);

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const requestId = req.id || 'unknown';
  let errorMessage = err.message || 'Erro interno do servidor.';
  let statusCode = err.status || 500;

  // Detectar erros de banco de dados e melhorar mensagem
  if (err.code === '23505') { // Unique violation (PostgreSQL)
    errorMessage = 'Violação de unicidade: o valor fornecido já existe no sistema.';
    statusCode = 409;
  } else if (err.code === '22P02') { // Invalid text representation (PostgreSQL)
    errorMessage = 'Formato de dado inválido. Verifique tipos de campos (números, datas, etc).';
    statusCode = 400;
  } else if (err.code === '23502') { // Not null violation (PostgreSQL)
    const fieldMatch = err.message.match(/"([^"]+)"/);
    const field = fieldMatch ? fieldMatch[1] : 'desconhecido';
    errorMessage = `Campo obrigatório não preenchido: ${field}`;
    statusCode = 400;
  } else if (err.code === '42P01') { // Undefined table (PostgreSQL)
    errorMessage = 'Tabela do banco de dados não encontrada. Verifique se as migrations foram executadas.';
    statusCode = 503;
  }

  const errorLogEntry = {
    timestamp: new Date().toISOString(),
    request_id: requestId,
    level: 'ERROR',
    method: req.method,
    path: req.path,
    status: statusCode,
    error: errorMessage,
    context: err.context || 'unknown',
    db_code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  };
  logger.error(JSON.stringify(errorLogEntry));
  res.status(statusCode).json({ error: errorMessage });
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`\n  ROUTflex CRM Backend`);
  logger.info(`  Rodando em:  http://localhost:${PORT}`);
  logger.info(`  Modo:        ${IS_MOCK ? 'Mock in-memory' : 'PostgreSQL'}`);
  logger.info(`  Health:      http://localhost:${PORT}/health\n`);
});

module.exports = app;
