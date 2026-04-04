import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Users, CheckCircle, XCircle, MapPin, RefreshCw, AlertTriangle, TrendingUp, Send } from 'lucide-react';
import Header from '../components/Header.jsx';
import { customersApi } from '../services/api.js';
import { useSession } from '../contexts/SessionContext.jsx';

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: bg }}>
        <Icon size={18} color={color} />
      </div>
      <div className="stat-card-value">{value ?? '—'}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>DDD {label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, color: p.fill }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill, display: 'inline-block' }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const STATUS_PIE_COLORS = ['#00C896', '#FF4757', '#FFB300'];

const STATUS_LABELS = {
  ATIVO: 'Ativos',
  INATIVO: 'Inativos',
  SEM_COORDENADA: 'Sem coordenada',
  PENDENTE_INTEGRACAO: 'Pendente integração',
};

const STATUS_COLORS = {
  ATIVO: '#00C896',
  INATIVO: '#FF4757',
  SEM_COORDENADA: '#FFB300',
  PENDENTE_INTEGRACAO: '#1565C0',
};

function toIsoDate(value) {
  if (!value) return null;
  const text = String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  if (!match) return null;
  return match[0];
}

function formatDatePtBr(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function extractCustomerDate(customer) {
  return toIsoDate(
    customer?.route_date
      || customer?.routeDate
      || customer?.date
      || customer?.last_visit_at
      || customer?.last_updated
      || customer?.created_at
      || null
  );
}

function buildDerivedDddDistribution(customers) {
  const grouped = new Map();
  customers.forEach((customer) => {
    const ddd = String(customer?.ddd || 'SEM_DDD');
    if (!grouped.has(ddd)) {
      grouped.set(ddd, {
        ddd,
        total: 0,
        ativos: 0,
        inativos: 0,
        sem_coordenada: 0,
      });
    }

    const row = grouped.get(ddd);
    row.total += 1;
    const status = String(customer?.status || '').toUpperCase();
    if (status === 'ATIVO') row.ativos += 1;
    else if (status === 'INATIVO') row.inativos += 1;
    else if (status === 'SEM_COORDENADA') row.sem_coordenada += 1;
  });

  return Array.from(grouped.values()).sort((a, b) => Number(a.ddd) - Number(b.ddd));
}

function buildDerivedStatusDistribution(customers) {
  const counts = {
    ATIVO: 0,
    INATIVO: 0,
    SEM_COORDENADA: 0,
    PENDENTE_INTEGRACAO: 0,
  };

  customers.forEach((customer) => {
    const status = String(customer?.status || '').toUpperCase();
    if (Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] += 1;
    }
  });

  return Object.keys(counts)
    .filter((statusKey) => counts[statusKey] > 0)
    .map((statusKey) => ({
      key: statusKey,
      name: STATUS_LABELS[statusKey] || statusKey,
      value: counts[statusKey],
      color: STATUS_COLORS[statusKey] || '#7f8c8d',
    }));
}

function buildDerivedStats(customers, fallbackIntegradosHoje, filtroData) {
  const total = customers.length;
  const ativos = customers.filter((customer) => String(customer?.status || '').toUpperCase() === 'ATIVO').length;
  const inativos = customers.filter((customer) => String(customer?.status || '').toUpperCase() === 'INATIVO').length;
  const semCoordenada = customers.filter((customer) => String(customer?.status || '').toUpperCase() === 'SEM_COORDENADA').length;
  const pendentes = customers.filter((customer) => String(customer?.status || '').toUpperCase() === 'PENDENTE_INTEGRACAO').length;
  const aptos = customers.filter((customer) => Boolean(customer?.eligible_for_routing)).length;
  const naoRoteirizaveis = Math.max(total - aptos, 0);
  const integradosHoje = filtroData
    ? customers.filter((customer) => toIsoDate(customer?.last_updated) === filtroData).length
    : Number(fallbackIntegradosHoje || 0);

  return {
    total,
    ativos,
    inativos,
    sem_coordenada: semCoordenada,
    pendentes,
    aptos,
    nao_roteirizaveis: naoRoteirizaveis,
    integrados_hoje: integradosHoje,
  };
}

export default function Dashboard() {
  const { activeSession } = useSession();
  const activeSessionId = activeSession?.id;
  const [stats, setStats] = useState(null);
  const [dddDist, setDddDist] = useState([]);
  const [statusDist, setStatusDist] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [filtroRegiao, setFiltroRegiao] = useState(null);
  const [filtroData, setFiltroData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const regiaoParam = params.get('regiao');
    const dataParam = params.get('data');

    if (regiaoParam && /^\d{2,3}$/.test(regiaoParam)) {
      setFiltroRegiao(regiaoParam);
    }

    const isoData = toIsoDate(dataParam);
    if (isoData) {
      setFiltroData(isoData);
    }
  }, []);

  const load = useCallback(async () => {
    console.log('[Dashboard] load() called, session:', activeSessionId);
    setLoading(true);
    setError('');

    // Limpar dados anteriores imediatamente para evitar exibição residual de outra região
    setCustomers([]);
    setStats(null);
    setDddDist([]);
    setStatusDist([]);
    setInsights(null);

    try {
      // Sem sessão ativa: dados vazios
      if (!activeSessionId) {
        return;
      }

      // Paginação: carregar todas as páginas do CRM (filtrado por session_id via interceptor)
      const PAGE_SIZE = 200;
      let allItems = [];
      let currentPage = 1;
      let totalPages = 1;

      // Primeira página
      const firstPayload = await customersApi.list({ per_page: PAGE_SIZE, page: 1 });
      const firstItems = Array.isArray(firstPayload?.items) ? firstPayload.items : (Array.isArray(firstPayload) ? firstPayload : []);
      allItems.push(...firstItems);
      if (typeof firstPayload?.pages === 'number') totalPages = firstPayload.pages;
      else if (typeof firstPayload?.total === 'number') totalPages = Math.ceil(firstPayload.total / PAGE_SIZE);
      if (firstItems.length < PAGE_SIZE) totalPages = 1;
      currentPage = 2;

      while (currentPage <= totalPages) {
        const payload = await customersApi.list({ per_page: PAGE_SIZE, page: currentPage });
        const items = Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload) ? payload : []);
        allItems.push(...items);

        if (typeof payload?.pages === 'number') {
          totalPages = payload.pages;
        } else if (typeof payload?.total === 'number') {
          totalPages = Math.ceil(payload.total / PAGE_SIZE);
        } else {
          break;
        }

        if (items.length < PAGE_SIZE) break;
        currentPage += 1;
      }

      setCustomers(allItems);

      const derivedStats = buildDerivedStats(allItems, Math.round(allItems.length * 0.038), null);
      const derivedDdd = buildDerivedDddDistribution(allItems);
      const derivedStatus = buildDerivedStatusDistribution(allItems);

      const groupedBySeller = new Map();
      const groupedByRegion = new Map();
      const groupedByCity = new Map();

      allItems.forEach((customer) => {
        const seller = String(customer?.seller_name || 'Sem vendedor');
        groupedBySeller.set(seller, (groupedBySeller.get(seller) || 0) + 1);

        const ddd = String(customer?.ddd || 'SEM_DDD');
        groupedByRegion.set(ddd, (groupedByRegion.get(ddd) || 0) + 1);

        const cityKey = `${customer?.city || 'Sem cidade'}/${customer?.state || '--'}`;
        if (!groupedByCity.has(cityKey)) {
          groupedByCity.set(cityKey, {
            city: customer?.city || 'Sem cidade',
            state: customer?.state || '--',
            ddd,
            total: 0,
            ativos: 0,
            inativos: 0,
            access_mode: customer?.access_mode || null,
          });
        }
        const row = groupedByCity.get(cityKey);
        row.total += 1;
        if (String(customer?.status || '').toUpperCase() === 'INATIVO') row.inativos += 1;
        else row.ativos += 1;
      });

      const sellerRows = Array.from(groupedBySeller.entries())
        .map(([seller_name, total]) => ({ seller_name, total }))
        .sort((a, b) => b.total - a.total);
      const regionRows = Array.from(groupedByRegion.entries())
        .map(([ddd, total]) => ({ ddd, total }))
        .sort((a, b) => b.total - a.total);
      const cityRows = Array.from(groupedByCity.values()).sort((a, b) => b.total - a.total);

      const avgLoad = sellerRows.length ? (allItems.length / sellerRows.length) : 0;
      const overloaded = sellerRows.filter((row) => row.total > avgLoad * 1.2);
      const critical = cityRows
        .filter((row) => row.access_mode === 'BALSA' || row.inativos > row.total * 0.2)
        .map((row) => ({
          city: row.city,
          state: row.state,
          ddd: row.ddd,
          reason: row.access_mode === 'BALSA' ? 'Acesso com balsa' : 'Alta inatividade local',
          total: row.total,
          inativos: row.inativos,
        }));

      setStats(derivedStats);
      setDddDist(derivedDdd);
      setStatusDist(derivedStatus);
      setInsights({
        summary: {
          total_customers: allItems.length,
          sellers: sellerRows.length,
          regions: regionRows.length,
          avg_customers_per_seller: Number(avgLoad.toFixed(2)),
        },
        customers_by_seller: sellerRows,
        customers_by_region: regionRows,
        density_by_city: cityRows,
        overloaded_sellers: overloaded,
        critical_regions: critical,
        recommendations: [
          'Balancear automaticamente a carteira quando um vendedor exceder 20% da media.',
          'Criar regra de alocacao dedicada para cidades com acesso por balsa.',
          'Mostrar no mapa impacto de troca de vendedor por tempo e distancia.',
          'Habilitar simulacao de redistribuicao com preview antes de confirmar.',
        ],
      });
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
      console.warn('[FLOW crm] CRM API customer load failed');
      setError('Nao foi possivel carregar os dados do CRM. Verifique se o backend CRM esta rodando na porta 3001.');
    } finally {
      setLoading(false);
    }
  }, [activeSessionId]);

  useEffect(() => { load(); }, [load]);

  const customersFiltered = useMemo(() => {
    return customers.filter((customer) => {
      if (filtroRegiao && String(customer?.ddd || '') !== String(filtroRegiao)) {
        return false;
      }

      if (filtroData) {
        const customerDate = extractCustomerDate(customer);
        if (!customerDate || customerDate !== filtroData) {
          return false;
        }
      }

      return true;
    });
  }, [customers, filtroRegiao, filtroData]);

  const hasActiveFilters = Boolean(filtroRegiao || filtroData);

  const effectiveDddDist = useMemo(() => {
    if (!hasActiveFilters) return dddDist;
    return buildDerivedDddDistribution(customersFiltered);
  }, [hasActiveFilters, dddDist, customersFiltered]);

  const effectiveStatusDist = useMemo(() => {
    if (!hasActiveFilters) return statusDist;
    return buildDerivedStatusDistribution(customersFiltered);
  }, [hasActiveFilters, statusDist, customersFiltered]);

  const effectiveStats = useMemo(() => {
    if (!hasActiveFilters) return stats;
    return buildDerivedStats(customersFiltered, stats?.integrados_hoje, filtroData);
  }, [hasActiveFilters, stats, customersFiltered, filtroData]);

  const statusPieData = effectiveStatusDist.map((row) => ({
    name: row.name,
    value: row.value,
    color: row.color,
  }));

  const dddIssues = effectiveDddDist
    .map((d) => ({ ...d, issues: Number(d.inativos || 0) + Number(d.sem_coordenada || 0) }))
    .sort((a, b) => b.issues - a.issues)
    .filter((d) => d.issues > 0);

  const quality = (() => {
    const aptos = Number(effectiveStats?.aptos || 0);
    const total = Number(effectiveStats?.total || 0);
    const naoAptos = Number(effectiveStats?.nao_roteirizaveis || Math.max(total - aptos, 0));
    const pctValidos = total > 0 ? Math.round((aptos / total) * 100) : 0;
    return {
      aptos,
      nao_aptos: naoAptos,
      pct_validos: pctValidos,
      score: pctValidos,
    };
  })();

  const clearFilters = () => {
    setFiltroRegiao(null);
    setFiltroData(null);
  };

  const loadOperationalScenario = async () => {
    setLoadingScenario(true);
    try {
      await load();
    } catch (err) {
      console.error('Erro ao recarregar cenário local:', err);
      setError('Falha ao recarregar dados.');
    } finally {
      setLoadingScenario(false);
    }
  };

  // load() executa apenas:
  // 1) no mount (via useEffect [load])
  // 2) ao trocar região (activeSessionId muda → load recria → effect dispara)
  // 3) ao clicar no botão Atualizar (chama load() diretamente)

  const customersBySeller = useMemo(() => {
    if (Array.isArray(insights?.customers_by_seller) && insights.customers_by_seller.length > 0) {
      return insights.customers_by_seller.slice(0, 12);
    }

    const grouped = new Map();
    customersFiltered.forEach((customer) => {
      const sellerName = String(customer?.seller_name || 'Sem vendedor');
      grouped.set(sellerName, (grouped.get(sellerName) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([seller_name, total]) => ({ seller_name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [insights, customersFiltered]);

  const densityByCity = useMemo(() => {
    if (Array.isArray(insights?.density_by_city) && insights.density_by_city.length > 0) {
      return insights.density_by_city.slice(0, 10).map((row) => ({
        city: `${row.city}/${row.state}`,
        total: row.total,
      }));
    }

    const grouped = new Map();
    customersFiltered.forEach((customer) => {
      const city = String(customer?.city || 'Sem cidade');
      const state = String(customer?.state || '--');
      const key = `${city}/${state}`;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([city, total]) => ({ city, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [insights, customersFiltered]);

  const overloadedSellers = Array.isArray(insights?.overloaded_sellers) ? insights.overloaded_sellers : [];
  const criticalRegions = Array.isArray(insights?.critical_regions) ? insights.critical_regions : [];
  const recommendations = Array.isArray(insights?.recommendations) ? insights.recommendations : [];

  const contextText = [
    filtroRegiao ? `região ${filtroRegiao}` : null,
    filtroData ? formatDatePtBr(filtroData) : null,
  ].filter(Boolean).join(' - ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header
        title="Dashboard"
        subtitle={hasActiveFilters
          ? `Visão filtrada do CRM (${contextText})`
          : 'Visão geral do CRM e inteligência de clientes'}
        actions={
          <>
            {hasActiveFilters && (
              <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
                Limpar filtros
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              Atualizar
            </button>
          </>
        }
      />

      <div className="page-body">
        {hasActiveFilters && (
          <div className="alert-item info" style={{ marginBottom: 20, justifyContent: 'space-between', gap: 12 }}>
            <span>
              Visualizando dados da {filtroRegiao ? `região ${filtroRegiao}` : 'operação'}
              {filtroData ? ` - ${formatDatePtBr(filtroData)}` : ''}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-overlay"><span className="spinner" /> Carregando dados…</div>
        ) : error ? (
          <div className="empty-state">
            <AlertTriangle size={40} />
            <strong>Falha ao carregar dados</strong>
            <p>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={load}>Tentar novamente</button>
          </div>
        ) : (
          <>
            {/* ── Stats Cards ─────────────────────────────────────────── */}
            <div className="stats-row">
              <StatCard label="Total de Clientes"  value={effectiveStats?.total}           icon={Users}       color="#1E3A6E" bg="#EEF2FF" />
              <StatCard label="Clientes Ativos"    value={effectiveStats?.ativos}          icon={CheckCircle} color="#00695C" bg="var(--success-bg)" />
              <StatCard label="Clientes Inativos"  value={effectiveStats?.inativos}        icon={XCircle}     color="#C62828" bg="var(--error-bg)" />
              <StatCard label="Sem Coordenada"     value={effectiveStats?.sem_coordenada}  icon={MapPin}      color="#E65100" bg="var(--warning-bg)" />
              <StatCard label="Integrados Hoje"    value={effectiveStats?.integrados_hoje} icon={Send}       color="#1565C0" bg="var(--info-bg)" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, marginBottom: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={loadOperationalScenario} disabled={loadingScenario}>
                <RefreshCw size={13} className={loadingScenario ? 'spin' : ''} />
                {loadingScenario ? 'Atualizando…' : 'Atualizar dados'}
              </button>
            </div>

            {/* ── Charts Row 1 ─────────────────────────────────────────── */}
            <div className="charts-row">
              {/* Distribuição por DDD */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Distribuição por DDD</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{effectiveDddDist.length} DDDs</span>
                </div>
                <div className="card-body">
                  {effectiveDddDist.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: 180 }}>
                      <strong>Sem dados para o filtro selecionado</strong>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={effectiveDddDist} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="ddd" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="ativos"      name="Ativos"          fill="#00C896" radius={[3,3,0,0]} />
                        <Bar dataKey="inativos"    name="Inativos"        fill="#FF4757" radius={[3,3,0,0]} />
                        <Bar dataKey="sem_coordenada" name="Sem Coord."   fill="#FFB300" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Status dos Clientes */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Status dos Clientes</span>
                  {effectiveStats && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Base considerada: {effectiveStats.total}
                    </span>
                  )}
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {statusPieData.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: 180 }}>
                      <strong>Sem dados para o filtro selecionado</strong>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={88} paddingAngle={3} dataKey="value">
                          {statusPieData.map((entry, i) => <Cell key={entry.name} fill={entry.color || STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} clientes`]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* ── Qualidade para Roteirização ─────────────────────────── */}
            {effectiveStats && (
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header">
                  <span className="card-title">Qualidade para Roteirização</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Critério: ativo + coordenada + atividade recente
                  </span>
                </div>
                <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 34, fontWeight: 900, color: 'var(--success)' }}>
                      {quality.score}%
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>score de roteirização</span>
                  </div>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>{quality.aptos}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Aptos</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--error)' }}>{quality.nao_aptos}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nao aptos</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#1565C0' }}>{quality.pct_validos}%</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Indice valido</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Ranking DDD com Problemas ─────────────────────────────── */}
            {dddIssues.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={16} color="var(--error)" />
                    Ranking de DDDs com Mais Problemas
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Inativos + Sem Coordenada</span>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dddIssues} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <YAxis dataKey="ddd" type="category" tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--text-primary)' }} width={40} tickFormatter={v => `DDD ${v}`} />
                      <Tooltip formatter={(v, n) => [`${v}`, n]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="inativos"     name="Inativos"     fill="#FF4757" radius={[0,3,3,0]} />
                      <Bar dataKey="sem_coordenada" name="Sem Coord." fill="#FFB300" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="charts-row" style={{ marginTop: 20 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Clientes por Vendedor</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top cargas de carteira</span>
                </div>
                <div className="card-body">
                  {customersBySeller.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: 180 }}>
                      <strong>Sem dados de vendedor</strong>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={customersBySeller} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                        <YAxis dataKey="seller_name" type="category" tick={{ fontSize: 11, fill: 'var(--text-primary)' }} width={90} />
                        <Tooltip formatter={(v) => [`${v} clientes`, 'Carga']} />
                        <Bar dataKey="total" name="Clientes" fill="#1E88E5" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Densidade por Cidade</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Concentração operacional</span>
                </div>
                <div className="card-body">
                  {densityByCity.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: 180 }}>
                      <strong>Sem dados por cidade</strong>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={densityByCity} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="city" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={0} angle={-18} textAnchor="end" height={52} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                        <Tooltip formatter={(v) => [`${v} clientes`, 'Densidade']} />
                        <Bar dataKey="total" name="Clientes" fill="#00695C" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-header">
                <span className="card-title">Análise Inteligente</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gargalos e recomendações</span>
              </div>
              <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Vendedores em sobrecarga</strong>
                  {overloadedSellers.length === 0 ? (
                    <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Sem sobrecarga crítica detectada.</p>
                  ) : (
                    <ul style={{ marginTop: 8, paddingLeft: 16, fontSize: 12 }}>
                      {overloadedSellers.slice(0, 5).map((row) => (
                        <li key={row.seller_name}>{row.seller_name}: {row.total} clientes</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <strong style={{ fontSize: 13 }}>Regiões críticas</strong>
                  {criticalRegions.length === 0 ? (
                    <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Sem regiões críticas sinalizadas.</p>
                  ) : (
                    <ul style={{ marginTop: 8, paddingLeft: 16, fontSize: 12 }}>
                      {criticalRegions.slice(0, 5).map((row, idx) => (
                        <li key={`${row.city}-${row.state}-${idx}`}>
                          {row.city}/{row.state} (DDD {row.ddd}): {row.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong style={{ fontSize: 13 }}>Melhorias sugeridas</strong>
                  {recommendations.length === 0 ? (
                    <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma recomendação disponível.</p>
                  ) : (
                    <ul style={{ marginTop: 8, paddingLeft: 16, fontSize: 12 }}>
                      {recommendations.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
