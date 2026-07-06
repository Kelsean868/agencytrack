// Daily Capture v2 — streak / daily-goal celebration. Fires when the agent
// logs a day that completes a streak milestone. Mobile takeover over the
// dimmed entry screen, reusing the recognition grammar (flame, halo, confetti).

if (typeof document !== 'undefined' && !document.getElementById('dc-celebrate-styles')) {
  const s = document.createElement('style');
  s.id = 'dc-celebrate-styles';
  s.textContent = `
    @keyframes dc-confetti { 0%{transform:translateY(-30px) rotate(0);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateY(680px) rotate(640deg);opacity:0} }
    @keyframes dc-pop { 0%{opacity:0;transform:scale(0.6) translateY(12px)} 60%{opacity:1;transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
    @keyframes dc-halo { 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(1.15);opacity:0.95} }
    @keyframes dc-ring { 0%{transform:scale(0.7);opacity:0.8} 100%{transform:scale(2.2);opacity:0} }
    @keyframes dc-rise2 { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    .dc-pop{animation:dc-pop 720ms cubic-bezier(0.34,1.56,0.64,1) both}
    .dc-halo{animation:dc-halo 2.4s ease-in-out infinite}
    .dc-rise2{animation:dc-rise2 600ms cubic-bezier(0.34,1.4,0.64,1) both}
    .dc-rd1{animation-delay:.12s}.dc-rd2{animation-delay:.22s}.dc-rd3{animation-delay:.34s}
  `;
  document.head.appendChild(s);
}

function _dcSeed(i) { const x = Math.sin((i + 1) * 5237 + 913) * 43758.5; return x - Math.floor(x); }

function DCConfetti({ colors, count = 40 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
      {Array.from({ length: count }).map((_, i) => {
        const left = _dcSeed(i) * 100, delay = _dcSeed(i + 50) * 2.2, dur = 2.6 + _dcSeed(i + 90) * 1.8;
        const w = 5 + Math.round(_dcSeed(i + 120) * 5), round = _dcSeed(i + 160) > 0.6;
        return <div key={i} style={{ position: 'absolute', top: -30, left: `${left}%`, width: w, height: round ? w : w + 5, background: colors[i % colors.length], borderRadius: round ? '50%' : 2, animation: `dc-confetti ${dur}s linear ${delay}s infinite`, opacity: 0 }} />;
      })}
    </div>
  );
}

function DailyCelebration({ t }) {
  const data = DAILY_SAMPLE;
  const milestone = data.streak.milestone;
  const glow = t.mode === 'light' ? t.gold + '55' : t.gold + '88';
  return (
    <MFrame t={t}>
      {/* dimmed entry behind */}
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(3px)', opacity: 0.4, pointerEvents: 'none' }}>
        <MHeader t={t} title="Log Today" sub={data.weekShort} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: t.mode === 'light' ? 'rgba(247,246,242,0.82)' : 'rgba(16,13,9,0.86)' }}></div>
      <div style={{ position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: '46%', background: `radial-gradient(circle, ${glow} 0%, transparent 62%)`, pointerEvents: 'none' }}></div>

      <DCConfetti colors={[t.gold, t.warning, t.teal, t.tealLight, '#fff']} />

      <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
        {/* flame medal */}
        <div style={{ position: 'relative', width: 116, height: 116, marginBottom: 22 }}>
          <div className="dc-halo" style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: `radial-gradient(circle, ${glow} 0%, transparent 68%)` }}></div>
          <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: `2px solid ${t.gold}66`, animation: 'dc-ring 2.4s ease-out infinite' }}></div>
          <div className="dc-pop" style={{ position: 'relative', width: 116, height: 116, borderRadius: '50%', background: 'radial-gradient(circle at 32% 26%, #fde9a8 0%, #e0aa3e 48%, #a06b12 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 -5px 12px rgba(0,0,0,0.22), inset 0 5px 12px rgba(255,255,255,0.42), 0 0 38px ${glow}` }}>
            <svg width="46" height="46" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M12 2c-1 4-4 5-4 9 0 3 2 5 4 5s4-2 4-5c0-1 0-2 1-3 1 2 3 4 3 7 0 4-3 7-7 7-3.8 0-7-3-7-7 0-5 4-7 6-13z"/></svg>
            <span style={{ position: 'absolute', top: '9%', left: '20%', width: '38%', height: '22%', borderRadius: '50%', background: 'rgba(255,255,255,0.45)', filter: 'blur(4px)' }}></span>
          </div>
        </div>

        <div className="dc-rise2 dc-rd1" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', color: t.gold, fontFamily: APP_FONT_MONO }}>STREAK MILESTONE</div>
        <div className="dc-rise2 dc-rd2" style={{ fontSize: 32, fontWeight: 700, color: t.ink, letterSpacing: '-0.03em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.05, marginTop: 10 }}>
          {milestone} days logged<br />in a row
        </div>
        <div className="dc-rise2 dc-rd2" style={{ fontSize: 13, color: t.inkMute, lineHeight: 1.55, marginTop: 12, maxWidth: 280 }}>
          You logged today and hit a <b style={{ color: t.ink }}>{milestone}-day streak</b> — your best is {data.streak.best}. Consistency is how the week's number gets built.
        </div>

        <div className="dc-rise2 dc-rd3" style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          {[{ k: 'STREAK', v: `${milestone}` }, { k: 'BEST', v: `${data.streak.best}` }, { k: 'TODAY', v: dcTtd(data.today.apiCredit) }].map((c, i) => (
            <div key={i} style={{ padding: '11px 16px', borderRadius: 12, background: i === 0 ? t.goldTint : t.surfaceSoft, border: `1px solid ${i === 0 ? t.gold + '55' : t.rule}` }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: i === 0 ? t.gold : t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{c.k}</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 5 }}>{c.v}</div>
            </div>
          ))}
        </div>

        <div className="dc-rise2 dc-rd3" style={{ marginTop: 26, padding: '12px 26px', background: t.gold, color: t.mode === 'light' ? '#3a2a08' : '#fff', borderRadius: 11, fontSize: 14, fontWeight: 700, boxShadow: `0 4px 14px ${t.gold}55` }}>
          Keep it going
        </div>
      </div>

      {/* Home indicator */}
      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: t.ink, borderRadius: 999, opacity: 0.85, zIndex: 30 }}></div>
    </MFrame>
  );
}

Object.assign(window, { DailyCelebration, DCConfetti });
