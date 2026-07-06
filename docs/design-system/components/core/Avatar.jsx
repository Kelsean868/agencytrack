// Initials-tile avatar — the ONLY avatar treatment (never photos/generated faces).
// Circle for people; 12px-radius square tiles for roles. Display font initials.
export function Avatar({ initials, size = 34, shape = 'circle', bg, color, ring = false, style }) {
  return (
    <span style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: shape === 'circle' ? '50%' : Math.round(size * 0.29),
      background: bg || 'var(--tealTint, var(--teal-tint))',
      color: color || (bg ? '#fff' : 'var(--teal)'),
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--display)', fontWeight: 800,
      fontSize: Math.round(size * 0.38), lineHeight: 1, letterSpacing: 0,
      boxShadow: ring ? '0 0 0 2px rgba(54,189,185,.5)' : 'none',
      ...style,
    }}>{initials}</span>
  );
}
