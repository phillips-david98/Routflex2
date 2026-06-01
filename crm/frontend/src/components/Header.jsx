import { useState } from 'react';
import { Bell, ChevronDown, HelpCircle, LogOut, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSession } from '../contexts/SessionContext.jsx';

export default function Header({ title, subtitle, actions }) {
  const { activeSession } = useSession();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);

  function handleLogout() {
    logout();
    setAccountOpen(false);
    navigate('/', { replace: true });
  }

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
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setAccountOpen((value) => !value)}
            title="Conta"
            style={{
              height: 34,
              borderRadius: 999,
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 800,
              padding: '0 9px 0 11px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            RF
            <ChevronDown size={13} />
          </button>

          {accountOpen && (
            <div style={{
              position: 'absolute',
              top: 42,
              right: 0,
              width: 280,
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              zIndex: 500,
            }}>
              <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,107,44,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserRound size={18} color="var(--accent)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>ROUTflex OPS</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Control Tower CRM</div>
                  </div>
                </div>
                {[
                  ['Usuario', user?.name || 'Administrador OPS'],
                  ['Perfil', user?.profile || 'Administrador OPS'],
                  ['Regiao', activeSession?.ddd ? `DDD ${activeSession.ddd}` : user?.region || 'DDD 65'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
                    <strong style={{ fontSize: 11, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</strong>
                  </div>
                ))}
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#00695C', fontSize: 11, fontWeight: 800, padding: '7px 8px', marginBottom: 6 }}>
                  <ShieldCheck size={14} />
                  Sessao mockada ativa
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 10px',
                    borderRadius: 'var(--radius)',
                    color: '#B91C1C',
                    background: 'var(--error-bg)',
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  <LogOut size={15} />
                  Sair do sistema
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
