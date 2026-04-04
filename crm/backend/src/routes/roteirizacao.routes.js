const router = require('express').Router();
const store = require('../data/mockStore');
const customerModel = require('../models/customer.model');

const IS_MOCK = process.env.USE_MOCK !== 'false';
const ROTEIRIZACAO_URL = process.env.ROTEIRIZACAO_API_URL || 'http://localhost:8000';
// Separa origem de dados (USE_MOCK) do modo de integração de roteirização.
// Valores aceitos: 'auto' | 'mock' | 'live'
// - auto: mock->mock integration, db->live integration
// - mock: sempre integração local (sem chamada ao Python)
// - live: sempre integração com Python (mesmo com USE_MOCK=true)
const ROUTING_INTEGRATION_MODE = String(process.env.ROUTING_INTEGRATION_MODE || 'auto').toLowerCase();
const ROTEIRIZACAO_TIMEOUT_MS = Number.parseInt(process.env.ROTEIRIZACAO_TIMEOUT_MS || '8000', 10);
const MAX_RETRY_ATTEMPTS = 2;

function shouldUseLiveRouting() {
  if (ROUTING_INTEGRATION_MODE === 'live') return true;
  if (ROUTING_INTEGRATION_MODE === 'mock') return false;
  return !IS_MOCK;
}

function hasValidCoordinates(customer) {
  const lat = Number(customer?.lat);
  const lon = Number(customer?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon);
}

function isEligibleForRouting(customer) {
  const status = String(customer?.status || '').toUpperCase();
  // Regra mínima e robusta: cliente ativo + coordenada válida.
  return status === 'ATIVO' && hasValidCoordinates(customer);
}

function getIneligibilityReason(customer) {
  const status = String(customer?.status || '').toUpperCase();
  if (!hasValidCoordinates(customer) || status === 'SEM_COORDENADA') {
    return 'Cliente sem coordenada válida.';
  }
  if (status === 'INATIVO') {
    return 'Cliente inativo não entra na rota automaticamente.';
  }
  return `Status inelegível: ${status || 'DESCONHECIDO'}`;
}

function toBatchRoutingStatus(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ATIVO') return 'ATIVO';
  if (normalized === 'INATIVO') return 'INATIVO';
  if (normalized === 'SEM_COORDENADA') return 'SEM_COORDENADA';
  return 'NOVO';
}

function buildBatchPayload(customers) {
  return {
    customers: customers.map((customer) => ({
      id: String(customer.client_id),
      name: customer.name,
      lat: Number(customer.lat),
      lon: Number(customer.lon),
      region: customer.ddd ? `DDD-${customer.ddd}` : 'SEM_DDD',
      driver_id: customer.ddd ? `DRIVER-${customer.ddd}` : 'DRIVER-DEFAULT',
      status: toBatchRoutingStatus(customer.status),
      eligible_for_routing: true,
      service_time_min: 10,
    })),
    depots: [],
    options: {
      include_new_when_eligible: true,
    },
  };
}

function createControllerWithTimeout(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

async function callRoutingBackendWithRetry(payload, requestId, sessionId) {
  const endpoint = `${ROTEIRIZACAO_URL}/plan/batch`;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const { controller, timeoutId } = createControllerWithTimeout(ROTEIRIZACAO_TIMEOUT_MS);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-request-id': requestId,
      };
      if (sessionId) headers['x-session-id'] = sessionId;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text();
        const error = new Error(`Backend de roteirização respondeu com HTTP ${response.status}.`);
        error.code = 'ROUTING_HTTP_ERROR';
        error.httpStatus = 502;
        error.details = { attempt, backend_status: response.status, backend_body: body?.slice(0, 600) };
        throw error;
      }

      let data;
      try {
        data = await response.json();
      } catch {
        const error = new Error('Resposta inválida do backend de roteirização (JSON esperado).');
        error.code = 'ROUTING_INVALID_RESPONSE';
        error.httpStatus = 502;
        error.details = { attempt };
        throw error;
      }

      if (!data || typeof data !== 'object' || !('status' in data)) {
        const error = new Error('Resposta inválida do backend de roteirização (campo status ausente).');
        error.code = 'ROUTING_INVALID_RESPONSE';
        error.httpStatus = 502;
        error.details = { attempt, backend_payload_keys: data && typeof data === 'object' ? Object.keys(data) : [] };
        throw error;
      }

      return { data, attempts: attempt, endpoint };
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError';
      const isConnectionError = err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'EAI_AGAIN' || err instanceof TypeError;

      if (attempt < MAX_RETRY_ATTEMPTS) {
        continue;
      }

      if (isTimeout) {
        const timeoutError = new Error(`Timeout ao chamar backend de roteirização após ${ROTEIRIZACAO_TIMEOUT_MS}ms.`);
        timeoutError.code = 'ROUTING_TIMEOUT';
        timeoutError.httpStatus = 504;
        timeoutError.details = { attempts: attempt, endpoint };
        throw timeoutError;
      }

      if (isConnectionError) {
        const connError = new Error('Falha de conexão com backend de roteirização. Verifique se o serviço Python está ativo.');
        connError.code = 'ROUTING_CONNECTION_ERROR';
        connError.httpStatus = 503;
        connError.details = { attempts: attempt, endpoint };
        throw connError;
      }

      if (err?.httpStatus) {
        throw err;
      }

      const unknownError = new Error('Erro inesperado ao integrar com backend de roteirização.');
      unknownError.code = 'ROUTING_UNKNOWN_ERROR';
      unknownError.httpStatus = 502;
      unknownError.details = { attempts: attempt, endpoint, message: err?.message || null };
      throw unknownError;
    }
  }

  const fallbackError = new Error('Falha ao integrar com backend de roteirização.');
  fallbackError.code = 'ROUTING_UNKNOWN_ERROR';
  fallbackError.httpStatus = 502;
  throw fallbackError;
}

/**
 * POST /api/roteirizacao/clientes
 * Envia clientes elegíveis para o sistema de roteirização.
 * Apenas clientes com status ATIVO e coordenada válida são aceitos.
 *
 * Body: { client_ids: string[] }
 */
router.post('/clientes', async (req, res, next) => {
  try {
    const { client_ids } = req.body;
    const sessionId = req.headers['x-session-id'] || req.query.session_id || null;

    if (!Array.isArray(client_ids) || client_ids.length === 0) {
      return res.status(400).json({ error: 'client_ids deve ser uma lista não vazia.' });
    }

    const uniqueClientIds = [...new Set(
      client_ids
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )];

    if (uniqueClientIds.length === 0) {
      return res.status(400).json({ error: 'client_ids deve conter valores válidos.' });
    }

    // Valida elegibilidade para mock e real usando a mesma regra de negócio.
    const rejected = [];
    const eligibleCustomers = [];
    const customers = await customerModel.findByClientIds(uniqueClientIds, sessionId);
    const customerByClientId = new Map(customers.map((customer) => [String(customer.client_id), customer]));

    uniqueClientIds.forEach((clientId) => {
      const customer = customerByClientId.get(clientId);
      if (!customer) {
        rejected.push({ client_id: clientId, reason: 'Cliente não encontrado.' });
        return;
      }

      if (!isEligibleForRouting(customer)) {
        rejected.push({
          client_id: clientId,
          name: customer.name,
          reason: getIneligibilityReason(customer),
        });
        return;
      }

      eligibleCustomers.push(customer);
    });

    const eligibleIds = eligibleCustomers.map((customer) => String(customer.client_id));

    if (IS_MOCK && eligibleIds.length > 0) {
      const extraRejected = [];
      eligibleIds.forEach((clientId) => {
        const customer = store.findByClientId(clientId, sessionId);
        if (!customer) {
          extraRejected.push({ client_id: clientId, reason: 'Cliente não encontrado no mock store.' });
        }
      });
      rejected.push(...extraRejected);
    }

    if (eligibleIds.length === 0) {
      return res.status(422).json({
        error: 'Nenhum cliente elegível para roteirização.',
        rejected,
      });
    }

    // Integração com roteirização independente da origem dos dados do CRM.
    // Ex.: USE_MOCK=true + ROUTING_INTEGRATION_MODE=live => mockStore -> Python /plan/batch.
    let routingResponse;
    const useLiveRouting = shouldUseLiveRouting();
    if (!useLiveRouting) {
      const results = await store.logIntegration(eligibleIds, sessionId);
      routingResponse = {
        status: 'ACCEPTED',
        accepted_count: results.length,
        customers: results,
        routed_at: new Date().toISOString(),
        source: `mock-local (mode=${ROUTING_INTEGRATION_MODE})`,
      };
    } else {
      try {
        const payload = buildBatchPayload(eligibleCustomers);
        const integration = await callRoutingBackendWithRetry(payload, req.id, sessionId);

        // Atualiza status local para evitar reenvio imediato no frontend.
        await Promise.all(
          eligibleCustomers.map((customer) => customerModel.update(customer.id, { status: 'PENDENTE_INTEGRACAO' }))
        );

        routingResponse = {
          status: 'ACCEPTED',
          accepted_count: eligibleIds.length,
          customers: eligibleCustomers.map((customer) => ({
            client_id: customer.client_id,
            name: customer.name,
            status: 'ACCEPTED',
          })),
          routed_at: new Date().toISOString(),
          source: `live-python (mode=${ROUTING_INTEGRATION_MODE}) → ${integration.endpoint}`,
          attempts: integration.attempts,
          backend_status: integration.data.status,
          backend_summary: integration.data.summary || null,
        };
      } catch (integrationError) {
        return res.status(integrationError.httpStatus || 502).json({
          error: integrationError.message,
          code: integrationError.code || 'ROUTING_INTEGRATION_ERROR',
          rejected_count: rejected.length,
          rejected,
          details: integrationError.details || null,
        });
      }
    }

    res.json({
      success: true,
      sent: eligibleIds.length,
      rejected_count: rejected.length,
      rejected,
      routing_response: routingResponse,
      message: `${eligibleIds.length} cliente(s) enviado(s) para roteirização com sucesso.`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/roteirizacao/status
 * Verifica o status da integração com o sistema de roteirização.
 */
router.get('/status', async (_req, res) => {
  const useLiveRouting = shouldUseLiveRouting();
  if (!useLiveRouting) {
    return res.json({
      connected: false,
      mode: 'mock',
      routeirizacao_url: ROTEIRIZACAO_URL,
      integration_mode: ROUTING_INTEGRATION_MODE,
      message: 'Integração local mock ativa (sem chamada ao backend Python).',
    });
  }

  const endpoint = `${ROTEIRIZACAO_URL}/health`;
  const { controller, timeoutId } = createControllerWithTimeout(Math.min(ROTEIRIZACAO_TIMEOUT_MS, 3000));
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);
    const connected = response.ok;
    return res.json({
      connected,
      mode: 'live',
      routeirizacao_url: ROTEIRIZACAO_URL,
      integration_mode: ROUTING_INTEGRATION_MODE,
      message: connected
        ? 'Integração ativa com backend Python de roteirização.'
        : `Backend de roteirização indisponível (HTTP ${response.status}).`,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    return res.json({
      connected: false,
      mode: 'live',
      routeirizacao_url: ROTEIRIZACAO_URL,
      integration_mode: ROUTING_INTEGRATION_MODE,
      message: err?.name === 'AbortError'
        ? 'Timeout ao verificar integração com backend Python.'
        : 'Falha de conexão ao verificar integração com backend Python.',
    });
  }
});

module.exports = router;
