import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, KeyRound, Lock, Mail, ShieldCheck, Truck, Users, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

function LoginMetric({ label, value, icon: Icon }) {
  return (
    <div className="login-metric-card" style={{
      border: '1px solid rgba(255,255,255,.12)',
      background: 'rgba(255,255,255,.06)',
      borderRadius: 10,
      padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={15} color="#FFB08A" />
        <span style={{ color: 'rgba(255,255,255,.72)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
      </div>
      <div style={{ color: '#fff', fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@routflex.com');
  const [password, setPassword] = useState('admin');

  function handleSubmit(event) {
    event.preventDefault();
    login({ email, password });
    navigate('/', { replace: true });
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F1B35 0%, #162B54 48%, #F0F2F5 48%, #F0F2F5 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
    }}>
      <div style={{
        width: 'min(1080px, 100%)',
        display: 'grid',
        gridTemplateColumns: '1.05fr .95fr',
        background: '#fff',
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid rgba(15,27,53,.12)',
        boxShadow: '0 24px 70px rgba(15,27,53,.24)',
      }}>
        <section className="login-visual-panel" style={{
          background: 'linear-gradient(145deg, #0F1B35 0%, #1E3A6E 100%)',
          padding: 36,
          color: '#fff',
          minHeight: 600,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div className="login-territory-grid" />
          <div className="login-route-line login-route-line-a" />
          <div className="login-route-line login-route-line-b" />
          <div className="login-orb login-orb-a" />
          <div className="login-orb login-orb-b" />
          <div className="login-route-node login-node-a" />
          <div className="login-route-node login-node-b" />
          <div className="login-route-node login-node-c" />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 42 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>ROUTflex OPS</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.62)', marginTop: 2 }}>Control Tower CRM</div>
              </div>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              border: '1px solid rgba(255,255,255,.18)',
              background: 'rgba(255,255,255,.08)',
              borderRadius: 999,
              padding: '6px 11px',
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 20,
            }}>
              <ShieldCheck size={14} color="#FFB08A" />
              Acesso operacional seguro
            </div>

            <h1 style={{ fontSize: 36, lineHeight: 1.08, marginBottom: 14, letterSpacing: '-.4px' }}>
              Plataforma premium para operação logística auditável.
            </h1>
            <p style={{ color: 'rgba(255,255,255,.72)', fontSize: 14, maxWidth: 460, lineHeight: 1.7 }}>
              Ambiente visual controlado para torre de controle, auditoria operacional, equipes em campo e leitura executiva da operação.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, position: 'relative', zIndex: 1 }}>
            <LoginMetric label="Rotas" value="91%" icon={Truck} />
            <LoginMetric label="Equipes" value="38" icon={Users} />
            <LoginMetric label="Score OPS" value="82" icon={BarChart3} />
          </div>
        </section>

        <section style={{ padding: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>
              Login mockado
            </div>
            <h2 style={{ fontSize: 26, color: 'var(--text-primary)', marginBottom: 8 }}>Entrar no ROUTflex OPS</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Use qualquer usuário e senha para acessar o ambiente visual.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="form-label">Usuário / e-mail</span>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input className="form-control" value={email} onChange={(event) => setEmail(event.target.value)} style={{ paddingLeft: 38 }} />
              </div>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="form-label">Senha</span>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input className="form-control" type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ paddingLeft: 38 }} />
              </div>
            </label>

            <button className="btn btn-primary" type="submit" style={{ justifyContent: 'center', padding: '12px 16px', fontSize: 14, marginTop: 8 }}>
              <Lock size={16} />
              Entrar no ROUTflex OPS
            </button>
          </form>

          <div style={{
            marginTop: 24,
            padding: 14,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            lineHeight: 1.55,
          }}>
            Sessão local mockada para demonstração visual. Não há autenticação real, API, JWT ou cookies complexos.
          </div>
        </section>
      </div>
    </main>
  );
}
