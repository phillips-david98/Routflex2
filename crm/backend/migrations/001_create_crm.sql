-- ============================================================
-- ROUTflex CRM – Migration 001
-- Modelagem PostgreSQL para o módulo CRM
-- ============================================================

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequence para client_id (precisa existir antes da tabela)
CREATE SEQUENCE IF NOT EXISTS crm_customer_seq START 1;

-- ── Tabela principal de clientes CRM ────────────────────────
CREATE TABLE IF NOT EXISTS crm_customers (
    id               SERIAL PRIMARY KEY,
    client_id        VARCHAR(20) UNIQUE NOT NULL DEFAULT ('CRM-' || LPAD(nextval('crm_customer_seq')::TEXT, 6, '0')),

    -- Dados pessoais / empresa
    name             VARCHAR(255) NOT NULL,
    phone            VARCHAR(20),
    ddd              VARCHAR(5),
    cpf_cnpj         VARCHAR(20) UNIQUE,

    -- Endereço
    address          VARCHAR(500),
    number           VARCHAR(20),
    neighborhood     VARCHAR(100),
    city             VARCHAR(100),
    state            CHAR(2),
    zip_code         VARCHAR(10),

    -- Coordenadas geográficas
    lat              DECIMAL(10, 8),
    lon              DECIMAL(11, 8),

    -- Status e elegibilidade
    status           VARCHAR(30) NOT NULL DEFAULT 'ATIVO'
                        CHECK (status IN ('ATIVO','INATIVO','SEM_COORDENADA','PENDENTE_INTEGRACAO')),
    eligible_for_routing BOOLEAN NOT NULL DEFAULT FALSE,

    -- Metadados
    notes            TEXT,
    last_updated     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_crm_customers_status  ON crm_customers (status);
CREATE INDEX IF NOT EXISTS idx_crm_customers_ddd     ON crm_customers (ddd);
CREATE INDEX IF NOT EXISTS idx_crm_customers_eligible ON crm_customers (eligible_for_routing);
CREATE INDEX IF NOT EXISTS idx_crm_customers_name    ON crm_customers (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_crm_customers_created ON crm_customers (created_at DESC);

-- ── Log de integrações com roteirização ─────────────────────
CREATE TABLE IF NOT EXISTS crm_routing_integrations (
    id            SERIAL PRIMARY KEY,
    client_id     VARCHAR(20) NOT NULL REFERENCES crm_customers(client_id) ON DELETE CASCADE,
    integrated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status        VARCHAR(50) NOT NULL DEFAULT 'SUCCESS'
                    CHECK (status IN ('SUCCESS','FAILED','PENDING')),
    response_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_crm_integrations_client  ON crm_routing_integrations (client_id);
CREATE INDEX IF NOT EXISTS idx_crm_integrations_date    ON crm_routing_integrations (integrated_at DESC);

-- ── View: clientes por DDD com indicadores ──────────────────
CREATE OR REPLACE VIEW crm_ddd_summary AS
SELECT
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
WHERE ddd IS NOT NULL
GROUP BY ddd
ORDER BY total DESC;

-- ── View: indicadores gerais de qualidade ───────────────────
CREATE OR REPLACE VIEW crm_quality_summary AS
SELECT
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
    ) AS pct_validos,
    ROUND(
        COUNT(*) FILTER (WHERE eligible_for_routing = FALSE)::NUMERIC
        / NULLIF(COUNT(*), 0) * 100, 1
    ) AS pct_invalidos
FROM crm_customers;
