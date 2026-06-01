import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Plug,
  RotateCw,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MockBadge,
  ProgressBar,
  SectionCard,
  TimelineRow,
} from './ModuleMockUi.jsx';

const integrations = [
  ['ERP', 'ativo', 'Pedidos e clientes', 'success'],
  ['WhatsApp', 'sincronizando', 'Mensagens operacionais', 'info'],
  ['GPS', 'atencao', 'Pacotes de localizacao', 'warning'],
  ['Banco', 'ativo', 'Base operacional', 'success'],
  ['CRM externo', 'offline', 'Carga comercial', 'danger'],
];

const logs = [
  { time: '15:08', title: 'Sincronizacao executada', meta: 'ERP atualizou clientes e rotas elegiveis.', tone: 'success', icon: CheckCircle2 },
  { time: '14:42', title: 'Falha detectada', meta: 'CRM externo recusou pacote de credenciais.', tone: 'danger', icon: AlertTriangle },
  { time: '13:10', title: 'Token validado', meta: 'Canal WhatsApp renovado automaticamente.', tone: 'info', icon: ShieldCheck },
];

export default function Integracoes() {
  return (
    <div>
      <Header
        title="Integrações"
        subtitle="Central de integracao operacional do ecossistema"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
        <SectionCard title="Integracoes operacionais" subtitle="Status visual dos conectores criticos" icon={Plug}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {integrations.map(([name, status, detail, tone]) => (
              <div key={name} style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 12, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, background: '#fff' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(30,58,110,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plug size={16} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{detail}</div>
                </div>
                <MockBadge tone={tone}>{status}</MockBadge>
              </div>
            ))}
          </div>
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SectionCard title="Painel tecnico" subtitle="Governanca de integridade" icon={Wifi}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Ultima sincronizacao', '15:08'],
                ['Supervisor tecnico', 'NOC Operacional'],
                ['Integridade operacional', '89%'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                  <strong style={{ fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</strong>
                </div>
              ))}
              <ProgressBar value={89} tone="success" />
            </div>
          </SectionCard>

          <SectionCard title="Logs mockados" subtitle="Eventos tecnicos recentes" icon={Clock3}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {logs.map((log) => (
                <TimelineRow key={log.title} {...log} status={log.tone === 'danger' ? 'Falha' : 'OK'} />
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
