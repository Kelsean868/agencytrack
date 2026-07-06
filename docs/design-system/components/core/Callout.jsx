// Gold-tint callout — recognition/attention band. Source: .ds-callout.
export function Callout({ children, style }) {
  return (
    <div style={{
      background: 'var(--gold-tint, var(--goldTint))',
      border: '1px solid rgba(176,125,26,.25)',
      borderRadius: 14, padding: '18px 20px',
      color: '#7A5A16', fontFamily: 'var(--sans)', fontSize: 14.5, lineHeight: 1.55,
      ...style,
    }}>{children}</div>
  );
}
