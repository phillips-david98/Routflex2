import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Map,
  Radio,
  Route,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MapPlaceholder,
  MetricCard,
  MockBadge,
  SectionCard,
  TimelineRow,
} from './ModuleMockUi.jsx';

const timeline = [
  { time: '07:35', title: 'Rota iniciada', meta: 'Ana Souza iniciou Cuiaba Norte.', tone: 'success', icon: Route },
  { time: '09:48', title: 'Atraso detectado', meta: 'Mercado Sao Jorge acima da janela.', tone: 'warning', icon: Clock3 },
  { time: '10:12', title: 'Supervisor acionado', meta: 'Tratativa aberta para rota critica.', tone: 'info', icon: ShieldCheck },
];

export default function CentralLogistica() {
  return (
    <div>
      <Header
        title="Central Logística"
        subtitle="Visao consolidada da operacao logistica"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 16 }}>
          <MetricCard label="Equipes ativas" value="14" helper="em campo agora" icon={Users} tone="success" />
          <MetricCard label="Rotas em andamento" value="22" helper="com telemetria visual" icon={Route} tone="accent" />
          <MetricCard label="Alertas operacionais" value="9" helper="em acompanhamento" icon={AlertTriangle} tone="warning" />
          <MetricCard label="Regioes criticas" value="3" helper="prioridade do dia" icon={Warehouse} tone="danger" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Mapa operacional" subtitle="Visao territorial placeholder" icon={Map}>
            <MapPlaceholder variant="telemetry" height={360} />
          </SectionCard>

          <SectionCard title="Painel lateral" subtitle="Operacao do dia" icon={Radio}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Operacao do dia', 'Ciclo 31/05'],
                ['Status territorial', 'Cuiaba Norte em atencao'],
                ['Supervisao ativa', 'Marina Lopes'],
                ['Capacidade logistica', '86% alocada'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: 12, textAlign: 'right' }}>{value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Timeline logistica" subtitle="Eventos recentes da torre operacional" icon={Truck}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {timeline.map((item) => (
              <TimelineRow key={item.title} {...item} status={item.tone === 'warning' ? 'Atencao' : 'OK'} />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
