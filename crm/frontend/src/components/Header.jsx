import { Bell, HelpCircle, MapPin } from 'lucide-react';
import { useSession } from '../contexts/SessionContext.jsx';

export default function Header({ title, subtitle, actions }) {
  const { activeSession } = useSession();

  return (
    <header style={{
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</p>
          )}
        </div>
        {activeSession && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(30,58,110,.08)',
            border: '1px solid rgba(30,58,110,.15)',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--primary)',
          }}>
            <MapPin size={11} />
            DDD {activeSession.ddd}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions}
        <button className="btn-ghost btn" title="Notificações">
          <Bell size={16} />
        </button>
        <button className="btn-ghost btn" title="Ajuda">
          <HelpCircle size={16} />
        </button>
        <div style={{
          width: 32, height: 32,
          borderRadius: '50%',
          background: 'var(--primary)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
        }}>
          RF
        </div>
      </div>
    </header>
  );
}
