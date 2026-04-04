const router = require('express').Router();
const customerModel = require('../models/customer.model');
const { validateCpfCnpj } = require('../utils/validators');

// Helper: extrai session_id do header ou query
function getSessionId(req) {
  return req.headers['x-session-id'] || req.query.session_id || null;
}

// ── GET /api/customers ─────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const { ddd, status, eligible, search, page = '1', per_page = '20' } = req.query;
    const filters = {
      session_id: sessionId,
      ddd: ddd || null,
      status: status || null,
      eligible: eligible !== undefined ? eligible === 'true' : null,
      search: search || null,
    };
    const result = await customerModel.findAll(filters, parseInt(page), parseInt(per_page));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/customers/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const customer = await customerModel.findById(req.params.id, sessionId);
    if (!customer) return res.status(404).json({ error: 'Cliente não encontrado.' });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/customers ────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const data = req.body;

    // Injetar session_id nos dados
    if (sessionId) data.session_id = sessionId;

    // Validação 1: Nome (obrigatório)
    if (!data.name || data.name.trim().length < 2) {
      return res.status(400).json({ error: 'Nome é obrigatório (mínimo 2 caracteres).' });
    }

    // Validação 2: Coordenadas (se fornecidas, validar tipo)
    if (data.lat !== undefined || data.lon !== undefined) {
      const lat = data.lat;
      const lon = data.lon;
      if (lat !== null && (typeof lat !== 'number' && (typeof lat !== 'string' || isNaN(parseFloat(lat))))) {
        return res.status(400).json({ error: 'Campo "lat" (latitude) deve ser um número.' });
      }
      if (lon !== null && (typeof lon !== 'number' && (typeof lon !== 'string' || isNaN(parseFloat(lon))))) {
        return res.status(400).json({ error: 'Campo "lon" (longitude) deve ser um número.' });
      }
    }

    // Validação 3: CPF/CNPJ (se fornecido, validar formato e duplicação dentro da sessão)
    if (data.cpf_cnpj) {
      const validation = validateCpfCnpj(data.cpf_cnpj);
      if (!validation.valid) {
        return res.status(400).json({ error: `CPF/CNPJ inválido: ${validation.message}` });
      }
      const existing = await customerModel.findByCpfCnpj(data.cpf_cnpj, sessionId);
      if (existing) {
        return res.status(409).json({ error: 'CPF/CNPJ já cadastrado no sistema.' });
      }
    }

    // Validação 4: DDD (se fornecido)
    if (data.ddd && (!/^\d{2}$/.test(String(data.ddd).trim()))) {
      return res.status(400).json({ error: 'DDD deve ter 2 dígitos.' });
    }

    const customer = await customerModel.create(data);
    if (!customer) {
      return res.status(500).json({ error: 'Falha ao criar cliente. Tente novamente.' });
    }
    res.status(201).json(customer);
  } catch (err) {
    err.context = 'create_customer';
    next(err);
  }
});

// ── PUT /api/customers/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const data = req.body;
    if (sessionId) data.session_id = sessionId;

    if (data.cpf_cnpj) {
      const validation = validateCpfCnpj(data.cpf_cnpj);
      if (!validation.valid) {
        return res.status(400).json({ error: `CPF/CNPJ inválido: ${validation.message}` });
      }
      const existing = await customerModel.findByCpfCnpj(data.cpf_cnpj, sessionId);
      if (existing && String(existing.id) !== String(req.params.id)) {
        return res.status(409).json({ error: 'CPF/CNPJ já cadastrado para outro cliente.' });
      }
    }

    const updated = await customerModel.update(req.params.id, data);
    if (!updated) return res.status(404).json({ error: 'Cliente não encontrado.' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/customers/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const deleted = await customerModel.remove(req.params.id, sessionId);
    if (!deleted) return res.status(404).json({ error: 'Cliente não encontrado.' });
    res.json({ message: 'Cliente removido com sucesso.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
