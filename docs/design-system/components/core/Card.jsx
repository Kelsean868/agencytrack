// Marketing card — paper surface, 1px rule, 18px radius, optional mono number label.
// Source: .ds-card / .step / .rescard patterns.
export function Card({ num, title, children, hoverLift = false, padding = '26px 28px', style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--paper, var(--surface))',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--r-card, 18px)',
        padding,
        transition: 'transform .25s, box-shadow .25s, border-color .25s',
        ...(hoverLift && hover ? { transform: 'translateY(-4px)', boxShadow: '0 18px 40px rgba(38,35,28,.1)', borderColor: 'rgba(1,105,111,.3)' } : {}),
        ...style,
      }}>
      {num ? (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--teal-bright, var(--tealLight))', letterSpacing: '.1em' }}>{num}</div>
      ) : null}
      {title ? (
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.15, fontSize: 21, margin: num ? '14px 0 10px' : '0 0 10px' }}>{title}</h3>
      ) : null}
      {children}
    </div>
  );
}
