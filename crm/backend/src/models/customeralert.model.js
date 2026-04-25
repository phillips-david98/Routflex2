// crm/backend/src/models/customeralert.model.js

// Enum de tipos de alerta
const { query } = require('../config/database');

const AlertTypes = Object.freeze({
  NO_COORDINATE: 'NO_COORDINATE',
  INCOMPLETE_DATA: 'INCOMPLETE_DATA',
  NOT_ELIGIBLE_FOR_ROUTING: 'NOT_ELIGIBLE_FOR_ROUTING',
  MISSING_PHONE: 'MISSING_PHONE',
});

const Severity = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function hasValidCoordinate(value) {
  if (value === null || value === undefined || value === '') return false;
  return Number.isFinite(Number(value));
}

async function createAlert({ customer_id, session_id, alert_type, alert_message, severity }) {
  // Compatível com unique partial index (customer_id, session_id, alert_type) WHERE is_active = TRUE
  const sql = `
    INSERT INTO crm_customer_alerts (
      customer_id, session_id, alert_type, alert_message, severity, is_active
    )
    VALUES ($1, $2, $3, $4, $5, TRUE)
    ON CONFLICT (customer_id, session_id, alert_type)
      WHERE is_active = TRUE
    DO UPDATE SET
      alert_message = EXCLUDED.alert_message,
      severity = EXCLUDED.severity,
      updated_at = NOW(),
      is_active = TRUE,
      resolved_at = NULL
    RETURNING *;
  `;
  const res = await query(sql, [customer_id, session_id, alert_type, alert_message, severity]);
  return res.rows[0];
}

async function resolveAlert({ customer_id, session_id, alert_type }) {
  const sql = `
    UPDATE crm_customer_alerts
    SET is_active = FALSE,
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE customer_id = $1
      AND session_id = $2
      AND alert_type = $3
      AND is_active = TRUE
    RETURNING *;
  `;
  const res = await query(sql, [customer_id, session_id, alert_type]);
  return res.rows[0];
}

async function getActiveAlertsByCustomer(customer_id, session_id) {
  const sql = `
    SELECT *
    FROM crm_customer_alerts
    WHERE customer_id = $1
      AND session_id = $2
      AND is_active = TRUE
    ORDER BY
      CASE severity
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
      END DESC,
      created_at DESC
  `;
  const res = await query(sql, [customer_id, session_id]);
  return res.rows;
}

async function getAllActiveAlerts() {
  const sql = `
    SELECT *
    FROM crm_customer_alerts
    WHERE is_active = TRUE
    ORDER BY
      CASE severity
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
      END DESC,
      created_at DESC
  `;
  const res = await query(sql);
  return res.rows;
}

// INCOMPLETE_DATA é alerta guarda-chuva.
// MISSING_PHONE é alerta específico e pode coexistir com INCOMPLETE_DATA.
async function evaluateCustomerAlerts(customer) {
  const {
    id: customer_id,
    session_id,
    lat,
    lon,
    eligible_for_routing,
    phone,
    name,
    cpf_cnpj,
    address,
    city,
    ddd,
    status,
  } = customer;

  // Validação explícita de session_id
  if (!session_id) {
    console.warn('[CRM_ALERTS] session_id ausente ao avaliar alertas do cliente', { customerId: customer_id });
    return;
  }

  const normalizedPhone = normalizeText(phone);

  const requiredFields = {
    name: normalizeText(name),
    cpf_cnpj: normalizeText(cpf_cnpj),
    phone: normalizedPhone,
    address: normalizeText(address),
    city: normalizeText(city),
    ddd: normalizeText(ddd),
    status: normalizeText(status),
  };

  const missingRequiredFields = Object.entries(requiredFields)
    .filter(([, value]) => value === '')
    .map(([fieldName]) => fieldName);

  const hasIncompleteData = missingRequiredFields.length > 0;

  const hasLat = hasValidCoordinate(lat);
  const hasLon = hasValidCoordinate(lon);
  const missingCoordinate = !hasLat || !hasLon;

  if (missingCoordinate) {
    await createAlert({
      customer_id,
      session_id,
      alert_type: AlertTypes.NO_COORDINATE,
      alert_message: 'Cliente sem coordenadas geográficas válidas.',
      severity: Severity.MEDIUM,
    });
  } else {
    await resolveAlert({ customer_id, session_id, alert_type: AlertTypes.NO_COORDINATE });
  }

  if (hasIncompleteData) {
    await createAlert({
      customer_id,
      session_id,
      alert_type: AlertTypes.INCOMPLETE_DATA,
      alert_message: `Cliente com dados cadastrais incompletos: ${missingRequiredFields.join(', ')}.`,
      severity: Severity.HIGH,
    });
  } else {
    await resolveAlert({ customer_id, session_id, alert_type: AlertTypes.INCOMPLETE_DATA });
  }

  // INCOMPLETE_DATA é alerta guarda-chuva.
  // MISSING_PHONE é alerta específico e pode coexistir com INCOMPLETE_DATA.
  // Severidade de MISSING_PHONE é MEDIUM pois impacta contato operacional/comercial.
  if (normalizedPhone === '') {
    await createAlert({
      customer_id,
      session_id,
      alert_type: AlertTypes.MISSING_PHONE,
      alert_message: 'Cliente sem telefone cadastrado.',
      severity: Severity.MEDIUM,
    });
  } else {
    await resolveAlert({ customer_id, session_id, alert_type: AlertTypes.MISSING_PHONE });
  }

  if (eligible_for_routing === false) {
    await createAlert({
      customer_id,
      session_id,
      alert_type: AlertTypes.NOT_ELIGIBLE_FOR_ROUTING,
      alert_message: 'Cliente não elegível para roteirização.',
      severity: Severity.MEDIUM,
    });
  } else {
    await resolveAlert({ customer_id, session_id, alert_type: AlertTypes.NOT_ELIGIBLE_FOR_ROUTING });
  }
}

module.exports = {
  AlertTypes,
  Severity,
  normalizeText,
  hasValidCoordinate,
  createAlert,
  resolveAlert,
  getActiveAlertsByCustomer,
  getAllActiveAlerts,
  evaluateCustomerAlerts,
};
