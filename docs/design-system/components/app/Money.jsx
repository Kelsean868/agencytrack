// TTD currency — the ttd() rule from reference/app-tokens.jsx as a component.
export function Money({ value, mono = true, color, size, style }) {
  let text;
  if (value >= 1000000) text = `TTD ${(value / 1000000).toFixed(2)}M`;
  else if (value >= 1000) text = `TTD ${(value / 1000).toFixed(1)}K`;
  else text = `TTD ${Math.round(value).toLocaleString()}`;
  return (
    <span style={{
      fontFamily: mono ? 'var(--mono)' : 'var(--display)',
      fontWeight: mono ? 700 : 800,
      letterSpacing: mono ? 0 : '-.02em',
      color, fontSize: size, ...style,
    }}>{text}</span>
  );
}
