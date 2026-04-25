-- ============================================================
-- ROUTflex CRM – Backfill 003a
-- Backfills territory_code and seller_name for existing rows.
-- PREREQUISITE: migration 003_add_territory_code.sql must be applied first.
-- SAFE: only updates rows WHERE territory_code IS NULL (idempotent).
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. Seller names pools
-- ═══════════════════════════════════════════════════════════════

-- Generic sellers (multi-DDD)
CREATE TEMPORARY TABLE _seller_names (idx INT PRIMARY KEY, name VARCHAR(100));
INSERT INTO _seller_names (idx, name) VALUES
  (0, 'Ana Paula Martins'),
  (1, 'Bruno Almeida'),
  (2, 'Carla Nogueira'),
  (3, 'Diego Costa'),
  (4, 'Fernanda Ribeiro'),
  (5, 'Gustavo Lima'),
  (6, 'Helena Souza'),
  (7, 'Igor Mendes');

-- DDD 65 sellers (Cuiabá region)
CREATE TEMPORARY TABLE _seller_names_65 (idx INT PRIMARY KEY, name VARCHAR(100));
INSERT INTO _seller_names_65 (idx, name) VALUES
  (0, 'Marcos Oliveira'),
  (1, 'Tatiana Ramos'),
  (2, 'Felipe Azevedo'),
  (3, 'Juliana Moura'),
  (4, 'Ricardo Santos'),
  (5, 'Priscila Lima'),
  (6, 'Anderson Silva'),
  (7, 'Camila Ferreira');

-- ═══════════════════════════════════════════════════════════════
-- 2. DDD 65 rows (session_id = 'DDD 65'):
--    city-based territory assignment matching operational scenario
--    Cuiabá      → MT-65-01, MT-65-02, MT-65-03  (3 slots)
--    Várzea Grande → MT-65-04, MT-65-05           (2 slots)
--    Others      → MT-65-03                       (rural overflow)
-- ═══════════════════════════════════════════════════════════════

UPDATE crm_customers AS c
SET
  territory_code = sub.territory_code,
  seller_name    = COALESCE(c.seller_name, sub.seller_name)
FROM (
  SELECT
    numbered.id,
    CASE
      -- Cuiabá: 3 territory slots cycling 01-03
      WHEN LOWER(numbered.city) LIKE 'cuiab%' THEN
        'MT-65-' || LPAD(((numbered.city_rn - 1) % 3 + 1)::TEXT, 2, '0')
      -- Várzea Grande: 2 territory slots cycling 04-05
      WHEN LOWER(numbered.city) LIKE 'v_rzea%' OR LOWER(numbered.city) LIKE 'varzea%' THEN
        'MT-65-' || LPAD(((numbered.city_rn - 1) % 2 + 4)::TEXT, 2, '0')
      -- Rural/other: overflow to territory 03
      ELSE 'MT-65-03'
    END AS territory_code,
    sn.name AS seller_name
  FROM (
    SELECT id, city,
           ROW_NUMBER() OVER (ORDER BY id) AS rn,
           ROW_NUMBER() OVER (PARTITION BY city ORDER BY id) AS city_rn
    FROM crm_customers
    WHERE session_id = 'DDD 65'
      AND territory_code IS NULL
  ) AS numbered
  LEFT JOIN _seller_names_65 sn ON sn.idx = (numbered.rn - 1) % 8
) AS sub
WHERE c.id = sub.id
  AND c.territory_code IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- 3. Non-DDD-65 rows (mock_data.sql or any other session):
--    Generic round-robin: {state}-{ddd}-{NN} with 4 slots per DDD
-- ═══════════════════════════════════════════════════════════════

UPDATE crm_customers AS c
SET
  territory_code = sub.territory_code,
  seller_name    = COALESCE(c.seller_name, sub.seller_name)
FROM (
  SELECT
    numbered.id,
    numbered.state || '-' || numbered.ddd || '-' || LPAD(((numbered.ddd_rn - 1) % 4 + 1)::TEXT, 2, '0')
      AS territory_code,
    sn.name AS seller_name
  FROM (
    SELECT id, state, ddd,
           ROW_NUMBER() OVER (ORDER BY id) AS rn,
           ROW_NUMBER() OVER (PARTITION BY ddd ORDER BY id) AS ddd_rn
    FROM crm_customers
    WHERE (session_id IS NULL OR session_id <> 'DDD 65')
      AND territory_code IS NULL
  ) AS numbered
  LEFT JOIN _seller_names sn ON sn.idx = (numbered.rn - 1) % 8
) AS sub
WHERE c.id = sub.id
  AND c.territory_code IS NULL;

DROP TABLE IF EXISTS _seller_names;
DROP TABLE IF EXISTS _seller_names_65;

COMMIT;
