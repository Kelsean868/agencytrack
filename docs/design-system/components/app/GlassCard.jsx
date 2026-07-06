// Nexus Glass hero card — the ONE glass card allowed per app screen.
// Physics come from tokens/glass.css (.glass + .teal/.gold, light/dark, AA fallbacks).
export function GlassCard({ tint = 'teal', padding = '20px 24px', children, style }) {
  return (
    <div className={`glass ${tint}`} style={{ padding, fontFamily: 'var(--sans)', ...style }}>
      {children}
    </div>
  );
}
