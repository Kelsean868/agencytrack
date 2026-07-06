// Refined kiosk panels — 10 distinct designs at 1280×720 (16:9 TV).
// Mock data is consistent with the prior reports (South Branch · 28 agents).

const PAD = 56;  // outer horizontal padding inside KioskFrame content slot

// ═══════════════════════════════════════════════════════════════════════════
// 01 · WELCOME — anchor moment between data panels
// ═══════════════════════════════════════════════════════════════════════════
function RefWelcome() {
  return (
    <KioskFrame>
      {/* Muted Ken Burns photo backdrop — manager-curated in production */}
      <BackgroundSlideshow photos={WELCOME_PHOTOS} />

      <div style={{
        width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `48px 72px`,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 64, width: '100%', maxWidth: 1120 }}>
          {/* Left — Greeting */}
          <div className="k-slide-l" style={{ flex: 1.3 }}>
            <KioskEyebrow>Good morning, South Branch</KioskEyebrow>
            <div style={{
              fontSize: 106, fontWeight: 700,
              letterSpacing: '-0.045em', lineHeight: 0.92,
              fontFamily: KIOSK_FONT_DISPLAY, color: KIOSK.text,
              marginTop: 18,
            }}>
              Let&rsquo;s<br />
              <span style={{ color: KIOSK.teal }}>build</span><br />
              the week.
            </div>
            <div style={{
              marginTop: 28, fontSize: 18, color: KIOSK.textMute, lineHeight: 1.55,
              maxWidth: 480,
            }}>
              28 agents on the floor &middot; <span style={{ color: KIOSK.text, fontWeight: 600 }}>6 of you</span> are on MDRT pace right now.
              Two more applications this week puts <span style={{ color: KIOSK.text, fontWeight: 600 }}>Riaz</span> at L4.
            </div>
          </div>

          {/* Right — clock + date */}
          <div className="k-slide-r" style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 152, fontWeight: 700,
              letterSpacing: '-0.055em', lineHeight: 0.88,
              fontFamily: KIOSK_FONT_DISPLAY, color: KIOSK.text,
            }}>
              7:42
            </div>
            <div style={{
              fontSize: 17, color: KIOSK.textMute, marginTop: 16,
              fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.16em',
              textTransform: 'uppercase', fontWeight: 700,
            }}>
              Thursday, 26 November
            </div>
            <div style={{
              marginTop: 24, padding: '10px 16px',
              background: KIOSK.tealTint, border: `1px solid ${KIOSK.tealGlow}`,
              borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 10,
            }}>
              <div className="k-pulse-dot" style={{
                width: 8, height: 8, borderRadius: '50%', background: KIOSK.hot,
                boxShadow: `0 0 10px ${KIOSK.hotGlow}`,
              }}></div>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.16em', color: KIOSK.tealBright, fontFamily: KIOSK_FONT_MONO }}>
                WEEK 48 &middot; 5 WEEKS TO YEAR-END
              </div>
            </div>
          </div>
        </div>
      </div>
    </KioskFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 02 · AGENT OF THE MONTH — three category winners, equal billing
// Each winner is a peer in their own category — not a 1st/2nd/3rd podium.
// Identity per category:
//   API Champion    — gold,  crown glyph        (production)
//   Apps Leader     — teal,  ribbon glyph       (volume)
//   Activity Winner — hot,   bolt glyph         (motion)
// ═══════════════════════════════════════════════════════════════════════════

// Simple flat SVG glyph badges — one per category, all sized equally.
function CategoryBadge({ kind, color, glow, size = 50 }) {
  // 24×24 viewbox glyphs, fill currentColor
  const glyphs = {
    crown: (
      <path d="M3 18h18M4 9l4 3 4-6 4 6 4-3v9H4V9z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
    ribbon: (
      <>
        <path d="M9 11l-4 8 4-2 3 2 3-2 4 2-4-8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
      </>
    ),
    bolt: (
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" strokeLinejoin="round" />
    ),
  };
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 35% 30%, ${color}55 0%, transparent 70%)`,
      border: `1.5px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, flexShrink: 0,
      boxShadow: glow ? `0 0 18px ${color}55, inset 0 0 12px ${color}22` : 'none',
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        {glyphs[kind]}
      </svg>
    </div>
  );
}

function RefAgentOfMonth() {
  const categories = [
    {
      cat: 'API Champion',
      glyph: 'crown',
      color: KIOSK.gold,
      glow: KIOSK.goldGlow,
      tint: KIOSK.goldTint,
      name: 'Marsha Singh',
      metric: 'TTD 187K',
      metricLabel: 'Settled this month',
      sub: 'TTD 162k beat · S·02',
      tagline: 'Highest production',
    },
    {
      cat: 'Apps Leader',
      glyph: 'ribbon',
      color: KIOSK.tealBright,
      glow: KIOSK.tealGlow,
      tint: KIOSK.tealTint,
      name: 'Anand Persad',
      metric: '14',
      metricLabel: 'Applications written',
      sub: '9 NB · 5 PPP · S·01',
      tagline: 'Most policies sold',
    },
    {
      cat: 'Activity Winner',
      glyph: 'bolt',
      color: KIOSK.hot,
      glow: KIOSK.hotGlow,
      tint: KIOSK.hotTint,
      name: 'Selina Mohammed',
      metric: '1,840',
      metricLabel: 'Dials + names',
      sub: 'Top of pipeline · S·03',
      tagline: 'Most activity logged',
    },
  ];

  return (
    <KioskFrame>
      <div style={{ padding: `40px 56px 32px`, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <KioskEyebrow color={KIOSK.gold}>★ November · 3 categories, 3 winners</KioskEyebrow>
            <KioskTitle size={54}>Agents of the&nbsp;Month.</KioskTitle>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO }}>
              AWARDED 26 NOV
            </div>
            <div style={{ fontSize: 13, color: KIOSK.textMute, marginTop: 4 }}>
              by T. Ramcharan · Branch Manager
            </div>
          </div>
        </div>

        {/* 3 equal portrait cards, fill remaining vertical space */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, flex: 1, minHeight: 0 }}>
          {categories.map((c, i) => (
            <div key={c.cat} className={'k-rise-' + (i + 1)} style={{
              padding: '22px 22px 22px',
              background: KIOSK.bgRaisedAlt, backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              borderRadius: 20,
              border: `1px solid ${c.color}33`,
              boxShadow: `0 0 50px ${c.glow}1a, inset 0 0 0 1px ${c.color}22`,
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Corner glow — static, supports composition */}
              <div style={{
                position: 'absolute', top: -40, right: -40, width: 240, height: 240,
                background: `radial-gradient(circle at 50% 50%, ${c.glow}, transparent 65%)`,
                pointerEvents: 'none', opacity: 0.5,
              }}></div>

              {/* Category badge + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                <CategoryBadge kind={c.glyph} color={c.color} glow size={46} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
                    color: c.color, textTransform: 'uppercase', fontFamily: KIOSK_FONT_MONO,
                  }}>{c.cat}</div>
                  <div style={{
                    fontSize: 10.5, color: KIOSK.textFaint, marginTop: 3,
                    fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.06em',
                  }}>{c.tagline}</div>
                </div>
              </div>

              {/* Portrait — big avatar at the centerpiece, flex-grows */}
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px 0', position: 'relative', minHeight: 0,
              }}>
                <div className="k-glow-soft" style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(circle at 50% 50%, ${c.glow}88 0%, ${c.glow}33 28%, transparent 60%)`,
                  pointerEvents: 'none',
                }}></div>
                <Avatar name={c.name} size={228} ring={c.color} glowStrong />
              </div>

              {/* Name */}
              <div style={{
                fontSize: 22, fontWeight: 700, color: KIOSK.text,
                letterSpacing: '-0.018em', fontFamily: KIOSK_FONT_DISPLAY, lineHeight: 1.1,
                textAlign: 'center', position: 'relative',
              }}>{c.name}</div>
              <div style={{
                fontSize: 10.5, color: KIOSK.textFaint, marginTop: 4, textAlign: 'center',
                fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.08em',
                position: 'relative',
              }}>{c.sub}</div>

              {/* Metric block */}
              <div style={{
                marginTop: 14, padding: '12px 16px',
                background: c.tint, borderRadius: 12,
                border: `1px solid ${c.color}22`,
                textAlign: 'center', position: 'relative',
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                  color: c.color, fontFamily: KIOSK_FONT_MONO,
                }}>{c.metricLabel.toUpperCase()}</div>
                <div style={{
                  fontSize: 36, fontWeight: 700, color: c.color,
                  fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.028em',
                  lineHeight: 1, marginTop: 4,
                }}>{c.metric}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </KioskFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 03 · BRANCH OVERVIEW — 4 hero KPIs with progress
// ═══════════════════════════════════════════════════════════════════════════
function RefBranchOverview() {
  const kpis = [
    { eyebrow: 'YTD SETTLED API',  value: 'TTD 8.42M', sub: '70% of TTD 12M goal', accent: KIOSK.teal,  big: true,  bar: 70 },
    { eyebrow: 'YTD APPLICATIONS', value: '612',        sub: '+22% vs same period LY', accent: KIOSK.gold, big: false, bar: null },
    { eyebrow: 'ACTIVE AGENTS',    value: '28',         sub: '6 on MDRT pace',          accent: KIOSK.tealBright, big: false, bar: null },
    { eyebrow: 'AVG API / AGENT',  value: 'TTD 300K',   sub: '+TTD 48k vs LY',          accent: KIOSK.hot,  big: false, bar: null },
  ];
  return (
    <KioskFrame>
      <div style={{ padding: `46px ${PAD}px 38px`, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <KioskEyebrow>South Branch · Where we stand</KioskEyebrow>
            <KioskTitle size={62}>The branch, right&nbsp;now.</KioskTitle>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 18, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
          {kpis.map((k, i) => (
            <div key={k.eyebrow} className={'k-fade-up k-d-' + (i + 1)} style={{
              padding: '28px 30px',
              background: KIOSK.bgSecondary, backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)',
              borderRadius: 16, border: `1px solid ${KIOSK.rule}`,
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
                color: k.accent, fontFamily: KIOSK_FONT_MONO,
              }}>{k.eyebrow}</div>
              <div style={{
                fontSize: k.big ? 92 : 68, fontWeight: 700,
                color: KIOSK.text, fontFamily: KIOSK_FONT_DISPLAY,
                letterSpacing: '-0.03em', lineHeight: 1, marginTop: 18,
              }}>{k.value}</div>
              <div style={{ fontSize: 14, color: KIOSK.textMute, marginTop: 10 }}>{k.sub}</div>

              {k.bar !== null && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ height: 6, background: KIOSK.bgRaised, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      width: `${k.bar}%`, height: 6,
                      background: `linear-gradient(90deg, ${KIOSK.tealDeep} 0%, ${KIOSK.teal} 100%)`,
                      borderRadius: 999,
                    }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.06em' }}>0</div>
                    <div style={{ fontSize: 11, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.06em' }}>TTD 12M</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom banner — momentum line */}
        <div className="k-fade-up k-d-6" style={{
          marginTop: 22, padding: '18px 28px',
          background: KIOSK.tealTint, border: `1px solid ${KIOSK.tealGlow}55`,
          borderRadius: 14, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: KIOSK.teal,
            boxShadow: `0 0 12px ${KIOSK.tealGlow}`,
          }}></div>
          <div style={{ fontSize: 20, color: KIOSK.text, letterSpacing: '-0.005em', flex: 1 }}>
            <span style={{ color: KIOSK.tealBright, fontWeight: 700 }}>TTD 3.58M to close the year on goal.</span>
            <span style={{ color: KIOSK.textMute }}>&nbsp;The 6 MDRT pacers already carry over half of that.</span>
          </div>
        </div>
      </div>
    </KioskFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 04 · BRANCH RUNNING TOTALS — MTD / QTD / YTD
// ═══════════════════════════════════════════════════════════════════════════
function RefRunningTotals() {
  const periods = [
    { label: 'MTD',  fullLabel: 'Month to date',   api: 'TTD 1.18M', apps: 87,  active: false },
    { label: 'QTD',  fullLabel: 'Quarter to date', api: 'TTD 2.46M', apps: 192, active: true  },
    { label: 'YTD',  fullLabel: 'Year to date',    api: 'TTD 8.42M', apps: 612, active: false },
  ];
  return (
    <KioskFrame>
      <div style={{ padding: `46px ${PAD}px 38px`, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 22 }}>
          <KioskEyebrow>Cumulative production</KioskEyebrow>
          <KioskTitle size={56}>Running totals.</KioskTitle>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
          {periods.map((p, i) => (
            <div key={p.label} className={'k-scale-in k-d-' + (i + 1)} style={{
              padding: '34px 30px 30px',
              background: p.active ? KIOSK.bgRaisedAlt : KIOSK.bgSecondary,
              borderRadius: 16,
              border: p.active ? `1px solid ${KIOSK.tealGlow}` : `1px solid ${KIOSK.rule}`,
              boxShadow: p.active ? `0 0 40px ${KIOSK.tealGlow}25` : 'none',
              position: 'relative',
              display: 'flex', flexDirection: 'column',
            }}>
              {p.active && (
                <div className="k-breathe" style={{
                  position: 'absolute', top: 14, right: 14,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
                  padding: '3px 8px', background: KIOSK.tealTint, color: KIOSK.tealBright,
                  borderRadius: 999, fontFamily: KIOSK_FONT_MONO,
                }}>NOW</div>
              )}

              <div style={{
                fontSize: 36, fontWeight: 700,
                color: p.active ? KIOSK.tealBright : KIOSK.textMute,
                fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.025em',
                lineHeight: 1,
              }}>{p.label}</div>
              <div style={{
                fontSize: 13, color: KIOSK.textFaint, marginTop: 4,
                fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>{p.fullLabel}</div>

              <div style={{ marginTop: 'auto', paddingTop: 24 }}>
                <div style={{ fontSize: 11, color: KIOSK.textMute, fontWeight: 700, letterSpacing: '0.16em', fontFamily: KIOSK_FONT_MONO }}>API</div>
                <div style={{
                  fontSize: 70, fontWeight: 700, color: KIOSK.text,
                  fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.035em', lineHeight: 1, marginTop: 8,
                }}>{p.api}</div>
              </div>

              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 11, color: KIOSK.textMute, fontWeight: 700, letterSpacing: '0.16em', fontFamily: KIOSK_FONT_MONO }}>APPS</div>
                <div style={{
                  fontSize: 46, fontWeight: 700, color: KIOSK.text,
                  fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.025em', lineHeight: 1, marginTop: 6,
                }}>{p.apps}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </KioskFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 05 · UNIT LEADERBOARD — 3 units ranked
// ═══════════════════════════════════════════════════════════════════════════
function RefUnitLeaderboard() {
  const units = [
    { rank: 1, name: 'Unit 02', mgr: 'M. Singh',     agents: 10, api: 2980000, avg: 298000, pct: 100 },
    { rank: 2, name: 'Unit 01', mgr: 'A. Persad',    agents: 10, api: 3120000, avg: 312000, pct: 100 }, // technically #1 by API but we'll rank by avg
    { rank: 3, name: 'Unit 03', mgr: 'S. Mohammed',  agents: 8,  api: 2320000, avg: 290000, pct: 78 },
  ];
  // Re-rank by API so #1 is highest
  const sorted = [...units].sort((a, b) => b.api - a.api).map((u, i) => ({ ...u, rank: i + 1 }));
  const maxApi = Math.max(...sorted.map(u => u.api));

  return (
    <KioskFrame>
      <div style={{ padding: `46px ${PAD}px 38px`, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 22 }}>
          <KioskEyebrow>South Branch · Unit standings</KioskEyebrow>
          <KioskTitle size={62}>Which unit&rsquo;s leading?</KioskTitle>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, minHeight: 0, justifyContent: 'space-evenly' }}>
          {sorted.map((u, i) => (
            <div key={u.name} className={'k-slide-r k-d-' + (i + 1)} style={{
              padding: '22px 28px',
              background: u.rank === 1 ? KIOSK.bgRaisedAlt : KIOSK.bgSecondary,
              borderRadius: 14,
              border: u.rank === 1 ? `1px solid ${KIOSK.goldGlow}55` : `1px solid ${KIOSK.rule}`,
              boxShadow: u.rank === 1 ? `0 0 40px ${KIOSK.goldGlow}1f` : 'none',
              display: 'flex', alignItems: 'center', gap: 24,
            }}>
              <Medal rank={u.rank} size={62} glow={u.rank === 1} />
              <div style={{ width: 240 }}>
                <div style={{
                  fontSize: 30, fontWeight: 700, color: KIOSK.text,
                  fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.022em',
                }}>{u.name}</div>
                <div style={{
                  fontSize: 13, color: KIOSK.textFaint, marginTop: 3,
                  fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.08em',
                }}>UM &middot; {u.mgr} &middot; {u.agents} agents</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: KIOSK.textMute, fontWeight: 600, letterSpacing: '0.06em', fontFamily: KIOSK_FONT_MONO }}>SETTLED API · YTD</div>
                  <div style={{ fontSize: 12, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO }}>Avg {ttdK(u.avg)}/agent</div>
                </div>
                <div style={{ height: 12, background: KIOSK.bgRaised, borderRadius: 999, overflow: 'hidden' }}>
                  <div className="k-progress-grow" style={{
                    width: `${(u.api / maxApi) * 100}%`, height: 12,
                    background: u.rank === 1
                      ? `linear-gradient(90deg, ${KIOSK.tealDeep} 0%, ${KIOSK.gold} 100%)`
                      : `linear-gradient(90deg, ${KIOSK.tealDeep} 0%, ${KIOSK.teal} 100%)`,
                    borderRadius: 999,
                    boxShadow: u.rank === 1 ? `0 0 12px ${KIOSK.goldGlow}` : 'none',
                  }}></div>
                </div>
              </div>
              <div style={{ width: 200, textAlign: 'right' }}>
                <div style={{
                  fontSize: 38, fontWeight: 700,
                  color: u.rank === 1 ? KIOSK.gold : KIOSK.text,
                  fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.025em', lineHeight: 1,
                }}>{ttdK(u.api)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </KioskFrame>
  );
}

Object.assign(window, { RefWelcome, RefAgentOfMonth, RefBranchOverview, RefRunningTotals, RefUnitLeaderboard });
