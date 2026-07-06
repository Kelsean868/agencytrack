// AgencyTrack — Auth + Onboarding v2. Login screen + first-login Welcome tour.
// Faithful to the repo (LoginScreen.jsx, WelcomeScreen.jsx) but rebuilt in the
// v2 system: cream surface, teal, Cabinet Grotesk display. Full-viewport login
// with a faint insurance-iconography pattern; Welcome is a 4-slide modal.
// Reuses app-tokens (icons, fonts, APP_LIGHT/DARK, APP_W/APP_H).

// ── Animated insurance-iconography backdrop ───────────────────────────────
// Evenly spaced grid of glyphs; alternate rows drift slowly in opposite
// directions. Raised opacity so it actually reads. Built as DOM rows (not an
// SVG pattern) so each row can animate independently + the login card's
// liquid-glass backdrop-filter has something to refract.
if (typeof document !== 'undefined' && !document.getElementById('login-pattern-anim')) {
  const s = document.createElement('style');
  s.id = 'login-pattern-anim';
  s.textContent = `
    @keyframes login-drift-l { from { transform: translateX(0); } to { transform: translateX(-140px); } }
    @keyframes login-drift-r { from { transform: translateX(-140px); } to { transform: translateX(0); } }
  `;
  document.head.appendChild(s);
}

const LOGIN_GLYPHS = {
  phone:     (p) => <g {...p}><rect x="6" y="2" width="20" height="28" rx="3" /><line x1="13" y1="25" x2="19" y2="25" /></g>,
  handshake: (p) => <g {...p}><path d="M2 13l7-4 5 3 5-3 7 4v8H2z" /><path d="M9 9l4-4 5 3" /></g>,
  doc:       (p) => <g {...p}><rect x="5" y="2" width="22" height="28" rx="3" /><line x1="10" y1="10" x2="22" y2="10" /><line x1="10" y1="16" x2="22" y2="16" /><line x1="10" y1="22" x2="17" y2="22" /></g>,
  dollar:    (p) => <g {...p}><circle cx="16" cy="16" r="13" /><path d="M11 12h8a3 3 0 0 1 0 6h-6a3 3 0 0 0 0 6h8M16 6v3M16 23v3" /></g>,
  calendar:  (p) => <g {...p}><rect x="4" y="5" width="24" height="23" rx="3" /><line x1="4" y1="12" x2="28" y2="12" /><line x1="11" y1="2" x2="11" y2="8" /><line x1="21" y1="2" x2="21" y2="8" /></g>,
  shield:    (p) => <g {...p}><path d="M16 3l11 4v7c0 7-5 11-11 13C10 25 5 21 5 14V7l11-4z" /><path d="M11 15l3 3 6-6" /></g>,
  target:    (p) => <g {...p}><circle cx="16" cy="16" r="13" /><circle cx="16" cy="16" r="7" /><circle cx="16" cy="16" r="1.5" /></g>,
  chart:     (p) => <g {...p}><line x1="4" y1="27" x2="28" y2="27" /><rect x="7" y="16" width="4" height="11" /><rect x="14" y="9" width="4" height="18" /><rect x="21" y="13" width="4" height="14" /></g>,
};
const LOGIN_GLYPH_ROWS = [
  ['phone', 'handshake', 'doc', 'dollar', 'calendar', 'shield'],
  ['target', 'chart', 'shield', 'phone', 'doc', 'handshake'],
  ['dollar', 'calendar', 'phone', 'target', 'handshake', 'chart'],
  ['doc', 'shield', 'chart', 'calendar', 'target', 'dollar'],
];
const LOGIN_CELL = 140;   // even horizontal spacing
const LOGIN_ROW_H = 116;  // even vertical spacing

function LoginPattern({ t }) {
  const c = t.teal;
  const op = t.mode === 'dark' ? 0.18 : 0.13;
  const rows = Math.ceil(((t.mode ? APP_H : APP_H) + LOGIN_ROW_H) / LOGIN_ROW_H) + 1;
  const perRow = Math.ceil((APP_W + LOGIN_CELL * 2) / LOGIN_CELL) + 1;
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: op }}>
      {Array.from({ length: rows }).map((_, ri) => {
        const left = ri % 2 === 0;
        const dur = 30 + (ri % 4) * 6;           // 30–48s, varied per row
        const kinds = LOGIN_GLYPH_ROWS[ri % LOGIN_GLYPH_ROWS.length];
        return (
          <div key={ri} style={{ position: 'absolute', top: ri * LOGIN_ROW_H - 20, left: -LOGIN_CELL, height: LOGIN_ROW_H, display: 'flex', alignItems: 'center', gap: LOGIN_CELL - 32, animation: `${left ? 'login-drift-l' : 'login-drift-r'} ${dur}s linear infinite` }}>
            {Array.from({ length: perRow }).map((__, ci) => {
              const Glyph = LOGIN_GLYPHS[kinds[ci % kinds.length]];
              return (
                <svg key={ci} width="32" height="32" viewBox="0 0 32 32" style={{ flexShrink: 0 }} fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <Glyph />
                </svg>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Field({ t, label, type, value, placeholder, autoFocus }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: t.inkMute }}>{label}</label>
      <div style={{
        height: 46, padding: '0 14px', display: 'flex', alignItems: 'center',
        background: t.surfaceSoft, border: `1px solid ${autoFocus ? t.teal : t.rule}`,
        borderRadius: 10, boxShadow: autoFocus ? `0 0 0 3px ${t.teal}22` : 'none',
      }}>
        <span style={{ fontSize: 14, color: value ? t.ink : t.inkFaint, fontFamily: type === 'password' ? 'monospace' : APP_FONT_SANS, letterSpacing: type === 'password' && value ? '0.18em' : 0 }}>
          {value || placeholder}
        </span>
      </div>
    </div>
  );
}

// Eye toggle glyph — open = revealed, slashed = hidden.
function EyeIcon({ open, size = 18, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

// Password field with the industry-standard show/hide reveal toggle + an
// optional Caps Lock warning.
function PasswordField({ t, value, revealed, caps }) {
  const focused = !!value;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: t.inkMute }}>Password</label>
        {caps && <span style={{ fontSize: 10, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO, display: 'inline-flex', alignItems: 'center', gap: 4, letterSpacing: '0.04em' }}><IconAlert size={11} color={t.warning} /> CAPS LOCK ON</span>}
      </div>
      <div style={{ height: 46, padding: '0 6px 0 14px', display: 'flex', alignItems: 'center', gap: 8, background: t.surfaceSoft, border: `1px solid ${focused ? t.teal : t.rule}`, borderRadius: 10, boxShadow: focused ? `0 0 0 3px ${t.teal}22` : 'none' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: value ? t.ink : t.inkFaint, fontFamily: revealed ? APP_FONT_SANS : 'monospace', letterSpacing: (!revealed && value) ? '0.18em' : 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {value ? (revealed ? value : '\u2022'.repeat(value.length)) : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
        </span>
        <div title={revealed ? 'Hide password' : 'Show password'} aria-label={revealed ? 'Hide password' : 'Show password'} style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: revealed ? t.teal : t.inkMute, background: revealed ? t.tealTint : 'transparent', flexShrink: 0 }}>
          <EyeIcon open={revealed} size={18} color={revealed ? t.teal : t.inkMute} />
        </div>
      </div>
    </div>
  );
}

// state: 'default' | 'error' | 'reset' | 'revealed'
function LoginV2({ t, state = 'default', device = 'desktop' }) {
  const W = device === 'mobile' ? M_W : APP_W;
  const H = device === 'mobile' ? M_H : APP_H;
  const filled = state !== 'default';
  const pw = filled ? 'Tatil2026!' : '';
  const revealed = state === 'revealed';
  const caps = state === 'error';
  const remember = state !== 'default';
  return (
    <div style={{ width: W, height: H, background: t.bg, color: t.ink, fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
      <LoginPattern t={t} />
      <div className="a-rise" style={{
        position: 'relative', zIndex: 1, width: device === 'mobile' ? 330 : 400,
        background: t.mode === 'dark' ? 'rgba(30,25,20,0.55)' : 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(22px) saturate(165%)', WebkitBackdropFilter: 'blur(22px) saturate(165%)',
        border: `1px solid ${t.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)'}`,
        borderRadius: 22,
        padding: '36px 34px',
        boxShadow: t.mode === 'dark'
          ? '0 24px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)'
          : '0 24px 70px rgba(40,37,29,0.16), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}><AgencyLogo size={56} radius={15} /></div>
          <div style={{ fontSize: 24, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY }}>AgencyTrack</div>
          <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 4 }}>Tatil Life — Sales Portal</div>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <Field t={t} label="Email address" type="email" value={filled ? 'marsha.singh@tatillife.com' : ''} placeholder="you@tatillife.com" autoFocus={state === 'default'} />
          <PasswordField t={t} value={pw} revealed={revealed} caps={caps} />

          {/* Remember me + forgot — the standard inline row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, background: remember ? t.teal : t.surfaceSoft, border: `1px solid ${remember ? t.teal : t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {remember && <IconCheck size={12} color="#fff" stroke={3} />}
              </span>
              <span style={{ fontSize: 12.5, color: t.inkMute }}>Remember me</span>
            </label>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: t.teal, cursor: 'pointer' }}>Forgot password?</span>
          </div>

          {state === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: t.danger, padding: '9px 12px', background: t.dangerTint, border: `1px solid ${t.danger}33`, borderRadius: 9 }}>
              <IconAlert size={14} color={t.danger} /> Incorrect email or password.
            </div>
          )}
          {state === 'reset' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: t.success, padding: '9px 12px', background: t.successTint, border: `1px solid ${t.success}33`, borderRadius: 9 }}>
              <IconCheck size={14} color={t.success} stroke={2.4} /> Reset email sent — check your inbox.
            </div>
          )}

          <div style={{ height: 48, background: t.teal, color: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14.5, fontWeight: 700, boxShadow: `0 3px 12px ${t.teal}55`, cursor: 'pointer', marginTop: 2 }}>
            Sign in <IconArrowR size={16} color="#fff" stroke={2.4} />
          </div>
        </div>

        {/* Help footer */}
        <div style={{ textAlign: 'center', marginTop: 22, paddingTop: 18, borderTop: `1px solid ${t.rule}` }}>
          <div style={{ fontSize: 12, color: t.inkMute }}>Trouble signing in? <span style={{ color: t.teal, fontWeight: 600, cursor: 'pointer' }}>Contact your manager</span></div>
          <div style={{ fontSize: 10.5, color: t.inkFaint, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: APP_FONT_MONO }}>
            <IconShield size={11} color={t.inkFaint} /> Secured by Tatil Life
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Welcome / first-login tour ────────────────────────────────────────────
const WELCOME_SLIDES = [
  { Icon: IconTrophy, title: 'Welcome to AgencyTrack', body: 'Your personal sales performance hub. Track your weekly activity, measure progress toward your goals, and stay on top of every target — all in one place.' },
  { Icon: IconWizard, title: 'Your Weekly Report', body: "Every week, tap 'Submit Weekly Report' to log your activity. It takes less than 5 minutes. Submit before Monday 9:00 AM to stay compliant." },
  { Icon: IconChart,  title: 'Track Your Progress', body: 'Your dashboard shows your KPIs, award progress, and where you stand against your targets. The Career tab shows your path to the next level.' },
  { Icon: IconShield, title: "You're All Set", body: 'Your manager will guide you through the rest. Need to revisit this tour? Ask your manager to reset it for you.', isLast: true },
];

function WelcomeV2({ t, index = 0, device = 'mobile' }) {
  const W = device === 'mobile' ? M_W : APP_W;
  const H = device === 'mobile' ? M_H : APP_H;
  const s = WELCOME_SLIDES[index];
  return (
    <div style={{ width: W, height: H, background: t.bg, position: 'relative', overflow: 'hidden', fontFamily: APP_FONT_SANS, boxSizing: 'border-box' }}>
      {/* Dim backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}></div>
      {/* Modal */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: device === 'mobile' ? 330 : 420, background: t.surface, borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.4)' }}>
        <div style={{ position: 'absolute', top: 16, right: 18, fontSize: 12, color: t.inkMute, cursor: 'pointer', zIndex: 1 }}>Skip</div>

        <div className="a-fade-up" key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '52px 36px 22px', gap: 16 }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: t.tealTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <s.Icon size={40} color={t.teal} stroke={1.8} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.2 }}>{s.title}</div>
          <div style={{ fontSize: 13.5, color: t.inkMute, lineHeight: 1.6 }}>{s.body}</div>
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, paddingBottom: 8 }}>
          {WELCOME_SLIDES.map((_, i) => (
            <div key={i} style={{ width: i === index ? 22 : 7, height: 7, borderRadius: 999, background: i === index ? t.teal : t.teal + '44', transition: 'width 200ms' }}></div>
          ))}
        </div>

        <div style={{ padding: '8px 36px 34px' }}>
          <div style={{ height: 48, background: t.teal, color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14.5, fontWeight: 700, boxShadow: `0 4px 14px ${t.teal}44`, cursor: 'pointer' }}>
            {s.isLast ? 'Get Started' : <>Next <IconChevR size={16} color="#fff" stroke={2.4} /></>}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginPattern, EyeIcon, PasswordField, LoginV2, WELCOME_SLIDES, WelcomeV2 });
