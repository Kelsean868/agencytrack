// Refined kiosk panels — batch B (Last Week, Ranked Leaderboard, Weekly
// Activity, Awards Watch, Compliance). Same TV scale + tokens as batch A.

const PAD_B = 56;

// ═══════════════════════════════════════════════════════════════════════════
// 06 · LAST WEEK RECAP — Monday morning hype
// ═══════════════════════════════════════════════════════════════════════════
function RefLastWeekRecap() {
  const top = [
    { rank: 1, name: 'Marsha Singh',     unit: 'South · 02', api: 24400, apps: 3 },
    { rank: 2, name: 'Anand Persad',     unit: 'South · 01', api: 21800, apps: 3 },
    { rank: 3, name: 'Selina Mohammed',  unit: 'South · 03', api: 19200, apps: 2 },
    { rank: 4, name: 'Riaz Khan',        unit: 'South · 02', api: 17600, apps: 2 },
    { rank: 5, name: 'Carla Joseph',     unit: 'South · 02', api: 16400, apps: 2 },
  ];

  return (
    <KioskFrame>
      <div style={{ padding: `46px ${PAD_B}px 38px`, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <KioskEyebrow color={KIOSK.hot}>Week 47 · Closed</KioskEyebrow>
            <KioskTitle size={62}>Last week&rsquo;s top&nbsp;five.</KioskTitle>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO }}>WEEK OF</div>
            <div style={{ fontSize: 22, color: KIOSK.textMute, fontWeight: 700, marginTop: 4 }}>17 — 23 Nov</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
          {/* Left — top 5 list */}
          <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-between' }}>
            {top.map((a, i) => (
              <div key={a.rank} className={'k-slide-l k-d-' + (i + 1)} style={{
                display: 'flex', alignItems: 'center', gap: 18,
                padding: '14px 20px',
                background: a.rank === 1 ? KIOSK.bgRaisedAlt : KIOSK.bgSecondary,
                borderRadius: 12,
                border: a.rank === 1 ? `1px solid ${KIOSK.goldGlow}55` : `1px solid ${KIOSK.rule}`,
                boxShadow: a.rank === 1 ? `0 0 24px ${KIOSK.goldGlow}1f` : 'none',
              }}>
                {a.rank <= 3 ? <Medal rank={a.rank} size={42} glow={a.rank === 1} /> : (
                  <div style={{
                    width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_DISPLAY,
                  }}>#{a.rank}</div>
                )}
                <Avatar name={a.name} size={48} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 20, fontWeight: 700, color: KIOSK.text,
                    letterSpacing: '-0.012em', fontFamily: KIOSK_FONT_DISPLAY,
                  }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.06em', marginTop: 2 }}>{a.unit}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 22, fontWeight: 700,
                    color: a.rank === 1 ? KIOSK.gold : KIOSK.teal,
                    fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1,
                  }}>{ttdK(a.api)}</div>
                  <div style={{ fontSize: 11, color: KIOSK.textFaint, marginTop: 4, fontFamily: KIOSK_FONT_MONO }}>{a.apps} apps</div>
                </div>
              </div>
            ))}
          </div>

          {/* Right — submission rate big number */}
          <div className="k-scale-in k-d-3" style={{
            flex: 1, padding: '24px 28px',
            background: KIOSK.bgSecondary, backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)', borderRadius: 16,
            border: `1px solid ${KIOSK.rule}`,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            alignItems: 'stretch',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: KIOSK.success, fontFamily: KIOSK_FONT_MONO }}>SUBMISSION RATE</div>
              <div style={{
                fontSize: 140, fontWeight: 700, color: KIOSK.success,
                fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.045em', lineHeight: 0.9, marginTop: 12,
                textShadow: `0 0 30px ${KIOSK.success}33`,
              }}>92<span style={{ fontSize: 70, color: KIOSK.textMute }}>%</span></div>
              <div style={{ fontSize: 16, color: KIOSK.textMute, marginTop: 14 }}>
                <span style={{ color: KIOSK.text, fontWeight: 700 }}>26 of 28 agents</span> submitted on&nbsp;time
              </div>
            </div>

            <div style={{
              padding: '12px 16px', background: KIOSK.successTint,
              border: `1px solid ${KIOSK.success}33`, borderRadius: 10,
              fontSize: 13, color: KIOSK.text, lineHeight: 1.5,
            }}>
              <span style={{ color: KIOSK.success, fontWeight: 700, letterSpacing: '0.06em', fontFamily: KIOSK_FONT_MONO, fontSize: 11 }}>HIGH WATER MARK</span>
              <br />
              Highest weekly submission rate this&nbsp;quarter.
            </div>
          </div>
        </div>
      </div>
    </KioskFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 07 · RANKED LEADERBOARD — the centerpiece. Hero podium + tail.
// Parameterized by period — same template renders 4 panels (Week, MTD, QTD, YTD).
// ═══════════════════════════════════════════════════════════════════════════

// Period-keyed config — drives title, chip state, eyebrow, and data scale.
const LEADERBOARD_PERIODS = {
  week: {
    chip: 'WK',
    title: 'This Week.',
    eyebrow: '★ This week\u2019s top of the floor',
    periodLabel: 'Week of 24 Nov · In progress',
    scale: 0.055,  // ~5.5% of YTD = realistic single-week production
    apsScale: 0.075,
  },
  mtd: {
    chip: 'MTD',
    title: 'November.',
    eyebrow: '★ Month to date',
    periodLabel: 'Month to date · Live',
    scale: 0.115,
    apsScale: 0.14,
  },
  qtd: {
    chip: 'QTD',
    title: 'Q4 2026.',
    eyebrow: '★ Quarter to date',
    periodLabel: 'Quarter to date · Live',
    scale: 0.32,
    apsScale: 0.34,
  },
  ytd: {
    chip: 'YTD',
    title: 'YTD Leaderboard.',
    eyebrow: '★ Top of the board',
    periodLabel: 'Year to date · Live',
    scale: 1.0,
    apsScale: 1.0,
  },
};

const LEADERBOARD_BASE_AGENTS = [
  { rank: 1, name: 'Marsha Singh',    unit: 'S·02', api: 487000, apps: 41 },
  { rank: 2, name: 'Anand Persad',    unit: 'S·01', api: 442000, apps: 36 },
  { rank: 3, name: 'Selina Mohammed', unit: 'S·03', api: 396000, apps: 38 },
  { rank: 4, name: 'Riaz Khan',       unit: 'S·02', api: 358000, apps: 30 },
  { rank: 5, name: 'Kamla Singh',     unit: 'S·01', api: 312000, apps: 27 },
  { rank: 6, name: 'Trevor Ramnauth', unit: 'S·03', api: 287000, apps: 24 },
  { rank: 7, name: 'Avinash Maharaj', unit: 'S·02', api: 254000, apps: 22 },
  { rank: 8, name: 'Hema Lakhan',     unit: 'S·01', api: 231000, apps: 21 },
];

// Rounded ceiling for cleaner display values
function roundApiK(n) {
  if (n >= 1_000_000) return Math.round(n / 10_000) * 10_000;
  if (n >= 100_000)  return Math.round(n / 1_000) * 1_000;
  return Math.round(n / 100) * 100;
}

function RefRankedLeaderboard({ period = 'ytd' } = {}) {
  const cfg = LEADERBOARD_PERIODS[period] ?? LEADERBOARD_PERIODS.ytd;

  // Scale base data to the period. Shuffle slightly for Week/MTD so it doesn't
  // feel like the same 1-2-3 every panel — top performers vary by short cadence.
  let scaled = LEADERBOARD_BASE_AGENTS.map((a) => ({
    ...a,
    api: roundApiK(a.api * cfg.scale),
    apps: Math.max(1, Math.round(a.apps * cfg.apsScale)),
  }));
  if (period === 'week') {
    // Reshuffle top 3 — single-week production is more volatile
    const swapped = [...scaled];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    scaled = swapped.map((a, i) => ({ ...a, rank: i + 1 }));
  } else if (period === 'mtd') {
    // Slightly different MTD champion
    const swapped = [...scaled];
    [swapped[0], swapped[2]] = [swapped[2], swapped[0]];
    scaled = swapped.map((a, i) => ({ ...a, rank: i + 1 }));
  }

  const agents = scaled;
  const podium = agents.slice(0, 3);
  const tail   = agents.slice(3, 8);
  const maxApi = agents[0].api;

  return (
    <KioskFrame>
      <div style={{ padding: `46px ${PAD_B}px 38px`, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        {/* Header — title + period chip */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <KioskEyebrow color={KIOSK.gold}>{cfg.eyebrow}</KioskEyebrow>
            <KioskTitle size={62}>{cfg.title}</KioskTitle>
          </div>
          {/* Period selector indicating which view is showing */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { k: 'WK', activeFor: 'week' },
              { k: 'MTD', activeFor: 'mtd' },
              { k: 'QTD', activeFor: 'qtd' },
              { k: 'YTD', activeFor: 'ytd' },
            ].map(p => {
              const active = p.activeFor === period;
              return (
              <div key={p.k} style={{
                padding: '8px 14px', borderRadius: 999,
                background: active ? KIOSK.teal : 'transparent',
                color: active ? KIOSK.bg : KIOSK.textFaint,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
                fontFamily: KIOSK_FONT_MONO,
                border: active ? 'none' : `1px solid ${KIOSK.rule}`,
                boxShadow: active ? `0 0 14px ${KIOSK.tealGlow}` : 'none',
              }}>{p.k}</div>
            );
            })}
          </div>
        </div>

        {/* Podium row — 3 hero cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 14, alignItems: 'end', marginBottom: 14 }}>
          {/* #2 left */}
          {[podium[1], podium[0], podium[2]].map((a, i) => {
            const center = i === 1; // middle slot = rank 1
            const trueRank = a.rank;
            // Center podium card lands first, then sides cascade out
            const delayClass = center ? '' : (i === 0 ? ' k-d-2' : ' k-d-3');
            return (
              <div key={a.rank} className={'k-scale-in' + delayClass} style={{
                padding: center ? '20px 20px 20px' : '18px 18px 16px',
                background: center ? KIOSK.bgRaisedAlt : KIOSK.bgSecondary,
                border: `1px solid ${trueRank === 1 ? KIOSK.goldGlow : trueRank === 2 ? KIOSK.silverGlow : KIOSK.bronzeGlow}55`,
                borderRadius: 16,
                boxShadow: center
                  ? `0 0 50px ${KIOSK.goldGlow}30, inset 0 0 0 1px ${KIOSK.gold}33`
                  : `0 0 24px ${trueRank === 2 ? KIOSK.silverGlow : KIOSK.bronzeGlow}20`,
                position: 'relative', overflow: 'hidden',
              }}>
                {center && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `radial-gradient(circle at 50% 30%, ${KIOSK.goldGlow}22 0%, transparent 60%)`,
                    pointerEvents: 'none',
                  }}></div>
                )}

                {/* Trophy plaque — centered stack: medal · eyebrow · avatar · name · unit · API · apps */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', height: '100%', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Medal rank={trueRank} size={center ? 38 : 30} glow={trueRank === 1} />
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                      color: trueRank === 1 ? KIOSK.gold : trueRank === 2 ? KIOSK.silver : KIOSK.bronze,
                      textTransform: 'uppercase', fontFamily: KIOSK_FONT_MONO,
                    }}>
                      {trueRank === 1 ? 'Champion' : trueRank === 2 ? 'Runner-up' : 'Third place'}
                    </div>
                  </div>

                  <div style={{ marginTop: center ? 14 : 12, position: 'relative' }}>
                    {/* Animated halo behind the winner avatar */}
                    {trueRank <= 3 && (
                      <div className="k-glow-soft" style={{
                        position: 'absolute',
                        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: center ? 130 : 100, height: center ? 130 : 100,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${trueRank === 1 ? KIOSK.goldGlow : trueRank === 2 ? KIOSK.silverGlow : KIOSK.bronzeGlow} 0%, transparent 65%)`,
                        pointerEvents: 'none',
                      }}></div>
                    )}
                    <Avatar name={a.name} size={center ? 80 : 60} ring={trueRank === 1 ? KIOSK.gold : trueRank === 2 ? KIOSK.silver : KIOSK.bronze} glowStrong={trueRank === 1} />
                  </div>

                  <div style={{
                    marginTop: center ? 12 : 10,
                    fontSize: center ? 24 : 20, fontWeight: 700, color: KIOSK.text,
                    letterSpacing: '-0.018em', fontFamily: KIOSK_FONT_DISPLAY, lineHeight: 1.08,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                  }}>{a.name}</div>
                  <div style={{ fontSize: 10.5, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.08em', marginTop: 3 }}>{a.unit}</div>

                  <div style={{
                    marginTop: center ? 14 : 12,
                    fontSize: center ? 36 : 28, fontWeight: 700,
                    color: trueRank === 1 ? KIOSK.gold : KIOSK.teal,
                    fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.025em', lineHeight: 1,
                  }}>{ttdK(a.api)}</div>
                  <div style={{ fontSize: 10.5, color: KIOSK.textFaint, marginTop: 4, fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.1em' }}>{a.apps} APPS</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tail — ranks 4-8 in compact rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tail.map((a, i) => (
            <div key={a.rank} className={'k-fade-up k-d-' + (i + 4)} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '4px 16px',
              background: KIOSK.bgSecondary, backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)', borderRadius: 10,
              border: `1px solid ${KIOSK.rule}`,
            }}>
              <div style={{
                width: 30, fontSize: 15, fontWeight: 700, color: KIOSK.textFaint,
                fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.02em', textAlign: 'right',
              }}>#{a.rank}</div>
              <Avatar name={a.name} size={32} />
              <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: KIOSK.text }}>{a.name}</div>
              <div style={{ width: 54, fontSize: 11, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.04em' }}>{a.unit}</div>
              <div style={{ flex: 1, paddingLeft: 12 }}>
                <div style={{ height: 4, background: KIOSK.bgRaised, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(a.api / maxApi) * 100}%`, height: 4,
                    background: KIOSK.teal, borderRadius: 999,
                  }}></div>
                </div>
              </div>
              <div style={{
                width: 100, textAlign: 'right',
                fontSize: 16, fontWeight: 700, color: KIOSK.text,
                fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.018em',
              }}>{ttdK(a.api)}</div>
            </div>
          ))}
        </div>
      </div>
    </KioskFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 08 · WEEKLY ACTIVITY — Prospecting + Conversions
// ═══════════════════════════════════════════════════════════════════════════
function RefWeeklyActivity() {
  const prospecting = [
    { rank: 1, name: 'Marsha Singh',    names: 14, calls: 58, total: 72 },
    { rank: 2, name: 'Riaz Khan',       names: 11, calls: 52, total: 63 },
    { rank: 3, name: 'Anand Persad',    names: 12, calls: 48, total: 60 },
    { rank: 4, name: 'Carla Joseph',    names: 9,  calls: 44, total: 53 },
    { rank: 5, name: 'Selina Mohammed', names: 8,  calls: 42, total: 50 },
  ];
  const conversions = [
    { rank: 1, name: 'Anand Persad',    ffi: 4, ci: 3, total: 7 },
    { rank: 2, name: 'Marsha Singh',    ffi: 3, ci: 3, total: 6 },
    { rank: 3, name: 'Selina Mohammed', ffi: 4, ci: 2, total: 6 },
    { rank: 4, name: 'Riaz Khan',       ffi: 3, ci: 2, total: 5 },
    { rank: 5, name: 'Kamla Singh',     ffi: 2, ci: 2, total: 4 },
  ];

  function Column({ title, eyebrow, agents, color, glowColor, kpiLabel }) {
    const maxTotal = agents[0].total;
    return (
      <div style={{
        flex: 1, padding: '28px 26px 26px',
        background: KIOSK.bgSecondary, backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)', borderRadius: 16,
        border: `1px solid ${KIOSK.rule}`,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color, fontFamily: KIOSK_FONT_MONO }}>{eyebrow}</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: KIOSK.text, letterSpacing: '-0.025em', fontFamily: KIOSK_FONT_DISPLAY, marginTop: 14 }}>{title}</div>
          </div>
          <div style={{ fontSize: 11, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.08em' }}>{kpiLabel}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'space-evenly' }}>
          {agents.map((a) => (
            <div key={a.rank} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 14px',
              background: a.rank === 1 ? KIOSK.bgRaisedAlt : 'transparent',
              borderRadius: 10,
              border: a.rank === 1 ? `1px solid ${glowColor}40` : 'none',
            }}>
              <div style={{
                width: 24, textAlign: 'right',
                fontSize: 13, fontWeight: 700,
                color: a.rank === 1 ? color : KIOSK.textFaint,
                fontFamily: KIOSK_FONT_DISPLAY,
              }}>#{a.rank}</div>
              <Avatar name={a.name} size={32} ring={a.rank === 1 ? color : null} />
              <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: KIOSK.text }}>{a.name}</div>
              <div style={{ flex: 0.8, paddingLeft: 8 }}>
                <div style={{ height: 4, background: KIOSK.bgRaised, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${(a.total / maxTotal) * 100}%`, height: 4, background: color, borderRadius: 999 }}></div>
                </div>
              </div>
              <div style={{
                width: 50, textAlign: 'right',
                fontSize: 20, fontWeight: 700, color: KIOSK.text,
                fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.022em',
              }}>{a.total}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <KioskFrame>
      <div style={{ padding: `46px ${PAD_B}px 38px`, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 18 }}>
          <KioskEyebrow color={KIOSK.hot}>Week 48 · Activity in progress</KioskEyebrow>
          <KioskTitle size={56}>This week, on&nbsp;the&nbsp;floor.</KioskTitle>
        </div>

        <div style={{ display: 'flex', gap: 18, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
          <div className="k-slide-l" style={{ flex: 1, display: 'flex' }}>
            <Column
              title="Prospecting"
              eyebrow="↑ NAMES + CALLS"
              agents={prospecting}
              color={KIOSK.teal}
              glowColor={KIOSK.tealGlow}
              kpiLabel="WEEK · TOTAL"
            />
          </div>
          <div className="k-slide-r k-d-2" style={{ flex: 1, display: 'flex' }}>
            <Column
              title="Conversions"
              eyebrow="↑ FFIs + CIs"
              agents={conversions}
              color={KIOSK.hot}
              glowColor={KIOSK.hotGlow}
              kpiLabel="WEEK · TOTAL"
            />
          </div>
        </div>
      </div>
    </KioskFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 · AWARDS WATCH — milestones in contention + achieved
// ═══════════════════════════════════════════════════════════════════════════
function RefAwardsWatch() {
  const achieved = [
    { name: 'Marsha Singh',    award: 'MDRT Pace' },
    { name: 'Anand Persad',    award: 'MDRT Pace' },
  ];
  const inContention = [
    { name: 'Selina Mohammed', award: 'MDRT Pace',        pct: 79, gap: 'TTD 104k to go' },
    { name: 'Riaz Khan',       award: 'MDRT Pace',        pct: 72, gap: 'TTD 142k to go' },
    { name: 'Anand Persad',    award: 'Agent of the Year',pct: 60, gap: 'TTD 558k to go' },
    { name: 'Kamla Singh',     award: 'MDRT Pace',        pct: 62, gap: 'TTD 188k to go' },
    { name: 'Trevor Ramnauth', award: 'MDRT Pace',        pct: 57, gap: 'TTD 213k to go' },
  ];

  return (
    <KioskFrame>
      <div style={{ padding: `46px ${PAD_B}px 38px`, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 18 }}>
          <KioskEyebrow color={KIOSK.gold}>★ MDRT · Agent of the Year</KioskEyebrow>
          <KioskTitle size={60}>Almost there.</KioskTitle>
        </div>

        {/* Achieved row — gold chips */}
        {achieved.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: KIOSK.gold, fontFamily: KIOSK_FONT_MONO, marginBottom: 8 }}>ACHIEVED THIS YEAR</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {achieved.map((a, i) => (
                <div key={a.name} className={'k-fade-in k-d-' + (i + 1)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px 8px 8px',
                  background: KIOSK.goldTint, border: `1px solid ${KIOSK.gold}33`,
                  borderRadius: 999, boxShadow: `0 0 16px ${KIOSK.goldGlow}1f`,
                }}>
                  <Medal rank={1} size={22} glow={false} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: KIOSK.text }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: KIOSK.gold, fontWeight: 700, letterSpacing: '0.08em', fontFamily: KIOSK_FONT_MONO }}>{a.award.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In contention list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0, justifyContent: 'space-evenly' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: KIOSK.tealBright, fontFamily: KIOSK_FONT_MONO, marginBottom: 4 }}>IN CONTENTION · 50% AND UP</div>
          {inContention.map((a, i) => (
            <div key={i} className={'k-fade-up k-d-' + (i + 2)} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '12px 18px',
              background: KIOSK.bgSecondary, backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)', borderRadius: 12,
              border: `1px solid ${KIOSK.rule}`,
            }}>
              <Avatar name={a.name} size={42} />
              <div style={{ width: 170 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: KIOSK.text, letterSpacing: '-0.005em' }}>{a.name}</div>
                <div style={{ fontSize: 10.5, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.08em', marginTop: 2 }}>TO {a.award.toUpperCase()}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: KIOSK.bgRaised, borderRadius: 999, overflow: 'hidden' }}>
                  <div className="k-progress-grow" style={{
                    width: `${a.pct}%`, height: 8,
                    background: `linear-gradient(90deg, ${KIOSK.tealDeep} 0%, ${KIOSK.teal} 70%, ${KIOSK.tealBright} 100%)`,
                    borderRadius: 999,
                    boxShadow: `0 0 8px ${KIOSK.tealGlow}`,
                  }}></div>
                </div>
              </div>
              <div style={{ width: 70, textAlign: 'right' }}>
                <div style={{
                  fontSize: 22, fontWeight: 700, color: KIOSK.tealBright,
                  fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1,
                }}>{a.pct}%</div>
              </div>
              <div style={{ width: 130, textAlign: 'right', fontSize: 12, color: KIOSK.textMute, fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.04em' }}>{a.gap}</div>
            </div>
          ))}
        </div>
      </div>
    </KioskFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 13 · COMPLIANCE — framed positively
// ═══════════════════════════════════════════════════════════════════════════
function RefCompliance() {
  const submitted = [
    'Marsha Singh', 'Anand Persad', 'Selina Mohammed', 'Riaz Khan', 'Kamla Singh',
    'Trevor Ramnauth', 'Avinash Maharaj', 'Hema Lakhan', 'Carla Joseph', 'Nisha Patel',
    'Aaron Holder', 'Sandhya Singh', 'Tariq Beharry', 'Krishna Bhagwan', 'Anjali Mohan',
    'Sunita Lal', 'Deepak Pillai', 'Lisa Roach', 'Brent Maharaj', 'Naomi Hosein',
    'Sasha Maharaj', 'Vikash Singh', 'Tara Doolahar', 'Imran Rampersad', 'Rohan Ali',
    'Dorian Garcia',
  ];
  const pending = ['Devin Lewis', 'Ravi Lochan'];

  return (
    <KioskFrame>
      <div style={{ padding: `46px ${PAD_B}px 38px`, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 18 }}>
          <KioskEyebrow color={KIOSK.success}>★ Submission status</KioskEyebrow>
          <KioskTitle size={56}>Who&rsquo;s already in this week.</KioskTitle>
        </div>

        <div style={{ display: 'flex', gap: 22, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
          {/* Big % */}
          <div className="k-scale-in" style={{
            width: 380, padding: '32px 28px',
            background: KIOSK.bgRaisedAlt, backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderRadius: 16,
            border: `1px solid ${KIOSK.success}44`,
            boxShadow: `0 0 50px ${KIOSK.success}22`,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            alignItems: 'center', textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: KIOSK.success, fontFamily: KIOSK_FONT_MONO }}>SUBMITTED</div>
            <div style={{
              fontSize: 160, fontWeight: 700, color: KIOSK.success,
              fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.045em', lineHeight: 0.9, marginTop: 10,
              textShadow: `0 0 24px ${KIOSK.success}55`,
            }}>93<span style={{ fontSize: 70, color: KIOSK.textMute }}>%</span></div>
            <div style={{ fontSize: 18, color: KIOSK.text, fontWeight: 700, marginTop: 14 }}>
              <span style={{ color: KIOSK.success }}>26</span> of 28 agents submitted
            </div>
            <div style={{ fontSize: 13, color: KIOSK.textMute, marginTop: 4 }}>
              2 expected before Monday 9 AM
            </div>
          </div>

          {/* Chip clouds */}
          <div className="k-fade-up k-d-2" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 22, justifyContent: 'space-between' }}>
            {/* Submitted chips */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: KIOSK.success, fontFamily: KIOSK_FONT_MONO, marginBottom: 8 }}>
                IN THIS WEEK · {submitted.length}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {submitted.map(n => (
                  <div key={n} style={{
                    padding: '5px 11px', borderRadius: 999,
                    background: KIOSK.successTint, color: KIOSK.success,
                    border: `1px solid ${KIOSK.success}33`,
                    fontSize: 12, fontWeight: 600,
                  }}>{n}</div>
                ))}
              </div>
            </div>

            {/* Back tomorrow */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: KIOSK.warning, fontFamily: KIOSK_FONT_MONO, marginBottom: 8 }}>
                BACK TOMORROW · {pending.length}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {pending.map(n => (
                  <div key={n} style={{
                    padding: '5px 11px', borderRadius: 999,
                    background: KIOSK.warningTint, color: KIOSK.warning,
                    border: `1px solid ${KIOSK.warning}33`,
                    fontSize: 12, fontWeight: 600,
                  }}>{n}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </KioskFrame>
  );
}

// Convenience wrappers for the period variants — same RefRankedLeaderboard
// template, different scaled data + active chip.
function RefWeekLeaderboard()  { return <RefRankedLeaderboard period="week" />; }
function RefMtdLeaderboard()   { return <RefRankedLeaderboard period="mtd"  />; }
function RefQtdLeaderboard()   { return <RefRankedLeaderboard period="qtd"  />; }
function RefYtdLeaderboard()   { return <RefRankedLeaderboard period="ytd"  />; }

Object.assign(window, {
  RefLastWeekRecap, RefRankedLeaderboard, RefWeeklyActivity, RefAwardsWatch, RefCompliance,
  RefWeekLeaderboard, RefMtdLeaderboard, RefQtdLeaderboard, RefYtdLeaderboard,
});
