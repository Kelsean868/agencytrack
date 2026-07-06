// AgencyTrack Button — solid teal primary or ghost outline. Never gradients.
// Values from marketing/tokens.css .ds-btn / reference index.html .btn.
export function Button({ variant = 'primary', size = 'md', children, icon, href, onClick, disabled, style }) {
  const pad = size === 'sm' ? '10px 14px' : size === 'lg' ? '14px 24px' : '12px 20px';
  const fs = size === 'sm' ? 13 : 14.5;
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
    fontFamily: 'var(--sans)', fontWeight: 700, fontSize: fs,
    padding: pad, borderRadius: 'var(--r-btn, 12px)', cursor: disabled ? 'default' : 'pointer',
    border: 0, textDecoration: 'none', lineHeight: 1.2,
    transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
    opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto',
  };
  const variants = {
    primary: { background: 'var(--teal)', color: '#fff' },
    ghost: { background: 'transparent', color: 'var(--ink)', border: '1.5px solid var(--rule)', padding: shrinkPad(pad, 1.5) },
  };
  const [hover, setHover] = React.useState(false);
  const hoverStyle = hover && !disabled
    ? variant === 'primary'
      ? { transform: 'translateY(-1px)', boxShadow: 'var(--sh-cta, 0 8px 20px rgba(1,105,111,.28))' }
      : { borderColor: 'var(--ink-faint, var(--inkFaint))' }
    : {};
  const Tag = href ? 'a' : 'button';
  return (
    <Tag href={href} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...hoverStyle, ...style }}>
      {children}{icon ? <span aria-hidden="true">{icon}</span> : null}
    </Tag>
  );
}

function shrinkPad(pad, by) {
  return pad.split(' ').map((p) => `${parseFloat(p) - by}px`).join(' ');
}
