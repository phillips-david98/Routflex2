import { Layers } from 'lucide-react';
import Header from '../components/Header.jsx';

function InitialStructureBadge() {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(30,58,110,.08)',
      border: '1px solid rgba(30,58,110,.15)',
      borderRadius: 6,
      padding: '4px 12px',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--primary)',
      letterSpacing: '.3px',
      textTransform: 'uppercase',
    }}>
      <Layers size={11} />
      Estrutura inicial
    </div>
  );
}

export default function ModulePlaceholder({ title, subtitle, description, icon: Icon = Layers }) {
  return (
    <div>
      <Header
        title={title}
        subtitle={subtitle}
        actions={<InitialStructureBadge />}
      />

      <div style={{ padding: 24 }}>
        <section style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          minHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{
            maxWidth: 620,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 14,
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: 'rgba(255,107,44,.1)',
              border: '1px solid rgba(255,107,44,.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icon size={24} color="var(--accent)" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                {title}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                {description}
              </p>
            </div>
            <div style={{
              width: '100%',
              marginTop: 10,
              borderTop: '1px solid var(--border)',
              paddingTop: 18,
              color: 'var(--text-muted)',
              fontSize: 12,
            }}>
              Container reservado para a evolução operacional do módulo.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
