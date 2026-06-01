import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MetricCard,
  MockBadge,
  SectionCard,
  TimelineRow,
} from './ModuleMockUi.jsx';

const incidents = [
  { consultant: 'Ana Souza', occurrence: 'Cliente sem responsavel', criticality: 'medio', time: '08:42', status: 'Aberta', tone: 'warning' },
  { consultant: 'Ricardo Lima', occurrence: 'Perda de sinal', criticality: 'alto', time: '11:05', status: 'Em tratativa', tone: 'danger' },
  { consultant: 'Fernanda Costa', occurrence: 'Atraso operacional', criticality: 'baixo', time: '12:20', status: 'Resolvida', tone: 'success' },
  { consultant: 'Carlos Mendes', occurrence: 'Checklist pendente', criticality: 'medio', time: '14:10', status: 'Pendente', tone: 'warning' },
];

const timeline = [
  { time: '08:42', title: 'Ocorrencia criada', meta: 'Cliente sem responsavel registrado no Palm.', tone: 'warning', icon: AlertTriangle },
  { time: '08:50', title: 'Supervisor acionado', meta: 'Marina Lopes recebeu tratativa operacional.', tone: 'info', icon: ShieldCheck },
  { time: '09:18', title: 'Resolucao registrada', meta: 'Evidencia anexada e rota liberada.', tone: 'success', icon: CheckCircle2 },
];

export default function Ocorrencias() {
  return (
    <div>
      <Header
        title="Ocorrências"
        subtitle="Central auditavel de incidentes operacionais"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 16 }}>
          <MetricCard label="Ocorrencias abertas" value="12" helper="em tratativa" icon={ShieldAlert} tone="warning" />
          <MetricCard label="Criticas" value="3" helper="impacto operacional" icon={AlertTriangle} tone="danger" />
          <MetricCard label="Resolvidas" value="28" helper="no ciclo atual" icon={CheckCircle2} tone="success" />
          <MetricCard label="Pendentes" value="7" helper="aguardando evidencia" icon={Clock3} tone="accent" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Lista principal" subtitle="Incidentes por consultor, criticidade e status" icon={ShieldAlert}>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>{['Consultor', 'Ocorrencia', 'Criticidade', 'Horario', 'Status'].map((column) => <th key={column}>{column}</th>)}</tr>
                </thead>
                <tbody>
                  {incidents.map((incident) => (
                    <tr key={`${incident.consultant}-${incident.occurrence}`}>
                      <td style={{ fontWeight: 700 }}>{incident.consultant}</td>
                      <td>{incident.occurrence}</td>
                      <td><MockBadge tone={incident.tone}>{incident.criticality}</MockBadge></td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{incident.time}</td>
                      <td><MockBadge tone={incident.tone}>{incident.status}</MockBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Painel lateral" subtitle="Impacto e reincidencia" icon={MapPin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Regioes criticas', 'Cuiaba Norte'],
                ['Reincidencia', '2 casos em 7 dias'],
                ['Impacto operacional', 'medio'],
                ['Responsavel', 'Supervisor DDD 65'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                  <strong style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Timeline de tratativas" subtitle="Registro operacional auditavel" icon={UserRound}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {timeline.map((item) => (
              <TimelineRow key={item.title} {...item} status={item.tone === 'warning' ? 'Aberto' : 'OK'} />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
