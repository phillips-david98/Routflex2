const STATUS = {
  ATIVO: 'ATIVO',
  INATIVO: 'INATIVO',
};

const CITY_PROFILES = [
  {
    regionKey: 'MT-65',
    ddd: '65',
    state: 'MT',
    city: 'Cuiaba',
    total: 900,
    density: 'DENSE',
    lat: -15.6014,
    lon: -56.0979,
    sellers: ['MT-65-A', 'MT-65-B', 'MT-65-C', 'MT-65-D', 'MT-65-E', 'MT-65-F'],
  },
  {
    regionKey: 'MT-65',
    ddd: '65',
    state: 'MT',
    city: 'Varzea Grande',
    total: 300,
    density: 'DENSE',
    lat: -15.6467,
    lon: -56.1326,
    sellers: ['MT-65-A', 'MT-65-B', 'MT-65-C', 'MT-65-D', 'MT-65-E', 'MT-65-F'],
  },
  {
    regionKey: 'MG-38',
    ddd: '38',
    state: 'MG',
    city: 'Montes Claros',
    total: 700,
    density: 'MIXED',
    lat: -16.7286,
    lon: -43.8578,
    sellers: ['MG-38-A', 'MG-38-B', 'MG-38-C', 'MG-38-D'],
  },
  {
    regionKey: 'MG-38',
    ddd: '38',
    state: 'MG',
    city: 'Sao Romao',
    total: 50,
    density: 'RURAL',
    lat: -16.3685,
    lon: -45.074,
    sellers: ['MG-38-A', 'MG-38-B', 'MG-38-C', 'MG-38-D'],
  },
  {
    regionKey: 'MG-38',
    ddd: '38',
    state: 'MG',
    city: 'Ponto Chique',
    total: 45,
    density: 'RURAL',
    lat: -16.6262,
    lon: -45.0768,
    sellers: ['MG-38-A', 'MG-38-B', 'MG-38-C', 'MG-38-D'],
  },
  {
    regionKey: 'MG-38',
    ddd: '38',
    state: 'MG',
    city: 'Pintopolis',
    total: 50,
    density: 'RURAL',
    lat: -16.0657,
    lon: -44.806,
    sellers: ['MG-38-A', 'MG-38-B', 'MG-38-C', 'MG-38-D'],
  },
  {
    regionKey: 'PA-93',
    ddd: '93',
    state: 'PA',
    city: 'Santarem',
    total: 300,
    density: 'SPARSE',
    lat: -2.4385,
    lon: -54.6996,
    sellers: ['PA-93-A', 'PA-93-B', 'PA-93-C'],
  },
  {
    regionKey: 'PA-93',
    ddd: '93',
    state: 'PA',
    city: 'Monte Alegre',
    total: 120,
    density: 'SPARSE',
    lat: -2.0072,
    lon: -54.0706,
    sellers: ['PA-93-A', 'PA-93-B', 'PA-93-C'],
  },
  {
    regionKey: 'PA-93',
    ddd: '93',
    state: 'PA',
    city: 'Aveiro',
    total: 80,
    density: 'RIVER_CROSSING',
    lat: -3.6084,
    lon: -55.3332,
    sellers: ['PA-93-A', 'PA-93-B', 'PA-93-C'],
    accessMode: 'BALSA',
  },
];

const SELLER_NAMES = [
  'Ana Paula Martins', 'Bruno Almeida', 'Carla Nogueira', 'Diego Costa',
  'Fernanda Ribeiro', 'Gustavo Lima', 'Helena Souza', 'Igor Mendes',
];

// ── Territory code normalization ────────────────────────────────────────────
// Canonical persisted format: {STATE}-{DDD}-{NN}  (e.g. MT-65-01)
// Accepts: 'MT-65-A' (letter→number), 'MT-65-01' (pass-through), raw string (pass-through)
function normalizeTerritory(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^([A-Z]{2})-(\d{2,3})-([A-Za-z0-9]+)$/);
  if (m) {
    let seq = m[3];
    if (/^[A-Za-z]$/.test(seq)) {
      seq = String(seq.toUpperCase().charCodeAt(0) - 64).padStart(2, '0');
    } else {
      seq = String(parseInt(seq, 10) || seq).padStart(2, '0');
    }
    return `${m[1]}-${m[2]}-${seq}`;
  }
  return s;
}

const COMPANY_PREFIX = [
  'Comercial', 'Distribuidora', 'Atacado', 'Mercantil', 'Rede', 'Grupo', 'Prime', 'Nova',
];

const COMPANY_SUFFIX = [
  'Alimentos', 'Farmacia', 'Suprimentos', 'Logistica', 'Servicos', 'Varejo', 'Tecnologia', 'Atacadista',
];

function pad(num, size = 6) {
  return String(num).padStart(size, '0');
}

function daysAgoIso(daysAgo) {
  const now = new Date();
  now.setDate(now.getDate() - daysAgo);
  return now.toISOString();
}

function rand(seed) {
  // Mulberry32-style PRNG — better distribution than sin-based
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randomInRange(seed, min, max) {
  return min + (max - min) * rand(seed);
}

function geocodeAddress(city, state) {
  const profile = CITY_PROFILES.find((item) => item.city === city && item.state === state);
  if (!profile) return null;

  return {
    lat: profile.lat,
    lon: profile.lon,
    source: 'CITY_CENTROID',
  };
}

function generateCpf(index) {
  return `000.${String(100 + (index % 900)).padStart(3, '0')}.${String(100 + ((index * 7) % 900)).padStart(3, '0')}-${String(10 + (index % 90)).padStart(2, '0')}`;
}

function buildAddress(profile, index) {
  const baseStreet = profile.city === 'Cuiaba' || profile.city === 'Varzea Grande'
    ? 'Av Principal'
    : profile.city === 'Montes Claros'
      ? 'Rua Central'
      : 'Estrada Municipal';

  return {
    address: `${baseStreet} ${((index % 35) + 1)}`,
    number: String((index % 900) + 100),
    neighborhood: profile.density === 'DENSE' ? 'Zona Urbana' : 'Zona de Expansao',
    city: profile.city,
    state: profile.state,
    zip_code: `${String(10000 + ((index * 37) % 89999)).slice(0, 5)}-${String((index * 19) % 1000).padStart(3, '0')}`,
  };
}

function distributeBySeller(sellers, index, totalForCity) {
  const sellerCount = sellers.length;
  const sellerBase = index % sellerCount;

  // Intencionalmente cria leve desbalanceamento para testar insight de sobrecarga.
  if (totalForCity > 600 && index % 7 === 0) return sellers[0];
  return sellers[sellerBase];
}

function densitySpread(profile) {
  if (profile.density === 'DENSE') return { lat: 0.07, lon: 0.07 };
  if (profile.density === 'MIXED') return { lat: 0.10, lon: 0.10 };
  if (profile.density === 'RURAL') return { lat: 0.14, lon: 0.14 };
  if (profile.density === 'RIVER_CROSSING') return { lat: 0.2, lon: 0.2 };
  return { lat: 0.16, lon: 0.16 };
}

// Sub-centroids representam bairros reais para distribuição espacial mais realista
const NEIGHBORHOOD_CENTROIDS = {
  'Cuiaba-MT': [
    { lat: -15.5960, lon: -56.0970, weight: 0.20 },  // Centro
    { lat: -15.5730, lon: -56.0840, weight: 0.12 },  // Morada do Ouro / CPA
    { lat: -15.6210, lon: -56.1080, weight: 0.10 },  // Porto / Jardim das Americas
    { lat: -15.5500, lon: -56.0600, weight: 0.10 },  // Pedra 90 / Parque Atalaia
    { lat: -15.6050, lon: -56.0500, weight: 0.10 },  // Bosque da Saude
    { lat: -15.5800, lon: -56.1300, weight: 0.10 },  // Coxipo
    { lat: -15.5650, lon: -56.1050, weight: 0.08 },  // Areao / Quilombo
    { lat: -15.6300, lon: -56.0650, weight: 0.08 },  // Pico do Amor
    { lat: -15.5900, lon: -56.0250, weight: 0.06 },  // Ribeirao do Lipa
    { lat: -15.6100, lon: -56.1400, weight: 0.06 },  // Santa Rosa
  ],
  'Varzea Grande-MT': [
    { lat: -15.6460, lon: -56.1320, weight: 0.25 },  // Centro VG
    { lat: -15.6350, lon: -56.1500, weight: 0.20 },  // Manga / Cristo Rei
    { lat: -15.6600, lon: -56.1200, weight: 0.15 },  // Parque do Lago
    { lat: -15.6250, lon: -56.1100, weight: 0.15 },  // Ponte Nova
    { lat: -15.6550, lon: -56.1600, weight: 0.10 },  // Jardim Glória
    { lat: -15.6700, lon: -56.1400, weight: 0.15 },  // Industrial
  ],
  'Montes Claros-MG': [
    { lat: -16.7286, lon: -43.8578, weight: 0.25 },  // Centro
    { lat: -16.7100, lon: -43.8700, weight: 0.15 },  // Major Prates
    { lat: -16.7450, lon: -43.8400, weight: 0.15 },  // Ibituruna
    { lat: -16.7200, lon: -43.8300, weight: 0.15 },  // Todos os Santos
    { lat: -16.7500, lon: -43.8700, weight: 0.15 },  // Jardim Panorama
    { lat: -16.7050, lon: -43.8500, weight: 0.15 },  // Santos Reis
  ],
};

function geocodeWithJitter(profile, seed) {
  const centroid = geocodeAddress(profile.city, profile.state);
  if (!centroid) return { lat: null, lon: null, geocode_source: 'UNRESOLVED' };

  const spread = densitySpread(profile);
  const neighborhoodKey = `${profile.city}-${profile.state}`;
  const neighborhoods = NEIGHBORHOOD_CENTROIDS[neighborhoodKey];

  let baseLat = centroid.lat;
  let baseLon = centroid.lon;

  // Usar sub-centroide de bairro quando disponível
  if (neighborhoods && neighborhoods.length > 0) {
    const pick = rand(seed * 7 + 3);
    let cumulative = 0;
    for (const nb of neighborhoods) {
      cumulative += nb.weight;
      if (pick <= cumulative) {
        baseLat = nb.lat;
        baseLon = nb.lon;
        break;
      }
    }
  }

  const lat = baseLat + randomInRange(seed * 31 + 11, -spread.lat, spread.lat);
  const lon = baseLon + randomInRange(seed * 37 + 13, -spread.lon, spread.lon);
  return {
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
    geocode_source: centroid.source,
  };
}

function buildScenarioCustomers() {
  const customers = [];
  let id = 1;

  CITY_PROFILES.forEach((profile) => {
    for (let i = 0; i < profile.total; i += 1) {
      const customerId = id;
      const isInactive = (i % 9) === 0;
      const status = isInactive ? STATUS.INATIVO : STATUS.ATIVO;
      const needsGeocode = (i % 5) === 0;
      const address = buildAddress(profile, i);
      const coords = needsGeocode
        ? geocodeWithJitter(profile, customerId * 13)
        : geocodeWithJitter(profile, customerId * 17);
      const lastVisitDays = status === STATUS.ATIVO ? 2 + (i % 26) : 35 + (i % 90);

      customers.push({
        id: customerId,
        client_id: `SIM-${pad(customerId)}`,
        name: `${COMPANY_PREFIX[customerId % COMPANY_PREFIX.length]} ${COMPANY_SUFFIX[(customerId * 3) % COMPANY_SUFFIX.length]} ${pad(customerId, 4)}`,
        phone: `${profile.ddd}9${String(10000000 + customerId).slice(-8)}`,
        ddd: profile.ddd,
        cpf_cnpj: generateCpf(customerId),
        ...address,
        lat: coords.lat,
        lon: coords.lon,
        status,
        eligible_for_routing: status === STATUS.ATIVO,
        last_visit_at: daysAgoIso(lastVisitDays),
        territory_code: normalizeTerritory(distributeBySeller(profile.sellers, i, profile.total)),
        seller_name: SELLER_NAMES[i % SELLER_NAMES.length],
        region_key: profile.regionKey,
        density_profile: profile.density,
        access_mode: profile.accessMode || null,
        geocode_source: coords.geocode_source,
        last_updated: daysAgoIso(i % 8),
        created_at: daysAgoIso(70 + (i % 120)),
        notes: profile.accessMode === 'BALSA' ? 'Area com travessia de balsa.' : null,
      });
      id += 1;
    }
  });

  return customers;
}

function summarize(customers) {
  const byDdd = {};
  const byCity = {};

  customers.forEach((customer) => {
    byDdd[customer.ddd] = (byDdd[customer.ddd] || 0) + 1;
    const cityKey = `${customer.city}-${customer.state}`;
    byCity[cityKey] = (byCity[cityKey] || 0) + 1;
  });

  return {
    total_customers: customers.length,
    ddds: byDdd,
    top_cities: Object.entries(byCity)
      .map(([city, total]) => ({ city, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6),
  };
}

function buildOperationalInsights(customers = []) {
  const sellers = new Map();
  const regions = new Map();
  const cities = new Map();

  customers.forEach((customer) => {
    const seller = String(customer.territory_code || customer.seller_name || 'SEM_TERRITORIO');
    sellers.set(seller, (sellers.get(seller) || 0) + 1);

    const region = String(customer.ddd || 'SEM_DDD');
    regions.set(region, (regions.get(region) || 0) + 1);

    const cityKey = `${customer.city}/${customer.state}`;
    if (!cities.has(cityKey)) {
      cities.set(cityKey, {
        city: customer.city,
        state: customer.state,
        ddd: customer.ddd,
        total: 0,
        ativos: 0,
        inativos: 0,
        access_mode: customer.access_mode || null,
      });
    }

    const cityRow = cities.get(cityKey);
    cityRow.total += 1;
    if (customer.status === STATUS.ATIVO) cityRow.ativos += 1;
    else cityRow.inativos += 1;
    if (customer.access_mode && !cityRow.access_mode) cityRow.access_mode = customer.access_mode;
  });

  const sellerRows = Array.from(sellers.entries()).map(([seller_name, total]) => ({ seller_name, total }));
  const regionRows = Array.from(regions.entries()).map(([ddd, total]) => ({ ddd, total }));
  const cityRows = Array.from(cities.values()).sort((a, b) => b.total - a.total);

  const avgLoad = sellerRows.length ? (customers.length / sellerRows.length) : 0;
  const overloadedSellers = sellerRows
    .filter((row) => row.total > avgLoad * 1.25)
    .sort((a, b) => b.total - a.total);

  const criticalRegions = cityRows
    .filter((row) => row.access_mode === 'BALSA' || row.inativos > row.ativos * 0.4)
    .map((row) => ({
      city: row.city,
      state: row.state,
      ddd: row.ddd,
      reason: row.access_mode === 'BALSA' ? 'Acesso com balsa' : 'Alta taxa de inatividade',
      total: row.total,
      inativos: row.inativos,
    }));

  return {
    summary: {
      total_customers: customers.length,
      sellers: sellerRows.length,
      regions: regionRows.length,
      avg_customers_per_seller: Number(avgLoad.toFixed(2)),
    },
    customers_by_seller: sellerRows.sort((a, b) => b.total - a.total),
    customers_by_region: regionRows.sort((a, b) => b.total - a.total),
    density_by_city: cityRows,
    overloaded_sellers: overloadedSellers,
    critical_regions: criticalRegions,
    recommendations: [
      'Criar balanceamento automatico por vendedor com teto dinamico por regiao.',
      'Aplicar janela de atendimento por perfil urbano/rural para reduzir atrasos.',
      'Destacar no mapa camadas operacionais (balsa, area remota, sem cobertura).',
      'Adicionar simulacao de replanejamento com arrastar-e-soltar e impacto em SLA.',
    ],
  };
}

function generateOperationalScenario() {
  const customers = buildScenarioCustomers();
  return {
    customers,
    summary: summarize(customers),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Cenário dedicado DDD 65 — Cuiabá + Várzea Grande + Santo Antônio de Leverger
// 1328 clientes total:
//   - Cuiabá:  780 urbanos (3 motoristas base)
//   - Várzea Grande:  420 urbanos (2 motoristas base)
//   - Santo Antônio de Leverger:  30 rurais
//   - Sem coordenada:  98 (espalhados entre as cidades)
// ═════════════════════════════════════════════════════════════════════════════

const DDD65_PROFILES = [
  {
    city: 'Cuiaba',
    state: 'MT',
    total: 780,
    density: 'DENSE',
    lat: -15.6014,
    lon: -56.0979,
    drivers: ['MOT-CBA-01', 'MOT-CBA-02', 'MOT-CBA-03'],
    neighborhoods: [
      'Centro Sul', 'Jardim das Americas', 'Bosque da Saude', 'Duque de Caxias',
      'Boa Esperanca', 'Coxipo', 'Pedra 90', 'CPA I', 'CPA II', 'CPA III',
      'Morada do Ouro', 'Santa Rosa', 'Grande Terceiro', 'Bandeirantes',
      'Jardim Vitoria', 'Jardim Presidente', 'Planalto', 'Pico do Amor',
    ],
    streets: [
      'Av Historiador Rubens de Mendonca', 'Av do CPA', 'Av Isaac Povoas',
      'Rua Barao de Melgaco', 'Av Fernando Correa da Costa', 'Av Miguel Sutil',
      'Rua Cel Pimenta Bueno', 'Rua Pedro Celestino', 'Av Republica do Libano',
      'Rua Antonio Maria Coelho', 'Rua 13 de Junho', 'Av Tenente Cel Duarte',
    ],
  },
  {
    city: 'Varzea Grande',
    state: 'MT',
    total: 420,
    density: 'DENSE',
    lat: -15.6467,
    lon: -56.1326,
    drivers: ['MOT-VGD-01', 'MOT-VGD-02'],
    neighborhoods: [
      'Centro', 'Cristo Rei', 'Manga', 'Jardim Gloria', 'Agua Limpa',
      'Mapim', 'Santa Isabel', 'Vila Arthur', 'Parque do Lago',
      'Costa Verde', 'Novo Mundo', 'Jardim Eldorado',
    ],
    streets: [
      'Av Julio Campos', 'Av da FEB', 'Rua Aluizio Ferreira',
      'Rua Manoel J de Arruda', 'Av Governador Julio Campos',
      'Rua Filinto Muller', 'Av Castelo Branco', 'Rua Dom Orlando Chaves',
    ],
  },
  {
    city: 'Santo Antonio de Leverger',
    state: 'MT',
    total: 30,
    density: 'RURAL',
    lat: -15.8618,
    lon: -56.0790,
    drivers: ['MOT-CBA-03'],
    neighborhoods: ['Centro', 'Beira Rio', 'Mimoso'],
    streets: ['Av Principal', 'Rua Padre Agostinho', 'Estrada Municipal MT-040'],
  },
];

const DDD65_NO_COORD_COUNT = 98;

// Build deterministic driver→territory mapping for DDD65
// All DDD65 profiles share state=MT, ddd=65.
// Unique drivers get sequential territory codes: MT-65-01, MT-65-02, ...
const DDD65_DRIVER_TERRITORY = (() => {
  const map = {};
  let seq = 1;
  DDD65_PROFILES.forEach((profile) => {
    profile.drivers.forEach((driverCode) => {
      if (!map[driverCode]) {
        map[driverCode] = `MT-65-${String(seq).padStart(2, '0')}`;
        seq += 1;
      }
    });
  });
  return map;
})();

const DDD65_SELLERS = [
  'Marcos Oliveira', 'Tatiana Ramos', 'Felipe Azevedo', 'Juliana Moura',
  'Ricardo Santos', 'Priscila Lima', 'Anderson Silva', 'Camila Ferreira',
];

const DDD65_PRIORITIES = ['ALTA', 'MEDIA', 'BAIXA'];

function generateDdd65Scenario() {
  const customers = [];
  let id = 1;

  // Fase 1: Gerar clientes COM coordenadas (1200 urbanos + 30 rurais = 1230)
  DDD65_PROFILES.forEach((profile) => {
    const spread = densitySpread(profile);
    const allDrivers = profile.drivers;

    for (let i = 0; i < profile.total; i += 1) {
      const isInactive = (i % 11 === 0);
      const status = isInactive ? STATUS.INATIVO : STATUS.ATIVO;

      const lat = Number((profile.lat + randomInRange(id * 17, -spread.lat, spread.lat)).toFixed(6));
      const lon = Number((profile.lon + randomInRange(id * 31, -spread.lon, spread.lon)).toFixed(6));

      const lastVisitDays = status === STATUS.ATIVO ? 1 + (i % 28) : 40 + (i % 80);
      const eligible = status === STATUS.ATIVO;

      const streetIdx = i % profile.streets.length;
      const neighIdx = i % profile.neighborhoods.length;
      const priorityIdx = id % DDD65_PRIORITIES.length;

      customers.push({
        id,
        client_id: `SIM-${pad(id)}`,
        name: `${COMPANY_PREFIX[id % COMPANY_PREFIX.length]} ${COMPANY_SUFFIX[(id * 3) % COMPANY_SUFFIX.length]} ${pad(id, 4)}`,
        phone: `659${String(10000000 + id).slice(-8)}`,
        ddd: '65',
        cpf_cnpj: generateCpf(id),
        address: `${profile.streets[streetIdx]} ${((i % 35) + 1)}`,
        number: String((i % 900) + 100),
        neighborhood: profile.neighborhoods[neighIdx],
        city: profile.city,
        state: profile.state,
        zip_code: `78${String(100 + ((i * 37) % 899)).padStart(3, '0')}-${String((i * 19) % 1000).padStart(3, '0')}`,
        lat,
        lon,
        status,
        eligible_for_routing: eligible,
        last_visit_at: daysAgoIso(lastVisitDays),
        territory_code: DDD65_DRIVER_TERRITORY[allDrivers[i % allDrivers.length]],
        seller_name: DDD65_SELLERS[i % DDD65_SELLERS.length],
        region_key: 'MT-65',
        density_profile: profile.density,
        access_mode: null,
        geocode_source: 'CITY_CENTROID',
        driver_base: allDrivers[i % allDrivers.length],
        priority: DDD65_PRIORITIES[priorityIdx],
        last_updated: daysAgoIso(i % 10),
        created_at: daysAgoIso(60 + (i % 120)),
        notes: null,
      });
      id += 1;
    }
  });

  // Fase 2: Gerar 98 clientes SEM coordenadas (distribuídos entre Cuiabá e Várzea Grande)
  const noCoordCities = [
    DDD65_PROFILES[0], // Cuiaba  — 60
    DDD65_PROFILES[1], // Varzea Grande — 38
  ];
  const noCoordSplit = [60, 38];

  let splitIdx = 0;
  let cityCount = 0;

  for (let k = 0; k < DDD65_NO_COORD_COUNT; k += 1) {
    if (cityCount >= noCoordSplit[splitIdx] && splitIdx < noCoordSplit.length - 1) {
      splitIdx += 1;
      cityCount = 0;
    }
    const profile = noCoordCities[splitIdx];
    const streetIdx = k % profile.streets.length;
    const neighIdx = k % profile.neighborhoods.length;
    const priorityIdx = id % DDD65_PRIORITIES.length;

    customers.push({
      id,
      client_id: `SIM-${pad(id)}`,
      name: `${COMPANY_PREFIX[id % COMPANY_PREFIX.length]} ${COMPANY_SUFFIX[(id * 3) % COMPANY_SUFFIX.length]} ${pad(id, 4)}`,
      phone: `659${String(10000000 + id).slice(-8)}`,
      ddd: '65',
      cpf_cnpj: generateCpf(id),
      address: `${profile.streets[streetIdx]} ${((k % 35) + 1)}`,
      number: String((k % 900) + 100),
      neighborhood: profile.neighborhoods[neighIdx],
      city: profile.city,
      state: profile.state,
      zip_code: `78${String(100 + ((k * 37) % 899)).padStart(3, '0')}-${String((k * 19) % 1000).padStart(3, '0')}`,
      lat: null,
      lon: null,
      status: 'SEM_COORDENADA',
      eligible_for_routing: false,
      last_visit_at: daysAgoIso(30 + (k % 60)),
      territory_code: DDD65_DRIVER_TERRITORY[profile.drivers[k % profile.drivers.length]],
      seller_name: DDD65_SELLERS[k % DDD65_SELLERS.length],
      region_key: 'MT-65',
      density_profile: profile.density,
      access_mode: null,
      geocode_source: 'UNRESOLVED',
      driver_base: profile.drivers[k % profile.drivers.length],
      priority: DDD65_PRIORITIES[priorityIdx],
      last_updated: daysAgoIso(k % 10),
      created_at: daysAgoIso(60 + (k % 120)),
      notes: 'Endereco sem geocodificacao.',
    });
    id += 1;
    cityCount += 1;
  }

  return {
    customers,
    summary: summarize(customers),
  };
}

module.exports = {
  generateOperationalScenario,
  generateDdd65Scenario,
  buildOperationalInsights,
};
