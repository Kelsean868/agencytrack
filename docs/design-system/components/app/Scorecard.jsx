// Compact KPI scorecard — app dashboards. Source: reference/app-shell.jsx Scorecard.
// Requires a .nexus (or .nexus.dark) token scope.
export function Scorecard({ eyebrow, value, sub, accent, big = false, progress, style }) {
  return (
    <div style={{
      flex: 1, padding: '14px 16px',
      background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 11,
      fontFamily: 'var(--sans)', ...style,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: accent || 'var(--teal)', letterSpacing: '0.14em', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>{eyebrow}</div>
      <div style={{
        fontSize: big ? 28 : 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.022em',
        fontFamily: 'var(--display)', lineHeight: 1, marginTop: 8,
      }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: 'var(--inkMute)', marginTop: 5 }}>{sub}</div> : null}
      {progress !== undefined ? (
        <div style={{ marginTop: 10, height: 4, background: 'var(--surfaceMute)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: 4, background: 'linear-gradient(90deg, var(--tealDark), var(--teal))', borderRadius: 999 }}></div>
        </div>
      ) : null}
    </div>
  );
}
