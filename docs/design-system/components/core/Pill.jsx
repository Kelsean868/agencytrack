// Status/label pill — 999px radius, tinted bg + strong ink. Source: app Pill + status bands.
const PILL_TONES = {
  teal:    { color: 'var(--teal)',    bg: 'var(--tealTint, var(--teal-tint))' },
  gold:    { color: 'var(--goldInk, var(--gold))', bg: 'var(--goldTint, var(--gold-tint))' },
  success: { color: 'var(--success, #2D7A4F)', bg: 'var(--successTint, #E8F5EE)' },
  warning: { color: 'var(--warning, #B45309)', bg: 'var(--warningTint, #FEF3E2)' },
  danger:  { color: 'var(--danger, #C0392B)',  bg: 'var(--dangerTint, #FDE8E7)' },
  neutral: { color: 'var(--ink-mute, var(--inkMute))', bg: 'var(--rule-soft, var(--surfaceMute))' },
  violet:  { color: 'var(--inkAccent, #5A3FA0)', bg: 'var(--inkAccentTint, #F0ECFF)' },
};

export function Pill({ tone = 'teal', solid = false, children, style }) {
  const t = PILL_TONES[tone] || PILL_TONES.teal;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      fontSize: 9.5, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      fontFamily: 'var(--sans)', whiteSpace: 'nowrap', flexShrink: 0,
      color: solid ? '#fff' : t.color,
      background: solid ? t.color : t.bg,
      ...style,
    }}>{children}</span>
  );
}
