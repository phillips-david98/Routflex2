import { useState } from 'react';
import { Users, ChevronRight } from 'lucide-react';
import { useSession } from '../contexts/SessionContext.jsx';
import SessionSelector from './SessionSelector.jsx';

export default function SessionGuard({ children }) {
  const { hasActiveSession, loading, sessions } = useSession();
  const [selectorOpen, setSelectorOpen] = useState(false);

  console.log('[SessionGuard] render:', { loading, hasActiveSession });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
        <span className="spinner" />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando dados…</span>
      </div>
    );
  }

  if (!hasActiveSession) {
    const hasAvailableSessions = sessions.filter((s) => s.status === 'ATIVA').length > 0;

    return (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', flexDirection: 'column', gap: 20,
          background: 'var(--bg-main)',
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--primary-light), var(--primary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={36} color="#fff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Selecione uma região
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, maxWidth: 420 }}>
              {hasAvailableSessions
                ? 'Escolha a região (DDD) que deseja visualizar para acessar o painel de auditoria e gestão de clientes.'
                : 'Nenhuma região cadastrada. Crie uma sessão no módulo de Roteirização para começar a usar o CRM.'}
            </p>
          </div>
          {hasAvailableSessions && (
            <button className="btn btn-primary" onClick={() => setSelectorOpen(true)} style={{ fontSize: 14, padding: '10px 24px' }}>
              <ChevronRight size={16} /> Selecionar Região
            </button>
          )}
        </div>
        <SessionSelector open={selectorOpen} onClose={() => setSelectorOpen(false)} />
      </>
    );
  }

  return children;
}
