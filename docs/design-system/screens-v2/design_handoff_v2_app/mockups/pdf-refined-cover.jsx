// Refined Agent Performance Report — COVER + 3 content pages.
// Native A4 (595×842). Designed as an HTML mock — the real implementation
// would re-render this in @react-pdf/renderer using the same tokens.

// ─── Donut ring (for cover hero) ──────────────────────────────────────────
function Donut({ percent, size = 160, stroke = 14, fg = PDF.teal, bg = PDF.rule, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={fg} strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`} strokeDashoffset={c / 4} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2}) rotate(180 ${size/2} ${size/2})`}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontSize: 30, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.025em',
          fontFamily: SERIF_DISPLAY, lineHeight: 1,
        }}>{label}</div>
        {sub && (
          <div style={{
            fontSize: 8, color: PDF.inkMute, marginTop: 6,
            letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
          }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ─── REFINED COVER ────────────────────────────────────────────────────────
function RefinedCover() {
  return (
    <div style={{
      width: A4_W, height: A4_H, background: PDF.paperCream,
      color: PDF.ink, fontFamily: SANS,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Left-edge editorial accent stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: PDF.teal }}></div>

      {/* Top lockup */}
      <div style={{
        position: 'absolute', top: 38, left: 56, right: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 200 200" style={{ display: 'block', borderRadius: 6 }}>
            <rect x="0" y="0" width="200" height="200" rx="44" fill="#014e52" />
            <path d="M100 28 Q65 28 37 42 Q30 45 30 56 L30 115 Q30 160 100 188 Q170 160 170 115 L170 56 Q170 45 163 42 Q135 28 100 28 Z" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.55" strokeWidth="2.5" />
            <rect x="72" y="127" width="11" height="18" rx="2.5" fill="white" fillOpacity="0.30" />
            <rect x="87" y="117" width="11" height="28" rx="2.5" fill="white" fillOpacity="0.50" />
            <rect x="102" y="105" width="11" height="40" rx="2.5" fill="white" fillOpacity="0.75" />
            <rect x="117" y="93" width="11" height="52" rx="2.5" fill="white" />
            <circle cx="122.5" cy="86" r="4.5" fill="#4ecdc4" />
            <polyline points="120,87 122.5,84 125,87" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.012em' }}>AgencyTrack</div>
            <div style={{ fontSize: 9, color: PDF.inkMute, marginTop: 1 }}>Tatil Life · Trinidad &amp; Tobago</div>
          </div>
        </div>
        <div style={{
          fontSize: 8.5, color: PDF.inkMute, letterSpacing: '0.14em',
          textTransform: 'uppercase', fontWeight: 700,
        }}>Confidential</div>
      </div>

      {/* Eyebrow over the name — magazine-cover treatment */}
      <div style={{ position: 'absolute', top: 188, left: 56, right: 56 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18,
        }}>
          <span style={{
            fontSize: 9, color: PDF.teal, fontWeight: 700,
            letterSpacing: '0.18em', fontFamily: MONO,
          }}>2026 · YTD</span>
          <div style={{ flex: 1, height: 1, background: PDF.ruleStrong }}></div>
          <span style={{
            fontSize: 9, color: PDF.inkMute, fontWeight: 600,
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>Performance Report</span>
        </div>

        <div style={{
          fontSize: 11, color: PDF.inkMute, letterSpacing: '0.16em',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: 18,
        }}>Prepared for</div>

        <div style={{
          fontSize: 56, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.03em',
          lineHeight: 0.98, fontFamily: SERIF_DISPLAY,
        }}>
          Marsha<br />Singh
        </div>

        <div style={{
          fontSize: 12, color: PDF.inkMute, marginTop: 18,
          lineHeight: 1.55, letterSpacing: '0.002em',
        }}>
          <span style={{ color: PDF.ink, fontWeight: 600 }}>Senior Associate</span>
          <span style={{ color: PDF.inkFaint, padding: '0 8px' }}>·</span>
          South Branch · Unit 02
          <br />
          14 months in service · Agent #8821
        </div>
      </div>

      {/* Hero stat block — donut + caption */}
      <div style={{
        position: 'absolute', bottom: 110, left: 56, right: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 28px',
        background: PDF.paper,
        border: `1px solid ${PDF.rule}`,
        borderRadius: 14,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 8.5, color: PDF.teal, fontWeight: 700,
            letterSpacing: '0.18em', fontFamily: MONO, marginBottom: 6,
          }}>YTD · SETTLED API</div>
          <div style={{
            fontSize: 40, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.028em',
            lineHeight: 1, fontFamily: SERIF_DISPLAY,
          }}>TTD 487,000</div>
          <div style={{
            fontSize: 10.5, color: PDF.inkMute, marginTop: 8, lineHeight: 1.5,
          }}>
            81% of your TTD 600,000 annual goal. On pace for MDRT.<br />
            <span style={{ color: PDF.inkFaint }}>TTD 113,000 remaining · 5 weeks to year-end</span>
          </div>
        </div>
        <div style={{ paddingLeft: 24 }}>
          <Donut percent={81} size={130} stroke={11} label="81%" sub="of goal" />
        </div>
      </div>

      {/* Footer meta */}
      <div style={{
        position: 'absolute', bottom: 36, left: 56, right: 56,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        paddingTop: 14, borderTop: `1px solid ${PDF.rule}`,
      }}>
        <div>
          <div style={{
            fontSize: 8, color: PDF.inkFaint, letterSpacing: '0.14em',
            textTransform: 'uppercase', fontWeight: 700, marginBottom: 4,
          }}>Reporting period</div>
          <div style={{ fontSize: 10, color: PDF.ink, fontWeight: 600 }}>
            01 Jan — 25 Nov 2026 · Last 12 weeks shown
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 8, color: PDF.inkFaint, letterSpacing: '0.14em',
            textTransform: 'uppercase', fontWeight: 700, marginBottom: 4,
          }}>Issued</div>
          <div style={{ fontSize: 10, color: PDF.ink, fontWeight: 600 }}>
            26 November 2026
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Donut, RefinedCover });
