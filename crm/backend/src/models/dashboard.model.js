const store = require('../data/mockStore');
const { query } = require('../config/database');

const IS_MOCK = process.env.USE_MOCK !== 'false';

// ── Stats ──────────────────────────────────────────────────────────────────────
async function getStats(sessionId) {
  if (IS_MOCK) return store.getStats(sessionId);

  const conditions = [];
  const params = [];
  if (sessionId) {
    conditions.push('session_id = $1');
    params.push(sessionId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query(`
    SELECT
      COUNT(*)::int                                            AS total,
      COUNT(*) FILTER (WHERE status = 'ATIVO')::int            AS ativos,
      COUNT(*) FILTER (WHERE status = 'INATIVO')::int          AS inativos,
      COUNT(*) FILTER (WHERE status = 'SEM_COORDENADA')::int   AS sem_coordenada,
      COUNT(*) FILTER (WHERE status = 'PENDENTE_INTEGRACAO')::int AS pendentes,
      COUNT(*) FILTER (WHERE eligible_for_routing = TRUE)::int AS aptos,
      COUNT(*) FILTER (WHERE last_updated >= CURRENT_DATE)::int AS integrados_hoje
    FROM crm_customers ${where}
  `, params);

  const row = res.rows[0];
  return {
    total: row.total,
    ativos: row.ativos,
    inativos: row.inativos,
    sem_coordenada: row.sem_coordenada,
    pendentes: row.pendentes,
    aptos: row.aptos,
    nao_roteirizaveis: Math.max(row.total - row.aptos, 0),
    integrados_hoje: row.integrados_hoje,
  };
}

// ── DDD Distribution ───────────────────────────────────────────────────────────
async function getDddDistribution(sessionId) {
  if (IS_MOCK) return store.getDddDistribution(sessionId);

  const conditions = ['ddd IS NOT NULL'];
  const params = [];
  if (sessionId) {
    conditions.push(`session_id = $${params.length + 1}`);
    params.push(sessionId);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;

  const res = await query(`
    SELECT
      ddd,
      COUNT(*)::int                                          AS total,
      COUNT(*) FILTER (WHERE status = 'ATIVO')::int          AS ativos,
      COUNT(*) FILTER (WHERE status = 'INATIVO')::int        AS inativos,
      COUNT(*) FILTER (WHERE status = 'SEM_COORDENADA')::int AS sem_coordenada
    FROM crm_customers ${where}
    GROUP BY ddd
    ORDER BY ddd
  `, params);

  return res.rows;
}

// ── Status Distribution ────────────────────────────────────────────────────────
async function getStatusDistribution(sessionId) {
  if (IS_MOCK) return store.getStatusDistribution(sessionId);

  const conditions = [];
  const params = [];
  if (sessionId) {
    conditions.push('session_id = $1');
    params.push(sessionId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'ATIVO')::int            AS ativos,
      COUNT(*) FILTER (WHERE status = 'INATIVO')::int          AS inativos,
      COUNT(*) FILTER (WHERE status = 'SEM_COORDENADA')::int   AS sem_coordenada,
      COUNT(*) FILTER (WHERE status = 'PENDENTE_INTEGRACAO')::int AS pendentes
    FROM crm_customers ${where}
  `, params);

  const row = res.rows[0];
  const rows = [
    { name: 'Ativos', key: 'ATIVO', value: row.ativos, color: '#00C896' },
    { name: 'Inativos', key: 'INATIVO', value: row.inativos, color: '#FF4757' },
    { name: 'Sem coordenada', key: 'SEM_COORDENADA', value: row.sem_coordenada, color: '#FFB300' },
    { name: 'Pendente integração', key: 'PENDENTE_INTEGRACAO', value: row.pendentes, color: '#1565C0' },
  ];
  return rows.filter((r) => r.value > 0);
}

// ── DDD Issues ─────────────────────────────────────────────────────────────────
async function getDddIssues(sessionId) {
  const dist = await getDddDistribution(sessionId);
  return dist
    .map((d) => ({ ...d, issues: (d.inativos || 0) + (d.sem_coordenada || 0) }))
    .sort((a, b) => b.issues - a.issues)
    .filter((d) => d.issues > 0);
}

// ── Quality ────────────────────────────────────────────────────────────────────
async function getQualityIndicators(sessionId) {
  if (IS_MOCK) return store.getQualityIndicators(sessionId);

  const conditions = [];
  const params = [];
  if (sessionId) {
    conditions.push('session_id = $1');
    params.push(sessionId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await query(`
    SELECT
      COUNT(*)::int                                                AS total,
      COUNT(*) FILTER (WHERE eligible_for_routing = TRUE)::int     AS aptos,
      COUNT(*) FILTER (WHERE eligible_for_routing = FALSE)::int    AS nao_aptos,
      COUNT(*) FILTER (WHERE status = 'SEM_COORDENADA')::int       AS sem_coordenada,
      COUNT(*) FILTER (WHERE lat IS NULL OR lon IS NULL)::int      AS sem_coordenada_raw,
      COUNT(*) FILTER (WHERE lat IS NOT NULL AND lon IS NOT NULL
        AND (lat < -33.75 OR lat > 5.27 OR lon < -73.99 OR lon > -34.79))::int AS fora_da_area
    FROM crm_customers ${where}
  `, params);

  const row = res.rows[0];
  const total = row.total || 1;
  const pctValidos = Math.round((row.aptos / total) * 100);

  return {
    aptos: row.aptos,
    nao_aptos: row.nao_aptos,
    pct_validos: pctValidos,
    pct_invalidos: Math.max(0, 100 - pctValidos),
    score: pctValidos,
    detalhes: {
      sem_coordenada: row.sem_coordenada,
      fora_da_area: row.fora_da_area,
    },
    criteria: {
      ativo: true,
      coordenada_valida: true,
      dentro_do_brasil: true,
    },
  };
}

// ── Alerts ─────────────────────────────────────────────────────────────────────
async function getAlerts(sessionId) {
  const stats = await getStats(sessionId);
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

  return { alerts, stats };
}

// ── Distribution by Driver ─────────────────────────────────────────────────────
// NOTA: crm_customers não possui campo driver_id. Quando a integração bidirecional
// com o backend de roteirização for implementada, este endpoint será alimentado
// com dados reais de atribuição de motoristas.
async function getDriverDistribution(sessionId) {
  if (IS_MOCK) {
    // Mock: sem dados de motorista no CRM mock
    return { available: false, message: 'Dados de motorista disponíveis apenas após roteirização.', drivers: [] };
  }

  // Verificar se a coluna driver_id existe (futuro)
  try {
    const conditions = ['driver_id IS NOT NULL'];
    const params = [];
    if (sessionId) {
      conditions.push(`session_id = $${params.length + 1}`);
      params.push(sessionId);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const res = await query(`
      SELECT
        driver_id,
        COUNT(*)::int AS total_clientes
      FROM crm_customers ${where}
      GROUP BY driver_id
      ORDER BY total_clientes DESC
    `, params);

    return { available: true, drivers: res.rows };
  } catch (err) {
    // Coluna driver_id não existe ainda
    if (err.code === '42703') {
      return { available: false, message: 'Campo driver_id ainda não disponível. Execute a migração de integração com roteirização.', drivers: [] };
    }
    throw err;
  }
}

// ── Routes Summary ─────────────────────────────────────────────────────────────
// NOTA: mesma situação — dados de rota (route_id, sequence) existem no frontend
// e no backend Python, não no CRM. Endpoint preparado para integração futura.
async function getRoutesSummary(sessionId) {
  if (IS_MOCK) {
    return { available: false, message: 'Dados de rotas disponíveis apenas após roteirização.', routes: [] };
  }

  try {
    const conditions = ['driver_id IS NOT NULL'];
    const params = [];
    if (sessionId) {
      conditions.push(`session_id = $${params.length + 1}`);
      params.push(sessionId);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const res = await query(`
      SELECT
        driver_id,
        COUNT(*)::int AS total_clientes,
        ROUND(AVG(COALESCE(sequence, 0)), 1) AS sequencia_media
      FROM crm_customers ${where}
      GROUP BY driver_id
      ORDER BY driver_id
    `, params);

    return {
      available: true,
      total_rotas: res.rows.length,
      rotas: res.rows,
    };
  } catch (err) {
    if (err.code === '42703') {
      return { available: false, message: 'Campos de roteirização (driver_id, sequence) ainda não disponíveis no CRM.', routes: [] };
    }
    throw err;
  }
}

// ── Insights ───────────────────────────────────────────────────────────────────
async function getOperationalInsights(sessionId) {
  if (IS_MOCK) return store.getOperationalInsights(sessionId);

  const conditions = [];
  const params = [];
  if (sessionId) {
    conditions.push('session_id = $1');
    params.push(sessionId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Clientes por cidade
  const cityRes = await query(`
    SELECT
      COALESCE(city, 'Sem cidade') AS city,
      COALESCE(state, '--') AS state,
      ddd,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'ATIVO')::int AS ativos,
      COUNT(*) FILTER (WHERE status = 'INATIVO')::int AS inativos
    FROM crm_customers ${where}
    GROUP BY city, state, ddd
    ORDER BY total DESC
    LIMIT 20
  `, params);

  // Clientes por região
  const regionRes = await query(`
    SELECT ddd, COUNT(*)::int AS total
    FROM crm_customers ${where}
    GROUP BY ddd
    ORDER BY total DESC
  `, params);

  const totalCustomers = regionRes.rows.reduce((sum, r) => sum + r.total, 0);

  return {
    summary: {
      total_customers: totalCustomers,
      regions: regionRes.rows.length,
    },
    customers_by_region: regionRes.rows,
    density_by_city: cityRes.rows,
    recommendations: [
      'Balancear automaticamente a carteira quando um vendedor exceder 20% da media.',
      'Criar regra de alocacao dedicada para cidades com acesso por balsa.',
      'Mostrar no mapa impacto de troca de vendedor por tempo e distancia.',
      'Habilitar simulacao de redistribuicao com preview antes de confirmar.',
    ],
  };
}

module.exports = {
  getStats,
  getDddDistribution,
  getStatusDistribution,
  getDddIssues,
  getQualityIndicators,
  getAlerts,
  getDriverDistribution,
  getRoutesSummary,
  getOperationalInsights,
};
