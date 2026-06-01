import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Radio,
  Route,
  Send,
  ShieldCheck,
  UserRound,
  Wifi,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import {
  MockBadge,
  SectionCard,
  TimelineRow,
} from './ModuleMockUi.jsx';

const conversations = [
  { name: 'Ana Souza', role: 'Consultora · Cuiaba Norte', status: 'online', badge: 'rota ativa', last: 'Checklist finalizado ha 4 min', tone: 'success', active: true },
  { name: 'Ricardo Lima', role: 'Consultor · Varzea Grande', status: 'aguardando retorno', badge: 'pendente', last: 'Solicitacao de foto enviada', tone: 'warning' },
  { name: 'Equipe DDD 65', role: 'Grupo operacional', status: 'sincronizado', badge: 'equipe', last: 'Rota consolidada recebida', tone: 'info' },
  { name: 'Supervisor Norte', role: 'Supervisao territorial', status: 'alerta operacional', badge: 'escalado', last: 'Desvio aguardando validacao', tone: 'danger' },
];

const conversationMessages = [
  { source: 'Sistema', time: '07:35', text: 'Rota iniciada as 07:35. Janela operacional aberta para 12 clientes.', tone: 'info', align: 'left' },
  { source: 'Supervisor', time: '08:12', text: 'Confirmar visita na FarmaMais antes de seguir para o Mercado Sao Jorge.', tone: 'primary', align: 'right' },
  { source: 'Consultor', time: '08:42', text: 'Cliente sem responsavel no local. Vou aguardar 10 minutos e registrar evidencia.', tone: 'warning', align: 'left' },
  { source: 'Sistema', time: '09:03', text: 'Desvio detectado da rota planejada. Distancia estimada: 1,8 km.', tone: 'danger', align: 'left' },
  { source: 'Consultor', time: '09:18', text: 'Checklist finalizado. Foto da fachada anexada ao Palm.', tone: 'success', align: 'left' },
];

const operationalAlerts = [
  ['Atraso detectado', 'Mercado Sao Jorge · +18 min', 'warning'],
  ['Parada longa', '16 min proximo ao cliente', 'warning'],
  ['Perda de sinal', '4 min sem pacote GPS', 'danger'],
  ['Visita pendente', 'Padaria Estrela sem encerramento', 'info'],
];

const quickActions = [
  ['Reenviar rota', Route],
  ['Solicitar foto', MessageCircle],
  ['Solicitar justificativa', AlertTriangle],
  ['Escalar supervisor', ShieldCheck],
];

const timeline = [
  { time: '07:35', title: 'Mensagem enviada', meta: 'Rota do dia enviada para Ana Souza.', tone: 'success', icon: Send },
  { time: '08:42', title: 'Confirmacao recebida', meta: 'Consultor respondeu ocorrencia em campo.', tone: 'info', icon: CheckCircle2 },
  { time: '09:03', title: 'Alerta escalado', meta: 'Desvio de rota registrado para supervisao.', tone: 'warning', icon: AlertTriangle },
  { time: '09:18', title: 'Supervisor acionado', meta: 'Evidencia recebida e conversa mantida em auditoria.', tone: 'success', icon: ShieldCheck },
];

function ConversationItem({ item }) {
  return (
    <div style={{
      padding: 12,
      borderRadius: 'var(--radius)',
      border: `1px solid ${item.active ? 'rgba(255,107,44,.35)' : 'var(--border)'}`,
      background: item.active ? 'rgba(255,107,44,.06)' : '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: item.active ? 'var(--accent)' : 'rgba(30,58,110,.08)',
          color: item.active ? '#fff' : 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 11,
        }}>
          {item.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{item.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.role}</div>
        </div>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: item.tone === 'success' ? 'var(--success)' : item.tone === 'warning' ? 'var(--warning)' : item.tone === 'danger' ? 'var(--error)' : 'var(--info)',
          flexShrink: 0,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.status}</span>
        <MockBadge tone={item.tone}>{item.badge}</MockBadge>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.last}</div>
    </div>
  );
}

function ConversationBubble({ message }) {
  const isRight = message.align === 'right';
  const border = message.tone === 'danger'
    ? 'rgba(255,71,87,.28)'
    : message.tone === 'warning'
      ? 'rgba(255,179,0,.35)'
      : message.tone === 'success'
        ? 'rgba(0,200,150,.25)'
        : 'var(--border)';

  return (
    <div style={{ display: 'flex', justifyContent: isRight ? 'flex-end' : 'flex-start' }}>
      <div style={{
        width: 'min(72%, 560px)',
        border: `1px solid ${border}`,
        borderRadius: 10,
        background: isRight ? 'rgba(30,58,110,.06)' : '#fff',
        padding: '11px 13px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{message.source}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{message.time}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message.text}</div>
      </div>
    </div>
  );
}

export default function WhatsAppOperacional() {
  return (
    <div>
      <Header
        title="WhatsApp Operacional"
        subtitle="Hub operacional conversacional integrado a rota"
        actions={<MockBadge tone="success">Mock visual controlado</MockBadge>}
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 330px', gap: 18, alignItems: 'start' }}>
          <SectionCard title="Conversas operacionais" subtitle="Coordenação de campo e supervisão" icon={MessageCircle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conversations.map((item) => (
                <ConversationItem key={item.name} item={item} />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Ana Souza · Rota Cuiaba Norte"
            subtitle="Timeline conversacional operacional · DDD 65"
            icon={UserRound}
            action={<MockBadge tone="success"><Wifi size={12} /> online</MockBadge>}
          >
            <div style={{
              minHeight: 515,
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              {conversationMessages.map((message) => (
                <ConversationBubble key={`${message.time}-${message.source}`} message={message} />
              ))}
            </div>
          </SectionCard>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SectionCard title="Alertas operacionais" subtitle="Sinais vinculados a rota" icon={AlertTriangle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {operationalAlerts.map(([title, detail, tone]) => (
                  <div key={title} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', padding: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                      <strong style={{ fontSize: 12, color: 'var(--text-primary)' }}>{title}</strong>
                      <MockBadge tone={tone}>{tone === 'danger' ? 'critico' : tone === 'warning' ? 'atenção' : 'info'}</MockBadge>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{detail}</div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Ações rápidas" subtitle="Comandos visuais mockados" icon={Radio}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {quickActions.map(([label, Icon]) => (
                  <button key={label} type="button" style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: '#fff',
                    padding: '10px 9px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 800,
                    textAlign: 'left',
                  }}>
                    <Icon size={14} color="var(--primary)" />
                    {label}
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Timeline operacional" subtitle="Registro auditavel da comunicacao" icon={Clock3}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(190px, 1fr))', gap: 18 }}>
            {timeline.map((item) => (
              <TimelineRow key={item.title} {...item} status={item.tone === 'warning' ? 'Escalado' : 'OK'} />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
