import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MapPin,
  RotateCw,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MetricCard,
  MockBadge,
  ProgressBar,
  SectionCard,
  TimelineRow,
} from './ModuleMockUi.jsx';

const auditRows = [
  { consultant: 'Ana Souza', client: 'Farmacia Central', alert: 'Visita fora do raio', time: '08:42', status: 'Em analise', criticality: 'alto', tone: 'danger' },
  { consultant: 'Ricardo Lima', client: 'Distribuidora Omega', alert: 'Checklist incompleto', time: '10:18', status: 'Pendente', criticality: 'medio', tone: 'warning' },
  { consultant: 'Fernanda Costa', client: 'Supermercado Norte', alert: 'Sincronizacao tardia', time: '12:07', status: 'Validado', criticality: 'baixo', tone: 'success' },
  { consultant: 'Ana Souza', client: 'Padaria Estrela', alert: 'Cliente pulado', time: '14:30', status: 'Escalado', criticality: 'alto', tone: 'danger' },
];

const occurrences = [
  { time: '14:30', title: 'Cliente pulado escalado', meta: 'Padaria Estrela requer justificativa do supervisor.', tone: 'danger', icon: ShieldAlert },
  { time: '12:07', title: 'Sincronizacao regularizada', meta: 'Pacote Palm recebido com atraso de 11 min.', tone: 'success', icon: RotateCw },
  { time: '10:18', title: 'Checklist pendente', meta: 'Distribuidora Omega aguardando evidencia de visita.', tone: 'warning', icon: ClipboardCheck },
];

const supervisors = [
  ['Marina Lopes', 'DDD 65', 'ativo', 'success'],
  ['Supervisor Cuiaba Norte', 'Rota critica', 'em revisao', 'warning'],
  ['Auditoria Central', 'Compliance', 'monitorando', 'info'],
];

function AuditTable() {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {['Consultor', 'Cliente', 'Tipo de alerta', 'Horario', 'Status', 'Criticidade'].map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {auditRows.map((row) => (
            <tr key={`${row.consultant}-${row.client}`}>
              <td style={{ fontWeight: 700 }}>{row.consultant}</td>
              <td>{row.client}</td>
              <td>{row.alert}</td>
              <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{row.time}</td>
              <td><MockBadge tone={row.tone}>{row.status}</MockBadge></td>
              <td><MockBadge tone={row.tone}>{row.criticality}</MockBadge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditoriaOperacional() {
  return (
    <div>
      <Header
        title="Auditoria Operacional"
        subtitle="Central de divergencias e validacao operacional"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 16 }}>
          <MetricCard label="Visitas auditadas" value="128" helper="janela operacional atual" icon={ClipboardCheck} tone="primary" />
          <MetricCard label="Divergencias" value="14" helper="pendentes de validacao" icon={ShieldAlert} tone="warning" />
          <MetricCard label="Fora do raio" value="6" helper="com evidencias cruzadas" icon={MapPin} tone="danger" />
          <MetricCard label="Clientes pendentes" value="9" helper="sem encerramento Palm" icon={Clock3} tone="accent" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Fila principal de auditoria" subtitle="Alertas cruzados entre execucao, raio e sincronizacao" icon={ClipboardCheck}>
            <AuditTable />
          </SectionCard>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SectionCard title="Ultimas ocorrencias" subtitle="Sinais recentes para revisao" icon={AlertTriangle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {occurrences.map((item) => (
                  <TimelineRow key={item.title} {...item} status={item.tone === 'danger' ? 'Critico' : item.tone === 'warning' ? 'Atencao' : 'Validado'} />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Supervisores responsaveis" subtitle="Governanca da fila operacional" icon={Users}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {supervisors.map(([name, area, status, tone]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(30,58,110,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCheck size={15} color="var(--primary)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{area}</div>
                    </div>
                    <MockBadge tone={tone}>{status}</MockBadge>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Palm x Telemetria" subtitle="Resumo de consistencia entre execucao declarada e deslocamento auditado" icon={RotateCw}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {[
              ['Visitas confirmadas', '91%', 'success'],
              ['Divergencias', '11%', 'warning'],
              ['Sincronizacoes pendentes', '7%', 'accent'],
            ].map(([label, value, tone]) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <strong>{value}</strong>
                </div>
                <ProgressBar value={Number(value.replace('%', ''))} tone={tone} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
