const STATUS_CONFIG = {
  ATIVO: {
    label: 'Ativo',
    bg: 'var(--success-bg)',
    color: '#00695C',
    dot: 'var(--success)',
  },
  INATIVO: {
    label: 'Inativo',
    bg: 'var(--error-bg)',
    color: '#C62828',
    dot: 'var(--error)',
  },
  SEM_COORDENADA: {
    label: 'Sem Coordenada',
    bg: 'var(--warning-bg)',
    color: '#E65100',
    dot: 'var(--warning)',
  },
  PENDENTE_INTEGRACAO: {
    label: 'Pend. Integração',
    bg: 'var(--info-bg)',
    color: '#1565C0',
    dot: 'var(--info)',
  },
};

export default function Badge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: '#F5F5F5', color: '#555', dot: '#555' };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 9px',
      borderRadius: '99px',
      fontSize: 11,
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}
