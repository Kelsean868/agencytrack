// Email shared primitives — design tokens + EmailFrame wrapper
// Renders email-safe table HTML at 600px wide inside an artboard.

const EMAIL = {
  // Brand
  teal:        '#01696F',
  tealDark:    '#014E52',
  tealLight:   '#018A91',
  tealTint:    '#E6F4F4',

  // Surfaces (cream-warm neutrals — match index.css :root tokens)
  bg:          '#F7F6F2',
  surface:     '#FFFFFF',
  surfaceMute: '#FAFAF8',
  surfaceSoft: '#F4F2EC',

  // Text
  ink:         '#28251D',
  inkMute:     '#6B6560',
  inkFaint:    '#A8A39C',

  // Borders
  border:      '#E5E2DB',
  borderStrong:'#CFCBC2',

  // Status
  danger:      '#C0392B',
  dangerTint:  '#FDE8E7',
  warning:     '#B45309',
  warningTint: '#FEF3E2',
  success:     '#2D7A4F',
  successTint: '#E8F5EE',
  gold:        '#B07D1A',
  goldTint:    '#FDF3DC',
};

// Email-safe font stack — same one the existing templates use.
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// Wrapper that simulates a mail-client viewport: cream page bg + card.
// Children render the inner card HTML (table).
function EmailFrame({ children, accentColor, accentHeight = 4 }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: EMAIL.bg,
      padding: '40px 20px',
      fontFamily: FONT,
      color: EMAIL.ink,
      overflow: 'hidden',
    }}>
      <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellSpacing="0" cellPadding="0" style={{
                width: 600,
                maxWidth: '100%',
                background: EMAIL.surface,
                borderRadius: 14,
                overflow: 'hidden',
                border: `1px solid ${EMAIL.border}`,
                boxShadow: '0 1px 2px rgba(40,37,29,0.04), 0 12px 32px rgba(40,37,29,0.06)',
              }}>
                <tbody>
                  {accentColor && (
                    <tr>
                      <td style={{
                        height: accentHeight,
                        background: accentColor,
                        lineHeight: '0',
                        fontSize: 0,
                      }}>&nbsp;</td>
                    </tr>
                  )}
                  {children}
                </tbody>
              </table>
              {/* Pre-header / inbox preview (visually hidden in real client; shown subtly here for design context) */}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Brand lockup used in refined headers + footers.
function BrandLockup({ size = 'md', tone = 'ink' }) {
  const isSm = size === 'sm';
  const monoSize = isSm ? 28 : 34;
  const wordSize = isSm ? 14 : 16;
  const subSize  = isSm ? 10.5 : 11;
  const textColor = tone === 'ink' ? EMAIL.ink : tone === 'muted' ? EMAIL.inkMute : EMAIL.surface;
  return (
    <table role="presentation" cellSpacing="0" cellPadding="0" style={{ borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: 'middle', paddingRight: 10 }}>
            <svg width={monoSize} height={monoSize} viewBox="0 0 200 200" style={{ display: 'inline-block', borderRadius: isSm ? 7 : 8, verticalAlign: 'middle' }}>
              <rect x="0" y="0" width="200" height="200" rx="44" fill="#014e52" />
              <path d="M100 28 Q65 28 37 42 Q30 45 30 56 L30 115 Q30 160 100 188 Q170 160 170 115 L170 56 Q170 45 163 42 Q135 28 100 28 Z" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.55" strokeWidth="2.5" />
              <rect x="72" y="127" width="11" height="18" rx="2.5" fill="white" fillOpacity="0.30" />
              <rect x="87" y="117" width="11" height="28" rx="2.5" fill="white" fillOpacity="0.50" />
              <rect x="102" y="105" width="11" height="40" rx="2.5" fill="white" fillOpacity="0.75" />
              <rect x="117" y="93" width="11" height="52" rx="2.5" fill="white" />
              <circle cx="122.5" cy="86" r="4.5" fill="#4ecdc4" />
              <polyline points="120,87 122.5,84 125,87" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </td>
          <td style={{ verticalAlign: 'middle', lineHeight: 1.1 }}>
            <div style={{
              fontSize: wordSize,
              fontWeight: 700,
              letterSpacing: '-0.018em',
              color: textColor,
              fontFamily: FONT,
            }}>AgencyTrack</div>
            <div style={{
              fontSize: subSize,
              fontWeight: 500,
              color: tone === 'ink' ? EMAIL.inkMute : tone === 'muted' ? EMAIL.inkFaint : 'rgba(255,255,255,0.8)',
              marginTop: 2,
              letterSpacing: '0.02em',
              fontFamily: FONT,
            }}>Tatil Life · Pilot</div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// Eyebrow pill used above hero copy.
function Eyebrow({ children, color = EMAIL.teal, bg = EMAIL.tealTint, dot = false }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: bg,
      color: color,
      padding: '5px 10px',
      borderRadius: 999,
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      fontFamily: FONT,
    }}>
      {dot && <span style={{
        width: 6, height: 6, borderRadius: '50%', background: color,
        display: 'inline-block',
      }}></span>}
      {children}
    </span>
  );
}

// Refined CTA button — proper email-safe table-button.
function CTAButton({ label, href = '#', color = EMAIL.teal, textColor = '#fff' }) {
  return (
    <table role="presentation" cellSpacing="0" cellPadding="0" style={{ borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td style={{
            borderRadius: 8,
            background: color,
          }}>
            <a href={href} style={{
              display: 'inline-block',
              padding: '14px 26px',
              fontSize: 14.5,
              fontWeight: 600,
              letterSpacing: '0.005em',
              color: textColor,
              textDecoration: 'none',
              borderRadius: 8,
              fontFamily: FONT,
              lineHeight: 1,
            }}>{label} <span style={{ paddingLeft: 4, fontWeight: 500 }}>→</span></a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// Small metadata strip — context row (e.g. Week / Due / Status).
function MetaStrip({ items }) {
  return (
    <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" style={{
      borderCollapse: 'collapse',
      background: EMAIL.surfaceSoft,
      borderRadius: 10,
      border: `1px solid ${EMAIL.border}`,
    }}>
      <tbody>
        <tr>
          {items.map((it, i) => (
            <td key={i} style={{
              padding: '14px 16px',
              borderRight: i < items.length - 1 ? `1px solid ${EMAIL.border}` : 'none',
              verticalAlign: 'top',
              width: `${100 / items.length}%`,
            }}>
              <div style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: EMAIL.inkFaint,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: 4,
                fontFamily: FONT,
              }}>{it.label}</div>
              <div style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: it.color || EMAIL.ink,
                letterSpacing: '-0.005em',
                lineHeight: 1.25,
                fontFamily: FONT,
              }}>{it.value}</div>
              {it.sub && (
                <div style={{
                  fontSize: 11.5,
                  color: EMAIL.inkMute,
                  marginTop: 2,
                  fontFamily: FONT,
                }}>{it.sub}</div>
              )}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

// Refined footer with brand lockup + meta + links.
function RefinedFooter({ recipient = 'agent@tatillife.co.tt' }) {
  return (
    <tr>
      <td style={{
        padding: '22px 36px 24px',
        borderTop: `1px solid ${EMAIL.border}`,
        background: EMAIL.surfaceMute,
      }}>
        <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'middle' }}>
                <BrandLockup size="sm" tone="muted" />
              </td>
              <td align="right" style={{ verticalAlign: 'middle', fontSize: 11, color: EMAIL.inkFaint, lineHeight: 1.6, fontFamily: FONT }}>
                <a href="#" style={{ color: EMAIL.inkMute, textDecoration: 'none' }}>Manage notifications</a>
                <span style={{ color: EMAIL.border, padding: '0 8px' }}>·</span>
                <a href="#" style={{ color: EMAIL.inkMute, textDecoration: 'none' }}>Contact support</a>
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ paddingTop: 12, fontSize: 11, color: EMAIL.inkFaint, lineHeight: 1.55, fontFamily: FONT }}>
                Sent to <span style={{ color: EMAIL.inkMute }}>{recipient}</span>.
                This is a transactional message from AgencyTrack at Tatil Life.
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}

Object.assign(window, { EMAIL, FONT, EmailFrame, BrandLockup, Eyebrow, CTAButton, MetaStrip, RefinedFooter });
