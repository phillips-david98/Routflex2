import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Building2,
  CalendarClock,
  History,
  Lightbulb,
  MapPin,
  MessageSquare,
  Search,
  ShieldAlert,
  Target,
  TrendingUp,
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

const customers = [
  {
    id: 1,
    name: 'Farmácia Central',
    code: 'CLI-0042',
    territory: 'Cuiabá Norte · DDD 65',
    owner: 'Ana Souza',
    criticality: 'alto',
    potential: 'R$ 8,4k/mês',
    competition: 'Rede FarmaMais',
    idealFrequency: '2x por semana',
    lastVisit: '12 dias',
    score: 72,
    notes: [
      'Cliente curva A com queda de frequência nas últimas duas semanas.',
      'Gestor valoriza previsibilidade de visita e reposição antes do fim de semana.',
    ],
  },
  {
    id: 2,
    name: 'Distribuidora Omega',
    code: 'CLI-0087',
    territory: 'Várzea Grande · DDD 65',
    owner: 'Ricardo Lima',
    criticality: 'médio',
    potential: 'R$ 12,1k/mês',
    competition: 'Atacadista regional',
    idealFrequency: '1x por semana',
    lastVisit: '5 dias',
    score: 84,
    notes: [
      'Relação estável, mas sensível a ruptura de entrega.',
      'Supervisor solicitou acompanhamento de sortimento nas próximas visitas.',
    ],
  },
  {
    id: 3,
    name: 'Supermercado Norte',
    code: 'CLI-0113',
    territory: 'Cuiabá Leste · DDD 65',
    owner: 'Fernanda Costa',
    criticality: 'baixo',
    potential: 'R$ 5,2k/mês',
    competition: 'Sem pressão relevante',
    idealFrequency: 'quinzenal',
    lastVisit: '3 dias',
    score: 93,
    notes: [
      'Cliente aderente ao roteiro atual.',
      'Boa abertura para expansão de categorias sazonais.',
    ],
  },
];

const history = [
  { time: '29/05', title: 'Phillips alterou frequência ideal', meta: 'Ajuste de quinzenal para 2x por semana após revisão territorial.', tone: 'info', icon: CalendarClock },
  { time: '28/05', title: 'Supervisor adicionou observação', meta: 'Priorizar atendimento antes das 10h por restrição de recebimento.', tone: 'warning', icon: MessageSquare },
  { time: '24/05', title: 'Consultor registrou concorrência', meta: 'Presença ativa da Rede FarmaMais em itens de alto giro.', tone: 'danger', icon: ShieldAlert },
  { time: '20/05', title: 'Carteira revisada', meta: 'Cliente mantido com criticidade alta para auditoria semanal.', tone: 'success', icon: History },
];

const insights = [
  { time: 'Hoje', title: 'Oportunidade de frequência', meta: 'Aumentar presença na semana de fechamento reduz risco de ruptura.', tone: 'success', icon: Lightbulb },
  { time: 'Hoje', title: 'Alerta territorial', meta: 'Cliente está fora do ciclo ideal há 5 dias.', tone: 'warning', icon: AlertTriangle },
  { time: '7 dias', title: 'Comportamento recorrente', meta: 'Pedidos caem quando a visita passa de 10 dias.', tone: 'info', icon: TrendingUp },
  { time: '15 dias', title: 'Observação operacional', meta: 'Recebimento mais rápido quando a rota chega pela manhã.', tone: 'info', icon: Brain },
];

const criticalityTheme = {
  baixo: 'success',
  médio: 'warning',
  alto: 'danger',
};

export default function Ins() {
  const [selectedId, setSelectedId] = useState(1);
  const [query, setQuery] = useState('');

  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return customers;
    return customers.filter((customer) =>
      `${customer.name} ${customer.code} ${customer.territory}`.toLowerCase().includes(normalized)
    );
  }, [query]);

  const selected = customers.find((customer) => customer.id === selectedId) || customers[0];
  const criticalityTone = criticalityTheme[selected.criticality] || 'info';

  return (
    <div>
      <Header
        title="INS - Analítico"
        subtitle="Inteligência operacional e memória estratégica do cliente"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '330px 1fr', gap: 18, alignItems: 'start' }}>
        <SectionCard title="Clientes analíticos" subtitle="Busca e leitura territorial" icon={Search}>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente, código ou território"
              style={{
                width: '100%',
                padding: '10px 12px 10px 34px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg-hover)',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredCustomers.map((customer) => {
              const active = customer.id === selected.id;
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => setSelectedId(customer.id)}
                  style={{
                    textAlign: 'left',
                    padding: 12,
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${active ? 'rgba(255,107,44,.35)' : 'var(--border)'}`,
                    background: active ? 'rgba(255,107,44,.06)' : '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: active ? 'var(--accent)' : 'var(--primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 11,
                    }}>
                      {customer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{customer.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{customer.code} · {customer.owner}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{customer.territory}</span>
                    <MockBadge tone={criticalityTheme[customer.criticality]}>{customer.criticality}</MockBadge>
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SectionCard
            title={selected.name}
            subtitle={`${selected.code} · ${selected.territory}`}
            icon={Building2}
            action={<MockBadge tone={criticalityTone}>Criticidade {selected.criticality}</MockBadge>}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 16, marginBottom: 18 }}>
              <MetricCard label="Potencial" value={selected.potential} helper="potencial operacional" icon={Target} tone="accent" />
              <MetricCard label="Concorrência" value={selected.competition} helper="pressão registrada" icon={ShieldAlert} tone={criticalityTone} />
              <MetricCard label="Frequência ideal" value={selected.idealFrequency} helper="política territorial" icon={CalendarClock} />
              <MetricCard label="Última visita" value={selected.lastVisit} helper="janela auditada" icon={MapPin} tone={selected.criticality === 'alto' ? 'danger' : 'success'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 18, alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>
                  Observações estratégicas
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selected.notes.map((note) => (
                    <div key={note} style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                      {note}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Score de memória territorial</span>
                  <strong>{selected.score}%</strong>
                </div>
                <ProgressBar value={selected.score} tone={selected.score >= 90 ? 'success' : selected.score >= 80 ? 'accent' : 'warning'} />
                <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                  O score consolida frequência, histórico recente, observações e risco competitivo em uma leitura operacional.
                </div>
              </div>
            </div>
          </SectionCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
            <SectionCard title="Histórico operacional" subtitle="Memória auditável do cliente" icon={History}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {history.map((item) => (
                  <TimelineRow key={item.title} {...item} status="Registrado" />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Timeline de insights" subtitle="Sinais para decisão territorial" icon={Brain}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {insights.map((item) => (
                  <TimelineRow key={item.title} {...item} status={item.tone === 'warning' ? 'Alerta' : 'Insight'} />
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Leitura territorial" subtitle="Resumo executivo para auditoria" icon={Users}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 16, alignItems: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65 }}>
                O cliente apresenta potencial relevante e depende de consistência operacional. A próxima decisão recomendada é preservar a cadência de visitas, registrar concorrência em campo e acompanhar a janela de reposição antes do fim de semana.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <MockBadge tone="info">Território monitorado</MockBadge>
                <MockBadge tone={criticalityTone}>Prioridade {selected.criticality}</MockBadge>
                <MockBadge tone="success">Memória ativa</MockBadge>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
