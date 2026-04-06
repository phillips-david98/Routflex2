-- ============================================================
-- ROUTflex CRM – Seed DDD 65 (Cuiabá / Várzea Grande)
-- 500 clientes reais para testes funcionais
-- Reexecutável: faz DELETE + INSERT (idempotente)
-- ============================================================

BEGIN;

-- ── 1. Sessão DDD 65 (upsert) ──────────────────────────────
INSERT INTO crm_sessions (id, ddd, name, status)
VALUES ('DDD 65', '65', 'Sessão DDD 65', 'ATIVA')
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ── 2. Limpar clientes anteriores do seed ───────────────────
DELETE FROM crm_customers WHERE session_id = 'DDD 65';

-- ── 3. Resetar sequence para evitar buracos ─────────────────
-- (opcional — não quebra se pular)
SELECT setval('crm_customer_seq', COALESCE((SELECT MAX(id) FROM crm_customers), 0) + 1, false);

-- ── 4. Inserir 500 clientes ─────────────────────────────────
-- Distribuição: ~400 ATIVO, ~60 INATIVO, ~40 SEM_COORDENADA
-- Cidades: ~60% Cuiabá, ~35% Várzea Grande, ~5% outros (Rondonópolis, Lucas)

INSERT INTO crm_customers (name, phone, ddd, cpf_cnpj, address, number, neighborhood, city, state, zip_code, lat, lon, status, eligible_for_routing, notes, session_id)
VALUES
-- ═══════════════════════════════════════════════════════════════
-- CUIABÁ — ATIVOS (1-240)
-- ═══════════════════════════════════════════════════════════════
('Distribuidora Cuiabana Ltda',          '65999010001','65','10.100.100/0001-01','Av Historiador Rubens de Mendonça','1200','Bosque da Saúde','Cuiabá','MT','78050-000',-15.5920,-56.0930,'ATIVO',true,NULL,'DDD 65'),
('Mercado Central MT',                   '65999010002','65','10.100.200/0001-02','Av do CPA','500','CPA I','Cuiabá','MT','78055-000',-15.5785,-56.0670,'ATIVO',true,NULL,'DDD 65'),
('Farmácia Saúde Popular',               '65999010003','65','10.100.300/0001-03','Rua Barão de Melgaço','320','Centro','Cuiabá','MT','78005-300',-15.5960,-56.0958,'ATIVO',true,NULL,'DDD 65'),
('Padaria Pão de Ouro',                  '65999010004','65','10.100.400/0001-04','Av Isaac Póvoas','890','Centro','Cuiabá','MT','78005-100',-15.5935,-56.0945,'ATIVO',true,NULL,'DDD 65'),
('Empório Mato-Grossense',               '65999010005','65','10.100.500/0001-05','Rua Cândido Mariano','180','Centro Sul','Cuiabá','MT','78020-120',-15.6010,-56.0960,'ATIVO',true,NULL,'DDD 65'),
('Supermercado Pantanal',                '65999010006','65','10.100.600/0001-06','Av Fernando Corrêa da Costa','2200','Coxipó','Cuiabá','MT','78060-900',-15.6120,-56.0650,'ATIVO',true,NULL,'DDD 65'),
('Atacadão do Cerrado',                  '65999010007','65','10.100.700/0001-07','Av Miguel Sutil','5500','Duque de Caxias','Cuiabá','MT','78043-300',-15.5750,-56.0890,'ATIVO',true,'Cliente VIP','DDD 65'),
('Casa de Carnes Nobre',                 '65999010008','65','10.100.800/0001-08','Rua Joaquim Murtinho','445','Centro Sul','Cuiabá','MT','78015-480',-15.5985,-56.0975,'ATIVO',true,NULL,'DDD 65'),
('Loja de Materiais São José',           '65999010009','65','10.100.900/0001-09','Av Tenente Coronel Duarte','760','Centro','Cuiabá','MT','78005-500',-15.5950,-56.0920,'ATIVO',true,NULL,'DDD 65'),
('Pet Shop Bicho Feliz',                 '65999010010','65','10.101.000/0001-10','Rua Antônio Maria Coelho','230','Araés','Cuiabá','MT','78005-690',-15.5880,-56.0980,'ATIVO',true,NULL,'DDD 65'),
('Restaurante Sabor Pantaneiro',         '65999010011','65','10.101.100/0001-11','Rua Pedro Celestino','335','Centro','Cuiabá','MT','78005-010',-15.5955,-56.0935,'ATIVO',true,NULL,'DDD 65'),
('Drogaria Vida Plena',                  '65999010012','65','10.101.200/0001-12','Av Getúlio Vargas','1100','Centro','Cuiabá','MT','78005-200',-15.5940,-56.0950,'ATIVO',true,NULL,'DDD 65'),
('Construtora Cerrado Verde',            '65999010013','65','10.101.300/0001-13','Rua Comandante Costa','500','Centro','Cuiabá','MT','78020-400',-15.5975,-56.0940,'ATIVO',true,NULL,'DDD 65'),
('Auto Peças MT',                        '65999010014','65','10.101.400/0001-14','Av CPA','1800','CPA II','Cuiabá','MT','78058-000',-15.5710,-56.0580,'ATIVO',true,NULL,'DDD 65'),
('Elétrica Pantanal',                    '65999010015','65','10.101.500/0001-15','Rua Presidente Marques','180','Centro','Cuiabá','MT','78005-400',-15.5965,-56.0965,'ATIVO',true,NULL,'DDD 65'),
('Vidraçaria Cristal',                   '65999010016','65','10.101.600/0001-16','Rua 13 de Junho','620','Centro','Cuiabá','MT','78005-250',-15.5945,-56.0925,'ATIVO',true,NULL,'DDD 65'),
('Papelaria e Gráfica MT',               '65999010017','65','10.101.700/0001-17','Rua Galdino Pimentel','280','Bandeirantes','Cuiabá','MT','78010-200',-15.6005,-56.0985,'ATIVO',true,NULL,'DDD 65'),
('Floricultura Girassol',                '65999010018','65','10.101.800/0001-18','Av Lavapés','1000','Jardim Petrópolis','Cuiabá','MT','78070-200',-15.6180,-56.0850,'ATIVO',true,NULL,'DDD 65'),
('Lanchonete Bom Sabor',                 '65999010019','65','10.101.900/0001-19','Rua Diogo Domingos Ferreira','150','Bandeirantes','Cuiabá','MT','78010-090',-15.5995,-56.0970,'ATIVO',true,NULL,'DDD 65'),
('Tecnologia MT Soluções',               '65999010020','65','10.102.000/0001-20','Av Historiador Rubens de Mendonça','3500','Jardim Aclimação','Cuiabá','MT','78050-100',-15.5830,-56.0780,'ATIVO',true,NULL,'DDD 65'),
('Escritório Contábil Central',          '65999010021','65','10.102.100/0001-21','Rua Presidente Marques','350','Centro','Cuiabá','MT','78005-400',-15.5968,-56.0962,'ATIVO',true,NULL,'DDD 65'),
('Clínica Veterinária MT',               '65999010022','65','10.102.200/0001-22','Rua Barão de Melgaço','900','Centro','Cuiabá','MT','78005-300',-15.5975,-56.0948,'ATIVO',true,NULL,'DDD 65'),
('Sorveteria Tropical',                  '65999010023','65','10.102.300/0001-23','Av do CPA','1200','CPA III','Cuiabá','MT','78058-100',-15.5700,-56.0550,'ATIVO',true,NULL,'DDD 65'),
('Borracharia Roda Viva',                '65999010024','65','10.102.400/0001-24','Av Fernando Corrêa da Costa','4500','Boa Esperança','Cuiabá','MT','78060-000',-15.6200,-56.0580,'ATIVO',true,NULL,'DDD 65'),
('Loja de Roupas Fashion MT',            '65999010025','65','10.102.500/0001-25','Rua Cândido Mariano','400','Centro Sul','Cuiabá','MT','78020-120',-15.6020,-56.0955,'ATIVO',true,NULL,'DDD 65'),
('Relojoaria Tempo Certo',               '65999010026','65','10.102.600/0001-26','Rua 7 de Setembro','180','Centro','Cuiabá','MT','78005-150',-15.5948,-56.0932,'ATIVO',true,NULL,'DDD 65'),
('Lavanderia Brilho',                    '65999010027','65','10.102.700/0001-27','Rua General Valle','310','Bandeirantes','Cuiabá','MT','78010-100',-15.5998,-56.0978,'ATIVO',true,NULL,'DDD 65'),
('Óptica Visão Clara',                   '65999010028','65','10.102.800/0001-28','Av Isaac Póvoas','1200','Centro','Cuiabá','MT','78005-100',-15.5928,-56.0938,'ATIVO',true,NULL,'DDD 65'),
('Livraria Saber MT',                    '65999010029','65','10.102.900/0001-29','Rua Voluntários da Pátria','250','Centro','Cuiabá','MT','78005-600',-15.5958,-56.0955,'ATIVO',true,NULL,'DDD 65'),
('Oficina Mecânica Turbo',               '65999010030','65','10.103.000/0001-30','Av Miguel Sutil','7200','Poção','Cuiabá','MT','78045-000',-15.5680,-56.0830,'ATIVO',true,NULL,'DDD 65');

-- Bloco gerado proceduralmente: Cuiabá ATIVOS 31-240
INSERT INTO crm_customers (name, phone, ddd, cpf_cnpj, address, number, neighborhood, city, state, zip_code, lat, lon, status, eligible_for_routing, notes, session_id)
SELECT
  'Cliente Cuiabá ' || LPAD(i::TEXT, 4, '0'),
  '6599901' || LPAD(i::TEXT, 4, '0'),
  '65',
  LPAD(i::TEXT, 2, '0') || '.1' || LPAD((i % 100)::TEXT, 2, '0') || '.' || LPAD(((i * 7) % 1000)::TEXT, 3, '0') || '/0001-' || LPAD(((i * 13) % 100)::TEXT, 2, '0'),
  CASE (i % 8)
    WHEN 0 THEN 'Av Historiador Rubens de Mendonça'
    WHEN 1 THEN 'Av do CPA'
    WHEN 2 THEN 'Rua Barão de Melgaço'
    WHEN 3 THEN 'Av Fernando Corrêa da Costa'
    WHEN 4 THEN 'Av Miguel Sutil'
    WHEN 5 THEN 'Av Isaac Póvoas'
    WHEN 6 THEN 'Rua Presidente Marques'
    ELSE 'Av Getúlio Vargas'
  END,
  ((i * 17) % 3000 + 100)::TEXT,
  CASE (i % 10)
    WHEN 0 THEN 'Centro'
    WHEN 1 THEN 'Centro Sul'
    WHEN 2 THEN 'Bosque da Saúde'
    WHEN 3 THEN 'CPA I'
    WHEN 4 THEN 'CPA II'
    WHEN 5 THEN 'Coxipó'
    WHEN 6 THEN 'Jardim das Américas'
    WHEN 7 THEN 'Araés'
    WHEN 8 THEN 'Bandeirantes'
    ELSE 'Jardim Petrópolis'
  END,
  'Cuiabá',
  'MT',
  '780' || LPAD(((i * 3) % 100)::TEXT, 2, '0') || '-' || LPAD(((i * 7) % 1000)::TEXT, 3, '0'),
  -- Coordenadas: Cuiabá centro base -15.6014, -56.0979 com dispersão ±0.06
  ROUND((-15.6014 + (sin(i * 1.7) * 0.04) + (cos(i * 3.1) * 0.02))::NUMERIC, 6),
  ROUND((-56.0979 + (cos(i * 2.3) * 0.04) + (sin(i * 1.1) * 0.02))::NUMERIC, 6),
  'ATIVO',
  true,
  CASE WHEN i % 15 = 0 THEN 'Cliente estratégico' ELSE NULL END,
  'DDD 65'
FROM generate_series(31, 240) AS s(i);

-- ═══════════════════════════════════════════════════════════════
-- VÁRZEA GRANDE — ATIVOS (241-400)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO crm_customers (name, phone, ddd, cpf_cnpj, address, number, neighborhood, city, state, zip_code, lat, lon, status, eligible_for_routing, notes, session_id)
SELECT
  'Cliente Várzea Grande ' || LPAD(i::TEXT, 4, '0'),
  '6599902' || LPAD(i::TEXT, 4, '0'),
  '65',
  LPAD(((i + 500) % 100)::TEXT, 2, '0') || '.2' || LPAD((i % 100)::TEXT, 2, '0') || '.' || LPAD(((i * 11) % 1000)::TEXT, 3, '0') || '/0001-' || LPAD(((i * 17) % 100)::TEXT, 2, '0'),
  CASE (i % 6)
    WHEN 0 THEN 'Av Júlio Campos'
    WHEN 1 THEN 'Av da FEB'
    WHEN 2 THEN 'Rua Filinto Müller'
    WHEN 3 THEN 'Av Couto Magalhães'
    WHEN 4 THEN 'Rua Tiradentes'
    ELSE 'Av Dom Orlando Chaves'
  END,
  ((i * 13) % 2000 + 50)::TEXT,
  CASE (i % 8)
    WHEN 0 THEN 'Centro'
    WHEN 1 THEN 'Manga'
    WHEN 2 THEN 'Cristo Rei'
    WHEN 3 THEN 'Jardim Glória'
    WHEN 4 THEN 'Santa Isabel'
    WHEN 5 THEN 'Parque do Lago'
    WHEN 6 THEN 'Marajoara'
    ELSE 'Água Limpa'
  END,
  'Várzea Grande',
  'MT',
  '781' || LPAD(((i * 3) % 100)::TEXT, 2, '0') || '-' || LPAD(((i * 7) % 1000)::TEXT, 3, '0'),
  -- Várzea Grande base: -15.6460, -56.1320 com dispersão ±0.04
  ROUND((-15.6460 + (sin(i * 2.1) * 0.03) + (cos(i * 0.7) * 0.015))::NUMERIC, 6),
  ROUND((-56.1320 + (cos(i * 1.9) * 0.03) + (sin(i * 2.7) * 0.015))::NUMERIC, 6),
  'ATIVO',
  true,
  CASE WHEN i % 20 = 0 THEN 'Atendimento especial' ELSE NULL END,
  'DDD 65'
FROM generate_series(241, 400) AS s(i);

-- ═══════════════════════════════════════════════════════════════
-- INATIVOS (401-460) — distribuídos entre Cuiabá e VG
-- ═══════════════════════════════════════════════════════════════
INSERT INTO crm_customers (name, phone, ddd, cpf_cnpj, address, number, neighborhood, city, state, zip_code, lat, lon, status, eligible_for_routing, notes, session_id)
SELECT
  'Cliente Inativo ' || LPAD(i::TEXT, 4, '0'),
  '6599903' || LPAD(i::TEXT, 4, '0'),
  '65',
  LPAD(((i + 700) % 100)::TEXT, 2, '0') || '.3' || LPAD((i % 100)::TEXT, 2, '0') || '.' || LPAD(((i * 9) % 1000)::TEXT, 3, '0') || '/0001-' || LPAD(((i * 19) % 100)::TEXT, 2, '0'),
  CASE (i % 4)
    WHEN 0 THEN 'Av Historiador Rubens de Mendonça'
    WHEN 1 THEN 'Av Júlio Campos'
    WHEN 2 THEN 'Rua Barão de Melgaço'
    ELSE 'Av da FEB'
  END,
  ((i * 11) % 1500 + 100)::TEXT,
  CASE (i % 4)
    WHEN 0 THEN 'Centro'
    WHEN 1 THEN 'Coxipó'
    WHEN 2 THEN 'Manga'
    ELSE 'Jardim das Américas'
  END,
  CASE WHEN i % 3 = 0 THEN 'Várzea Grande' ELSE 'Cuiabá' END,
  'MT',
  '780' || LPAD(((i * 5) % 100)::TEXT, 2, '0') || '-' || LPAD(((i * 3) % 1000)::TEXT, 3, '0'),
  ROUND((-15.6200 + (sin(i * 1.3) * 0.04))::NUMERIC, 6),
  ROUND((-56.1100 + (cos(i * 2.1) * 0.04))::NUMERIC, 6),
  'INATIVO',
  false,
  CASE (i % 3)
    WHEN 0 THEN 'Inadimplente há 90 dias'
    WHEN 1 THEN 'Fechou temporariamente'
    ELSE 'Sem pedidos há 6 meses'
  END,
  'DDD 65'
FROM generate_series(401, 460) AS s(i);

-- ═══════════════════════════════════════════════════════════════
-- SEM COORDENADA (461-500) — precisam geocodificação
-- ═══════════════════════════════════════════════════════════════
INSERT INTO crm_customers (name, phone, ddd, cpf_cnpj, address, number, neighborhood, city, state, zip_code, lat, lon, status, eligible_for_routing, notes, session_id)
SELECT
  'Cliente Sem Coord ' || LPAD(i::TEXT, 4, '0'),
  '6599904' || LPAD(i::TEXT, 4, '0'),
  '65',
  LPAD(((i + 900) % 100)::TEXT, 2, '0') || '.4' || LPAD((i % 100)::TEXT, 2, '0') || '.' || LPAD(((i * 13) % 1000)::TEXT, 3, '0') || '/0001-' || LPAD(((i * 23) % 100)::TEXT, 2, '0'),
  CASE (i % 5)
    WHEN 0 THEN 'Rua desconhecida'
    WHEN 1 THEN 'Av sem número'
    WHEN 2 THEN 'Travessa indefinida'
    WHEN 3 THEN 'Estrada rural km 15'
    ELSE 'Quadra sem identificação'
  END,
  'S/N',
  CASE (i % 4)
    WHEN 0 THEN 'Centro'
    WHEN 1 THEN 'Zona Rural'
    WHEN 2 THEN 'Bairro Novo'
    ELSE 'Distrito Industrial'
  END,
  CASE WHEN i % 2 = 0 THEN 'Cuiabá' ELSE 'Várzea Grande' END,
  'MT',
  '780' || LPAD(((i * 9) % 100)::TEXT, 2, '0') || '-' || LPAD(((i * 11) % 1000)::TEXT, 3, '0'),
  NULL,  -- sem lat
  NULL,  -- sem lon
  'SEM_COORDENADA',
  false,
  'Aguardando geocodificação',
  'DDD 65'
FROM generate_series(461, 500) AS s(i);

-- ── 5. Atualizar sequence ───────────────────────────────────
SELECT setval('crm_customer_seq', COALESCE((SELECT MAX(id) FROM crm_customers), 0) + 1, false);

-- ── 6. Resumo ───────────────────────────────────────────────
DO $$
DECLARE
  v_total   INT;
  v_ativos  INT;
  v_inat    INT;
  v_sem     INT;
  v_cuiaba  INT;
  v_vg      INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM crm_customers WHERE session_id = 'DDD 65';
  SELECT COUNT(*) INTO v_ativos FROM crm_customers WHERE session_id = 'DDD 65' AND status = 'ATIVO';
  SELECT COUNT(*) INTO v_inat FROM crm_customers WHERE session_id = 'DDD 65' AND status = 'INATIVO';
  SELECT COUNT(*) INTO v_sem FROM crm_customers WHERE session_id = 'DDD 65' AND status = 'SEM_COORDENADA';
  SELECT COUNT(*) INTO v_cuiaba FROM crm_customers WHERE session_id = 'DDD 65' AND city = 'Cuiabá';
  SELECT COUNT(*) INTO v_vg FROM crm_customers WHERE session_id = 'DDD 65' AND city = 'Várzea Grande';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE ' SEED DDD 65 — RESUMO';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE ' Total:          %', v_total;
  RAISE NOTICE ' Ativos:         %', v_ativos;
  RAISE NOTICE ' Inativos:       %', v_inat;
  RAISE NOTICE ' Sem coordenada: %', v_sem;
  RAISE NOTICE ' Cuiabá:         %', v_cuiaba;
  RAISE NOTICE ' Várzea Grande:  %', v_vg;
  RAISE NOTICE '════════════════════════════════════════';
END $$;

COMMIT;
