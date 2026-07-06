// App motion system — shared across desktop + mobile. Inspired by the kiosk
// k-* animation library, but gentler / quieter for daily-use surfaces.
//
// Includes:
//   • Ambient blob backdrop component (AmbientBg)
//   • Keyframes: blob-a/b/c (slow drift), fade-up, rise, scale-in, glow-soft,
//     progress-grow, count-up, breathe, pulse, halo
//   • Utility classes: .a-rise / .a-fade-up / .a-scale-in / .a-glow-soft /
//     .a-breathe / .a-progress-grow / .a-card (hover lift) + .a-d-N delays
//   • Hero card gradient + glow helpers

// One-time CSS injection. Runs on module load. Idempotent.
if (typeof document !== 'undefined' && !document.getElementById('app-motion-styles')) {
  const s = document.createElement('style');
  s.id = 'app-motion-styles';
  s.textContent = `
    /* ── Keyframes ─────────────────────────────────────────────────────── */
    @keyframes app-blob-a {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33%      { transform: translate(120px, 80px) scale(1.12); }
      66%      { transform: translate(-60px, 110px) scale(0.94); }
    }
    @keyframes app-blob-b {
      0%, 100% { transform: translate(0, 0) scale(1); }
      40%      { transform: translate(-140px, 60px) scale(1.08); }
      75%      { transform: translate(80px, -90px) scale(0.96); }
    }
    @keyframes app-blob-c {
      0%, 100% { transform: translate(0, 0) scale(1); }
      30%      { transform: translate(90px, -60px) scale(0.9); }
      65%      { transform: translate(-90px, -100px) scale(1.1); }
    }
    @keyframes app-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes app-rise {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes app-scale-in {
      from { opacity: 0; transform: scale(0.96); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes app-progress-grow {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }
    @keyframes app-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes app-line-draw {
      to { stroke-dashoffset: 0; }
    }
    @keyframes app-arc-reveal {
      to { stroke-dashoffset: 0; }
    }
    @keyframes app-bar-grow {
      from { transform: scaleY(0); }
      to   { transform: scaleY(1); }
    }
    @keyframes app-pulse-badge {
      0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
      50%      { box-shadow: 0 0 0 6px transparent; opacity: 0.7; }
    }
    .a-line-draw {
      animation: app-line-draw 1.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both;
    }
    .a-arc-reveal {
      animation: app-arc-reveal 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.4s both;
    }
    .a-bar-grow {
      animation: app-bar-grow 0.7s cubic-bezier(0.34, 1.2, 0.64, 1) both;
    }
    .a-pulse-badge {
      animation: app-pulse-badge 2.4s ease-in-out infinite;
    }
    @keyframes kiosk-slide-r {
      from { opacity: 0; transform: translateX(30px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes kiosk-rise {
      from { opacity: 0; transform: translateY(30px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes app-glow-soft {
      0%, 100% { opacity: 0.5; }
      50%      { opacity: 0.85; }
    }
    @keyframes app-breathe {
      0%, 100% { opacity: 0.55; transform: scale(1); }
      50%      { opacity: 1;    transform: scale(1.05); }
    }
    @keyframes app-fab-pulse {
      0%, 100% { box-shadow: 0 6px 16px var(--fab-glow-1), 0 2px 4px rgba(40,37,29,0.18), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 0 var(--fab-glow-2); }
      50%      { box-shadow: 0 6px 16px var(--fab-glow-1), 0 2px 4px rgba(40,37,29,0.18), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 8px transparent; }
    }

    /* ── Utility classes ───────────────────────────────────────────────── */
    .a-fade-up    { animation: app-fade-up 520ms cubic-bezier(0.34, 1.4, 0.64, 1) both; }
    .a-rise       { animation: app-rise 600ms cubic-bezier(0.34, 1.4, 0.64, 1) both; }
    .a-scale-in   { animation: app-scale-in 600ms cubic-bezier(0.34, 1.4, 0.64, 1) both; }
    .a-glow-soft  { animation: app-glow-soft 3.6s ease-in-out infinite; }
    .a-breathe    { animation: app-breathe 2.8s ease-in-out infinite; }
    .a-fab-pulse  { animation: app-fab-pulse 3.6s ease-in-out infinite; }
    .a-progress-grow {
      transform-origin: left center;
      animation: app-progress-grow 1.2s cubic-bezier(0.34, 1, 0.64, 1) both;
    }

    /* Stagger delays */
    .a-d-1 { animation-delay: 80ms; }
    .a-d-2 { animation-delay: 160ms; }
    .a-d-3 { animation-delay: 240ms; }
    .a-d-4 { animation-delay: 320ms; }
    .a-d-5 { animation-delay: 400ms; }
    .a-d-6 { animation-delay: 480ms; }
    .a-d-7 { animation-delay: 560ms; }
    .a-d-8 { animation-delay: 640ms; }

    /* Interactive card — subtle hover lift. The actual transition values are
       safe for daily use (~200ms, ~2px lift, soft shadow). */
    .a-card {
      transition: transform 220ms cubic-bezier(0.34, 1, 0.64, 1),
                  box-shadow 220ms ease;
    }
    .a-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(40,37,29,0.08), 0 2px 4px rgba(40,37,29,0.04);
    }
  `;
  document.head.appendChild(s);
}

// ──────────────────────────────────────────────────────────────────────────
// AmbientBg — drifting colored blob field behind the main content.
// Tone scales with mode (very subtle in light, more present in dark).
// ──────────────────────────────────────────────────────────────────────────
function AmbientBg({ t }) {
  // Alphas per mode — light is whisper, dark leans into kiosk feel
  const isLight = t.mode === 'light';
  const tealAlpha = isLight ? 0.06 : 0.18;
  const goldAlpha = isLight ? 0.045 : 0.13;
  const peachAlpha = isLight ? 0.04 : 0.11;
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      pointerEvents: 'none', zIndex: 0,
    }}>
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%', width: '55%', height: '70%',
        background: `radial-gradient(circle, rgba(74,181,184,${tealAlpha}) 0%, rgba(74,181,184,0) 65%)`,
        filter: 'blur(40px)',
        animation: 'app-blob-a 38s ease-in-out infinite',
      }}></div>
      <div style={{
        position: 'absolute', top: '25%', right: '-15%', width: '50%', height: '60%',
        background: `radial-gradient(circle, rgba(232,183,62,${goldAlpha}) 0%, rgba(232,183,62,0) 65%)`,
        filter: 'blur(45px)',
        animation: 'app-blob-b 44s ease-in-out infinite',
      }}></div>
      <div style={{
        position: 'absolute', bottom: '-20%', left: '20%', width: '55%', height: '60%',
        background: `radial-gradient(circle, rgba(255,160,117,${peachAlpha}) 0%, rgba(255,160,117,0) 65%)`,
        filter: 'blur(50px)',
        animation: 'app-blob-c 50s ease-in-out infinite',
      }}></div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// HeroCard — wraps content with a subtle gradient backdrop + soft glow
// underneath. Used for the highest-weight cards (YTD API, commission gap,
// Looking Ahead widget).
// ──────────────────────────────────────────────────────────────────────────
function HeroCard({ t, accent, glow, children, padding = '20px 22px', style = {} }) {
  const a = accent || t.teal;
  const g = glow || t.tealTint;
  return (
    <div className="a-card" style={{
      position: 'relative', padding,
      background: t.surface, border: `1px solid ${t.rule}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: `0 1px 2px rgba(40,37,29,0.03)`,
      ...style,
    }}>
      {/* Subtle radial backdrop */}
      <div style={{
        position: 'absolute', top: -50, right: -60, width: 260, height: 260,
        background: `radial-gradient(circle, ${g} 0%, transparent 65%)`,
        pointerEvents: 'none', opacity: 0.85,
      }}></div>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}

Object.assign(window, { AmbientBg, HeroCard });
