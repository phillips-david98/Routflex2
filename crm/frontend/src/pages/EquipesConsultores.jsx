import {
  Activity,
  Clock3,
  PauseCircle,
  Route,
  TrendingUp,
  UserRound,
  Users,
  Wifi,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MetricCard,
  MockBadge,
  ProgressBar,
  SectionCard,
} from './ModuleMockUi.jsx';

const people = [
  { name: 'Ana Souza', territory: 'Cuiaba Norte', status: 'Em rota', productivity: '92%', tone: 'success' },
  { name: 'Ricardo Lima', territory: 'Varzea Grande', status: 'Pausado', productivity: '74%', tone: 'warning' },
  { name: 'Fernanda Costa', territory: 'Cuiaba Leste', status: 'Online', productivity: '86%', tone: 'info' },
  { name: 'Carlos Mendes', territory: 'Rondonopolis', status: 'Offline', productivity: '61%', tone: 'danger' },
];

export default function EquipesConsultores() {
  const selected = people[0];

  return (
    <div>
      <Header
        title="Equipes & Consultores"
        subtitle="Gestao operacional das equipes em campo"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 16 }}>
          <MetricCard label="Ativos hoje" value="18" helper="com rota atribuida" icon={Users} tone="success" />
          <MetricCard label="Em rota" value="14" helper="em execucao" icon={Route} tone="accent" />
          <MetricCard label="Pausados" value="3" helper="parada operacional" icon={PauseCircle} tone="warning" />
          <MetricCard label="Offline" value="1" helper="sem sinal recente" icon={Wifi} tone="danger" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Colaboradores" subtitle="Status e produtividade de campo" icon={Users}>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>{['Nome', 'Territorio', 'Status', 'Produtividade'].map((column) => <th key={column}>{column}</th>)}</tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.name}>
                      <td style={{ fontWeight: 700 }}>{person.name}</td>
                      <td>{person.territory}</td>
                      <td><MockBadge tone={person.tone}>{person.status}</MockBadge></td>
                      <td style={{ fontWeight: 800 }}>{person.productivity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title={selected.name} subtitle="Painel individual operacional" icon={UserRound}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Rota atual', 'Cuiaba Norte - 31/05'],
                ['Score operacional', '92%'],
                ['Ultimas ocorrencias', '1 alerta leve'],
                ['Supervisor', 'Marina Lopes'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                  <strong style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</strong>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Leitura de performance" subtitle="Estabilidade, aderencia e produtividade" icon={TrendingUp}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {[
              ['Estabilidade', '89%', 'success'],
              ['Aderencia', '84%', 'accent'],
              ['Produtividade', '78%', 'warning'],
            ].map(([label, value, tone]) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
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
