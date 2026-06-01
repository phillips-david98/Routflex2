import { CheckCircle2, Circle, Flag, MapPin } from 'lucide-react';

export function MockBadge({ children, tone = 'info' }) {
  const tones = {
    info: { bg: 'rgba(30,58,110,.08)', border: 'rgba(30,58,110,.16)', color: 'var(--primary)' },
    success: { bg: 'var(--success-bg)', border: 'rgba(0,200,150,.25)', color: '#00695C' },
    warning: { bg: 'var(--warning-bg)', border: 'rgba(255,179,0,.35)', color: '#92400E' },
    danger: { bg: 'var(--error-bg)', border: 'rgba(255,71,87,.28)', color: '#B91C1C' },
  };
  const style = tones[tone] || tones.info;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 9px',
      borderRadius: 999,
      border: `1px solid ${style.border}`,
      background: style.bg,
      color: style.color,
      fontSize: 11,
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

export function MetricCard({ label, value, helper, icon: Icon, tone = 'primary' }) {
  const colors = {
    primary: { color: 'var(--primary)', bg: 'rgba(30,58,110,.08)' },
    accent: { color: 'var(--accent)', bg: 'rgba(255,107,44,.1)' },
    success: { color: '#00695C', bg: 'var(--success-bg)' },
    warning: { color: '#92400E', bg: 'var(--warning-bg)' },
    danger: { color: '#B91C1C', bg: 'var(--error-bg)' },
  };
  const theme = colors[tone] || colors.primary;

  return (
    <div className="stat-card" style={{ minHeight: 126 }}>
      <div className="stat-card-icon" style={{ background: theme.bg }}>
        <Icon size={18} color={theme.color} />
      </div>
      <div className="stat-card-value" style={{ color: theme.color, fontSize: 25 }}>{value}</div>
      <div className="stat-card-label">{label}</div>
      {helper && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{helper}</div>}
    </div>
  );
}

export function SectionCard({ title, subtitle, icon: Icon, action, children, style }) {
  return (
    <section style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
      }}>
        {Icon && <Icon size={16} color="var(--text-secondary)" />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}
        </div>
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </section>
  );
}

export function ProgressBar({ value, tone = 'success' }) {
  const colors = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--error)',
    accent: 'var(--accent)',
    primary: 'var(--primary)',
  };

  return (
    <div style={{ height: 8, borderRadius: 99, background: 'var(--bg-main)', overflow: 'hidden' }}>
      <div style={{
        width: `${value}%`,
        height: '100%',
        borderRadius: 99,
        background: colors[tone] || colors.success,
      }} />
    </div>
  );
}

export function TimelineRow({ time, title, meta, status, tone = 'info', icon: Icon = Circle }) {
  const dot = {
    info: 'var(--info)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--error)',
    accent: 'var(--accent)',
    muted: 'var(--text-muted)',
  }[tone] || 'var(--info)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 20px 1fr auto', gap: 10, alignItems: 'start' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', paddingTop: 2 }}>{time}</div>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', border: `2px solid ${dot}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={10} color={dot} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        {meta && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{meta}</div>}
      </div>
      {status && <MockBadge tone={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'info'}>{status}</MockBadge>}
    </div>
  );
}

export function MapPlaceholder({ variant = 'route', height = 330 }) {
  const path = variant === 'telemetry'
    ? 'M48 260 C105 210 118 150 176 150 C232 151 232 80 305 78 C383 75 413 130 458 104'
    : 'M42 225 C94 188 120 192 150 146 C188 91 246 117 288 82 C332 45 380 78 425 50';

  const points = variant === 'telemetry'
    ? [
      { x: 48, y: 260, label: 'Início' },
      { x: 176, y: 150, label: 'Parada' },
      { x: 305, y: 78, label: 'Cliente' },
      { x: 458, y: 104, label: 'Fim' },
    ]
    : [
      { x: 42, y: 225, label: 'Base' },
      { x: 150, y: 146, label: 'C2' },
      { x: 288, y: 82, label: 'C4' },
      { x: 425, y: 50, label: 'C7' },
    ];

  return (
    <div style={{
      height,
      position: 'relative',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      background: '#EEF3F8',
      border: '1px solid var(--border)',
    }}>
      <svg viewBox="0 0 500 300" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <pattern id={`grid-${variant}`} width="42" height="42" patternUnits="userSpaceOnUse">
            <path d="M 42 0 L 0 0 0 42" fill="none" stroke="rgba(30,58,110,.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="500" height="300" fill={`url(#grid-${variant})`} />
        <path d="M0 85 L500 36" stroke="rgba(30,58,110,.08)" strokeWidth="18" />
        <path d="M0 236 L500 196" stroke="rgba(30,58,110,.08)" strokeWidth="14" />
        <path d={path} fill="none" stroke="rgba(30,58,110,.25)" strokeWidth="10" strokeLinecap="round" />
        <path d={path} fill="none" stroke={variant === 'telemetry' ? 'var(--primary)' : 'var(--accent)'} strokeWidth="4" strokeLinecap="round" />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r={index === 0 || index === points.length - 1 ? 9 : 7} fill="#fff" stroke={index === points.length - 1 ? 'var(--success)' : 'var(--accent)'} strokeWidth="4" />
            <text x={point.x + 12} y={point.y - 8} fill="#1A1A2E" fontSize="12" fontWeight="700">{point.label}</text>
          </g>
        ))}
      </svg>
      <div style={{ position: 'absolute', left: 14, bottom: 14 }}>
        <MockBadge tone="info"><MapPin size={12} /> Mapa visual mockado</MockBadge>
      </div>
    </div>
  );
}

export function ChecklistItem({ checked, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      {checked ? <CheckCircle2 size={16} color="var(--success)" /> : <Flag size={16} color="var(--warning)" />}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}
