const router = require('express').Router();
const sessionModel = require('../models/session.model');

// ── GET /sessions ──────────────────────────────────────────────────────────────
router.get('/', async (_req, res, next) => {
  try {
    const sessions = await sessionModel.findAll();
    res.json({ items: sessions, total: sessions.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /sessions/:id ──────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const session = await sessionModel.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada.' });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// ── POST /sessions ─────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { ddd, name } = req.body;

    if (!ddd || !/^\d{2}$/.test(String(ddd).trim())) {
      return res.status(400).json({ error: 'DDD é obrigatório e deve ter 2 dígitos.' });
    }

    const session = await sessionModel.create({ ddd, name });
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// ── PUT /sessions/:id ──────────────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const updated = await sessionModel.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Sessão não encontrada.' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /sessions/:id ───────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await sessionModel.remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Sessão não encontrada.' });
    res.json({ message: 'Sessão removida com sucesso.' });
  } catch (err) {
    next(err);
  }
});

// ── GET /sessions/:id/stats ────────────────────────────────────────────────────
router.get('/:id/stats', async (req, res, next) => {
  try {
    const session = await sessionModel.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada.' });
    const stats = await sessionModel.getStats(req.params.id);
    res.json({ ...session, ...stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
