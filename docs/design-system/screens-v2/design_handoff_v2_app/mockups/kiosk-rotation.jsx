// Live rotation preview — auto-cycles through all 10 refined kiosk panels with
// a crossfade transition so the cross-screen motion is visible at design time.
// In production the kiosk cycles every 25-45s; demo runs at 5s for visibility.

const { useState: useStateK, useEffect: useEffectK } = React;

function LiveRotationPreview() {
  const panels = [
    { Component: RefWelcome,           label: 'Welcome',            chapter: '01' },
    { Component: RefAgentOfMonth,      label: 'Agent of the Month', chapter: '02' },
    { Component: RefBranchOverview,    label: 'Branch Overview',    chapter: '03' },
    { Component: RefRunningTotals,     label: 'Running Totals',     chapter: '04' },
    { Component: RefUnitLeaderboard,   label: 'Unit Leaderboard',   chapter: '05' },
    { Component: RefLastWeekRecap,     label: 'Last Week Recap',    chapter: '06' },
    { Component: RefWeekLeaderboard,   label: 'This Week',          chapter: '07' },
    { Component: RefMtdLeaderboard,    label: 'Month to Date',      chapter: '08' },
    { Component: RefQtdLeaderboard,    label: 'Quarter to Date',    chapter: '09' },
    { Component: RefRankedLeaderboard, label: 'YTD Leaderboard',    chapter: '10' },
    { Component: RefCampaignCompany,   label: 'Christmas Campaign', chapter: '11' },
    { Component: RefCampaignManager,   label: "Closer's Cup",       chapter: '12' },
    { Component: RefWeeklyActivity,    label: 'Weekly Activity',    chapter: '13' },
    { Component: RefAwardsWatch,       label: 'Awards Watch',       chapter: '14' },
    { Component: RefCompliance,        label: 'Compliance',         chapter: '15' },
    { Component: RefBirthdays,         label: 'Birthdays',          chapter: '16' },
    { Component: RefNoticeboard,       label: 'Noticeboard',        chapter: '17' },
  ];

  const [idx, setIdx] = useStateK(0);
  const [paused, setPaused] = useStateK(false);

  useEffectK(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % panels.length), 5000);
    return () => clearInterval(t);
  }, [paused, panels.length]);

  const Current = panels[idx].Component;
  const total = panels.length;

  return (
    <div
      style={{
        width: TV_W, height: TV_H,
        position: 'relative', overflow: 'hidden',
        background: KIOSK.bg,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Panel content — keyed so React remounts on each change.
          The k-fade-in animation replays + the panel's own entrance choreography
          also replays (each card/row has its own k-rise / k-slide / k-scale-in).
          That's what gives the cross-screen transition its "broadcast" feel. */}
      <div key={idx} className="k-fade-in" style={{ position: 'absolute', inset: 0 }}>
        <Current />
      </div>

      {/* Chapter badge + label — top-right overlay */}
      <div style={{
        position: 'absolute', top: 18, right: 22,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px 8px 10px',
        background: 'rgba(14,11,7,0.75)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(244,239,227,0.08)',
        borderRadius: 999, zIndex: 10,
      }}>
        <div className="k-pulse-dot" style={{
          width: 8, height: 8, borderRadius: '50%', background: KIOSK.hot,
          boxShadow: `0 0 8px ${KIOSK.hotGlow}`,
        }}></div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
          color: KIOSK.tealBright, textTransform: 'uppercase',
          fontFamily: KIOSK_FONT_MONO,
        }}>LIVE</div>
        <div style={{ width: 1, height: 12, background: 'rgba(244,239,227,0.15)' }}></div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
          color: KIOSK.textMute, textTransform: 'uppercase',
          fontFamily: KIOSK_FONT_MONO,
        }}>
          <span style={{ color: KIOSK.text }}>{panels[idx].chapter}</span>
          <span style={{ color: KIOSK.textDim, padding: '0 6px' }}>/</span>
          <span>{String(total).padStart(2, '0')}</span>
          <span style={{ color: KIOSK.textDim, padding: '0 8px' }}>·</span>
          <span style={{ color: KIOSK.text }}>{panels[idx].label}</span>
        </div>
      </div>

      {/* Progress dots — bottom, with active one elongated */}
      <div style={{
        position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 6, alignItems: 'center', zIndex: 10,
        padding: '8px 12px',
        background: 'rgba(14,11,7,0.65)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(244,239,227,0.06)',
        borderRadius: 999,
      }}>
        {panels.map((_, i) => (
          <div key={i} style={{
            width: i === idx ? 22 : 6, height: 6, borderRadius: 999,
            background: i === idx ? KIOSK.tealBright : 'rgba(244,239,227,0.18)',
            transition: 'width 360ms cubic-bezier(0.4, 0, 0.2, 1), background 360ms ease',
            boxShadow: i === idx ? `0 0 8px ${KIOSK.tealGlow}` : 'none',
          }}></div>
        ))}
      </div>

      {/* Pause hint */}
      {paused && (
        <div className="k-fade-in" style={{
          position: 'absolute', bottom: 18, right: 22, zIndex: 10,
          padding: '6px 12px',
          background: 'rgba(14,11,7,0.75)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(244,239,227,0.08)',
          borderRadius: 999,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
          color: KIOSK.warning, textTransform: 'uppercase',
          fontFamily: KIOSK_FONT_MONO,
        }}>Paused · Move cursor to resume</div>
      )}
    </div>
  );
}

Object.assign(window, { LiveRotationPreview });
