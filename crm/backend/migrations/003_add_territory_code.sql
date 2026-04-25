-- ============================================================
-- ROUTflex CRM – Migration 003
-- Adds territory_code and seller_name columns to crm_customers
-- territory_code = canonical territory assignment (e.g. MT-65-01, SP-11-02)
-- seller_name    = human seller/driver name
-- ============================================================

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS territory_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS seller_name   VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_crm_customers_territory ON crm_customers (territory_code);
