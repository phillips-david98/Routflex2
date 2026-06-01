import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  LayoutDashboard,
  LineChart,
  MapPin,
  MessageCircle,
  Navigation,
  PackageSearch,
  Plug,
  Route,
  ShieldAlert,
  Users,
  Wallet,
  Warehouse,
  Zap,
} from 'lucide-react';
import { useSession } from '../contexts/SessionContext.jsx';
import SessionSelector from './SessionSelector.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/controle', label: 'Torre de Controle', icon: Activity },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/roteirizacao', label: 'Roteirização', icon: Route },
  { to: '/palm', label: 'Palm - Rotas', icon: Navigation },
  { to: '/ins', label: 'INS - Analítico', icon: LineChart },
  { to: '/auditoria-operacional', label: 'Auditoria Operacional', icon: ClipboardCheck },
  { to: '/ocorrencias', label: 'Ocorrências', icon: ShieldAlert },
  { to: '/despesas-operacionais', label: 'Despesas Operacionais', icon: Wallet },
  { to: '/supply-chain', label: 'Supply Chain', icon: PackageSearch },
  { to: '/equipes-consultores', label: 'Equipes & Consultores', icon: Users },
  { to: '/telemetria', label: 'Telemetria', icon: Gauge },
  { to: '/whatsapp-operacional', label: 'WhatsApp Operacional', icon: MessageCircle },
  { to: '/indicadores-operacionais', label: 'Indicadores Operacionais', icon: BarChart3 },
  { to: '/integracoes', label: 'Integrações', icon: Plug },
  { to: '/central-logistica', label: 'Central Logística', icon: Warehouse },
];

export default function Sidebar({ collapsed = false, transitioning = false, onToggle }) {
  const { activeSession } = useSession();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const width = collapsed ? 76 : 240;
  const showExpandedContent = !collapsed || transitioning;

  return (
    <aside className={`sidebar-shell${collapsed ? ' is-collapsed' : ''}${transitioning ? ' is-transitioning' : ''}`} style={{
      width,
      background: 'var(--sidebar-bg)',
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      transition: 'width 320ms cubic-bezier(.22, 1, .36, 1)',
      overflow: 'visible',
    }}>
      <button
        type="button"
        onClick={onToggle}
        className="sidebar-toggle"
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        aria-expanded={!collapsed}
        style={{
          position: 'absolute',
          top: 22,
          right: -15,
          width: 30,
          height: 30,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <span className="sidebar-toggle-icon">
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </span>
      </button>

      <div style={{
        padding: collapsed ? '18px 14px 15px' : '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{
            width: 36,
            height: 36,
            background: 'var(--accent)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Zap size={18} color="#fff" />
          </div>
          {showExpandedContent && (
            <div className={`sidebar-copy${collapsed ? ' is-hidden' : ''}`}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>ROUTflex OPS</div>
              <div style={{ color: 'var(--sidebar-text)', fontSize: 11 }}>Control Tower CRM</div>
            </div>
          )}
        </div>
      </div>

      <div
        onClick={() => !collapsed && setSelectorOpen(true)}
        title={activeSession ? `Região DDD ${activeSession.ddd}` : 'Sem região'}
        style={{
          margin: '12px 10px 0',
          padding: collapsed ? '10px 0' : '10px 12px',
          borderRadius: 8,
          background: activeSession ? 'rgba(255,107,44,.12)' : 'rgba(255,255,255,.06)',
          border: activeSession ? '1px solid rgba(255,107,44,.3)' : '1px solid rgba(255,255,255,.1)',
          cursor: collapsed ? 'default' : 'pointer',
          transition: 'background .15s ease, border-color .15s ease, color .15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <MapPin size={14} color={activeSession ? 'var(--accent)' : 'var(--sidebar-text)'} />
          {showExpandedContent && (
            <div className={`sidebar-copy${collapsed ? ' is-hidden' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                  {activeSession ? (activeSession.name || `Região DDD ${activeSession.ddd}`) : 'Sem região'}
                </div>
                {activeSession && (
                  <div style={{ color: 'var(--sidebar-text)', fontSize: 10, marginTop: 1 }}>
                    DDD {activeSession.ddd} - Selecionada
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
                {activeSession ? activeSession.ddd : '---'}
              </div>
            </div>
          )}
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(148,163,184,.5)', textTransform: 'uppercase', letterSpacing: '.6px', padding: collapsed ? '8px 0 4px' : '8px 10px 4px', minHeight: 22 }}>
          {showExpandedContent && (
            <span className={`sidebar-copy${collapsed ? ' is-hidden' : ''}`}>Principal</span>
          )}
        </div>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 6,
              color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
              background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              transition: 'background .15s ease, color .15s ease',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={16} color={isActive ? 'var(--accent)' : 'currentColor'} />
                {showExpandedContent && (
                  <span className={`sidebar-copy${collapsed ? ' is-hidden' : ''}`} style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {label}
                  </span>
                )}
                {isActive && !collapsed && (
                  <div style={{
                    width: 3,
                    height: 14,
                    background: 'var(--accent)',
                    borderRadius: 2,
                    marginLeft: 'auto',
                    flexShrink: 0,
                  }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{
        padding: collapsed ? '12px 0' : '12px 16px',
        borderTop: '1px solid rgba(255,255,255,.06)',
        fontSize: 11,
        color: 'var(--sidebar-text)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 6 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: activeSession ? 'var(--success)' : 'var(--warning)',
            boxShadow: activeSession ? '0 0 0 2px rgba(0,200,150,.2)' : '0 0 0 2px rgba(255,179,0,.2)',
          }} />
          {showExpandedContent && (
            <span className={`sidebar-copy${collapsed ? ' is-hidden' : ''}`}>
              {activeSession ? `Região DDD ${activeSession.ddd}` : 'Nenhuma região selecionada'}
            </span>
          )}
        </div>
      </div>

      <SessionSelector open={selectorOpen} onClose={() => setSelectorOpen(false)} />
    </aside>
  );
}
