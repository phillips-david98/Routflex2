-- ============================================================
-- ROUTflex CRM – Migration 002
-- Sessões de planejamento com isolamento por session_id
-- ============================================================

-- ── Tabela de sessões de planejamento ───────────────────────
CREATE TABLE IF NOT EXISTS crm_sessions (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    ddd         VARCHAR(5) NOT NULL,
    name        VARCHAR(255),
    status      VARCHAR(30) NOT NULL DEFAULT 'ATIVA'
                    CHECK (status IN ('ATIVA','ARQUIVADA','FINALIZADA')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_sessions_ddd     ON crm_sessions (ddd);
CREATE INDEX IF NOT EXISTS idx_crm_sessions_status  ON crm_sessions (status);
CREATE INDEX IF NOT EXISTS idx_crm_sessions_created ON crm_sessions (created_at DESC);

-- ── Adicionar session_id à tabela de clientes ───────────────
ALTER TABLE crm_customers
    ADD COLUMN IF NOT EXISTS session_id VARCHAR(36) REFERENCES crm_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_crm_customers_session ON crm_customers (session_id);

-- ── Adicionar session_id à tabela de integrações ────────────
ALTER TABLE crm_routing_integrations
    ADD COLUMN IF NOT EXISTS session_id VARCHAR(36) REFERENCES crm_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_crm_integrations_session ON crm_routing_integrations (session_id);

-- ── Recriar views com suporte a session_id ──────────────────
DROP VIEW IF EXISTS crm_ddd_summary;
CREATE OR REPLACE VIEW crm_ddd_summary AS
SELECT
    session_id,
    ddd,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'ATIVO')               AS ativos,
    COUNT(*) FILTER (WHERE status = 'INATIVO')             AS inativos,
    COUNT(*) FILTER (WHERE status = 'SEM_COORDENADA')      AS sem_coordenada,
    COUNT(*) FILTER (WHERE status = 'PENDENTE_INTEGRACAO') AS pendentes,
    COUNT(*) FILTER (WHERE eligible_for_routing = TRUE)    AS elegiveis,
    ROUND(
        COUNT(*) FILTER (WHERE eligible_for_routing = TRUE)::NUMERIC
        / NULLIF(COUNT(*), 0) * 100, 1
    ) AS pct_elegivel
FROM crm_customers
WHERE ddd IS NOT NULL AND session_id IS NOT NULL
GROUP BY session_id, ddd
ORDER BY total DESC;

DROP VIEW IF EXISTS crm_quality_summary;
CREATE OR REPLACE VIEW crm_quality_summary AS
SELECT
    session_id,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'ATIVO')               AS ativos,
    COUNT(*) FILTER (WHERE status = 'INATIVO')             AS inativos,
    COUNT(*) FILTER (WHERE status = 'SEM_COORDENADA')      AS sem_coordenada,
    COUNT(*) FILTER (WHERE status = 'PENDENTE_INTEGRACAO') AS pendentes,
    COUNT(*) FILTER (WHERE eligible_for_routing = TRUE)    AS aptos,
    COUNT(*) FILTER (WHERE eligible_for_routing = FALSE)   AS nao_aptos,
    ROUND(
        COUNT(*) FILTER (WHERE eligible_for_routing = TRUE)::NUMERIC
        / NULLIF(COUNT(*), 0) * 100, 1
    ) AS pct_validos
FROM crm_customers
WHERE session_id IS NOT NULL
GROUP BY session_id;
