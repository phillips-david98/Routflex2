// ROUTflex — Configuration & Constants
// Extracted from map.html — Phase 3 Wave 1

const days = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];
const dayColors = {
  SEG: '#e74c3c',
  TER: '#ff66b2',
  QUA: '#3498db',
  QUI: '#2ecc71',
  SEX: '#e67e22',
  SAB: '#f1c40f',
  DOM: '#95a5a6'
};
const weekCycleColors = {
  1: '#ff4fa3',
  2: '#3b82f6',
  3: '#22c55e',
  4: '#8b5a2b',
  5: '#eab308',
  6: '#a855f7',
  7: '#ef4444',
  8: '#111111'
};
const vehicleColors = {
  carro: '#3498db',
  moto: '#e74c3c',
  pickup: '#e67e22',
  pesado: '#8e44ad',
  eletrico: '#2ecc71'
};
function colorForVehicle(vehicle) {
  return vehicleColors[vehicle] || '#95a5a6';
}
const driverTerritoryPalette = ['#d84a4a', '#2f63d6', '#3a9f4f', '#7a5a3a', '#7a45b6'];
const dddRegions = {
  38: 'Montes Claros e Norte de Minas',
  61: 'Brasilia',
  62: 'Anapolis',
  64: 'Rio Verde',
  65: 'Cuiaba',
  66: 'Tangara da Serra',
  93: 'Santarem e Baixo Amazonas'
};
const dddStates = {
  38: 'MG',
  61: 'DF',
  62: 'GO',
  64: 'GO',
  65: 'MT',
  66: 'MT',
  93: 'PA'
};
const dddSpecificReferenceBases = {
  31: { city: 'Belo Horizonte', neighborhood: 'Centro', address: 'Base Referência DDD 31', lat: -19.9167, lon: -43.9345, vehicle: 'carro' },
  38: { city: 'Montes Claros', neighborhood: 'Centro', address: 'Base Referência DDD 38', lat: -16.7364, lon: -43.8617, vehicle: 'carro' },
  62: { city: 'Goiania', neighborhood: 'Setor Sul', address: 'Base Referência DDD 62', lat: -16.6869, lon: -49.2648, vehicle: 'pickup' },
  91: { city: 'Belem', neighborhood: 'Nazare', address: 'Base Referência DDD 91', lat: -1.4558, lon: -48.5039, vehicle: 'carro' },
  93: { city: 'Santarem', neighborhood: 'Centro', address: 'Base Referência DDD 93', lat: -2.4385, lon: -54.6996, vehicle: 'carro' },
  94: { city: 'Maraba', neighborhood: 'Cidade Nova', address: 'Base Referência DDD 94', lat: -5.3817, lon: -49.1322, vehicle: 'carro' },
  95: { city: 'Boa Vista', neighborhood: 'Centro', address: 'Base Referência DDD 95', lat: 2.8235, lon: -60.6758, vehicle: 'carro' },
  96: { city: 'Macapa', neighborhood: 'Centro', address: 'Base Referência DDD 96', lat: 0.0349, lon: -51.0694, vehicle: 'carro' }
};
const stateCapitalBases = {
  AC: { city: 'Rio Branco', neighborhood: 'Centro', lat: -9.97499, lon: -67.8243, vehicle: 'carro' },
  AL: { city: 'Maceio', neighborhood: 'Centro', lat: -9.64985, lon: -35.7089, vehicle: 'carro' },
  AP: { city: 'Macapa', neighborhood: 'Centro', lat: 0.0349, lon: -51.0694, vehicle: 'carro' },
  AM: { city: 'Manaus', neighborhood: 'Centro', lat: -3.11903, lon: -60.0217, vehicle: 'carro' },
  BA: { city: 'Salvador', neighborhood: 'Centro', lat: -12.9714, lon: -38.5014, vehicle: 'carro' },
  CE: { city: 'Fortaleza', neighborhood: 'Centro', lat: -3.73186, lon: -38.5267, vehicle: 'carro' },
  DF: { city: 'Brasilia', neighborhood: 'Plano Piloto', lat: -15.7939, lon: -47.8828, vehicle: 'carro' },
  ES: { city: 'Vitoria', neighborhood: 'Centro', lat: -20.3155, lon: -40.3128, vehicle: 'carro' },
  GO: { city: 'Goiania', neighborhood: 'Setor Central', lat: -16.6869, lon: -49.2648, vehicle: 'carro' },
  MA: { city: 'Sao Luis', neighborhood: 'Centro', lat: -2.53073, lon: -44.3068, vehicle: 'carro' },
  MG: { city: 'Belo Horizonte', neighborhood: 'Centro', lat: -19.9167, lon: -43.9345, vehicle: 'carro' },
  MS: { city: 'Campo Grande', neighborhood: 'Centro', lat: -20.4697, lon: -54.6201, vehicle: 'carro' },
  MT: { city: 'Cuiaba', neighborhood: 'Centro', lat: -15.6014, lon: -56.0979, vehicle: 'carro' },
  PA: { city: 'Belem', neighborhood: 'Nazare', lat: -1.4558, lon: -48.5039, vehicle: 'carro' },
  PB: { city: 'Joao Pessoa', neighborhood: 'Centro', lat: -7.1195, lon: -34.845, vehicle: 'carro' },
  PE: { city: 'Recife', neighborhood: 'Centro', lat: -8.04756, lon: -34.877, vehicle: 'carro' },
  PI: { city: 'Teresina', neighborhood: 'Centro', lat: -5.08921, lon: -42.8016, vehicle: 'carro' },
  PR: { city: 'Curitiba', neighborhood: 'Centro', lat: -25.4284, lon: -49.2733, vehicle: 'carro' },
  RJ: { city: 'Rio de Janeiro', neighborhood: 'Centro', lat: -22.9068, lon: -43.1729, vehicle: 'carro' },
  RN: { city: 'Natal', neighborhood: 'Centro', lat: -5.79448, lon: -35.211, vehicle: 'carro' },
  RO: { city: 'Porto Velho', neighborhood: 'Centro', lat: -8.76194, lon: -63.9039, vehicle: 'carro' },
  RR: { city: 'Boa Vista', neighborhood: 'Centro', lat: 2.8235, lon: -60.6758, vehicle: 'carro' },
  RS: { city: 'Porto Alegre', neighborhood: 'Centro', lat: -30.0346, lon: -51.2177, vehicle: 'carro' },
  SC: { city: 'Florianopolis', neighborhood: 'Centro', lat: -27.5949, lon: -48.5482, vehicle: 'carro' },
  SE: { city: 'Aracaju', neighborhood: 'Centro', lat: -10.9472, lon: -37.0731, vehicle: 'carro' },
  SP: { city: 'Sao Paulo', neighborhood: 'Centro', lat: -23.5505, lon: -46.6333, vehicle: 'carro' },
  TO: { city: 'Palmas', neighborhood: 'Plano Diretor', lat: -10.2491, lon: -48.3243, vehicle: 'carro' }
};

function getReferenceBaseByDDD(ddd) {
  const code = Number(ddd);
  if (!Number.isFinite(code)) return null;

  const specific = dddSpecificReferenceBases[code];
  if (specific) {
    return { ...specific };
  }

  const uf = inferStateCodeByDDD(code);
  const capitalBase = stateCapitalBases[uf];
  if (!capitalBase) return null;

  return {
    city: capitalBase.city,
    neighborhood: capitalBase.neighborhood,
    address: `Base Referência DDD ${code}`,
    lat: capitalBase.lat,
    lon: capitalBase.lon,
    vehicle: capitalBase.vehicle || 'carro'
  };
}
const stateLabels = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapa',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceara',
  DF: 'Brasilia',
  ES: 'Espirito Santo',
  GO: 'Goias',
  MA: 'Maranhao',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Para',
  PB: 'Paraiba',
  PR: 'Parana',
  PE: 'Pernambuco',
  PI: 'Piaui',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondonia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'Sao Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
  BR: 'Brasil'
};

function inferStateCodeByDDD(ddd) {
  const code = Number(ddd);
  if (!Number.isFinite(code)) return 'BR';

  if (code >= 11 && code <= 19) return 'SP';
  if ([21, 22, 24].includes(code)) return 'RJ';
  if ([27, 28].includes(code)) return 'ES';
  if (code >= 31 && code <= 38) return 'MG';
  if (code >= 41 && code <= 46) return 'PR';
  if (code >= 47 && code <= 49) return 'SC';
  if ([51, 53, 54, 55].includes(code)) return 'RS';
  if (code === 61) return 'DF';
  if ([62, 64].includes(code)) return 'GO';
  if (code === 63) return 'TO';
  if ([65, 66].includes(code)) return 'MT';
  if (code === 67) return 'MS';
  if (code === 68) return 'AC';
  if (code === 69) return 'RO';
  if ([71, 73, 74, 75, 77].includes(code)) return 'BA';
  if (code === 79) return 'SE';
  if ([81, 87].includes(code)) return 'PE';
  if (code === 82) return 'AL';
  if (code === 83) return 'PB';
  if (code === 84) return 'RN';
  if ([85, 88].includes(code)) return 'CE';
  if ([86, 89].includes(code)) return 'PI';
  if ([91, 93, 94].includes(code)) return 'PA';
  if ([92, 97].includes(code)) return 'AM';
  if (code === 95) return 'RR';
  if (code === 96) return 'AP';
  if ([98, 99].includes(code)) return 'MA';
  return 'BR';
}

function inferRegionLabelByDDD(ddd) {
  const uf = inferStateCodeByDDD(ddd);
  return stateLabels[uf] || 'Nova sessão';
}
const driverBases = {
  61: { city: 'Brasilia', neighborhood: 'Asa Sul', address: 'SQS Operacional 61', lat: -15.7801, lon: -47.9292, vehicle: 'carro' },
  62: { city: 'Anapolis', neighborhood: 'Jundiai', address: 'Rua dos Condutores 62', lat: -16.3265, lon: -48.9522, vehicle: 'pickup' },
  64: { city: 'Rio Verde', neighborhood: 'Setor Central', address: 'Avenida das Rotas 64', lat: -17.7927, lon: -50.9192, vehicle: 'pesado' },
  65: { city: 'Cuiaba', neighborhood: 'Jardim Cuiaba', address: 'Rua da Base 65', lat: -15.6014, lon: -56.0979, vehicle: 'moto' },
  66: { city: 'Tangara da Serra', neighborhood: 'Centro', address: 'Travessa Operacional 66', lat: -14.6229, lon: -57.4932, vehicle: 'carro' }
};
const territories = ['urbano', 'interior', 'rodovia', 'fronteira'];
const priorities = ['Alta', 'Media', 'Baixa'];
const windows = ['08:00-10:00', '10:00-12:00', '13:00-15:00', '15:00-18:00'];
const dddDriverSlots = {
  65: 6
};
const MAX_WEEKS = 8;
const MAX_MAP_RENDER_POINTS = 3000;
const LARGE_DATASET_THRESHOLD = 800;
const VIEWPORT_BOUNDS_PAD_FACTOR = 0.35;
const VIEWPORT_REFRESH_DEBOUNCE_MS = 500;
const MARKER_BATCH_SIZE = 500;
const MARKER_BATCH_DELAY_MS = 16;
const LASSO_ROUTE_MAX_DISTANCE = 22;
const LASSO_ROUTE_AMBIGUITY_GAP = 8;

const PLAN_SAVE_STORAGE_KEY = 'ROUTflex:manual-plan:v1';
const BACKEND_API_BASE = window.location.protocol === 'file:'
  ? 'http://127.0.0.1:8000'
  : `${window.location.protocol}//${window.location.hostname || '127.0.0.1'}:8000`;
const pageSearchParams = new URLSearchParams(window.location.search);
const CRM_DASHBOARD_OVERRIDE_URL = pageSearchParams.get('crm_url');
const ROUTFLEX_RUNTIME_CONFIG = window.ROUTFLEX_RUNTIME_CONFIG || window.ROUTFLEX_CONFIG || {};
const CRM_URL = CRM_DASHBOARD_OVERRIDE_URL
  || ROUTFLEX_RUNTIME_CONFIG.crmDashboardUrl
  || ROUTFLEX_RUNTIME_CONFIG.crmUrl
  || window.__ROUTFLEX_CRM_URL__
  || 'http://localhost:5173/';
const CRM_API_BASE = ROUTFLEX_RUNTIME_CONFIG.crmApiUrl
  || window.__ROUTFLEX_CRM_API_URL__
  || `${window.location.protocol}//${window.location.hostname || '127.0.0.1'}:3001`;
