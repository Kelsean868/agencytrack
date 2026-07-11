// Celebrations — the rest of the ladder. Extends streak-celebrate.jsx's
// grammar (gold medal radial, halo, confetti, one-tap dismiss, reduced
// variant) to the remaining personal moments, plus the manager-side echo.
//
//   • First sale — the career's most emotional milestone (★ medal).
//   • Award qualification — the moment a threshold is crossed (trophy).
//   • Personal-best week — highest settled-API week ever (bolt).
//   • Annual commitment reached — the Game Plan year goal at 100% (target).
//   • Manager echo — a quiet toast on the manager's dashboard when someone
//     on their team hits any of these; recognition travels up, one tap to
//     congratulate.

// Kiosk balloon rules, replicated for the personal celebration surfaces:
// 5 float paths (gentle S-curve, wide drift, mid-rise bump + wobble ×2,
// diagonal), full-width spawn (2–95%), independent pseudo-random streams for
// position/color/path/timing, long foreground spacing (~2 visible at once),
// gradient balloon + knot + curling string, blurred background layer vs
// crisp foreground layer.
if (typeof document !== 'undefined' && !document.getElementById('celeb-balloon-styles')) {
  const s = document.createElement('style');
  s.id = 'celeb-balloon-styles';
  s.textContent = `
    @keyframes celeb-balloon-a {
      0%   { transform: translateY(0)      translateX(0)    rotate(0deg);   opacity: 0; }
      8%   { opacity: 0.9; }
      25%  { transform: translateY(-220px) translateX(36px) rotate(2deg); }
      55%  { transform: translateY(-460px) translateX(-22px) rotate(-3deg); }
      80%  { transform: translateY(-660px) translateX(14px) rotate(1deg); }
      92%  { opacity: 0.9; }
      100% { transform: translateY(-880px) translateX(0)    rotate(0deg);   opacity: 0; }
    }
    @keyframes celeb-balloon-b {
      0%   { transform: translateY(0)      translateX(0)     rotate(0deg);   opacity: 0; }
      10%  { opacity: 0.9; }
      30%  { transform: translateY(-260px) translateX(-58px) rotate(-3deg); }
      60%  { transform: translateY(-510px) translateX(40px)  rotate(4deg); }
      85%  { transform: translateY(-720px) translateX(-12px) rotate(-1deg); }
      92%  { opacity: 0.9; }
      100% { transform: translateY(-880px) translateX(20px)  rotate(0deg);   opacity: 0; }
    }
    @keyframes celeb-balloon-c {
      0%   { transform: translateY(0)      translateX(0)    scale(1, 1)      rotate(0deg);  opacity: 0; }
      8%   { opacity: 0.9; }
      30%  { transform: translateY(-280px) translateX(18px) scale(1, 1)      rotate(2deg); }
      38%  { transform: translateY(-340px) translateX(22px) scale(1.05, 0.92) rotate(0deg); }
      44%  { transform: translateY(-320px) translateX(-12px) scale(1, 1)      rotate(-3deg); }
      55%  { transform: translateY(-380px) translateX(-26px) scale(1, 1)      rotate(2deg); }
      80%  { transform: translateY(-620px) translateX(10px) scale(1, 1)      rotate(-1deg); }
      92%  { opacity: 0.9; }
      100% { transform: translateY(-880px) translateX(0)    scale(1, 1)      rotate(0deg);  opacity: 0; }
    }
    @keyframes celeb-balloon-d {
      0%   { transform: translateY(0)      translateX(0)    rotate(0deg);   opacity: 0; }
      9%   { opacity: 0.9; }
      35%  { transform: translateY(-300px) translateX(-30px) rotate(-2deg); }
      65%  { transform: translateY(-560px) translateX(-70px) rotate(1deg); }
      88%  { transform: translateY(-760px) translateX(-44px) rotate(-1deg); }
      92%  { opacity: 0.9; }
      100% { transform: translateY(-880px) translateX(-20px) rotate(0deg);   opacity: 0; }
    }
    @keyframes celeb-balloon-e {
      0%   { transform: translateY(0)      translateX(0)    scale(1, 1)      rotate(0deg);  opacity: 0; }
      8%   { opacity: 0.9; }
      32%  { transform: translateY(-300px) translateX(-22px) scale(1, 1)      rotate(-2deg); }
      40%  { transform: translateY(-360px) translateX(-26px) scale(0.94, 1.05) rotate(0deg); }
      46%  { transform: translateY(-340px) translateX(8px)  scale(1, 1)      rotate(3deg); }
      60%  { transform: translateY(-460px) translateX(36px) scale(1, 1)      rotate(-1deg); }
      85%  { transform: translateY(-700px) translateX(-14px) scale(1, 1)     rotate(2deg); }
      92%  { opacity: 0.9; }
      100% { transform: translateY(-880px) translateX(0)    scale(1, 1)      rotate(0deg);  opacity: 0; }
    }
  `;
  document.head.appendChild(s);
}

function CelebBalloons({ t, foreground = false, count = foreground ? 3 : 6 }) {
  const palette = ['#F47C8F', '#B59FD8', '#FFA075', '#6DCFB0', '#E0AA3E', '#7DC4F0', '#F4D06F', '#FDB6A8'];
  const floatVariants = ['a', 'b', 'c', 'd', 'e'];
  const balloons = Array.from({ length: count }, (_, i) => {
    const rPos = (i * 73 + 11) % 100;
    const rColor = (i * 41 + 29) % palette.length;
    const rPath = (i * 17 + 5) % floatVariants.length;
    const rSize = (i * 53 + 19) % 100;
    const baseDur = foreground ? 14 : 24;
    const spacing = foreground ? baseDur * 0.95 : baseDur / count;
    return {
      left: 2 + rPos * 0.93,
      delay: (i * spacing + (rPos % 4) * 0.5) % (baseDur * 2.4),
      duration: baseDur + (rSize % 5),
      color: palette[rColor],
      size: foreground ? 78 + (rSize % 3) * 14 : 40 + (rSize % 3) * 10,
      path: floatVariants[rPath],
    };
  });
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      zIndex: foreground ? 6 : 2,
      opacity: foreground ? 1 : 0.5,
      filter: foreground ? 'none' : 'blur(2.5px)',
    }}>
      {balloons.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: '-180px', left: `${b.left}%`,
          width: b.size, height: b.size * 1.22, opacity: 0,
          animation: `celeb-balloon-${b.path} ${b.duration}s linear ${b.delay}s infinite`,
          filter: foreground
            ? `drop-shadow(0 14px 26px rgba(0,0,0,0.28)) drop-shadow(0 0 18px ${b.color}55)`
            : 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
        }}>
          <svg viewBox="0 0 100 122" width="100%" height="100%">
            <defs>
              <radialGradient id={`cbg${foreground ? 'f' : 'b'}${i}`} cx="35%" cy="28%" r="68%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                <stop offset="22%" stopColor={b.color} stopOpacity="0.95" />
                <stop offset="75%" stopColor={b.color} stopOpacity="0.92" />
                <stop offset="100%" stopColor={b.color} stopOpacity="0.78" />
              </radialGradient>
              <radialGradient id={`chi${foreground ? 'f' : 'b'}${i}`} cx="32%" cy="24%" r="22%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="50" cy="48" rx="38" ry="44" fill={`url(#cbg${foreground ? 'f' : 'b'}${i})`} />
            <ellipse cx="36" cy="32" rx="14" ry="10" fill={`url(#chi${foreground ? 'f' : 'b'}${i})`} />
            <path d="M44 91 L50 99 L56 91 Z" fill={b.color} opacity="0.92" />
            <path d="M50 99 Q53 106 47 112 Q44 116 50 122" stroke={b.color} strokeWidth="1.2" fill="none" opacity="0.55" strokeLinecap="round" />
          </svg>
        </div>
      ))}
    </div>
  );
}

// Gold medal disc with an arbitrary glyph (streaks keep the flame).
function CelebMedal({ t, size = 92, reduced = false, children }) {
  const glow = t.mode === 'light' ? t.gold + '55' : t.gold + '88';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div className={reduced ? undefined : 'dc-halo'} style={{ position: 'absolute', inset: -size * 0.18, borderRadius: '50%', background: `radial-gradient(circle, ${glow} 0%, transparent 68%)`, opacity: reduced ? 0.55 : undefined }}></div>
      {!reduced && <div style={{ position: 'absolute', inset: -size * 0.07, borderRadius: '50%', border: `2px solid ${t.gold}66`, animation: 'dc-ring 2.4s ease-out infinite' }}></div>}
      <div className={reduced ? undefined : 'dc-pop'} style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 32% 26%, #fde9a8 0%, #e0aa3e 48%, #a06b12 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 -5px 12px rgba(0,0,0,0.22), inset 0 5px 12px rgba(255,255,255,0.42), 0 0 ${size * 0.33}px ${glow}` }}>
        {children}
        <span style={{ position: 'absolute', top: '9%', left: '20%', width: '38%', height: '22%', borderRadius: '50%', background: 'rgba(255,255,255,0.45)', filter: 'blur(4px)' }}></span>
      </div>
    </div>
  );
}

// Shared mobile takeover scaffold — dimmed app behind, scrim, glow, confetti,
// whole-screen tap target, home indicator.
function CelebTakeoverM({ t, reduced = false, confetti = true, count = 40, backTitle = 'Today', backSub = 'WEEK 28', children }) {
  const glow = t.mode === 'light' ? t.gold + '55' : t.gold + '88';
  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(3px)', opacity: 0.4, pointerEvents: 'none' }}>
        <MHeader t={t} title={backTitle} sub={backSub} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: t.mode === 'light' ? 'rgba(247,246,242,0.84)' : 'rgba(16,13,9,0.88)' }}></div>
      <div style={{ position: 'absolute', top: '4%', left: '50%', transform: 'translateX(-50%)', width: '86%', height: '44%', background: `radial-gradient(circle, ${glow} 0%, transparent 62%)`, pointerEvents: 'none', opacity: reduced ? 0.5 : 1 }}></div>
      {confetti && !reduced && <DCConfetti colors={[t.gold, t.warning, t.teal, t.tealLight, '#fff']} count={count} />}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 26, textAlign: 'center', cursor: 'pointer' }}>
        {children}
      </div>
      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: t.ink, borderRadius: 999, opacity: 0.85, zIndex: 30 }}></div>
    </MFrame>
  );
}

// Shared bits.
function CelebEyebrow({ t, reduced, children }) {
  return <div className={reduced ? undefined : 'dc-rise2 dc-rd1'} style={{ marginTop: 18, fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', color: t.gold, fontFamily: APP_FONT_MONO }}>{children}</div>;
}
function CelebChips({ t, reduced, chips }) {
  return (
    <div className={reduced ? undefined : 'dc-rise2 dc-rd3'} style={{ display: 'flex', gap: 9, marginTop: 20 }}>
      {chips.map((c, i) => (
        <div key={i} style={{ padding: '10px 15px', borderRadius: 12, background: c.gold ? t.goldTint : t.surfaceSoft, border: `1px solid ${c.gold ? t.gold + '55' : t.rule}` }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: c.gold ? t.gold : t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{c.k}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 4 }}>{c.v}</div>
        </div>
      ))}
    </div>
  );
}
function CelebCta({ t, reduced, children }) {
  return (
    <>
      <div className={reduced ? undefined : 'dc-rise2 dc-rd3'} style={{ marginTop: 22, padding: '13px 30px', minHeight: 44, boxSizing: 'border-box', background: t.gold, color: t.mode === 'light' ? '#3a2a08' : '#fff', borderRadius: 11, fontSize: 14, fontWeight: 700, boxShadow: `0 4px 14px ${t.gold}55` }}>{children}</div>
      <div className={reduced ? undefined : 'dc-rise2 dc-rd3'} style={{ marginTop: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: t.inkFaint, fontFamily: APP_FONT_MONO }}>TAP ANYWHERE TO CONTINUE</div>
    </>
  );
}

// ── First sale ────────────────────────────────────────────────────────────
function FirstSaleMobile({ t, reduced = false }) {
  const r2 = reduced ? undefined : 'dc-rise2 dc-rd2';
  return (
    <CelebTakeoverM t={t} reduced={reduced} count={52} backTitle="Log Today">
      <CelebMedal t={t} size={96} reduced={reduced}>
        <span style={{ fontSize: 40, color: '#fff', lineHeight: 1, marginTop: -3 }}>★</span>
      </CelebMedal>
      <CelebEyebrow t={t} reduced={reduced}>★ FIRST SALE · CAREER MILESTONE</CelebEyebrow>
      <div className={r2} style={{ fontSize: 32, fontWeight: 800, color: t.ink, letterSpacing: '-0.03em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.08, marginTop: 10 }}>
        Your first sale.
      </div>
      <div className={r2} style={{ fontSize: 12.5, color: t.inkMute, lineHeight: 1.55, marginTop: 12, maxWidth: 280 }}>
        Whole Life for the Maharaj family — the first of many. Somebody sleeps easier tonight because you kept asking.
      </div>
      <CelebChips t={t} reduced={reduced} chips={[
        { k: 'API', v: ttd(18_400), gold: true },
        { k: 'PRODUCT', v: 'Whole Life' },
        { k: 'LIVES', v: 2 },
      ]} />
      <CelebCta t={t} reduced={reduced}>The first of many</CelebCta>
    </CelebTakeoverM>
  );
}

// ── Award qualification ───────────────────────────────────────────────────
function AwardQualifiedMobile({ t, reduced = false }) {
  const r2 = reduced ? undefined : 'dc-rise2 dc-rd2';
  return (
    <CelebTakeoverM t={t} reduced={reduced} count={48} backTitle="Awards">
      <CelebMedal t={t} size={96} reduced={reduced}>
        <IconTrophy size={40} color="#fff" stroke={2} />
      </CelebMedal>
      <CelebEyebrow t={t} reduced={reduced}>AWARD QUALIFIED · YTD SETTLED API</CelebEyebrow>
      <div className={r2} style={{ fontSize: 32, fontWeight: 800, color: t.ink, letterSpacing: '-0.03em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.08, marginTop: 10 }}>
        Eagles Club,<br />qualified.
      </div>
      <div className={r2} style={{ fontSize: 12.5, color: t.inkMute, lineHeight: 1.55, marginTop: 12, maxWidth: 285 }}>
        {ttd(482_000)} settled — over the {ttd(450_000)} bar with seven weeks still on the clock.
      </div>
      <CelebChips t={t} reduced={reduced} chips={[
        { k: 'SETTLED', v: ttd(482_000), gold: true },
        { k: 'THRESHOLD', v: ttd(450_000) },
        { k: 'WEEKS LEFT', v: 7 },
      ]} />
      <CelebCta t={t} reduced={reduced}>See your awards</CelebCta>
    </CelebTakeoverM>
  );
}

// ── Personal-best week — fires on weekly settlement ───────────────────────
function BestWeekMobile({ t, reduced = false }) {
  const r2 = reduced ? undefined : 'dc-rise2 dc-rd2';
  return (
    <CelebTakeoverM t={t} reduced={reduced} backTitle="History">
      <CelebMedal t={t} size={88} reduced={reduced}>
        <IconBolt size={38} color="#fff" stroke={2.2} />
      </CelebMedal>
      <CelebEyebrow t={t} reduced={reduced}>PERSONAL BEST · WEEK 48 SETTLED</CelebEyebrow>
      <div className={r2} style={{ fontSize: 52, fontWeight: 800, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 12, textShadow: t.mode === 'light' ? 'none' : `0 0 60px ${t.gold}44` }}>
        {ttd(31_200)}
      </div>
      <div className={r2} style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 8 }}>
        your best week yet
      </div>
      <div className={r2} style={{ fontSize: 12.5, color: t.inkMute, lineHeight: 1.55, marginTop: 12, maxWidth: 280 }}>
        Past your previous best of {ttd(28_400)} — and every dollar of it settled, not promised.
      </div>
      <CelebChips t={t} reduced={reduced} chips={[
        { k: 'THIS WEEK', v: ttd(31_200), gold: true },
        { k: 'OLD BEST', v: ttd(28_400) },
        { k: 'APPS', v: 5 },
      ]} />
      <CelebCta t={t} reduced={reduced}>Keep the pace</CelebCta>
    </CelebTakeoverM>
  );
}

// ── Annual commitment reached — the Game Plan year goal at 100% ───────────
function CommitmentMobile({ t, reduced = false }) {
  const r2 = reduced ? undefined : 'dc-rise2 dc-rd2';
  return (
    <CelebTakeoverM t={t} reduced={reduced} count={48} backTitle="Game Plan">
      <CelebMedal t={t} size={92} reduced={reduced}>
        <IconTarget size={38} color="#fff" stroke={2.2} />
      </CelebMedal>
      <CelebEyebrow t={t} reduced={reduced}>2026 COMMITMENT · GAME PLAN</CelebEyebrow>
      <div className={r2} style={{ fontSize: 96, fontWeight: 800, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.045em', lineHeight: 0.95, marginTop: 8, textShadow: t.mode === 'light' ? 'none' : `0 0 60px ${t.gold}44` }}>
        100%
      </div>
      <div className={r2} style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 8 }}>
        commitment, met
      </div>
      <div className={r2} style={{ fontSize: 12.5, color: t.inkMute, lineHeight: 1.55, marginTop: 12, maxWidth: 285 }}>
        The {ttd(250_000)} you committed to in January is settled — with nine weeks of the year left to spend.
      </div>
      <CelebChips t={t} reduced={reduced} chips={[
        { k: 'SETTLED', v: ttd(251_000), gold: true },
        { k: 'COMMITTED', v: ttd(250_000) },
        { k: 'WEEKS EARLY', v: 9 },
      ]} />
      <CelebCta t={t} reduced={reduced}>Set the stretch</CelebCta>
    </CelebTakeoverM>
  );
}

// ── Manager echo — recognition travels up, quietly ────────────────────────
// A stacked toast on the manager's dashboard, not a takeover. One tap to
// congratulate (sends a note the agent sees), × to dismiss.
function ManagerEchoToast({ t, icon, title, sub, delayClass }) {
  return (
    <div className={delayClass} style={{
      width: 384, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14,
      boxShadow: t.mode === 'light' ? '0 14px 34px rgba(38,35,28,0.14)' : '0 14px 34px rgba(0,0,0,0.55)',
      padding: '13px 14px', display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: t.goldTint, border: `1px solid ${t.gold}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>{title}</div>
        <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2, fontFamily: APP_FONT_MONO, letterSpacing: '0.03em' }}>{sub}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div style={{ padding: '7px 14px', background: t.gold, color: t.mode === 'light' ? '#3a2a08' : '#fff', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Congratulate</div>
          <div style={{ padding: '7px 14px', background: t.surfaceSoft, color: t.inkMute, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>View</div>
        </div>
      </div>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: t.surfaceSoft, border: `1px solid ${t.rule}`, color: t.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>×</div>
    </div>
  );
}

function ManagerEchoScene({ t }) {
  return (
    <div style={{ width: '100%', height: '100%', background: t.bg, position: 'relative', overflow: 'hidden', fontFamily: APP_FONT_SANS }}>
      {/* dimmed manager dashboard behind */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.55, pointerEvents: 'none', padding: '22px 28px' }}>
        <div style={{ height: 60, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: t.tealTint }}></div>
          <div style={{ width: 190, height: 14, borderRadius: 6, background: t.surfaceMute }}></div>
          <div style={{ flex: 1 }}></div>
          <div style={{ width: 110, height: 30, borderRadius: 9, background: t.surfaceSoft, border: `1px solid ${t.rule}` }}></div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ flex: 1, height: 130, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}></div>)}
        </div>
        <div style={{ marginTop: 16, height: 420, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}></div>
      </div>

      {/* echo stack — top right, newest first */}
      <div style={{ position: 'absolute', top: 20, right: 22, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ManagerEchoToast
          t={t}
          delayClass="dc-rise2 dc-rd1"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill={t.gold} stroke="none"><path d="M12 2c-1 4-4 5-4 9 0 3 2 5 4 5s4-2 4-5c0-1 0-2 1-3 1 2 3 4 3 7 0 4-3 7-7 7-3.8 0-7-3-7-7 0-5 4-7 6-13z"/></svg>}
          title="Marsha Singh hit 25 weeks filed in a row"
          sub="FILING STREAK · JUST NOW"
        />
        <ManagerEchoToast
          t={t}
          delayClass="dc-rise2 dc-rd2"
          icon={<IconTrophy size={18} color={t.gold} stroke={2} />}
          title="Anand Persad qualified for Eagles Club"
          sub="AWARD · 12 MIN AGO"
        />
      </div>
    </div>
  );
}

Object.assign(window, {
  CelebMedal, CelebTakeoverM, CelebEyebrow, CelebChips, CelebCta, CelebBalloons,
  FirstSaleMobile, AwardQualifiedMobile, BestWeekMobile, CommitmentMobile,
  ManagerEchoToast, ManagerEchoScene,
});
