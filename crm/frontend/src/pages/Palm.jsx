import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Lock,
  Map,
  Navigation,
  PauseCircle,
  Radio,
  Route,
  Settings,
  SkipForward,
  UserRound,
  Wifi,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  ChecklistItem,
  MapPlaceholder,
  MetricCard,
  MockBadge,
  ProgressBar,
  SectionCard,
  TimelineRow,
} from './ModuleMockUi.jsx';

const routeStops = [
  { time: '08:10', client: 'Farmácia Central', executed: '08:16', status: 'Atendido', note: 'Checklist completo e pedido conferido.', tone: 'success' },
  { time: '09:00', client: 'Mercado São Jorge', executed: '09:22', status: 'Atraso', note: 'Acesso bloqueado na doca lateral.', tone: 'warning' },
  { time: '10:20', client: 'Distribuidora Omega', executed: '10:18', status: 'Atendido', note: 'Recebimento validado pelo gerente.', tone: 'success' },
  { time: '11:30', client: 'Padaria Estrela', executed: '-', status: 'Pulado', note: 'Responsável ausente. Reagendar na próxima janela.', tone: 'danger' },
  { time: '14:00', client: 'Supermercado Norte', executed: 'Pendente', status: 'Pendente', note: 'Próxima visita operacional.', tone: 'muted' },
];

const telemetryCadence = ['5 min', '10 min', '15 min'];
const fieldControls = [
  { label: 'Exigir checklist', active: true },
  { label: 'Exigir foto da visita', active: true },
  { label: 'Bloqueio fora do raio', active: false },
];
const authorizedTeam = [
  { name: 'Ana Souza', role: 'Consultora', tone: 'success', status: 'em rota' },
  { name: 'Ricardo Lima', role: 'Consultor', tone: 'info', status: 'autorizado' },
  { name: 'Supervisor DDD 65', role: 'Gestão', tone: 'warning', status: 'aprovação' },
];
const collaboratorStatus = [
  { label: 'Em rota', tone: 'success' },
  { label: 'Pausado', tone: 'warning' },
  { label: 'Offline', tone: 'danger' },
  { label: 'Sincronizando', tone: 'info' },
];

function ToggleRow({ label, active }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        width: 34,
        height: 18,
        borderRadius: 999,
        padding: 2,
        background: active ? 'var(--success)' : '#CBD5E1',
        display: 'flex',
        justifyContent: active ? 'flex-end' : 'flex-start',
        flexShrink: 0,
      }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.18)' }} />
      </span>
    </div>
  );
}

export default function Palm() {
  return (
    <div>
      <Header
        title="Palm - Rotas"
        subtitle="Execução operacional da rota em campo"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SectionCard
          title="Rota Cuiabá Norte - 31/05"
          subtitle="Consultor: Ana Souza · Território DDD 65 · Status: em execução"
          icon={Route}
          action={<MockBadge tone="warning">68% do dia</MockBadge>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: 18, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>Progresso operacional</span>
                <strong style={{ color: 'var(--text-primary)' }}>8 de 12 visitas tratadas</strong>
              </div>
              <ProgressBar value={68} tone="accent" />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <MockBadge tone="info"><UserRound size={12} /> Ana Souza</MockBadge>
              <MockBadge tone="success">Rota ativa</MockBadge>
            </div>
          </div>
        </SectionCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 16 }}>
          <MetricCard label="Clientes previstos" value="12" helper="janela 08:00-17:30" icon={ClipboardList} />
          <MetricCard label="Atendidos" value="8" helper="com checklist encerrado" icon={CheckCircle2} tone="success" />
          <MetricCard label="Pendentes" value="3" helper="em janela futura" icon={Clock3} tone="warning" />
          <MetricCard label="Pulados" value="1" helper="requer tratativa" icon={SkipForward} tone="danger" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Timeline operacional" subtitle="Execução humana da rota, sem telemetria real" icon={Navigation}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {routeStops.map((stop) => (
                <TimelineRow
                  key={stop.client}
                  time={stop.time}
                  title={stop.client}
                  meta={`Executado: ${stop.executed} · ${stop.note}`}
                  status={stop.status}
                  tone={stop.tone}
                  icon={stop.tone === 'danger' ? SkipForward : stop.tone === 'warning' ? PauseCircle : CheckCircle2}
                />
              ))}
            </div>
          </SectionCard>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SectionCard title="Mapa da rota" subtitle="Referência visual do roteiro" icon={Map}>
              <MapPlaceholder height={210} />
            </SectionCard>

            <SectionCard title="Painel de campo" subtitle="Checklist e alertas" icon={ClipboardList}>
              <ChecklistItem checked>Materiais de visita conferidos antes da saída.</ChecklistItem>
              <ChecklistItem checked>Fotos de fachada registradas nos clientes críticos.</ChecklistItem>
              <ChecklistItem>Reagendar Padaria Estrela com supervisor.</ChecklistItem>
              <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start', color: '#92400E', fontSize: 12, lineHeight: 1.45 }}>
                <AlertTriangle size={15} color="var(--warning)" />
                Uma visita pulada exige justificativa operacional até o fechamento da rota.
              </div>
            </SectionCard>

            <SectionCard title="Controles operacionais" subtitle="Parâmetros mockados da execução" icon={Settings}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>
                    <Radio size={14} color="var(--primary)" />
                    Frequência de telemetria
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                    {telemetryCadence.map((cadence) => (
                      <div key={cadence} style={{
                        textAlign: 'center',
                        borderRadius: 8,
                        border: `1px solid ${cadence === '10 min' ? 'rgba(255,107,44,.4)' : 'var(--border)'}`,
                        background: cadence === '10 min' ? 'rgba(255,107,44,.07)' : 'var(--bg-hover)',
                        color: cadence === '10 min' ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '8px 6px',
                      }}>
                        {cadence}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  {fieldControls.map((control) => (
                    <ToggleRow key={control.label} label={control.label} active={control.active} />
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Equipe autorizada" subtitle="Acesso operacional da rota" icon={Lock}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {authorizedTeam.map((member) => (
                  <div key={member.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(30,58,110,.08)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                      {member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{member.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{member.role}</div>
                    </div>
                    <MockBadge tone={member.tone}>{member.status}</MockBadge>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Status operacional" subtitle="Leitura discreta do colaborador" icon={Wifi}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {collaboratorStatus.map((status) => (
                  <div key={status.label} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: status.label === 'Em rota' ? 'var(--success-bg)' : '#fff',
                  }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: status.tone === 'success' ? 'var(--success)' : status.tone === 'warning' ? 'var(--warning)' : status.tone === 'danger' ? 'var(--error)' : 'var(--info)',
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>{status.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                <Camera size={14} color="var(--text-muted)" />
                Foto e checklist tratados como controles visuais mockados.
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
