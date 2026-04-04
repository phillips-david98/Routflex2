const router = require('express').Router();
const store = require('../data/mockStore');

const IS_MOCK = process.env.USE_MOCK !== 'false';

function getSessionId(req) {
  return req.headers['x-session-id'] || req.query.session_id || null;
}

// ── GET /api/dashboard/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    if (!IS_MOCK) return res.status(501).json({ error: 'Modo banco de dados não implementado.' });
    const sessionId = getSessionId(req);
    res.json(store.getStats(sessionId));
  } catch (err) {
    next(err);
  }
});

// ── GET /distribution/ddd (legacy: /ddd-distribution) ───────────────────────
const dddDistributionHandler = async (req, res, next) => {
  try {
    if (!IS_MOCK) return res.status(501).json({ error: 'Modo banco de dados não implementado.' });
    const sessionId = getSessionId(req);
    res.json(store.getDddDistribution(sessionId));
  } catch (err) {
    next(err);
  }
};

router.get('/distribution/ddd', dddDistributionHandler);
router.get('/ddd-distribution', dddDistributionHandler);

// ── GET /distribution/status (legacy: /status-distribution) ─────────────────
const statusDistributionHandler = async (req, res, next) => {
  try {
    if (!IS_MOCK) return res.status(501).json({ error: 'Modo banco de dados não implementado.' });
    const sessionId = getSessionId(req);
    res.json(store.getStatusDistribution(sessionId));
  } catch (err) {
    next(err);
  }
};

router.get('/distribution/status', statusDistributionHandler);
router.get('/status-distribution', statusDistributionHandler);

// ── GET /api/dashboard/ddd-issues ─────────────────────────────────────────────
router.get('/ddd-issues', async (req, res, next) => {
  try {
    if (!IS_MOCK) return res.status(501).json({ error: 'Modo banco de dados não implementado.' });
    const sessionId = getSessionId(req);
    res.json(store.getDddIssues(sessionId));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/dashboard/quality ────────────────────────────────────────────────
router.get('/quality', async (req, res, next) => {
  try {
    if (!IS_MOCK) return res.status(501).json({ error: 'Modo banco de dados não implementado.' });
    const sessionId = getSessionId(req);
    res.json(store.getQualityIndicators(sessionId));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/dashboard/alerts ─────────────────────────────────────────────────
router.get('/alerts', async (req, res, next) => {
  try {
    if (!IS_MOCK) return res.status(501).json({ error: 'Modo banco de dados não implementado.' });
    const sessionId = getSessionId(req);
    const stats = store.getStats(sessionId);
    const alerts = [];

    if (stats.sem_coordenada > 0) {
      alerts.push({
        type: 'warning',
        code: 'SEM_COORDENADA',
        message: `${stats.sem_coordenada} cliente(s) sem coordenada — não podem ser roteirizados.`,
        count: stats.sem_coordenada,
      });
    }

    if (stats.inativos > 0) {
      alerts.push({
        type: 'info',
        code: 'INATIVOS',
        message: `${stats.inativos} cliente(s) inativos — baixa prioridade para roteirização.`,
        count: stats.inativos,
      });
    }

    if (stats.pendentes > 0) {
      alerts.push({
        type: 'info',
        code: 'PENDENTES',
        message: `${stats.pendentes} cliente(s) com integração pendente — aguardando confirmação.`,
        count: stats.pendentes,
      });
    }

    if (stats.nao_roteirizaveis > 0) {
      alerts.push({
        type: 'error',
        code: 'NAO_ROTEIRIZAVEIS',
        message: `${stats.nao_roteirizaveis} cliente(s) não podem ser roteirizados no momento.`,
        count: stats.nao_roteirizaveis,
      });
    }

    res.json({ alerts, stats });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/dashboard/scenario/load ────────────────────────────────────────
router.post('/scenario/load', async (req, res, next) => {
  try {
    if (!IS_MOCK) return res.status(501).json({ error: 'Modo banco de dados não implementado.' });
    const sessionId = getSessionId(req);
    const result = await store.loadOperationalScenario(sessionId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/dashboard/insights ──────────────────────────────────────────────
router.get('/insights', async (req, res, next) => {
  try {
    if (!IS_MOCK) return res.status(501).json({ error: 'Modo banco de dados não implementado.' });
    const sessionId = getSessionId(req);
    res.json(store.getOperationalInsights(sessionId));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
