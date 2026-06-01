import {
  Activity,
  Calendar,
  Clock3,
  Filter,
  Gauge,
  LocateFixed,
  Map,
  Milestone,
  MoveRight,
  PauseCircle,
  PlayCircle,
  Route,
  Signal,
  Timer,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MapPlaceholder,
  MetricCard,
  MockBadge,
  ProgressBar,
  SectionCard,
  TimelineRow,
} from './ModuleMockUi.jsx';

const events = [
  { time: '07:48', title: 'Saída da base operacional', meta: 'Primeiro sinal registrado no território DDD 65.', tone: 'success', icon: LocateFixed },
  { time: '08:42', title: 'Parada operacional detectada', meta: '16 min próximo ao cliente Farmácia Central.', tone: 'info', icon: PauseCircle },
  { time: '10:18', title: 'Cliente visitado', meta: 'Geocerca compatível com Distribuidora Omega.', tone: 'success', icon: Milestone },
  { time: '12:07', title: 'Desvio de percurso', meta: '3,4 km fora do eixo planejado, sem impacto crítico.', tone: 'warning', icon: MoveRight },
  { time: '16:26', title: 'Última localização recebida', meta: 'Retorno ao corredor logístico principal.', tone: 'info', icon: LocateFixed },
];

const filters = [
  ['Data', '31/05/2026'],
  ['Intervalo', '07:30 - 17:30'],
  ['Consultor', 'Ana Souza'],
  ['Território', 'Cuiabá Norte'],
  ['Status GPS', 'Sinal estável'],
];
const quickRanges = ['Últimas 2h', 'Hoje', 'Ontem', 'Semana'];
const detectedEvents = [
  { type: 'Parada longa', time: '08:42', detail: '16 min em área de cliente', tone: 'warning' },
  { type: 'Desvio detectado', time: '12:07', detail: '3,4 km fora do eixo planejado', tone: 'warning' },
  { type: 'Cliente detectado', time: '10:18', detail: 'Distribuidora Omega validada', tone: 'success' },
  { type: 'Perda de sinal', time: '15:11', detail: '4 min sem pacote GPS', tone: 'danger' },
];

export default function Telemetria() {
  return (
    <div>
      <Header
        title="Telemetria"
        subtitle="Auditoria de deslocamento real e eventos operacionais"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SectionCard title="Filtros operacionais" subtitle="Parâmetros visuais da auditoria" icon={Filter} action={<MockBadge tone="info"><Calendar size={12} /> Hoje</MockBadge>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
            {filters.map(([label, value]) => (
              <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-hover)', padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {quickRanges.map((range) => (
                <span key={range} style={{
                  padding: '7px 11px',
                  borderRadius: 999,
                  border: `1px solid ${range === 'Hoje' ? 'rgba(255,107,44,.4)' : 'var(--border)'}`,
                  background: range === 'Hoje' ? 'rgba(255,107,44,.07)' : '#fff',
                  color: range === 'Hoje' ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 800,
                }}>
                  {range}
                </span>
              ))}
            </div>
            <button type="button" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 13px',
              borderRadius: 'var(--radius)',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <PlayCircle size={15} />
              Reproduzir rota
            </button>
          </div>
        </SectionCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 16 }}>
          <MetricCard label="Km total" value="86,4" helper="rota auditada" icon={Route} />
          <MetricCard label="Visitas detectadas" value="9" helper="por geocerca mockada" icon={Milestone} tone="success" />
          <MetricCard label="Desvios" value="2" helper="fora do planejado" icon={MoveRight} tone="warning" />
          <MetricCard label="Tempo produtivo" value="74%" helper="movimento + visitas" icon={Activity} tone="accent" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Mapa auditável do deslocamento" subtitle="Percurso mockado com pontos de parada, início e fim" icon={Map}>
            <MapPlaceholder variant="telemetry" height={430} />
          </SectionCard>

          <SectionCard title="Painel operacional" subtitle="Leitura consolidada do colaborador" icon={Gauge}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Colaborador', 'Ana Souza'],
                ['Território', 'Cuiabá Norte · DDD 65'],
                ['Km rodado', '86,4 km'],
                ['Tempo parado', '1h 18min'],
                ['Em movimento', '5h 42min'],
                ['Primeira localização', '07:48 · Base operacional'],
                ['Última localização', '16:26 · Av. Miguel Sutil'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                  <strong style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Timeline de eventos" subtitle="Sequência auditável do dia" icon={Clock3}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {events.map((event) => (
                <TimelineRow key={event.time} {...event} status={event.tone === 'warning' ? 'Atenção' : 'Validado'} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Planejado x executado" subtitle="Comparação visual controlada" icon={Timer}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                ['Janela da rota', '82%', 'warning'],
                ['Aderência ao percurso', '91%', 'success'],
                ['Cobertura de clientes', '75%', 'accent'],
              ].map(([label, value, tone]) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <strong>{value}</strong>
                  </div>
                  <ProgressBar value={Number(value.replace('%', ''))} tone={tone} />
                </div>
              ))}
              <div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                Dois desvios foram detectados, mas o trecho executado permanece compatível com a rota produtiva do dia.
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Eventos detectados" subtitle="Lista operacional compacta para auditoria" icon={Signal}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(170px, 1fr))', gap: 10 }}>
            {detectedEvents.map((event) => (
              <div key={event.type} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <strong style={{ fontSize: 12, color: 'var(--text-primary)' }}>{event.type}</strong>
                  <MockBadge tone={event.tone}>{event.time}</MockBadge>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.45 }}>{event.detail}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
