import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Route, Settings, Zap, MapPin, Activity } from 'lucide-react';
import { useSession } from '../contexts/SessionContext.jsx';
import SessionSelector from './SessionSelector.jsx';

const NAV_ITEMS = [
  { to: '/',             label: 'Dashboard',        icon: LayoutDashboard },
  { to: '/controle',     label: 'Torre de Controle', icon: Activity },
  { to: '/clientes',     label: 'Clientes',         icon: Users },
  { to: '/roteirizacao', label: 'Roteirização',     icon: Route },
];

export default function Sidebar() {
  const { activeSession } = useSession();
  const [selectorOpen, setSelectorOpen] = useState(false);

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      background: 'var(--sidebar-bg)',
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--accent)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>ROUTflex</div>
            <div style={{ color: 'var(--sidebar-text)', fontSize: 11 }}>CRM módulo</div>
          </div>
        </div>
      </div>

      {/* Session indicator */}
      <div
        onClick={() => setSelectorOpen(true)}
        style={{
          margin: '12px 10px 0',
          padding: '10px 12px',
          borderRadius: 8,
          background: activeSession ? 'rgba(255,107,44,.12)' : 'rgba(255,255,255,.06)',
          border: activeSession ? '1px solid rgba(255,107,44,.3)' : '1px solid rgba(255,255,255,.1)',
          cursor: 'pointer',
          transition: 'all .15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={14} color={activeSession ? 'var(--accent)' : 'var(--sidebar-text)'} />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
              {activeSession ? (activeSession.name || `Região DDD ${activeSession.ddd}`) : 'Sem região'}
            </div>
            {activeSession && (
              <div style={{ color: 'var(--sidebar-text)', fontSize: 10, marginTop: 1 }}>
                DDD {activeSession.ddd} · Selecionada
              </div>
            )}
          </div>
          <div style={{
            background: activeSession ? 'var(--accent)' : 'rgba(255,255,255,.15)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 4,
          }}>
            {activeSession ? activeSession.ddd : '···'}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(148,163,184,.5)', textTransform: 'uppercase', letterSpacing: '.6px', padding: '8px 10px 4px' }}>
          Principal
        </div>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px',
              borderRadius: 6,
              color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
              background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              transition: 'all .15s',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={16} color={isActive ? 'var(--accent)' : 'currentColor'} />
                {label}
                {isActive && (
                  <div style={{
                    width: 3, height: 14, background: 'var(--accent)',
                    borderRadius: 2, marginLeft: 'auto',
                  }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,.06)',
        fontSize: 11,
        color: 'var(--sidebar-text)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: activeSession ? 'var(--success)' : 'var(--warning)',
            boxShadow: activeSession ? '0 0 0 2px rgba(0,200,150,.2)' : '0 0 0 2px rgba(255,179,0,.2)',
          }} />
          {activeSession ? `Região DDD ${activeSession.ddd}` : 'Nenhuma região selecionada'}
        </div>
      </div>

      <SessionSelector open={selectorOpen} onClose={() => setSelectorOpen(false)} />
    </aside>
  );
}
