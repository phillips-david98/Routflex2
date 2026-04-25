
const store = require('../data/mockStore');
const { query } = require('../config/database');
const { validateCpfCnpj, isValidCoordinate } = require('../utils/validators');
const { evaluateCustomerAlerts } = require('./customeralert.model');

const IS_MOCK = process.env.USE_MOCK !== 'false';

// ── Normaliza tipos de colunas DECIMAL que o pg retorna como string ────────────
function normalizeRow(row) {
  if (!row) return row;
  if (row.lat != null) row.lat = parseFloat(row.lat);
  if (row.lon != null) row.lon = parseFloat(row.lon);
  return row;
}

// ── Helpers DB ─────────────────────────────────────────────────────────────────
async function dbFindAll(filters, page, perPage) {
  const conditions = [];
  const params = [];
  let i = 1;

  // REGRA CRÍTICA: toda query DEVE filtrar por session_id
  if (filters.session_id) {
    conditions.push(`session_id = $${i++}`);
    params.push(filters.session_id);
  }

  if (filters.ddd) { conditions.push(`ddd = $${i++}`); params.push(filters.ddd); }
  if (filters.status) { conditions.push(`status = $${i++}`); params.push(filters.status); }
  if (filters.eligible !== null) { conditions.push(`eligible_for_routing = $${i++}`); params.push(filters.eligible); }
  if (filters.search) {
    conditions.push(`(LOWER(name) LIKE $${i} OR cpf_cnpj LIKE $${i} OR LOWER(city) LIKE $${i})`);
    params.push(`%${filters.search.toLowerCase()}%`);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * perPage;

  const countRes = await query(`SELECT COUNT(*) FROM crm_customers ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const dataRes = await query(
    `SELECT * FROM crm_customers ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
    [...params, perPage, offset]
  );

  return { items: dataRes.rows.map(normalizeRow), total, page, per_page: perPage, pages: Math.ceil(total / perPage) };
}

// ── Model API ──────────────────────────────────────────────────────────────────
async function findAll(filters, page = 1, perPage = 20) {
  if (IS_MOCK) {
    const sessionId = filters.session_id;
    const { session_id, ...rest } = filters;
    return store.findAll(sessionId, rest, page, perPage);
  }
  return dbFindAll(filters, page, perPage);
}

async function findById(id, sessionId) {
  if (IS_MOCK) return store.findById(id, sessionId);
  const conditions = ['id = $1'];
  const params = [id];
  if (sessionId) {
    conditions.push('session_id = $2');
    params.push(sessionId);
  }
  const res = await query(`SELECT * FROM crm_customers WHERE ${conditions.join(' AND ')}`, params);
  return normalizeRow(res.rows[0]) || null;
}

async function findByClientIds(clientIds = [], sessionId) {
  const normalized = [...new Set(
    clientIds
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )];

  if (normalized.length === 0) return [];

  if (IS_MOCK) {
    return normalized
      .map((clientId) => store.findByClientId(clientId, sessionId))
      .filter(Boolean);
  }

  const conditions = ['client_id = ANY($1::text[])'];
  const params = [normalized];
  if (sessionId) {
    conditions.push('session_id = $2');
    params.push(sessionId);
  }
  const res = await query(
    `SELECT * FROM crm_customers WHERE ${conditions.join(' AND ')}`,
    params
  );
  return res.rows.map(normalizeRow);
}

async function findByCpfCnpj(cpfCnpj, sessionId) {
  if (IS_MOCK) return store.findByCpfCnpj(cpfCnpj, sessionId);
  const clean = cpfCnpj.replace(/\D/g, '');
  const conditions = [`REGEXP_REPLACE(cpf_cnpj,'\\D','','g') = $1`];
  const params = [clean];
  if (sessionId) {
    conditions.push('session_id = $2');
    params.push(sessionId);
  }
  const res = await query(`SELECT * FROM crm_customers WHERE ${conditions.join(' AND ')}`, params);
  return normalizeRow(res.rows[0]) || null;
}

async function create(data) {
  if (IS_MOCK) return store.create(data, data.session_id);

  try {
    let lat = null;
    let lon = null;
    if (data.lat !== undefined && data.lat !== null && data.lat !== '') {
      lat = parseFloat(data.lat);
    }
    if (data.lon !== undefined && data.lon !== null && data.lon !== '') {
      lon = parseFloat(data.lon);
    }

    if (isNaN(lat) && lat !== null) {
      const err = new Error('Latitude deve ser um número válido.');
      err.code = '22P02';
      throw err;
    }
    if (isNaN(lon) && lon !== null) {
      const err = new Error('Longitude deve ser um número válido.');
      err.code = '22P02';
      throw err;
    }

    const status = !isValidCoordinate(lat, lon) ? 'SEM_COORDENADA' : (data.status || 'ATIVO');
    const eligible = status === 'ATIVO' && isValidCoordinate(lat, lon);

    const res = await query(
      `INSERT INTO crm_customers (name,phone,ddd,cpf_cnpj,address,number,neighborhood,city,state,zip_code,lat,lon,status,eligible_for_routing,notes,session_id,territory_code,seller_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [data.name, data.phone, data.ddd, data.cpf_cnpj, data.address, data.number, data.neighborhood,
       data.city, data.state, data.zip_code, lat, lon, status, eligible, data.notes || null, data.session_id || null,
       data.territory_code || null, data.seller_name || null]
    );
    const customer = normalizeRow(res.rows[0]);
    // Garante que customer.session_id está presente
    try {
      await evaluateCustomerAlerts(customer);
    } catch (err) {
      console.error('[CRM_ALERTS] Falha ao avaliar alertas do cliente', {
        customerId: customer?.id,
        sessionId: customer?.session_id,
        error: err?.message || err,
      });
    }
    return customer;
  } catch (err) {
    // Re-throw com contexto
    err.context = 'customer_model_create';
    throw err;
  }
}

async function update(id, data) {
  if (IS_MOCK) return store.update(id, data, data.session_id || null);
  const current = await findById(id, data.session_id);
  if (!current) return null;
  let lat = current.lat;
  let lon = current.lon;
  if (data.lat !== undefined && data.lat !== null && data.lat !== '') {
    lat = parseFloat(data.lat);
  }
  if (data.lon !== undefined && data.lon !== null && data.lon !== '') {
    lon = parseFloat(data.lon);
  }
  const requestedStatus = data.status !== undefined ? data.status : current.status;
  const status = !isValidCoordinate(lat, lon) ? 'SEM_COORDENADA' : requestedStatus;
  const eligible = status === 'ATIVO' && isValidCoordinate(lat, lon);
  const res = await query(
    `UPDATE crm_customers SET name=$1,phone=$2,ddd=$3,cpf_cnpj=$4,address=$5,number=$6,neighborhood=$7,
     city=$8,state=$9,zip_code=$10,lat=$11,lon=$12,status=$13,eligible_for_routing=$14,notes=$15,
     territory_code=$16,seller_name=$17,last_updated=NOW()
     WHERE id=$18 RETURNING *`,
    [data.name ?? current.name, data.phone ?? current.phone, data.ddd ?? current.ddd,
     data.cpf_cnpj ?? current.cpf_cnpj, data.address ?? current.address, data.number ?? current.number,
     data.neighborhood ?? current.neighborhood, data.city ?? current.city, data.state ?? current.state,
     data.zip_code ?? current.zip_code, lat, lon, status, eligible, data.notes ?? current.notes,
     data.territory_code ?? current.territory_code, data.seller_name ?? current.seller_name, id]
  );
  const customer = normalizeRow(res.rows[0]);
  // Garante que customer.session_id está presente
  try {
    await evaluateCustomerAlerts(customer);
  } catch (err) {
    console.error('[CRM_ALERTS] Falha ao avaliar alertas do cliente', {
      customerId: customer?.id,
      sessionId: customer?.session_id,
      error: err?.message || err,
    });
  }
  return customer;
}

async function remove(id, sessionId) {
  if (IS_MOCK) return store.remove(id, sessionId);
  const conditions = ['id = $1'];
  const params = [id];
  if (sessionId) {
    conditions.push('session_id = $2');
    params.push(sessionId);
  }
  const res = await query(`DELETE FROM crm_customers WHERE ${conditions.join(' AND ')} RETURNING id`, params);
  return res.rowCount > 0;
}

module.exports = { findAll, findById, findByClientIds, findByCpfCnpj, create, update, remove };
