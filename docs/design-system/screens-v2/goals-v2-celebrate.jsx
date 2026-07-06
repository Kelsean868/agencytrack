// Goals v2 — celebration takeovers. Full-screen "you hit it" moments that
// fire right on the Goals page (rendered over a dimmed, blurred Goals desktop
// so it reads as in-context). The grammar reuses the kiosk recognition
// language — medals, halos, confetti — but is themed to the app's light/dark
// tokens. Each trigger gets its OWN energy (the user asked to vary these):
//   • annual  — gold, trophy, dense confetti, the biggest moment of the year
//   • streak  — amber/flame, a run of weekly targets, kinetic + warm
//   • quarter — silver, calmer "period closed on goal"

if (typeof document !== 'undefined' && !document.getElementById('goals-celebrate-styles')) {
  const s = document.createElement('style');
  s.id = 'goals-celebrate-styles';
  s.textContent = `
    @keyframes g-confetti-fall {
      0%   { transform: translateY(-40px) rotate(0deg);   opacity: 0; }
      8%   { opacity: 1; }
      90%  { opacity: 1; }
      100% { transform: translateY(840px) rotate(680deg); opacity: 0; }
    }
    @keyframes g-pop {
      0%   { opacity: 0; transform: scale(0.6) translateY(14px); }
      60%  { opacity: 1; transform: scale(1.06) translateY(0); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes g-halo {
      0%, 100% { transform: scale(1);    opacity: 0.55; }
      50%      { transform: scale(1.14); opacity: 0.95; }
    }
    @keyframes g-ring {
      0%   { transform: scale(0.7); opacity: 0.8; }
      100% { transform: scale(2.3); opacity: 0; }
    }
    @keyframes g-rise-cel {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes g-shimmer-cel {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .g-pop      { animation: g-pop 760ms cubic-bezier(0.34,1.56,0.64,1) both; }
    .g-halo     { animation: g-halo 2.6s ease-in-out infinite; }
    .g-rise-cel { animation: g-rise-cel 640ms cubic-bezier(0.34,1.4,0.64,1) both; }
    .g-d1 { animation-delay: 120ms; } .g-d2 { animation-delay: 220ms; }
    .g-d3 { animation-delay: 320ms; } .g-d4 { animation-delay: 440ms; }
  `;
  document.head.appendChild(s);
}

function _gseed(i) {
  const x = Math.sin((i + 1) * 4871 + 1237) * 43758.5;
  return x - Math.floor(x);
}

function ConfettiField({ colors, count = 64 }) {
  const pieces = Array.from({ length: count }).map((_, i) => {
    const left = _gseed(i) * 100;
    const delay = _gseed(i + 100) * 2.4;
    const dur = 2.8 + _gseed(i + 200) * 2.2;
    const w = 5 + Math.round(_gseed(i + 300) * 6);
    const h = 8 + Math.round(_gseed(i + 350) * 8);
    const color = colors[i % colors.length];
    const round = _gseed(i + 400) > 0.7;
    return (
      <div key={i} style={{
        position: 'absolute', top: -40, left: `${left}%`,
        width: w, height: round ? w : h, background: color,
        borderRadius: round ? '50%' : 2,
        animation: `g-confetti-fall ${dur}s linear ${delay}s infinite`,
        opacity: 0,
      }} />
    );
  });
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>{pieces}</div>;
}

// Big circular medal/coin with a glyph.
function CelMedal({ kind, glow, accent }) {
  const grad = kind === 'gold'
    ? 'radial-gradient(circle at 32% 26%, #fde9a8 0%, #e0aa3e 48%, #a06b12 100%)'
    : kind === 'silver'
      ? 'radial-gradient(circle at 32% 26%, #f4f6f9 0%, #c2c7cf 48%, #767d88 100%)'
      : 'radial-gradient(circle at 32% 26%, #ffd9a3 0%, #e8923e 48%, #a8531a 100%)';
  const glyph = kind === 'gold' ? (
    // trophy
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4z" /><path d="M6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4" /><path d="M9 20h6M12 16v4" />
    </svg>
  ) : kind === 'silver' ? (
    // check
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  ) : (
    // flame
    <svg width="50" height="50" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M12 2c-1 4-4 5-4 9 0 3 2 5 4 5s4-2 4-5c0-1 0-2 1-3 1 2 3 4 3 7 0 4-3 7-7 7-3.8 0-7-3-7-7 0-5 4-7 6-13z" /></svg>
  );
  return (
    <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
      <div className="g-halo" style={{ position: 'absolute', inset: -22, borderRadius: '50%', background: `radial-gradient(circle, ${glow} 0%, transparent 68%)`, pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: `2px solid ${accent}66`, animation: 'g-ring 2.4s ease-out infinite' }}></div>
      <div className="g-pop" style={{
        position: 'relative', width: 130, height: 130, borderRadius: '50%', background: grad,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `inset 0 -5px 12px rgba(0,0,0,0.22), inset 0 5px 12px rgba(255,255,255,0.42), 0 0 40px ${glow}`,
      }}>
        {glyph}
        <span style={{ position: 'absolute', top: '9%', left: '20%', width: '38%', height: '22%', borderRadius: '50%', background: 'rgba(255,255,255,0.45)', filter: 'blur(4px)' }}></span>
      </div>
    </div>
  );
}

const CEL_VARIANTS = {
  annual: {
    medal: 'gold',
    eyebrow: 'ANNUAL COMMITMENT · HIT',
    title: 'TTD 600K. Done.',
    accentKey: 'gold',
    body: (data) => `You hit the commitment you set yourself on 12 March \u2014 TTD 60K above your assigned target, with two weeks to spare.`,
    stats: [
      { k: 'COMMITMENT', v: 'TTD 600K' },
      { k: 'FINISHED AT', v: 'TTD 612K' },
      { k: 'VS TARGET', v: '+TTD 72K' },
    ],
    cta: 'Set your 2027 commitment',
    confetti: (t) => [t.gold, t.teal, '#fde9a8', t.tealLight, '#fff'],
  },
  streak: {
    medal: 'bronze',
    eyebrow: 'WEEKLY STREAK · 8 WEEKS',
    title: 'Eight weeks. Every target.',
    accentKey: 'warning',
    body: (data) => `Eight straight weeks clearing your weekly API target \u2014 the longest run of your year. This is how the annual number gets caught.`,
    stats: [
      { k: 'STREAK', v: '8 WKS' },
      { k: 'AVG / WK', v: 'TTD 22.6K' },
      { k: 'VS WK TARGET', v: '+26%' },
    ],
    cta: 'Keep the streak alive',
    confetti: (t) => [t.gold, t.warning, '#ffd9a3', t.teal, '#fff'],
  },
  quarter: {
    medal: 'silver',
    eyebrow: 'Q4 · CLOSED ON GOAL',
    title: 'Q4 closed on goal.',
    accentKey: 'teal',
    body: (data) => `You finished the quarter at TTD 178K against a TTD 175K target \u2014 your third straight quarter on or above pace.`,
    stats: [
      { k: 'QUARTER', v: 'TTD 178K' },
      { k: 'TARGET', v: 'TTD 175K' },
      { k: 'ON-GOAL QTRS', v: '3 IN A ROW' },
    ],
    cta: 'View Q1 plan',
    confetti: (t) => [t.teal, t.tealLight, '#c2c7cf', t.gold, '#fff'],
  },
};

function GoalsCelebration({ t, variant = 'annual' }) {
  const data = GOALS_SAMPLE;
  const cfg = CEL_VARIANTS[variant];
  const accent = t[cfg.accentKey];
  const glow = t.mode === 'light' ? accent + '55' : accent + '77';
  const scrim = t.mode === 'light' ? 'rgba(247,246,242,0.78)' : 'rgba(16,13,9,0.82)';

  return (
    <div style={{ width: APP_W, height: APP_H, position: 'relative', overflow: 'hidden', background: t.bg, fontFamily: APP_FONT_SANS }}>
      {/* Dimmed Goals page behind */}
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(3px)', transform: 'scale(1.02)', opacity: 0.5 }}>
        <GoalsDesktopScene t={t} />
      </div>

      {/* Scrim */}
      <div style={{ position: 'absolute', inset: 0, background: scrim, backdropFilter: 'blur(2px)' }}></div>

      {/* Accent glow wash */}
      <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '70%', height: '70%', background: `radial-gradient(circle, ${glow} 0%, transparent 62%)`, pointerEvents: 'none' }}></div>

      <ConfettiField colors={cfg.confetti(t)} count={variant === 'quarter' ? 44 : 70} />

      {/* Center card */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div className="g-pop" style={{
          width: 620, maxWidth: '92%', padding: '40px 44px 34px', textAlign: 'center',
          background: t.surface, border: `1px solid ${accent}55`, borderRadius: 24,
          boxShadow: `0 24px 80px rgba(0,0,0,${t.mode === 'light' ? 0.16 : 0.5}), 0 0 0 1px ${accent}22`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, background: `radial-gradient(circle, ${accent}1f 0%, transparent 65%)`, pointerEvents: 'none' }}></div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <CelMedal kind={cfg.medal} glow={glow} accent={accent} />
          </div>

          <div className="g-rise-cel g-d1" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', color: accent, fontFamily: APP_FONT_MONO }}>{cfg.eyebrow}</div>
          <div className="g-rise-cel g-d2" style={{
            fontSize: 44, fontWeight: 700, color: t.ink, letterSpacing: '-0.03em',
            fontFamily: APP_FONT_DISPLAY, lineHeight: 1.02, marginTop: 12,
          }}>{cfg.title}</div>
          <div className="g-rise-cel g-d3" style={{ fontSize: 14.5, color: t.inkMute, lineHeight: 1.55, marginTop: 14, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
            {cfg.body(data)}
          </div>

          {/* Stat row */}
          <div className="g-rise-cel g-d3" style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'center' }}>
            {cfg.stats.map((s, i) => (
              <div key={i} style={{
                flex: 1, maxWidth: 160, padding: '12px 10px', borderRadius: 12,
                background: i === 0 ? accent + (t.mode === 'light' ? '14' : '22') : t.surfaceSoft,
                border: `1px solid ${i === 0 ? accent + '55' : t.rule}`,
              }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: i === 0 ? accent : t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{s.k}</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 6 }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="g-rise-cel g-d4" style={{ display: 'flex', gap: 10, marginTop: 26, justifyContent: 'center', alignItems: 'center' }}>
            <div style={{
              padding: '12px 22px', borderRadius: 10, background: accent, color: t.mode === 'light' && cfg.accentKey === 'gold' ? '#3a2a08' : '#fff',
              fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: `0 4px 14px ${accent}55`,
            }}>
              {cfg.cta} <IconArrowR size={14} color={t.mode === 'light' && cfg.accentKey === 'gold' ? '#3a2a08' : '#fff'} stroke={2.4} />
            </div>
            <div style={{ padding: '12px 18px', borderRadius: 10, border: `1px solid ${t.rule}`, color: t.inkMute, fontSize: 13, fontWeight: 600 }}>
              Share to the wall
            </div>
          </div>

          <div className="g-rise-cel g-d4" style={{ fontSize: 10, color: t.inkFaint, marginTop: 18, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
            {data.agent.toUpperCase()} · {data.year} · TATIL LIFE SOUTH
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { GoalsCelebration, ConfettiField, CelMedal });
