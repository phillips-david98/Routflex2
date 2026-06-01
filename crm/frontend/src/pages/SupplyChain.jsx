import {
  AlertTriangle,
  PackageSearch,
  Route,
  Truck,
  Warehouse,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MetricCard,
  MockBadge,
  SectionCard,
} from './ModuleMockUi.jsx';

const rows = [
  { item: 'Kit promocional', territory: 'Cuiaba Norte', step: 'Equipe', priority: 'Alta', forecast: 'Hoje 15:30', criticality: 'Media', status: 'Em reposicao', owner: 'Ana Souza', tone: 'warning' },
  { item: 'Material de visita', territory: 'Varzea Grande', step: 'Cliente', priority: 'Normal', forecast: 'Concluido', criticality: 'Baixa', status: 'Entregue', owner: 'Ricardo Lima', tone: 'success' },
  { item: 'Amostras controladas', territory: 'Rondonopolis', step: 'Centro', priority: 'Normal', forecast: '01/06 09:00', criticality: 'Baixa', status: 'Pendente', owner: 'Supervisor Sul', tone: 'info' },
  { item: 'Carga de apoio', territory: 'Cuiaba Leste', step: 'Fornecedor', priority: 'Critica', forecast: 'Hoje 13:10', criticality: 'Alta', status: 'Risco ruptura', owner: 'Central Logistica', tone: 'danger' },
];

const flowSteps = [
  { step: '01', name: 'Fornecedor', status: 'Liberado', owner: 'Compras OPS', sla: 'SLA 2h', tone: 'success' },
  { step: '02', name: 'Centro', status: 'Separacao', owner: 'CD Cuiaba', sla: 'SLA 4h', tone: 'warning' },
  { step: '03', name: 'Equipe', status: 'Em rota', owner: 'Supervisor DDD 65', sla: 'SLA hoje', tone: 'info' },
  { step: '04', name: 'Cliente', status: 'Pendente parcial', owner: 'Consultor campo', sla: 'SLA 24h', tone: 'warning' },
];

export default function SupplyChain() {
  return (
    <div>
      <Header
        title="Supply Chain"
        subtitle="Controle simplificado da cadeia operacional"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 12 }}>
          <MetricCard label="Abastecimentos" value="18" helper="programados" icon={Warehouse} tone="primary" />
          <MetricCard label="Entregas" value="42" helper="confirmadas" icon={Truck} tone="success" />
          <MetricCard label="Reposicoes" value="7" helper="em andamento" icon={PackageSearch} tone="warning" />
          <MetricCard label="Pendencias" value="4" helper="risco operacional" icon={AlertTriangle} tone="danger" />
        </div>

        <SectionCard title="Fluxo operacional" subtitle="Etapas, responsavel e SLA mockado do ciclo logistico" icon={Route}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {flowSteps.map((step) => (
              <div key={step.name} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '.5px' }}>ETAPA {step.step}</span>
                  <MockBadge tone={step.tone}>{step.status}</MockBadge>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8 }}>{step.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '82px 1fr', gap: 6, fontSize: 11, lineHeight: 1.35 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Responsavel</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>{step.owner}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>SLA</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>{step.sla}</strong>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Tabela operacional" subtitle="Itens, etapa logistica, prioridade e previsao" icon={PackageSearch}>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>{['Item', 'Territorio', 'Etapa', 'Prioridade', 'Previsao', 'Criticidade', 'Status', 'Responsavel'].map((column) => <th key={column}>{column}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.item}>
                      <td style={{ fontWeight: 700 }}>{row.item}</td>
                      <td>{row.territory}</td>
                      <td>{row.step}</td>
                      <td><MockBadge tone={row.priority === 'Critica' ? 'danger' : row.priority === 'Alta' ? 'warning' : 'info'}>{row.priority}</MockBadge></td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{row.forecast}</td>
                      <td>{row.criticality}</td>
                      <td><MockBadge tone={row.tone}>{row.status}</MockBadge></td>
                      <td>{row.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Painel de risco" subtitle="Monitoramento executivo da cadeia" icon={AlertTriangle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Indice de risco', 'medio', 'warning'],
                ['Ruptura prevista', '1 item critico', 'danger'],
                ['SLA comprometido', '2 etapas', 'warning'],
                ['Reposicao prioritaria', 'Cuiaba Leste', 'info'],
                ['Estabilidade geral', 'cadeia sob controle', 'success'],
              ].map(([label, value, tone]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                  <MockBadge tone={tone}>{value}</MockBadge>
                </div>
              ))}
              <div style={{ marginTop: 2, padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.45 }}>
                Leitura auditavel: a cadeia permanece estavel, mas o gargalo atual esta na separacao do CD e na reposicao de Cuiaba Leste.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
