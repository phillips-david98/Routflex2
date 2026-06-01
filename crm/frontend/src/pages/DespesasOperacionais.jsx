import {
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Fuel,
  Route,
  ShieldX,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MetricCard,
  MockBadge,
  ProgressBar,
  SectionCard,
} from './ModuleMockUi.jsx';

const expenses = [
  { collaborator: 'Ana Souza', type: 'Combustivel', value: 'R$ 286,40', route: 'Cuiaba Norte', status: 'Aprovado', date: '31/05', tone: 'success' },
  { collaborator: 'Ricardo Lima', type: 'Pedagio', value: 'R$ 42,80', route: 'Varzea Grande', status: 'Pago', date: '31/05', tone: 'info' },
  { collaborator: 'Fernanda Costa', type: 'Frete apoio', value: 'R$ 510,00', route: 'Cuiaba Leste', status: 'Pendente', date: '30/05', tone: 'warning' },
  { collaborator: 'Equipe DDD 65', type: 'Reembolso avulso', value: 'R$ 118,90', route: 'Rota critica', status: 'Reprovado', date: '29/05', tone: 'danger' },
];

const summary = [
  ['Custo/km', 'R$ 2,84'],
  ['Maior despesa', 'Frete apoio'],
  ['Media diaria', 'R$ 957,20'],
  ['Pendencias', '4 lancamentos'],
];

function ExpenseTable() {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {['Colaborador', 'Tipo', 'Valor', 'Rota', 'Status', 'Data'].map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={`${expense.collaborator}-${expense.type}`}>
              <td style={{ fontWeight: 700 }}>{expense.collaborator}</td>
              <td>{expense.type}</td>
              <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{expense.value}</td>
              <td>{expense.route}</td>
              <td><MockBadge tone={expense.tone}>{expense.status}</MockBadge></td>
              <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{expense.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DespesasOperacionais() {
  return (
    <div>
      <Header
        title="Despesas Operacionais"
        subtitle="Controle operacional de custos da operacao logistica"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 16 }}>
          <MetricCard label="Combustivel" value="R$ 4,8k" helper="ciclo atual" icon={Fuel} tone="accent" />
          <MetricCard label="Frete" value="R$ 2,1k" helper="apoios operacionais" icon={Truck} tone="primary" />
          <MetricCard label="Pedagio" value="R$ 640" helper="rotas auditadas" icon={CreditCard} tone="success" />
          <MetricCard label="Pendentes" value="R$ 912" helper="aguardando aprovacao" icon={Clock3} tone="warning" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Lancamentos operacionais" subtitle="Custos vinculados a colaborador, rota e status" icon={FileText}>
            <ExpenseTable />
          </SectionCard>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SectionCard title="Resumo operacional" subtitle="Leitura executiva de custos" icon={Wallet}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {summary.map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                    <strong style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</strong>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Status financeiro" subtitle="Fila simples de auditoria" icon={Banknote}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  ['Pendente', Clock3, 'warning'],
                  ['Aprovado', CheckCircle2, 'success'],
                  ['Pago', Wallet, 'info'],
                  ['Reprovado', ShieldX, 'danger'],
                ].map(([label, Icon, tone]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}>
                    <Icon size={15} color={tone === 'success' ? 'var(--success)' : tone === 'warning' ? 'var(--warning)' : tone === 'danger' ? 'var(--error)' : 'var(--primary)'} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Previsto x realizado" subtitle="Comparativo visual controlado de custo operacional" icon={TrendingUp}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {[
              ['Combustivel', '88%', 'accent'],
              ['Frete apoio', '61%', 'primary'],
              ['Despesas pendentes', '24%', 'warning'],
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
