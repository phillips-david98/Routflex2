import { X, CheckCircle, Calendar, MapPin, Info } from 'lucide-react';
import { useSession } from '../contexts/SessionContext.jsx';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SessionSelector({ open, onClose }) {
  const { sessions, activeSession, switchSession } = useSession();

  const handleSwitch = (session) => {
    switchSession(session);
    onClose();
  };

  if (!open) return null;

  const activeSessions = sessions.filter((s) => s.status === 'ATIVA');

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <span className="modal-title">Selecionar Região (DDD)</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Available regions */}
          {activeSessions.length > 0 ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                Regiões disponíveis ({activeSessions.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeSessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSwitch(s)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: activeSession?.id === s.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: activeSession?.id === s.id ? 'rgba(30,58,110,.06)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'all .15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{
                      width: 40, height: 40,
                      borderRadius: 8,
                      background: activeSession?.id === s.id ? 'var(--primary)' : 'var(--bg-main)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 14,
                      color: activeSession?.id === s.id ? '#fff' : 'var(--text-primary)',
                    }}>
                      {s.ddd}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name || `Região DDD ${s.ddd}`}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, marginTop: 2 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={10} /> DDD {s.ddd}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Calendar size={10} /> {formatDate(s.created_at)}
                        </span>
                      </div>
                    </div>
                    {activeSession?.id === s.id && (
                      <CheckCircle size={18} color="var(--success)" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>
              <Info size={40} color="var(--text-muted)" />
              <strong>Nenhuma região disponível</strong>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340 }}>
                As regiões são criadas pelo módulo de Roteirização.
                Crie uma sessão de planejamento lá para visualizar dados aqui.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
