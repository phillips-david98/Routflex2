import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell,
} from 'recharts';
import {
  Activity, MapPin, Users, CheckCircle, AlertTriangle, RefreshCw,
  Target, Navigation, Crosshair, Globe, Shield, Truck, TrendingDown,
  Map as MapIcon, Layers,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import { customersApi } from '../services/api.js';
import { useSession } from '../contexts/SessionContext.jsx';

// ── Score theming ───────────────────────────────────────────────────────────
function getScoreTheme(score) {
  if (score >= 80) return { color: '#00C896', bg: '#E6FBF5', text: '#00695C', label: 'Excelente' };
  if (score >= 60) return { color: '#FFB300', bg: '#FFF8E1', text: '#E65100', label: 'Atenção' };
  return { color: '#FF4757', bg: '#FFF0F1', text: '#C62828', label: 'Crítico' };
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, suffix, icon: Icon, color, bg, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: bg }}>
        <Icon size={18} color={color} />
      </div>
      <div className="stat-card-value">
        {value ?? '—'}
        {suffix && <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 2 }}>{suffix}</span>}
      </div>
      <div className="stat-card-label">{label}</div>
      {detail && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{detail}</div>}
    </div>
  );
}

// ── Progress Bar ────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color, height = 6 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ background: 'var(--bg-main)', borderRadius: 99, height, width: '100%', overflow: 'hidden' }}>
      <div style={{ background: color, height: '100%', width: `${pct}%`, borderRadius: 99, transition: 'width .3s ease' }} />
    </div>
  );
}

// ── Insight Alert ───────────────────────────────────────────────────────────
const ALERT_THEMES = {
  critical: { bg: 'var(--error-bg)', border: 'var(--error)', color: '#C62828' },
  warning:  { bg: 'var(--warning-bg)', border: 'var(--warning)', color: '#E65100' },
  info:     { bg: 'var(--info-bg)', border: 'var(--info)', color: '#1565C0' },
  success:  { bg: 'var(--success-bg)', border: 'var(--success)', color: '#00695C' },
};

function InsightAlert({ severity, title, description, metric, icon: Icon }) {
  const t = ALERT_THEMES[severity] || ALERT_THEMES.info;
  return (
    <div style={{
      background: t.bg, borderLeft: `3px solid ${t.border}`, borderRadius: 'var(--radius)',
      padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        {Icon ? <Icon size={16} color={t.color} /> : <AlertTriangle size={16} color={t.color} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: t.color, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: t.color, opacity: 0.85 }}>{description}</div>
        {metric && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, color: t.color }}>{metric}</div>}
      </div>
    </div>
  );
}

// ── Territory code display ───────────────────────────────────────────────
// Persisted format: 'MT-65-01' (canonical, from territory_code field)
// Display format:   'MT 65 - 01'
// Fallback: legacy data without territory_code infers from seller_name regex.
function deriveTerritory(customer) {
  const direct = customer?.territory_code;
  const raw = String(direct || customer?.seller_name || '').trim();
  if (!raw) return { code: 'Sem território', label: 'Sem território' };
  const m = raw.match(/^([A-Z]{2})[\s-]*(\d{2,3})[\s-]*(\d{1,2})$/);
  if (m) {
    const code = `${m[1]}-${m[2]}-${m[3].padStart(2, '0')}`;
    const label = `${m[1]} ${m[2]} - ${m[3].padStart(2, '0')}`;
    return { code, label };
  }
  // Legacy fallback: letter-based codes (MT-65-A → MT 65 - 01)
  const mLetter = raw.match(/^([A-Z]{2})[\s-]*(\d{2,3})[\s-]*([A-Za-z])$/);
  if (mLetter) {
    const seq = String(mLetter[3].toUpperCase().charCodeAt(0) - 64).padStart(2, '0');
    const code = `${mLetter[1]}-${mLetter[2]}-${seq}`;
    const label = `${mLetter[1]} ${mLetter[2]} - ${seq}`;
    return { code, label };
  }
  return { code: raw, label: raw };
}

// ── Score computation ───────────────────────────────────────────────────────
// Weighted composite: geocoding 35% + active ratio 25% + routing eligibility 25% + workload balance 15%
function computeScore(metrics) {
  const { total, ativos, semCoordenada, aptos, territoryCv } = metrics;
  if (total === 0) return { total: 0, geo: 0, active: 0, routing: 0, balance: 0 };

  const geo     = ((total - semCoordenada) / total) * 35;
  const active  = (ativos / total) * 25;
  const routing = (aptos / total) * 25;
  const balance = territoryCv !== null ? Math.max(0, (1 - territoryCv) * 15) : 7.5;

  return {
    total:   Math.round(geo + active + routing + balance),
    geo:     Math.round((geo / 35) * 100),
    active:  Math.round((active / 25) * 100),
    routing: Math.round((routing / 25) * 100),
    balance: Math.round((balance / 15) * 100),
  };
}

// ── Custom Bar Tooltip ──────────────────────────────────────────────────────
const BarTooltipContent = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
      padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, color: p.fill || p.color }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill || p.color, display: 'inline-block' }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function ControlTower() {
  const { activeSession } = useSession();
  const activeSessionId = activeSession?.id;
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Data fetch (same pattern as Dashboard) ──────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setCustomers([]);

    if (!activeSessionId) { setLoading(false); return; }

    try {
      const PAGE_SIZE = 200;
      let allItems = [];
      let currentPage = 1;
      let totalPages = 1;

      const first = await customersApi.list({ per_page: PAGE_SIZE, page: 1 });
      const firstItems = Array.isArray(first?.items) ? first.items : (Array.isArray(first) ? first : []);
      allItems.push(...firstItems);
      if (typeof first?.pages === 'number') totalPages = first.pages;
      else if (typeof first?.total === 'number') totalPages = Math.ceil(first.total / PAGE_SIZE);
      if (firstItems.length < PAGE_SIZE) totalPages = 1;
      currentPage = 2;

      while (currentPage <= totalPages) {
        const payload = await customersApi.list({ per_page: PAGE_SIZE, page: currentPage });
        const items = Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload) ? payload : []);
        allItems.push(...items);
        if (typeof payload?.pages === 'number') totalPages = payload.pages;
        else if (typeof payload?.total === 'number') totalPages = Math.ceil(payload.total / PAGE_SIZE);
        else break;
        if (items.length < PAGE_SIZE) break;
        currentPage += 1;
      }

      setCustomers(allItems);
    } catch (err) {
      console.error('[ControlTower] load error:', err);
      setError('Não foi possível carregar os dados. Verifique se o backend CRM está rodando na porta 3001.');
    } finally {
      setLoading(false);
    }
  }, [activeSessionId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived metrics ─────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = customers.length;
    const ativos = customers.filter(c => String(c?.status || '').toUpperCase() === 'ATIVO').length;
    const inativos = customers.filter(c => String(c?.status || '').toUpperCase() === 'INATIVO').length;
    const semCoordenada = customers.filter(c => String(c?.status || '').toUpperCase() === 'SEM_COORDENADA').length;
    const aptos = customers.filter(c => Boolean(c?.eligible_for_routing)).length;
    const comCoord = customers.filter(c => c?.lat != null && c?.lon != null).length;

    const byDdd = new Map();
    const byCity = new Map();
    const byTerritory = new Map();

    customers.forEach(c => {
      const ddd = String(c?.ddd || 'SEM');
      const cityName = c?.city || 'Sem cidade';
      const stateName = c?.state || '--';
      const cityKey = `${cityName}/${stateName}`;
      const { code: territoryCode, label: territoryLabel } = deriveTerritory(c);
      const status = String(c?.status || '').toUpperCase();
      const eligible = Boolean(c?.eligible_for_routing);
      const hasCoord = c?.lat != null && c?.lon != null;

      // DDD grouping
      if (!byDdd.has(ddd)) byDdd.set(ddd, { ddd, total: 0, ativos: 0, inativos: 0, semCoord: 0, aptos: 0 });
      const dddRow = byDdd.get(ddd);
      dddRow.total++;
      if (status === 'ATIVO') dddRow.ativos++;
      if (status === 'INATIVO') dddRow.inativos++;
      if (status === 'SEM_COORDENADA') dddRow.semCoord++;
      if (eligible) dddRow.aptos++;

      // City grouping
      if (!byCity.has(cityKey)) byCity.set(cityKey, { cityKey, cityName, state: stateName, ddd, total: 0, ativos: 0, inativos: 0, semCoord: 0 });
      const cityRow = byCity.get(cityKey);
      cityRow.total++;
      if (status === 'ATIVO') cityRow.ativos++;
      if (status === 'INATIVO') cityRow.inativos++;
      if (!hasCoord) cityRow.semCoord++;

      // Territory grouping
      if (!byTerritory.has(territoryCode)) byTerritory.set(territoryCode, { code: territoryCode, label: territoryLabel, total: 0, ativos: 0, aptos: 0, inativos: 0, semCoord: 0 });
      const tRow = byTerritory.get(territoryCode);
      tRow.total++;
      if (status === 'ATIVO') tRow.ativos++;
      if (status === 'INATIVO') tRow.inativos++;
      if (status === 'SEM_COORDENADA') tRow.semCoord++;
      if (eligible) tRow.aptos++;
    });

    const territoryArray = Array.from(byTerritory.values()).sort((a, b) => b.total - a.total);
    const dddArray = Array.from(byDdd.values()).sort((a, b) => b.total - a.total);
    const cityArray = Array.from(byCity.values()).sort((a, b) => b.total - a.total);

    // Coefficient of variation for territory workload balance
    let territoryCv = null;
    if (territoryArray.length > 1) {
      const loads = territoryArray.map(t => t.total);
      const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
      if (mean > 0) {
        const variance = loads.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / loads.length;
        territoryCv = Math.sqrt(variance) / mean;
      }
    }

    const topTerritoryPct = territoryArray.length > 0 && total > 0
      ? Math.round((territoryArray[0].total / total) * 100)
      : 0;

    const geocodingPct = total > 0 ? Math.round((comCoord / total) * 100) : 0;
    const activeDdds = dddArray.filter(d => d.ddd !== 'SEM' && d.total > 0).length;

    return {
      total, ativos, inativos, semCoordenada, aptos, comCoord,
      geocodingPct, activeDdds, topTerritoryPct, territoryCv,
      byDdd: dddArray,
      byCity: cityArray,
      byTerritory: territoryArray,
    };
  }, [customers]);

  const score = useMemo(() => computeScore(metrics), [metrics]);
  const theme = getScoreTheme(score.total);

  // ── Smart alerts (deterministic rules) ──────────────────────────────────
  const alerts = useMemo(() => {
    const result = [];
    const { total, geocodingPct, aptos, semCoordenada, inativos, byTerritory, byDdd } = metrics;
    if (total === 0) return result;

    // Geocoding coverage
    if (geocodingPct < 80) {
      result.push({
        severity: 'critical', icon: Crosshair,
        title: 'Cobertura de geocodificação crítica',
        description: `Apenas ${geocodingPct}% dos clientes possuem coordenadas. Isso impacta diretamente a capacidade de roteirização.`,
        metric: `${semCoordenada} clientes sem coordenadas`,
      });
    } else if (geocodingPct < 95) {
      result.push({
        severity: 'warning', icon: Crosshair,
        title: 'Coordenadas incompletas',
        description: `${100 - geocodingPct}% da base ainda não possui coordenadas válidas. Tratamento recomendado antes da próxima roteirização.`,
        metric: `${semCoordenada} pendentes de geocodificação`,
      });
    }

    // Routing eligibility
    const eligPct = Math.round((aptos / total) * 100);
    if (eligPct < 60) {
      result.push({
        severity: 'critical', icon: Target,
        title: 'Base com baixa elegibilidade para rota',
        description: `Apenas ${eligPct}% dos clientes estão aptos para roteirização. Verifique dados faltantes, status inativos e coordenadas.`,
        metric: `${aptos} de ${total} elegíveis`,
      });
    }

    // Inactivity rate
    const inactivePct = Math.round((inativos / total) * 100);
    if (inactivePct > 20) {
      result.push({
        severity: 'warning', icon: TrendingDown,
        title: 'Alta taxa de inatividade',
        description: `${inactivePct}% da base está inativa. Considere revisão de cadastro ou campanha de reativação.`,
        metric: `${inativos} clientes inativos`,
      });
    }

    // Workload imbalance
    if (byTerritory.length > 1) {
      const loads = byTerritory.map(t => t.total);
      const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
      const overloaded = byTerritory.filter(t => t.total > avg * 1.5);
      if (overloaded.length > 0) {
        result.push({
          severity: 'warning', icon: Truck,
          title: 'Desequilíbrio territorial detectado',
          description: `${overloaded.length} território(s) com carga acima de 150% da média (${Math.round(avg)} clientes/território).`,
          metric: overloaded.slice(0, 3).map(t => `${t.label}: ${t.total}`).join(' · '),
        });
      }
    }

    // DDD health
    const problemDdds = byDdd.filter(d => {
      const problemPct = d.total > 0 ? ((d.inativos + d.semCoord) / d.total) * 100 : 0;
      return problemPct > 40 && d.total > 5;
    });
    if (problemDdds.length > 0) {
      result.push({
        severity: 'warning', icon: Globe,
        title: 'DDDs com alta proporção de problemas',
        description: `${problemDdds.length} DDD(s) com mais de 40% de clientes inativos ou sem coordenada.`,
        metric: problemDdds.slice(0, 4).map(d => `DDD ${d.ddd}`).join(', '),
      });
    }

    // Success state
    if (score.total >= 80 && result.length === 0) {
      result.push({
        severity: 'success', icon: Shield,
        title: 'Base operacional saudável',
        description: `Score operacional de ${score.total}/100. A base está em boas condições para roteirização.`,
      });
    }

    // Sort: critical → warning → info → success
    const order = { critical: 0, warning: 1, info: 2, success: 3 };
    result.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
    return result;
  }, [metrics, score]);

  // ── Derived view data ───────────────────────────────────────────────────
  const topCities = metrics.byCity.slice(0, 10);
  const dddHealth = metrics.byDdd.filter(d => d.ddd !== 'SEM').slice(0, 12);
  const territoryRanking = metrics.byTerritory.slice(0, 10);
  const avgTerritoryLoad = metrics.byTerritory.length > 0
    ? Math.round(metrics.total / metrics.byTerritory.length)
    : 0;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header
        title="Torre de Controle"
        subtitle="Inteligência operacional e prontidão logística"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Atualizar
          </button>
        }
      />

      <div className="page-body">
        {loading ? (
          <div className="loading-overlay"><span className="spinner" /> Carregando dados operacionais…</div>
        ) : error ? (
          <div className="empty-state">
            <AlertTriangle size={40} />
            <strong>Falha ao carregar dados</strong>
            <p>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={load}>Tentar novamente</button>
          </div>
        ) : !activeSessionId ? (
          <div className="empty-state">
            <Navigation size={40} />
            <strong>Selecione uma região</strong>
            <p>Escolha uma sessão/região na barra lateral para visualizar a inteligência operacional.</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <Activity size={40} />
            <strong>Sem dados para esta região</strong>
            <p>Nenhum cliente encontrado para a sessão selecionada.</p>
          </div>
        ) : (
          <>
            {/* ════════════════════════════════════════════════════════════
                1. Executive KPI Strip
            ════════════════════════════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 24 }}>
              <KpiCard
                label="Base Operacional"
                value={metrics.total}
                icon={Users}
                color="#1E3A6E" bg="#EEF2FF"
              />
              <KpiCard
                label="Cobertura Geo"
                value={metrics.geocodingPct}
                suffix="%"
                icon={Crosshair}
                color={metrics.geocodingPct >= 90 ? '#00695C' : '#E65100'}
                bg={metrics.geocodingPct >= 90 ? '#E6FBF5' : '#FFF8E1'}
                detail={`${metrics.comCoord} geolocalizados`}
              />
              <KpiCard
                label="Aptos p/ Rota"
                value={metrics.aptos}
                icon={Target}
                color="#00695C" bg="#E6FBF5"
                detail={`${metrics.total > 0 ? Math.round((metrics.aptos / metrics.total) * 100) : 0}% da base`}
              />
              <KpiCard
                label="Sem Coordenada"
                value={metrics.semCoordenada}
                icon={MapPin}
                color="#E65100" bg="#FFF8E1"
              />
              <KpiCard
                label="DDDs Ativos"
                value={metrics.activeDdds}
                icon={Globe}
                color="#1565C0" bg="#E3F2FD"
              />
              <KpiCard
                label="Score Operacional"
                value={score.total}
                suffix="/100"
                icon={Shield}
                color={theme.color}
                bg={theme.bg}
                detail={theme.label}
              />
            </div>

            {/* ════════════════════════════════════════════════════════════
                2. Routing Readiness Panel
            ════════════════════════════════════════════════════════════ */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Truck size={16} color="var(--accent)" />
                  Prontidão para Roteirização
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                  background: theme.bg, color: theme.text,
                }}>
                  {theme.label}
                </span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32, alignItems: 'center' }}>
                  {/* Score circle */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 140, height: 140, borderRadius: '50%',
                      border: `8px solid ${theme.color}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto', background: theme.bg,
                    }}>
                      <div style={{ fontSize: 36, fontWeight: 900, color: theme.color, lineHeight: 1 }}>{score.total}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>de 100</div>
                    </div>
                  </div>

                  {/* Score breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {[
                      { label: 'Geocodificação', value: score.geo, weight: '35%', color: '#00C896' },
                      { label: 'Clientes ativos', value: score.active, weight: '25%', color: '#1565C0' },
                      { label: 'Elegibilidade rota', value: score.routing, weight: '25%', color: '#FF6B2C' },
                      { label: 'Equilíbrio territorial', value: score.balance, weight: '15%', color: '#7C4DFF' },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{item.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}%</span>
                        </div>
                        <ProgressBar value={item.value} max={100} color={item.color} />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>peso: {item.weight}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Readiness summary strip */}
                <div style={{
                  display: 'flex', gap: 24, marginTop: 24, paddingTop: 16,
                  borderTop: '1px solid var(--border)', justifyContent: 'center', flexWrap: 'wrap',
                }}>
                  {[
                    { label: 'Elegíveis', value: metrics.aptos, total: metrics.total, color: '#00C896' },
                    { label: 'Sem coordenada', value: metrics.semCoordenada, total: metrics.total, color: '#FFB300' },
                    { label: 'Inativos', value: metrics.inativos, total: metrics.total, color: '#FF4757' },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center', minWidth: 100 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {item.label} ({item.total > 0 ? Math.round((item.value / item.total) * 100) : 0}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════
                3. Geographic Intelligence + DDD Health
            ════════════════════════════════════════════════════════════ */}
            <div className="charts-row" style={{ marginBottom: 24 }}>
              {/* Top Cities Table */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={16} color="var(--primary)" />
                    Concentração por Cidade
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top 10</span>
                </div>
                {topCities.length === 0 ? (
                  <div className="empty-state" style={{ minHeight: 180 }}><strong>Sem dados geográficos</strong></div>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Cidade / UF</th>
                          <th>DDD</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'right' }}>Ativos</th>
                          <th style={{ textAlign: 'right' }}>S/ Coord.</th>
                          <th style={{ width: 80 }}>Saúde</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topCities.map((row, i) => {
                          const healthPct = row.total > 0 ? Math.round((row.ativos / row.total) * 100) : 0;
                          return (
                            <tr key={row.cityKey}>
                              <td style={{ fontWeight: 600, fontSize: 12 }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: 10, marginRight: 6 }}>#{i + 1}</span>
                                {row.cityName}/{row.state}
                              </td>
                              <td>{row.ddd}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.total}</td>
                              <td style={{ textAlign: 'right', color: '#00695C' }}>{row.ativos}</td>
                              <td style={{ textAlign: 'right', color: row.semCoord > 0 ? '#E65100' : 'var(--text-muted)' }}>{row.semCoord}</td>
                              <td>
                                <ProgressBar
                                  value={healthPct} max={100}
                                  color={healthPct >= 80 ? '#00C896' : healthPct >= 60 ? '#FFB300' : '#FF4757'}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* DDD Health Table */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={16} color="var(--accent)" />
                    Saúde por DDD
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{metrics.activeDdds} regiões</span>
                </div>
                {dddHealth.length === 0 ? (
                  <div className="empty-state" style={{ minHeight: 180 }}><strong>Sem dados por DDD</strong></div>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>DDD</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'right' }}>Aptos</th>
                          <th style={{ textAlign: 'right' }}>Problemas</th>
                          <th style={{ width: 110 }}>Elegibilidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dddHealth.map(row => {
                          const eligPct = row.total > 0 ? Math.round((row.aptos / row.total) * 100) : 0;
                          const problems = row.inativos + row.semCoord;
                          return (
                            <tr key={row.ddd}>
                              <td style={{ fontWeight: 700 }}>DDD {row.ddd}</td>
                              <td style={{ textAlign: 'right' }}>{row.total}</td>
                              <td style={{ textAlign: 'right', color: '#00695C' }}>{row.aptos}</td>
                              <td style={{ textAlign: 'right', color: problems > 0 ? '#C62828' : 'var(--text-muted)' }}>{problems}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <ProgressBar
                                    value={eligPct} max={100}
                                    color={eligPct >= 80 ? '#00C896' : eligPct >= 60 ? '#FFB300' : '#FF4757'}
                                  />
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{eligPct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════
                4. Workload Distribution + Geographic Concentration
            ════════════════════════════════════════════════════════════ */}
            <div className="charts-row" style={{ marginBottom: 24 }}>
              {/* Territory Workload */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Truck size={16} color="var(--primary)" />
                    Carga por Território
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Média: {avgTerritoryLoad} clientes/território
                  </span>
                </div>
                <div className="card-body">
                  {territoryRanking.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: 200 }}><strong>Sem dados de território</strong></div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={territoryRanking} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                          <YAxis
                            dataKey="label" type="category"
                            tick={{ fontSize: 10, fill: '#1A1A2E', fontFamily: 'monospace' }} width={100}
                            tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v}
                          />
                          <Tooltip content={<BarTooltipContent />} />
                          <Bar dataKey="total" name="Clientes" radius={[0, 4, 4, 0]}>
                            {territoryRanking.map((entry) => (
                              <Cell
                                key={entry.code}
                                fill={
                                  entry.total > avgTerritoryLoad * 1.5 ? '#FF4757' :
                                  entry.total > avgTerritoryLoad * 1.2 ? '#FFB300' : '#1E3A6E'
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      {avgTerritoryLoad > 0 && (
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1E3A6E', display: 'inline-block' }} /> Normal
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#FFB300', display: 'inline-block' }} /> Acima (+20%)
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#FF4757', display: 'inline-block' }} /> Sobrecarga (+50%)
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* City concentration stacked chart */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} color="var(--accent)" />
                    Composição Geográfica
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top 10 cidades · ativos vs inativos</span>
                </div>
                <div className="card-body">
                  {topCities.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: 200 }}><strong>Sem dados geográficos</strong></div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={topCities.map(c => ({ city: `${c.cityName}/${c.state}`, ativos: c.ativos, inativos: c.inativos }))}
                        margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="city" tick={{ fontSize: 9, fill: '#9CA3AF' }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                        <Tooltip content={<BarTooltipContent />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="ativos" name="Ativos" fill="#00C896" stackId="a" />
                        <Bar dataKey="inativos" name="Inativos" fill="#FF4757" stackId="a" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════
                5. Smart Analysis
            ════════════════════════════════════════════════════════════ */}
            {alerts.length > 0 && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} color="var(--accent)" />
                    Análise Operacional Inteligente
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {alerts.filter(a => a.severity === 'critical').length > 0 &&
                      `${alerts.filter(a => a.severity === 'critical').length} crítico(s)`}
                    {alerts.filter(a => a.severity === 'critical').length > 0 && alerts.filter(a => a.severity === 'warning').length > 0 && ' · '}
                    {alerts.filter(a => a.severity === 'warning').length > 0 &&
                      `${alerts.filter(a => a.severity === 'warning').length} alerta(s)`}
                  </span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {alerts.map((alert, i) => <InsightAlert key={i} {...alert} />)}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                6. Geographic Visualization Placeholder
            ════════════════════════════════════════════════════════════ */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapIcon size={16} color="var(--primary)" />
                  Inteligência Geográfica
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                  background: '#E3F2FD', color: '#1565C0',
                }}>EM BREVE</span>
              </div>
              <div className="card-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #EEF2FF 0%, #E3F2FD 50%, #E6FBF5 100%)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '48px 24px',
                  border: '2px dashed var(--border)',
                }}>
                  <MapIcon size={48} color="#9CA3AF" style={{ opacity: 0.4, marginBottom: 12 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Mapa de Calor Operacional
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
                    Visualização geográfica com heatmap de concentração de clientes,
                    densidade por região e indicadores de cobertura territorial.
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20 }}>
                    {[
                      { label: 'Cidades mapeadas', value: metrics.byCity.length },
                      { label: 'DDDs cobertos', value: metrics.activeDdds },
                      { label: 'Clientes geolocalizados', value: metrics.comCoord },
                    ].map(item => (
                      <div key={item.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#1E3A6E' }}>{item.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
