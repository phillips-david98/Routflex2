const router = require('express').Router();
const store = require('../data/mockStore');
const dashboardModel = require('../models/dashboard.model');

const IS_MOCK = process.env.USE_MOCK !== 'false';

function getSessionId(req) {
  return req.headers['x-session-id'] || req.query.session_id || null;
}

// ── GET /api/dashboard/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    res.json(await dashboardModel.getStats(sessionId));
  } catch (err) {
    next(err);
  }
});

// ── GET /distribution/ddd (legacy: /ddd-distribution) ───────────────────────
const dddDistributionHandler = async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    res.json(await dashboardModel.getDddDistribution(sessionId));
  } catch (err) {
    next(err);
  }
};

router.get('/distribution/ddd', dddDistributionHandler);
router.get('/ddd-distribution', dddDistributionHandler);

// ── GET /distribution/status (legacy: /status-distribution) ─────────────────
const statusDistributionHandler = async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    res.json(await dashboardModel.getStatusDistribution(sessionId));
  } catch (err) {
    next(err);
  }
};

router.get('/distribution/status', statusDistributionHandler);
router.get('/status-distribution', statusDistributionHandler);

// ── GET /api/dashboard/ddd-issues ─────────────────────────────────────────────
router.get('/ddd-issues', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    res.json(await dashboardModel.getDddIssues(sessionId));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/dashboard/quality ────────────────────────────────────────────────
router.get('/quality', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    res.json(await dashboardModel.getQualityIndicators(sessionId));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/dashboard/alerts ─────────────────────────────────────────────────
router.get('/alerts', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    res.json(await dashboardModel.getAlerts(sessionId));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/dashboard/distribution/driver ────────────────────────────────────
router.get('/distribution/driver', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    res.json(await dashboardModel.getDriverDistribution(sessionId));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/dashboard/routes/summary ─────────────────────────────────────────
router.get('/routes/summary', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    res.json(await dashboardModel.getRoutesSummary(sessionId));
  } catch (err) {
    next(err);
  }
});

// ── POST /api/dashboard/scenario/load ────────────────────────────────────────
router.post('/scenario/load', async (req, res, next) => {
  try {
    if (!IS_MOCK) return res.status(501).json({ error: 'Cenário operacional disponível apenas em modo mock.' });
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
    const sessionId = getSessionId(req);
    res.json(await dashboardModel.getOperationalInsights(sessionId));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
