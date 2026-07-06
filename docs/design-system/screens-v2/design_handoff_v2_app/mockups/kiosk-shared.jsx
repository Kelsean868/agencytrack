// Kiosk shared primitives — dark theatrical presentation surface.
// Panels render at native 16:9 TV scale (1280×720). The real app's existing
// --color-presentation token family maps here:
//   --color-presentation        → KIOSK.bg
//   --color-presentation-text   → KIOSK.text
//   --color-presentation-accent → KIOSK.teal
// We lean further into the warm dark + add gold + hot accents the existing
// surface stops short of.

const TV_W = 1280;
const TV_H = 720;

// ─── Ambient animation keyframes ──────────────────────────────────────────
// Injected once on module load. Used selectively across panels to create
// "broadcast feel" — slow, subtle, never distracting.
if (typeof document !== 'undefined' && !document.getElementById('kiosk-anim-styles')) {
  const s = document.createElement('style');
  s.id = 'kiosk-anim-styles';
  s.textContent = `
    @keyframes kiosk-pulse-dot {
      0%, 100% { opacity: 1;    transform: scale(1); }
      50%      { opacity: 0.42; transform: scale(0.78); }
    }
    @keyframes kiosk-breathe {
      0%, 100% { opacity: 0.55; }
      50%      { opacity: 1; }
    }
    @keyframes kiosk-halo-gold {
      0%, 100% { box-shadow: 0 0 0 0 rgba(232,183,62,0.55), inset 0 0 0 2px rgba(232,183,62,1); }
      50%      { box-shadow: 0 0 0 14px rgba(232,183,62,0), inset 0 0 0 2px rgba(232,183,62,1); }
    }
    @keyframes kiosk-halo-teal {
      0%, 100% { box-shadow: 0 0 0 0 rgba(124,216,219,0.5),  inset 0 0 0 2px rgba(124,216,219,1); }
      50%      { box-shadow: 0 0 0 12px rgba(124,216,219,0), inset 0 0 0 2px rgba(124,216,219,1); }
    }
    @keyframes kiosk-halo-hot {
      0%, 100% { box-shadow: 0 0 0 0 rgba(242,106,85,0.5),   inset 0 0 0 2px rgba(242,106,85,1); }
      50%      { box-shadow: 0 0 0 12px rgba(242,106,85,0),  inset 0 0 0 2px rgba(242,106,85,1); }
    }
    @keyframes kiosk-drift {
      0%, 100% { transform: translate(0, 0); }
      50%      { transform: translate(22px, -14px); }
    }
    @keyframes kiosk-tick {
      0%, 92%, 100% { opacity: 1; }
      48%           { opacity: 0.32; }
    }
    @keyframes kiosk-rise {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes kiosk-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes kiosk-progress-grow {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }
    @keyframes kiosk-glow-soft {
      0%, 100% { opacity: 0.5; }
      50%      { opacity: 0.9; }
    }
    @keyframes kiosk-confetti-fall {
      0%   { transform: translateY(-60px) rotate(0deg); opacity: 0; }
      10%  { opacity: 0.85; }
      90%  { opacity: 0.85; }
      100% { transform: translateY(780px) rotate(720deg); opacity: 0; }
    }
    @keyframes kiosk-sparkle {
      0%, 100% { transform: scale(0.6); opacity: 0.2; }
      50%      { transform: scale(1);   opacity: 1; }
    }
    @keyframes kiosk-balloon-float {
      0%   { transform: translateY(0)      translateX(0); opacity: 0; }
      8%   { opacity: 0.85; }
      25%  { transform: translateY(-220px) translateX(18px); }
      50%  { transform: translateY(-440px) translateX(-14px); }
      75%  { transform: translateY(-640px) translateX(10px); }
      92%  { opacity: 0.85; }
      100% { transform: translateY(-860px) translateX(0); opacity: 0; }
    }
    /* Variant A — gentle S-curve sway */
    @keyframes kiosk-balloon-float-a {
      0%   { transform: translateY(0)      translateX(0)    rotate(0deg);   opacity: 0; }
      8%   { opacity: 0.9; }
      25%  { transform: translateY(-220px) translateX(36px) rotate(2deg); }
      55%  { transform: translateY(-460px) translateX(-22px) rotate(-3deg); }
      80%  { transform: translateY(-660px) translateX(14px) rotate(1deg); }
      92%  { opacity: 0.9; }
      100% { transform: translateY(-880px) translateX(0)    rotate(0deg);   opacity: 0; }
    }
    /* Variant B — wider drift, opposite curve */
    @keyframes kiosk-balloon-float-b {
      0%   { transform: translateY(0)      translateX(0)     rotate(0deg);   opacity: 0; }
      10%  { opacity: 0.9; }
      30%  { transform: translateY(-260px) translateX(-58px) rotate(-3deg); }
      60%  { transform: translateY(-510px) translateX(40px)  rotate(4deg); }
      85%  { transform: translateY(-720px) translateX(-12px) rotate(-1deg); }
      92%  { opacity: 0.9; }
      100% { transform: translateY(-880px) translateX(20px)  rotate(0deg);   opacity: 0; }
    }
    /* Variant C — bumps a card bottom mid-rise, wobbles, continues */
    @keyframes kiosk-balloon-float-c {
      0%   { transform: translateY(0)      translateX(0)    scale(1, 1)      rotate(0deg);  opacity: 0; }
      8%   { opacity: 0.9; }
      30%  { transform: translateY(-280px) translateX(18px) scale(1, 1)      rotate(2deg); }
      38%  { transform: translateY(-340px) translateX(22px) scale(1.05, 0.92) rotate(0deg); }   /* squish on contact */
      44%  { transform: translateY(-320px) translateX(-12px) scale(1, 1)      rotate(-3deg); } /* bounces back */
      55%  { transform: translateY(-380px) translateX(-26px) scale(1, 1)      rotate(2deg); }
      80%  { transform: translateY(-620px) translateX(10px) scale(1, 1)      rotate(-1deg); }
      92%  { opacity: 0.9; }
      100% { transform: translateY(-880px) translateX(0)    scale(1, 1)      rotate(0deg);  opacity: 0; }
    }
    /* Variant D — subtle diagonal drift */
    @keyframes kiosk-balloon-float-d {
      0%   { transform: translateY(0)      translateX(0)    rotate(0deg);   opacity: 0; }
      9%   { opacity: 0.9; }
      35%  { transform: translateY(-300px) translateX(-30px) rotate(-2deg); }
      65%  { transform: translateY(-560px) translateX(-70px) rotate(1deg); }
      88%  { transform: translateY(-760px) translateX(-44px) rotate(-1deg); }
      92%  { opacity: 0.9; }
      100% { transform: translateY(-880px) translateX(-20px) rotate(0deg);   opacity: 0; }
    }
    /* Variant E — bumps a card bottom on the other side */
    @keyframes kiosk-balloon-float-e {
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
    @keyframes kiosk-ken-burns {
      from { transform: scale(1.0) translate(0, 0); }
      to   { transform: scale(1.12) translate(-12px, -6px); }
    }
    @keyframes kiosk-ken-burns-alt {
      from { transform: scale(1.08) translate(8px, 4px); }
      to   { transform: scale(1.0) translate(0, 0); }
    }
    @keyframes kiosk-blob-a {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25%      { transform: translate(140px, 80px) scale(1.18); }
      50%      { transform: translate(-30px, 160px) scale(0.9); }
      75%      { transform: translate(-110px, 60px) scale(1.08); }
    }
    @keyframes kiosk-blob-b {
      0%, 100% { transform: translate(0, 0) scale(1); }
      30%      { transform: translate(-160px, 80px) scale(1.12); }
      55%      { transform: translate(40px, -120px) scale(0.92); }
      80%      { transform: translate(120px, 30px) scale(1.05); }
    }
    @keyframes kiosk-blob-c {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25%      { transform: translate(120px, -90px) scale(0.88); }
      50%      { transform: translate(-100px, -140px) scale(1.15); }
      75%      { transform: translate(-140px, 30px) scale(0.96); }
    }

    /* ── Entrance animations — used for panel-arrival choreography ── */
    @keyframes kiosk-slide-l {
      from { opacity: 0; transform: translateX(-32px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes kiosk-slide-r {
      from { opacity: 0; transform: translateX(32px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes kiosk-scale-in {
      from { opacity: 0; transform: scale(0.92); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes kiosk-fade-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes kiosk-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ── Animation utility classes ── */
    .k-pulse-dot   { animation: kiosk-pulse-dot 2.2s ease-in-out infinite; }
    .k-breathe     { animation: kiosk-breathe 3.6s ease-in-out infinite; }
    .k-halo-gold   { animation: kiosk-halo-gold 2.8s ease-out infinite; }
    .k-halo-teal   { animation: kiosk-halo-teal 2.8s ease-out infinite; }
    .k-halo-hot    { animation: kiosk-halo-hot  2.8s ease-out infinite; }
    .k-drift       { animation: kiosk-drift 28s ease-in-out infinite; }
    .k-tick        { animation: kiosk-tick 1.1s ease-in-out infinite; }
    .k-glow-soft   { animation: kiosk-glow-soft 4s ease-in-out infinite; }

    /* Entrance — each has a soft-springy ease */
    .k-rise        { animation: kiosk-rise 720ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    .k-slide-l     { animation: kiosk-slide-l 700ms cubic-bezier(0.4, 0, 0.2, 1) both; }
    .k-slide-r     { animation: kiosk-slide-r 700ms cubic-bezier(0.4, 0, 0.2, 1) both; }
    .k-scale-in    { animation: kiosk-scale-in 720ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    .k-fade-up     { animation: kiosk-fade-up 600ms cubic-bezier(0.4, 0, 0.2, 1) both; }
    .k-fade-in     { animation: kiosk-fade-in 600ms ease-out both; }

    /* Stagger delays — chain via .k-d-N */
    .k-d-1  { animation-delay: 80ms; }
    .k-d-2  { animation-delay: 160ms; }
    .k-d-3  { animation-delay: 240ms; }
    .k-d-4  { animation-delay: 320ms; }
    .k-d-5  { animation-delay: 400ms; }
    .k-d-6  { animation-delay: 480ms; }
    .k-d-7  { animation-delay: 560ms; }
    .k-d-8  { animation-delay: 640ms; }
    .k-d-9  { animation-delay: 720ms; }
    .k-d-10 { animation-delay: 800ms; }
    .k-d-11 { animation-delay: 880ms; }
    .k-d-12 { animation-delay: 960ms; }

    /* Back-compat aliases (was: .k-rise-1/2/3) */
    .k-rise-1 { animation: kiosk-rise 720ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    .k-rise-2 { animation: kiosk-rise 720ms cubic-bezier(0.34, 1.56, 0.64, 1) both; animation-delay: 140ms; }
    .k-rise-3 { animation: kiosk-rise 720ms cubic-bezier(0.34, 1.56, 0.64, 1) both; animation-delay: 280ms; }

    .k-progress-grow {
      transform-origin: left center;
      animation: kiosk-progress-grow 1.4s cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .k-shimmer {
      background-image: linear-gradient(
        90deg,
        transparent 0%,
        rgba(244,239,227,0.0) 40%,
        rgba(244,239,227,0.18) 50%,
        rgba(244,239,227,0.0) 60%,
        transparent 100%
      );
      background-size: 200% 100%;
      background-repeat: no-repeat;
      animation: kiosk-shimmer 5.2s linear infinite;
    }
  `;
  document.head.appendChild(s);
}

const KIOSK = {
  // Dark warm surface — deeper than the existing --color-presentation (#1A1612).
  bg:           '#0E0B07',
  bgSecondary:  'rgba(255, 248, 232, 0.045)',  // glass surface
  bgRaised:     'rgba(255, 248, 232, 0.06)',
  bgRaisedAlt:  'rgba(255, 248, 232, 0.08)',   // glass surface raised

  // Text
  text:         '#F4EFE3',
  textMute:     '#B5AB9C',
  textFaint:    '#7A7064',
  textDim:      '#4F473E',

  // Hairlines (rgba over dark)
  rule:         'rgba(244, 239, 227, 0.08)',
  ruleStrong:   'rgba(244, 239, 227, 0.16)',

  // Brand teal — lifted variant from --color-presentation-accent
  teal:         '#4AB5B8',
  tealBright:   '#7CD8DB',
  tealDeep:     '#01696F',
  tealGlow:     'rgba(74, 181, 184, 0.45)',
  tealTint:     'rgba(74, 181, 184, 0.12)',

  // Recognition accents — match the PDF medal palette
  gold:         '#E8B73E',
  goldGlow:     'rgba(232, 183, 62, 0.55)',
  goldTint:     'rgba(232, 183, 62, 0.14)',
  silver:       '#C7CBD1',
  silverGlow:   'rgba(199, 203, 209, 0.4)',
  bronze:       '#C08D6B',
  bronzeGlow:   'rgba(192, 141, 107, 0.4)',

  // Hot accent — "on fire", milestone hits
  hot:          '#F26A55',
  hotGlow:      'rgba(242, 106, 85, 0.55)',
  hotTint:      'rgba(242, 106, 85, 0.14)',

  // Semantic
  success:      '#6BCB85',
  successTint:  'rgba(107, 203, 133, 0.14)',
  warning:      '#E8B53E',
  warningTint:  'rgba(232, 181, 62, 0.14)',
  danger:       '#E07A6A',
  dangerTint:   'rgba(224, 122, 106, 0.14)',
};

const KIOSK_FONT_DISPLAY = "'Cabinet Grotesk', 'Helvetica Neue Black', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const KIOSK_FONT_SANS    = "'Satoshi', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const KIOSK_FONT_MONO    = "'JetBrains Mono', 'Menlo', 'SF Mono', monospace";

// ─── KioskFrame — every panel sits in this 1280×720 dark surface ──────────
// No header/footer chrome. The screen is a full TV display — staff at the
// branch already know it's AgencyTrack. Every pixel goes to content.
function KioskFrame({ children }) {
  return (
    <div style={{
      width: TV_W, height: TV_H,
      background: KIOSK.bg,
      color: KIOSK.text,
      fontFamily: KIOSK_FONT_SANS,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Liquid glass — animated colored blob field gives backdrop-filter something to refract */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '-15%', width: '70%', height: '80%',
          background: 'radial-gradient(circle, rgba(74,181,184,0.42) 0%, rgba(74,181,184,0) 65%)',
          filter: 'blur(40px)', animation: 'kiosk-blob-a 22s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: '30%', right: '-18%', width: '65%', height: '70%',
          background: 'radial-gradient(circle, rgba(232,183,62,0.32) 0%, rgba(232,183,62,0) 65%)',
          filter: 'blur(45px)', animation: 'kiosk-blob-b 26s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-25%', left: '15%', width: '60%', height: '70%',
          background: 'radial-gradient(circle, rgba(242,106,85,0.28) 0%, rgba(242,106,85,0) 65%)',
          filter: 'blur(50px)', animation: 'kiosk-blob-c 30s ease-in-out infinite',
        }} />
      </div>

      {/* Subtle radial vignette so center punches harder — gently drifts */}
      <div className="k-drift" style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, rgba(74,181,184,0.045) 0%, transparent 55%)`,
        pointerEvents: 'none',
      }}></div>

      {/* Stripe-pattern texture — barely visible warmth */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `repeating-linear-gradient(135deg, transparent 0, transparent 14px, rgba(244,239,227,0.014) 14px, rgba(244,239,227,0.014) 15px)`,
        pointerEvents: 'none',
      }}></div>

      {/* Content slot — full canvas */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Medal — gradient coin like the PDF, sized for TV ──────────────────────
function Medal({ rank, size = 64, glow = true }) {
  const grad = rank === 1
    ? 'radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 50%, #b45309 100%)'
    : rank === 2
      ? 'radial-gradient(circle at 32% 28%, #f1f5f9 0%, #94a3b8 50%, #475569 100%)'
      : 'radial-gradient(circle at 32% 28%, #fed7aa 0%, #c08d6b 50%, #92400e 100%)';
  const glowColor = rank === 1 ? KIOSK.goldGlow : rank === 2 ? KIOSK.silverGlow : KIOSK.bronzeGlow;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: grad,
      color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: KIOSK_FONT_DISPLAY,
      fontSize: size * 0.42, fontWeight: 800, letterSpacing: '-0.04em',
      boxShadow: glow
        ? `inset 0 -3px 6px rgba(0,0,0,0.22), inset 0 3px 6px rgba(255,255,255,0.42), 0 0 24px ${glowColor}`
        : 'inset 0 -3px 6px rgba(0,0,0,0.22), inset 0 3px 6px rgba(255,255,255,0.42)',
      position: 'relative', flexShrink: 0,
    }}>
      <span style={{ position: 'relative', zIndex: 1, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{rank}</span>
      <span style={{
        position: 'absolute', top: '6%', left: '18%', width: '38%', height: '24%',
        borderRadius: '50%', background: 'rgba(255,255,255,0.42)', filter: 'blur(3px)',
      }}></span>
    </div>
  );
}

// ─── Avatar — circular agent photo placeholder w/ initials ────────────────
function Avatar({ name, size = 56, ring = null, photo = null, glowStrong = false }) {
  const initials = (name || 'A').split(' ').map(s => s[0]).slice(0, 2).join('');
  // Pluck the hex (or named) ring color into a glow box-shadow. When
  // `glowStrong` is set the photo itself reads as if it's lit — multi-layer
  // shadow with bigger spread + brighter inner ring + ambient outer halo.
  const baseShadow = ring
    ? glowStrong
      ? `0 0 ${size * 0.18}px ${ring}, 0 0 ${size * 0.36}px ${ring}88, 0 0 ${size * 0.55}px ${ring}44`
      : `0 0 16px ${ring}55`
    : 'none';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: photo ? `center/cover url(${photo})` : `linear-gradient(135deg, ${KIOSK.bgRaisedAlt} 0%, ${KIOSK.bgRaised} 100%)`,
      color: KIOSK.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: KIOSK_FONT_DISPLAY,
      fontSize: size * 0.36, fontWeight: 700, letterSpacing: '-0.02em',
      border: ring ? `${glowStrong ? 3 : 2}px solid ${ring}` : `1px solid ${KIOSK.ruleStrong}`,
      boxShadow: baseShadow,
      flexShrink: 0,
    }}>{!photo && initials}</div>
  );
}

// ─── Eyebrow / chapter mark — used inside many panels for the title ───────
function KioskEyebrow({ children, color = KIOSK.teal }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700,
      letterSpacing: '0.22em', textTransform: 'uppercase',
      color, fontFamily: KIOSK_FONT_MONO,
    }}>{children}</div>
  );
}

// Big display heading for panel titles
function KioskTitle({ children, size = 56 }) {
  return (
    <div style={{
      fontSize: size, fontWeight: 700, color: KIOSK.text,
      letterSpacing: '-0.028em', lineHeight: 0.96,
      fontFamily: KIOSK_FONT_DISPLAY,
      marginTop: 16,
    }}>{children}</div>
  );
}

// Money formatter
function ttdK(n) {
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `TTD ${(n / 1_000).toFixed(1)}K`;
  return `TTD ${Math.round(n).toLocaleString()}`;
}

// ─── BackgroundSlideshow — Ken Burns + crossfade muted photo backdrop ─────
// Used on the Welcome panel. Photos heavily muted (grayscale + dim + slight
// blur) so they read as ambient texture, never competing with the foreground
// type. In production the manager uploads a curated set; the URLs here are
// placeholder team / activity photos for the design canvas.
//
// Behaviour:
//   - Two layered photo divs, opacity cross-fade between them
//   - Each photo has its own Ken Burns animation (alternating direction)
//   - A dark vignette + warm gradient sits on top to anchor the canvas back to
//     the kiosk surface tone (#0E0B07) so the Welcome type stays readable.
const { useState: useStateBg, useEffect: useEffectBg } = React;

function BackgroundSlideshow({
  photos = [],
  interval = 9000,           // ms per photo
  filter = 'grayscale(100%) brightness(0.52) contrast(0.9) blur(1.5px)',
}) {
  const [idx, setIdx] = useStateBg(0);

  useEffectBg(() => {
    if (!photos.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % photos.length), interval);
    return () => clearInterval(t);
  }, [photos.length, interval]);

  if (!photos.length) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      overflow: 'hidden', pointerEvents: 'none',
    }}>
      {photos.map((src, i) => {
        const active = i === idx;
        // Alternate Ken Burns direction so successive photos move differently
        const burnsAnim = i % 2 === 0
          ? 'kiosk-ken-burns 14s ease-out forwards'
          : 'kiosk-ken-burns-alt 14s ease-out forwards';
        return (
          <div
            key={i}
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter,
              opacity: active ? 1 : 0,
              transition: 'opacity 1800ms ease-in-out',
              animation: active ? burnsAnim : 'none',
              transformOrigin: 'center center',
            }}
          />
        );
      })}

      {/* Dark vignette + warm gradient overlay — pushes photos back, ties to surface */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          linear-gradient(135deg, rgba(14,11,7,0.58) 0%, rgba(14,11,7,0.34) 50%, rgba(14,11,7,0.62) 100%),
          radial-gradient(ellipse at center, rgba(14,11,7,0.0) 0%, rgba(14,11,7,0.28) 80%, rgba(14,11,7,0.5) 100%)
        `,
      }} />

      {/* Faint teal tint to keep the photos aligned with kiosk surface palette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(74,181,184,0.04) 0%, transparent 60%)',
      }} />
    </div>
  );
}

// Default photo set — Unsplash, business / team / activity flavours.
// Manager-curated in production. Order randomised on each load to keep the
// rotation fresh across reloads.
const WELCOME_PHOTOS = [
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&q=75&auto=format&fit=crop', // team meeting around table
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=75&auto=format&fit=crop', // colleagues collaborating
  'https://images.unsplash.com/photo-1521737852567-6949f3f9f2b5?w=1600&q=75&auto=format&fit=crop', // women in conversation
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1600&q=75&auto=format&fit=crop',  // team brainstorm
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1600&q=75&auto=format&fit=crop', // handshake close-up
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1600&q=75&auto=format&fit=crop', // colleagues at desk
  'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1600&q=75&auto=format&fit=crop', // office work
];

Object.assign(window, {
  KIOSK, KIOSK_FONT_DISPLAY, KIOSK_FONT_SANS, KIOSK_FONT_MONO,
  TV_W, TV_H,
  KioskFrame, Medal, Avatar, KioskEyebrow, KioskTitle,
  BackgroundSlideshow, WELCOME_PHOTOS,
  ttdK,
});
