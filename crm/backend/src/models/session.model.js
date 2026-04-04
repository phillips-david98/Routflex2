const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

const IS_MOCK = process.env.USE_MOCK !== 'false';

// ── Persistência em arquivo JSON ─────────────────────────────────────────────────
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const META_FILE = path.join(DATA_DIR, 'sessions_meta.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadMockSessions() {
  ensureDataDir();
  try {
    if (fs.existsSync(META_FILE)) {
      const raw = fs.readFileSync(META_FILE, 'utf-8');
      return JSON.parse(raw || '[]');
    }
  } catch (err) {
    console.error('[session.model] Erro ao carregar sessions_meta.json:', err.message);
  }
  return [];
}

function saveMockSessions() {
  try {
    ensureDataDir();
    fs.writeFileSync(META_FILE, JSON.stringify(mockSessions, null, 2));
  } catch (err) {
    console.error('[session.model] Erro ao salvar sessions_meta.json:', err.message);
  }
}

// ── In-memory store para mock mode ──────────────────────────────────────────
let mockSessions = loadMockSessions();
console.log(`[session.model] Boot: ${mockSessions.length} sessão(ões) carregada(s) de ${META_FILE}`);

function buildSessionId(ddd) {
  return `DDD ${String(ddd).trim()}`;
}

// ── Model API ───────────────────────────────────────────────────────────────

async function findAll() {
  if (IS_MOCK) {
    return [...mockSessions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  const res = await query('SELECT * FROM crm_sessions ORDER BY created_at DESC');
  return res.rows;
}

async function findById(id) {
  if (IS_MOCK) {
    return mockSessions.find((s) => s.id === id) || null;
  }
  const res = await query('SELECT * FROM crm_sessions WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function create(data) {
  if (!data.ddd || !/^\d{2}$/.test(String(data.ddd).trim())) {
    const err = new Error('DDD é obrigatório e deve ter 2 dígitos.');
    err.status = 400;
    throw err;
  }

  if (IS_MOCK) {
    const sessionId = buildSessionId(data.ddd);
    // Impedir duplicatas: um DDD = uma sessão
    const existing = mockSessions.find((s) => s.id === sessionId);
    if (existing) return existing;

    const session = {
      id: sessionId,
      ddd: String(data.ddd).trim(),
      name: data.name || `Sessão DDD ${data.ddd}`,
      status: 'ATIVA',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockSessions.push(session);
    saveMockSessions();
    return session;
  }

  const sessionId = buildSessionId(data.ddd);
  // Upsert: se já existe, retorna existente
  const existingRes = await query('SELECT * FROM crm_sessions WHERE id = $1', [sessionId]);
  if (existingRes.rows[0]) return existingRes.rows[0];

  const res = await query(
    `INSERT INTO crm_sessions (id, ddd, name, status)
     VALUES ($1, $2, $3, 'ATIVA')
     RETURNING *`,
    [sessionId, String(data.ddd).trim(), data.name || `Sessão DDD ${data.ddd}`]
  );
  return res.rows[0];
}

async function update(id, data) {
  if (IS_MOCK) {
    const idx = mockSessions.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    if (data.name !== undefined) mockSessions[idx].name = data.name;
    if (data.status !== undefined) mockSessions[idx].status = data.status;
    if (data.ddd !== undefined) mockSessions[idx].ddd = data.ddd;
    mockSessions[idx].updated_at = new Date().toISOString();
    saveMockSessions();
    return mockSessions[idx];
  }

  const current = await findById(id);
  if (!current) return null;

  const res = await query(
    `UPDATE crm_sessions SET name = $1, status = $2, ddd = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [
      data.name ?? current.name,
      data.status ?? current.status,
      data.ddd ?? current.ddd,
      id,
    ]
  );
  return res.rows[0];
}

async function remove(id) {
  if (IS_MOCK) {
    const idx = mockSessions.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    mockSessions.splice(idx, 1);
    saveMockSessions();
    return true;
  }
  const res = await query('DELETE FROM crm_sessions WHERE id = $1 RETURNING id', [id]);
  return res.rowCount > 0;
}

async function getStats(sessionId) {
  if (IS_MOCK) {
    return { session_id: sessionId, customers: 0, routes: 0 };
  }
  const res = await query(
    `SELECT COUNT(*) as total_customers FROM crm_customers WHERE session_id = $1`,
    [sessionId]
  );
  return {
    session_id: sessionId,
    customers: parseInt(res.rows[0].total_customers),
  };
}

module.exports = { findAll, findById, create, update, remove, getStats };
