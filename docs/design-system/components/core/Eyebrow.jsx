// Mono uppercase eyebrow — the brand's signature microlabel.
// 12px/700/.22em (marketing) or 10.5-11px/.14-.18em (app density).
// `tone="faint"` renders in --inkFaint (used by app nav/section headers);
// explicit `color` always wins. className="eyebrow" lets nav CSS target it.
export function Eyebrow({ children, color, tone, size = 'md', star = false, style, className }) {
  const fs = size === 'sm' ? 10.5 : 12;
  const ls = size === 'sm' ? '0.14em' : '0.22em';
  const toneColor = tone === 'faint' ? 'var(--inkFaint)' : undefined;
  return (
    <div className={['eyebrow', className].filter(Boolean).join(' ')} style={{
      fontFamily: 'var(--mono)', fontSize: fs, fontWeight: 700,
      letterSpacing: ls, textTransform: 'uppercase',
      color: color || toneColor || 'var(--teal)', ...style,
    }}>
      {star ? '★ ' : ''}{children}
    </div>
  );
}
