// Streak Celebration v2 — the weekly-report FILING streak milestone takeover
// (5 / 10 / 25 / 52 weeks), redesigned. Extends the Daily Capture celebration
// grammar (flame medal, halo, confetti — dailycap-celebrate.jsx) into a
// full-screen milestone moment:
//   • The milestone NUMBER is the hero — display type at poster scale,
//     the medal supports it instead of leading.
//   • Gold only (recognition color), medal radial is the one allowed gradient.
//   • One-tap dismiss: the whole screen is the tap target.
//   • reduced prop = prefers-reduced-motion variant: static, no confetti,
//     no pop/rise animation, halo frozen at a calm value.
//   • Mobile takeover + desktop takeover (over the dimmed report screen).

const STREAK_NEXT = { 5: 10, 10: 25, 25: 52, 52: null };
const STREAK_COPY = {
  5:  { sub: 'Five straight weeks filed on time. The habit is forming — this is how the year gets built.' },
  10: { sub: 'Ten weeks without a miss. Your manager sees a full, honest picture of the quarter.' },
  25: { sub: 'Half a year of unbroken filing. The Master Sheet has never had a gap with your name on it.' },
  52: { sub: 'A full year. Every single week, filed. Nobody can say what gets measured wasn\u2019t done.' },
};

// ── Flame medal — Daily Capture's medal, scaled for the milestone moment ──
function StreakMedal({ t, size = 120, reduced = false, annual = false }) {
  const glow = t.mode === 'light' ? t.gold + '55' : t.gold + '88';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div className={reduced ? undefined : 'dc-halo'} style={{ position: 'absolute', inset: -size * 0.18, borderRadius: '50%', background: `radial-gradient(circle, ${glow} 0%, transparent 68%)`, opacity: reduced ? 0.55 : undefined }}></div>
      {!reduced && <div style={{ position: 'absolute', inset: -size * 0.07, borderRadius: '50%', border: `2px solid ${t.gold}66`, animation: 'dc-ring 2.4s ease-out infinite' }}></div>}
      {annual && <div style={{ position: 'absolute', inset: -size * 0.13, borderRadius: '50%', border: `1.5px solid ${t.gold}44` }}></div>}
      <div className={reduced ? undefined : 'dc-pop'} style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 32% 26%, #fde9a8 0%, #e0aa3e 48%, #a06b12 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 -5px 12px rgba(0,0,0,0.22), inset 0 5px 12px rgba(255,255,255,0.42), 0 0 ${size * 0.33}px ${glow}` }}>
        <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M12 2c-1 4-4 5-4 9 0 3 2 5 4 5s4-2 4-5c0-1 0-2 1-3 1 2 3 4 3 7 0 4-3 7-7 7-3.8 0-7-3-7-7 0-5 4-7 6-13z"/></svg>
        <span style={{ position: 'absolute', top: '9%', left: '20%', width: '38%', height: '22%', borderRadius: '50%', background: 'rgba(255,255,255,0.45)', filter: 'blur(4px)' }}></span>
      </div>
    </div>
  );
}

// ── The milestone content block (shared mobile/desktop) ───────────────────
function StreakContent({ t, weeks, best, reduced = false, scale = 1 }) {
  const annual = weeks === 52;
  const next = STREAK_NEXT[weeks];
  const rise = (n) => reduced ? undefined : `dc-rise2 dc-rd${n}`;
  const heroSize = Math.round((weeks >= 10 ? 148 : 132) * scale);
  const chips = [
    { k: 'STREAK', v: `${weeks} wks`, gold: true },
    { k: 'BEST', v: `${Math.max(best, weeks)} wks` },
    next ? { k: 'NEXT MILESTONE', v: `${next} wks` } : { k: 'THIS YEAR', v: '52 / 52' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <StreakMedal t={t} size={Math.round(92 * scale)} reduced={reduced} annual={annual} />

      <div className={rise(1)} style={{ marginTop: 18 * scale, fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', color: t.gold, fontFamily: APP_FONT_MONO }}>
        {annual ? '\u2605 FILING STREAK \u00b7 A FULL YEAR' : 'FILING STREAK MILESTONE'}
      </div>

      {/* The hero — the number itself */}
      <div className={rise(2)} style={{ position: 'relative', lineHeight: 0.9, marginTop: 8 * scale }}>
        <div style={{ fontSize: heroSize, fontWeight: 800, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.045em', textShadow: t.mode === 'light' ? 'none' : `0 0 60px ${t.gold}44` }}>
          {weeks}
        </div>
      </div>
      <div className={rise(2)} style={{ fontSize: Math.round(19 * scale), fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>
        weeks filed in a row
      </div>

      <div className={rise(2)} style={{ fontSize: 12.5, color: t.inkMute, lineHeight: 1.55, marginTop: 12, maxWidth: 300 * Math.max(1, scale * 0.9) }}>
        {STREAK_COPY[weeks]?.sub || STREAK_COPY[5].sub}
      </div>

      <div className={rise(3)} style={{ display: 'flex', gap: 9, marginTop: 20 * scale }}>
        {chips.map((c, i) => (
          <div key={i} style={{ padding: '10px 15px', borderRadius: 12, background: c.gold ? t.goldTint : t.surfaceSoft, border: `1px solid ${c.gold ? t.gold + '55' : t.rule}` }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: c.gold ? t.gold : t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{c.k}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 4 }}>{c.v}</div>
          </div>
        ))}
      </div>

      <div className={rise(3)} style={{ marginTop: 22 * scale, padding: '13px 30px', minHeight: 44, boxSizing: 'border-box', background: t.gold, color: t.mode === 'light' ? '#3a2a08' : '#fff', borderRadius: 11, fontSize: 14, fontWeight: 700, boxShadow: `0 4px 14px ${t.gold}55`, cursor: 'pointer' }}>
        Keep filing
      </div>
      <div className={rise(3)} style={{ marginTop: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: t.inkFaint, fontFamily: APP_FONT_MONO }}>
        TAP ANYWHERE TO CONTINUE
      </div>
    </div>
  );
}

// ── Mobile takeover — over the dimmed weekly-report screen ────────────────
function StreakMobile({ t, weeks = 25, best = 25, reduced = false }) {
  const glow = t.mode === 'light' ? t.gold + '55' : t.gold + '88';
  return (
    <MFrame t={t}>
      {/* dimmed report screen behind */}
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(3px)', opacity: 0.4, pointerEvents: 'none' }}>
        <MHeader t={t} title="Weekly Report" sub="WEEK 48 · SUBMITTED" />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: t.mode === 'light' ? 'rgba(247,246,242,0.84)' : 'rgba(16,13,9,0.88)' }}></div>
      <div style={{ position: 'absolute', top: '4%', left: '50%', transform: 'translateX(-50%)', width: '86%', height: '44%', background: `radial-gradient(circle, ${glow} 0%, transparent 62%)`, pointerEvents: 'none', opacity: reduced ? 0.5 : 1 }}></div>

      {!reduced && <DCConfetti colors={[t.gold, t.warning, t.teal, t.tealLight, '#fff']} count={weeks >= 52 ? 56 : 40} />}

      {/* one-tap dismiss — the whole overlay is the target */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'pointer' }}>
        <StreakContent t={t} weeks={weeks} best={best} reduced={reduced} />
      </div>

      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: t.ink, borderRadius: 999, opacity: 0.85, zIndex: 30 }}></div>
    </MFrame>
  );
}

// ── Desktop takeover — over the dimmed Weekly Report Wizard ───────────────
function StreakDesktop({ t, weeks = 10, best = 10, reduced = false }) {
  const glow = t.mode === 'light' ? t.gold + '4d' : t.gold + '77';
  return (
    <div style={{ width: '100%', height: '100%', background: t.bg, position: 'relative', overflow: 'hidden', fontFamily: APP_FONT_SANS }}>
      {/* dimmed wizard behind */}
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(4px)', opacity: 0.45, pointerEvents: 'none', padding: '22px 28px' }}>
        <div style={{ height: 60, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: t.tealTint }}></div>
          <div style={{ width: 220, height: 14, borderRadius: 6, background: t.surfaceMute }}></div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <div style={{ flex: 1.4, height: 560, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}></div>
          <div style={{ flex: 1, height: 560, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}></div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: t.mode === 'light' ? 'rgba(247,246,242,0.85)' : 'rgba(16,13,9,0.88)' }}></div>
      <div style={{ position: 'absolute', top: '-4%', left: '50%', transform: 'translateX(-50%)', width: '58%', height: '58%', background: `radial-gradient(circle, ${glow} 0%, transparent 62%)`, pointerEvents: 'none', opacity: reduced ? 0.5 : 1 }}></div>

      {!reduced && <DCConfetti colors={[t.gold, t.warning, t.teal, t.tealLight, '#fff']} count={54} />}

      <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <StreakContent t={t} weeks={weeks} best={best} reduced={reduced} scale={1.15} />
      </div>

      {/* Esc affordance */}
      <div style={{ position: 'absolute', top: 18, right: 20, zIndex: 4, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 999, color: t.inkMute, fontSize: 10.5, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em', cursor: 'pointer' }}>
        ESC · DISMISS
      </div>
    </div>
  );
}

// ── Personal celebration surfaces — the agent's own app greets them ───────
// Distinct from the room surfaces (Kiosk, Meeting Mode) which announce to
// the branch. Color discipline: birthday is festive but NOT performance
// recognition, so it leads teal; contract anniversary is a career milestone,
// so it earns gold like the streaks.

function BirthdayMobile({ t, name = 'Marsha', initials = 'MS', date = 'JUL 10', branch = 'South Branch', reduced = false }) {
  const glow = t.mode === 'light' ? t.teal + '3d' : t.teal + '66';
  const rise = (n) => reduced ? undefined : `dc-rise2 dc-rd${n}`;
  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(3px)', opacity: 0.4, pointerEvents: 'none' }}>
        <MHeader t={t} title="Today" sub="WEEK 28" />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: t.mode === 'light' ? 'rgba(247,246,242,0.84)' : 'rgba(16,13,9,0.88)' }}></div>
      <div style={{ position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', width: '84%', height: '42%', background: `radial-gradient(circle, ${glow} 0%, transparent 62%)`, pointerEvents: 'none', opacity: reduced ? 0.5 : 1 }}></div>

      {!reduced && <DCConfetti colors={[t.teal, t.tealLight, t.gold, t.warning, '#fff']} count={30} />}
      {!reduced && <CelebBalloons t={t} />}

      <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center', cursor: 'pointer' }}>
        {/* glowing avatar — the kiosk celebration treatment, personal scale */}
        <div style={{ position: 'relative', width: 104, height: 104, marginBottom: 20 }}>
          <div className={reduced ? undefined : 'dc-halo'} style={{ position: 'absolute', inset: -18, borderRadius: '50%', background: `radial-gradient(circle, ${glow} 0%, transparent 68%)`, opacity: reduced ? 0.55 : undefined }}></div>
          {!reduced && <div style={{ position: 'absolute', inset: -7, borderRadius: '50%', border: `2px solid ${t.teal}55`, animation: 'dc-ring 2.4s ease-out infinite' }}></div>}
          <div className={reduced ? undefined : 'dc-pop'} style={{ position: 'relative', width: 104, height: 104, borderRadius: '50%', background: t.tealTint, border: `2.5px solid ${t.teal}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 34, fontFamily: APP_FONT_DISPLAY, color: t.teal, boxShadow: `0 0 34px ${glow}` }}>{initials}</div>
        </div>

        <div className={rise(1)} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', color: t.teal, fontFamily: APP_FONT_MONO }}>★ TODAY · {date}</div>
        <div className={rise(2)} style={{ fontSize: 31, fontWeight: 800, color: t.ink, letterSpacing: '-0.03em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.08, marginTop: 10 }}>
          Happy birthday,<br />{name}.
        </div>
        <div className={rise(2)} style={{ fontSize: 12.5, color: t.inkMute, lineHeight: 1.55, marginTop: 12, maxWidth: 270 }}>
          From everyone at {branch} — have a great one. The numbers can wait until tomorrow.
        </div>

        <div className={rise(3)} style={{ marginTop: 24, padding: '13px 30px', minHeight: 44, boxSizing: 'border-box', background: t.teal, color: '#fff', borderRadius: 11, fontSize: 14, fontWeight: 700, boxShadow: `0 4px 14px ${t.teal}55` }}>
          Back to my day
        </div>
        <div className={rise(3)} style={{ marginTop: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: t.inkFaint, fontFamily: APP_FONT_MONO }}>TAP ANYWHERE TO CONTINUE</div>
      </div>
      {!reduced && <CelebBalloons t={t} foreground count={2} />}

      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: t.ink, borderRadius: 999, opacity: 0.85, zIndex: 30 }}></div>
    </MFrame>
  );
}

function AnniversaryMobile({ t, name = 'Anand', years = 3, since = 'MAR 2023', weeksFiled = 141, lives = 214, reduced = false }) {
  const glow = t.mode === 'light' ? t.gold + '55' : t.gold + '88';
  const rise = (n) => reduced ? undefined : `dc-rise2 dc-rd${n}`;
  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(3px)', opacity: 0.4, pointerEvents: 'none' }}>
        <MHeader t={t} title="Today" sub="WEEK 28" />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: t.mode === 'light' ? 'rgba(247,246,242,0.84)' : 'rgba(16,13,9,0.88)' }}></div>
      <div style={{ position: 'absolute', top: '4%', left: '50%', transform: 'translateX(-50%)', width: '86%', height: '44%', background: `radial-gradient(circle, ${glow} 0%, transparent 62%)`, pointerEvents: 'none', opacity: reduced ? 0.5 : 1 }}></div>

      {!reduced && <DCConfetti colors={[t.gold, t.warning, t.teal, '#fff']} count={28} />}
      {!reduced && <CelebBalloons t={t} />}

      <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center', cursor: 'pointer' }}>
        <StreakMedal t={t} size={88} reduced={reduced} annual={years >= 5} />

        <div className={rise(1)} style={{ marginTop: 18, fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', color: t.gold, fontFamily: APP_FONT_MONO }}>CONTRACT ANNIVERSARY · SINCE {since}</div>

        <div className={rise(2)} style={{ fontSize: 120, fontWeight: 800, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.045em', lineHeight: 0.9, marginTop: 8, textShadow: t.mode === 'light' ? 'none' : `0 0 60px ${t.gold}44` }}>{years}</div>
        <div className={rise(2)} style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>
          {years === 1 ? 'year in the field' : 'years in the field'}
        </div>
        <div className={rise(2)} style={{ fontSize: 12.5, color: t.inkMute, lineHeight: 1.55, marginTop: 12, maxWidth: 290 }}>
          {name}, that's {years === 1 ? 'a year' : `${['', 'one', 'two', 'three', 'four', 'five'][years] || years} years`} of fact finds, kept promises and filed weeks. Families are covered because you stayed at it.
        </div>

        <div className={rise(3)} style={{ display: 'flex', gap: 9, marginTop: 20 }}>
          {[{ k: 'YEARS', v: years, gold: true }, { k: 'WEEKS FILED', v: weeksFiled }, { k: 'LIVES', v: lives }].map((c, i) => (
            <div key={i} style={{ padding: '10px 15px', borderRadius: 12, background: c.gold ? t.goldTint : t.surfaceSoft, border: `1px solid ${c.gold ? t.gold + '55' : t.rule}` }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: c.gold ? t.gold : t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{c.k}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 4 }}>{c.v}</div>
            </div>
          ))}
        </div>

        <div className={rise(3)} style={{ marginTop: 22, padding: '13px 30px', minHeight: 44, boxSizing: 'border-box', background: t.gold, color: t.mode === 'light' ? '#3a2a08' : '#fff', borderRadius: 11, fontSize: 14, fontWeight: 700, boxShadow: `0 4px 14px ${t.gold}55` }}>
          Here's to the next one
        </div>
        <div className={rise(3)} style={{ marginTop: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: t.inkFaint, fontFamily: APP_FONT_MONO }}>TAP ANYWHERE TO CONTINUE</div>
      </div>
      {!reduced && <CelebBalloons t={t} foreground count={2} />}

      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: t.ink, borderRadius: 999, opacity: 0.85, zIndex: 30 }}></div>
    </MFrame>
  );
}

Object.assign(window, { StreakMedal, StreakContent, StreakMobile, StreakDesktop, STREAK_NEXT, STREAK_COPY, BirthdayMobile, AnniversaryMobile });
