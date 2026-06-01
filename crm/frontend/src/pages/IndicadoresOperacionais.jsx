import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Gauge,
  MapPin,
  Route,
  TrendingUp,
  Users,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MetricCard,
  MockBadge,
  ProgressBar,
  SectionCard,
} from './ModuleMockUi.jsx';

const comparisons = [
  ['Semana atual', '87%', '1.248 visitas auditadas', 'success'],
  ['Semana anterior', '81%', '1.106 visitas auditadas', 'primary'],
  ['Planejado', '92%', '91 rotas previstas', 'accent'],
  ['Executado', '86%', '83 rotas concluidas', 'warning'],
];

const territories = [
  ['Cuiaba Norte', 'critico', 'warning'],
  ['Varzea Grande', 'estavel', 'success'],
  ['Rondonopolis', 'em observacao', 'info'],
];

const executiveSummary = [
  ['Visitas auditadas', '1.248', CheckCircle2, 'success'],
  ['Rotas concluidas', '83 de 91', Route, 'accent'],
  ['Territorios criticos', '3', MapPin, 'warning'],
  ['Alertas operacionais', '27', AlertTriangle, 'danger'],
];

function ExecutiveKpi({ label, value, icon: Icon, tone }) {
  const color = tone === 'success' ? '#00695C' : tone === 'warning' ? '#92400E' : tone === 'danger' ? '#B91C1C' : tone === 'accent' ? 'var(--accent)' : 'var(--primary)';
  const bg = tone === 'success' ? 'var(--success-bg)' : tone === 'warning' ? 'var(--warning-bg)' : tone === 'danger' ? 'var(--error-bg)' : tone === 'accent' ? 'rgba(255,107,44,.1)' : 'rgba(30,58,110,.08)';

  return (
    <div className="stat-card" style={{ minHeight: 136 }}>
      <div className="stat-card-icon" style={{ background: bg }}>
        <Icon size={18} color={color} />
      </div>
      <div className="stat-card-value" style={{ color, fontSize: 27 }}>{value}</div>
      <div className="stat-card-label">{label}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>base auditavel do periodo</div>
    </div>
  );
}

export default function IndicadoresOperacionais() {
  return (
    <div>
      <Header
        title="Indicadores Operacionais"
        subtitle="Central consolidada de KPIs operacionais"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 16 }}>
          <MetricCard label="Aderencia operacional" value="87%" helper="1.248 visitas dentro do criterio" icon={CheckCircle2} tone="success" />
          <MetricCard label="Eficiencia de rota" value="91%" helper="83 de 91 rotas concluidas" icon={Route} tone="accent" />
          <MetricCard label="Produtividade equipe" value="76%" helper="38 consultores ativos" icon={Users} tone="primary" />
          <MetricCard label="Score logistico" value="82" helper="12 territorios auditados" icon={Gauge} tone="warning" />
        </div>

        <SectionCard title="Resumo executivo" subtitle="Volume real associado aos indicadores do ciclo" icon={Activity}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 12 }}>
            {executiveSummary.map(([label, value, Icon, tone]) => (
              <ExecutiveKpi key={label} label={label} value={value} icon={Icon} tone={tone} />
            ))}
          </div>
        </SectionCard>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Comparativos operacionais" subtitle="Leitura executiva simples e controlada" icon={BarChart3}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {comparisons.map(([label, value, context, tone]) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <strong>{value}</strong>
                  </div>
                  <ProgressBar value={Number(value.replace('%', ''))} tone={tone} />
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)' }}>{context}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Leitura executiva" subtitle="Tendencia operacional por territorio" icon={TrendingUp}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {territories.map(([name, status, tone]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>territorio monitorado · base auditavel</div>
                  </div>
                  <MockBadge tone={tone}>{status}</MockBadge>
                </div>
              ))}
              <div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                A operacao segue estavel: 1.248 visitas foram auditadas, 83 rotas concluidas e 27 alertas seguem classificados para acompanhamento executivo.
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Indicadores por eixo" subtitle="Grafico simples para leitura corporativa" icon={Activity}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {[
              ['Operacao', '88%', 'success'],
              ['Auditoria', '74%', 'warning'],
              ['Logistica', '92%', 'accent'],
            ].map(([label, value, tone]) => (
              <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, background: '#fff' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>{label}</div>
                <ProgressBar value={Number(value.replace('%', ''))} tone={tone} />
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>{value} de consistencia</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
