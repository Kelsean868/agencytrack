// Kiosk extras — two new panels:
//   14 · Branch Noticeboard — up to 3 manager-posted notices
//   15 · Birthdays & Anniversaries — weekly celebrations with confetti

const PAD_X = 56;

// ═══════════════════════════════════════════════════════════════════════════
// 14 · BRANCH NOTICEBOARD — 3 manager-posted notice cards
// ═══════════════════════════════════════════════════════════════════════════

// Small inline SVG glyphs per notice category
function NoticeGlyph({ kind, color, size = 32 }) {
  const glyphs = {
    announcement: (
      // Megaphone
      <path d="M3 11l14-6v14L3 13M3 11v2M3 11h-1v2h1M17 7v10M19 8v8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ),
    training: (
      // Book / training cap
      <>
        <path d="M3 8l9-4 9 4-9 4-9-4z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
    reminder: (
      // Bell
      <>
        <path d="M6 17h12M10 20h4M12 4c-3 0-5 2-5 5v3l-2 4h14l-2-4v-3c0-3-2-5-5-5z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  };
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 35% 30%, ${color}55 0%, transparent 70%)`,
      border: `1.5px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, flexShrink: 0,
      boxShadow: `0 0 14px ${color}33, inset 0 0 8px ${color}22`,
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        {glyphs[kind]}
      </svg>
    </div>
  );
}

function RefNoticeboard() {
  const notices = [
    {
      kind: 'announcement',
      category: 'Announcement',
      color: KIOSK.tealBright,
      glow: KIOSK.tealGlow,
      tint: KIOSK.tealTint,
      title: 'Monthly recognition lunch',
      body: 'Join the branch in the lounge at 12:30 PM. We\u2019re celebrating November\u2019s top performers and welcoming new agents.',
      meta: 'FRI 28 NOV · 12:30 PM',
      from: 'T. Ramcharan',
    },
    {
      kind: 'training',
      category: 'Training',
      color: KIOSK.gold,
      glow: KIOSK.goldGlow,
      tint: KIOSK.goldTint,
      title: 'TermLife Plus product launch',
      body: 'Required training for all producers on the new TermLife Plus rider. Two sessions: Mon 9 AM and Wed 2 PM.',
      meta: 'MON 1 DEC · 9:00 AM',
      from: 'Head Office',
    },
    {
      kind: 'reminder',
      category: 'Reminder',
      color: KIOSK.hot,
      glow: KIOSK.hotGlow,
      tint: KIOSK.hotTint,
      title: 'Q4 production deadline',
      body: 'Last day to submit Q4 business for settlement is Fri 12 Dec. After that, applications slide into Q1 2027.',
      meta: 'IN 16 DAYS',
      from: 'Branch Manager',
    },
  ];

  return (
    <KioskFrame>
      <div style={{
        padding: `46px ${PAD_X}px 38px`, height: '100%',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <KioskEyebrow color={KIOSK.tealBright}>★ Branch noticeboard</KioskEyebrow>
            <KioskTitle size={58}>What&rsquo;s on this&nbsp;week.</KioskTitle>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO }}>
              UPDATED 26 NOV
            </div>
            <div style={{ fontSize: 13, color: KIOSK.textMute, marginTop: 4 }}>
              Posted by your branch manager
            </div>
          </div>
        </div>

        {/* 3 equal notice cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22, flex: 1, minHeight: 0 }}>
          {notices.map((n, i) => (
            <div key={n.category} className={'k-rise-' + (i + 1)} style={{
              padding: '24px 24px 22px',
              background: KIOSK.bgSecondary,
              backdropFilter: 'blur(22px) saturate(170%)',
              WebkitBackdropFilter: 'blur(22px) saturate(170%)',
              borderRadius: 20,
              border: `1px solid ${n.color}33`,
              boxShadow: `0 0 40px ${n.glow}1f, inset 0 1px 0 rgba(245,240,224,0.08)`,
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Corner glow */}
              <div style={{
                position: 'absolute', top: -50, right: -50, width: 240, height: 240,
                background: `radial-gradient(circle at 50% 50%, ${n.glow}, transparent 60%)`,
                pointerEvents: 'none', opacity: 0.45,
              }}></div>

              {/* Category badge + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                <NoticeGlyph kind={n.kind} color={n.color} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
                    color: n.color, textTransform: 'uppercase', fontFamily: KIOSK_FONT_MONO,
                  }}>{n.category}</div>
                  <div style={{
                    fontSize: 10.5, color: KIOSK.textFaint, marginTop: 3,
                    fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.08em',
                  }}>{n.meta}</div>
                </div>
              </div>

              {/* Title */}
              <div style={{
                marginTop: 22, fontSize: 24, fontWeight: 700, color: KIOSK.text,
                letterSpacing: '-0.018em', fontFamily: KIOSK_FONT_DISPLAY, lineHeight: 1.15,
                position: 'relative',
              }}>{n.title}</div>

              {/* Body */}
              <div style={{
                marginTop: 14, flex: 1,
                fontSize: 15, color: KIOSK.textMute, lineHeight: 1.55,
                position: 'relative',
              }}>{n.body}</div>

              {/* Footer — source */}
              <div style={{
                marginTop: 18, paddingTop: 14, borderTop: `1px solid ${KIOSK.rule}`,
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 11, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                position: 'relative',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.color }}></div>
                FROM · {n.from}
              </div>
            </div>
          ))}
        </div>
      </div>
    </KioskFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 15 · BIRTHDAYS + ANNIVERSARIES — weekly celebrations
// ═══════════════════════════════════════════════════════════════════════════

// Balloon — round shape with a string tail, floats UP from the bottom.
// Two flavours:
//   foreground=true  — large (~100px), fast, in front of card content
//   foreground=false — small (~60px), slower, behind cards (distance)
//
// Per-balloon randomness:
//   • One of 5 float keyframes (different sway / wobble / bump patterns) so
//     no two balloons take the same path; some bump card bottoms mid-rise.
//   • Color chosen from 8-color celebration palette, decoupled from position.
//   • Left-spawn position covers full bottom width (2–95%).
//   • Long inter-balloon spacing — at any moment max 2 foreground balloons.
function Balloons({ foreground = false, count = foreground ? 3 : 6 }) {
  // Expanded celebration palette — softer / festive tones that ride with the
  // dark warm surface. Not tied to the card border colors.
  const palette = [
    '#F47C8F', // rose
    '#B59FD8', // lavender
    '#FFA075', // peach
    '#6DCFB0', // mint
    KIOSK.gold,
    '#7DC4F0', // sky
    '#F4D06F', // sunny yellow
    '#FDB6A8', // coral
  ];
  // 5 different float keyframes — assigned via index hash so the same balloon
  // doesn't always pick the same path between renders.
  const floatVariants = ['a', 'b', 'c', 'd', 'e'];

  const balloons = Array.from({ length: count }, (_, i) => {
    // Multiple independent pseudo-random streams so position, color, path,
    // and timing don't covary.
    const rPos    = (i * 73 + 11) % 100;
    const rColor  = (i * 41 + 29) % palette.length;
    const rPath   = (i * 17 + 5)  % floatVariants.length;
    const rSize   = (i * 53 + 19) % 100;
    const baseDur = foreground ? 14 : 24;
    // Foreground: longer spacing between balloons (count*5s slot per balloon)
    // so on screen at any moment there are ~2 visible max with longer gaps.
    const spacing = foreground ? baseDur * 0.95 : baseDur / count;
    return {
      left:     2 + rPos * 0.93,                                // 2–95%
      delay:    (i * spacing + (rPos % 4) * 0.5) % (baseDur * 2.4),
      duration: baseDur + (rSize % 5),
      color:    palette[rColor],
      size:     foreground ? 96 + (rSize % 3) * 16 : 46 + (rSize % 3) * 12,
      path:     floatVariants[rPath],
    };
  });

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: foreground ? 5 : 0,
      opacity: foreground ? 1 : 0.5,
      filter: foreground ? 'none' : 'blur(2.5px)',
    }}>
      {balloons.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: '-180px',
            left: `${b.left}%`,
            width: b.size, height: b.size * 1.22,
            opacity: 0,
            animation: `kiosk-balloon-float-${b.path} ${b.duration}s linear ${b.delay}s infinite`,
            filter: foreground
              ? `drop-shadow(0 14px 26px rgba(0,0,0,0.4)) drop-shadow(0 0 18px ${b.color}55)`
              : `drop-shadow(0 4px 8px rgba(0,0,0,0.25))`,
          }}
        >
          <svg viewBox="0 0 100 122" width="100%" height="100%">
            <defs>
              <radialGradient id={`bg${foreground ? 'f' : 'b'}${i}`} cx="35%" cy="28%" r="68%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                <stop offset="22%" stopColor={b.color} stopOpacity="0.95" />
                <stop offset="75%" stopColor={b.color} stopOpacity="0.92" />
                <stop offset="100%" stopColor={b.color} stopOpacity="0.78" />
              </radialGradient>
              <radialGradient id={`hi${foreground ? 'f' : 'b'}${i}`} cx="32%" cy="24%" r="22%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="50" cy="48" rx="38" ry="44" fill={`url(#bg${foreground ? 'f' : 'b'}${i})`} />
            <ellipse cx="36" cy="32" rx="14" ry="10" fill={`url(#hi${foreground ? 'f' : 'b'}${i})`} />
            <path d="M44 91 L50 99 L56 91 Z" fill={b.color} opacity="0.92" />
            <path d="M50 99 Q53 106 47 112 Q44 116 50 122"
                  stroke={b.color} strokeWidth="1.2" fill="none" opacity="0.55" strokeLinecap="round" />
          </svg>
        </div>
      ))}
    </div>
  );
}

// Confetti — colored ribbon shapes drifting down from the top continuously.
// Pseudo-random spread + delays so 24 pieces feel organic.
function Confetti({ count = 18 }) {
  const colors = [KIOSK.gold, KIOSK.tealBright, KIOSK.hot, '#F4EFE3', '#A78BFA'];
  const pieces = Array.from({ length: count }, (_, i) => {
    const r1 = (i * 37) % 100;
    const r2 = (i * 53) % 100;
    return {
      left:     r1 + (r2 % 5),
      delay:    (r2 % 12) * 0.7,
      duration: 11 + (r1 % 6),
      color:    colors[i % colors.length],
      size:     5 + (i % 4) * 2,
      rotate:   (i * 47) % 360,
      shape:    i % 3, // 0 = bar, 1 = round, 2 = diamond
    };
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '-40px',
            left: `${p.left}%`,
            width: p.shape === 1 ? p.size : p.size,
            height: p.shape === 1 ? p.size : p.size * 0.55,
            background: p.color,
            opacity: 0,
            transform: `rotate(${p.rotate}deg)`,
            animation: `kiosk-confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
            borderRadius: p.shape === 1 ? '50%' : p.shape === 2 ? '0' : '1px',
            boxShadow: `0 0 4px ${p.color}66`,
          }}
        />
      ))}
    </div>
  );
}

// Foreground confetti — a few small random pieces drifting down in front of
// cards. Limited count so it reads as occasional, not snowing.
function ForegroundConfetti({ count = 8 }) {
  const colors = [KIOSK.gold, KIOSK.tealBright, KIOSK.hot, '#F47C8F', '#B59FD8'];
  const pieces = Array.from({ length: count }, (_, i) => {
    const r1 = (i * 41) % 100;
    const r2 = (i * 67) % 100;
    return {
      left:     8 + r1 * 0.85,
      delay:    (i * 3.7) % 18,
      duration: 16 + (r1 % 7),
      color:    colors[i % colors.length],
      size:     5 + (i % 3) * 2,
      rotate:   (i * 49) % 360,
      shape:    i % 3,
    };
  });
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      pointerEvents: 'none', zIndex: 4,
    }}>
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '-40px',
            left: `${p.left}%`,
            width: p.size, height: p.shape === 1 ? p.size : p.size * 0.55,
            background: p.color,
            opacity: 0,
            transform: `rotate(${p.rotate}deg)`,
            animation: `kiosk-confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
            borderRadius: p.shape === 1 ? '50%' : p.shape === 2 ? '0' : '1px',
            boxShadow: `0 0 4px ${p.color}66, 0 4px 8px rgba(0,0,0,0.25)`,
          }}
        />
      ))}
    </div>
  );
}

// Sparkle motif — used near agent avatars on the birthday cards
function Sparkle({ size = 14, color = KIOSK.gold, top, left, delay = 0 }) {
  return (
    <div style={{
      position: 'absolute', top, left,
      width: size, height: size,
      animation: `kiosk-sparkle 2.4s ease-in-out ${delay}s infinite`,
      pointerEvents: 'none',
    }}>
      <svg viewBox="0 0 24 24" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
        <path d="M12 2l1.6 7.4L21 11l-7.4 1.6L12 20l-1.6-7.4L3 11l7.4-1.6L12 2z" />
      </svg>
    </div>
  );
}

function RefBirthdays() {
  // Full week's celebrations — up to 6 supported via in-panel crossfade.
  // 3 visible at any moment; after ~9s on the panel, cards individually
  // fade-swap to the next page, staggered ~1.2s apart so the reveal feels
  // conversational instead of robotic.
  const allCelebrations = [
    // ── Page 1 ──
    {
      name: 'Carla Joseph', kind: 'birthday', occasion: 'Turns 32',
      date: 'TUE 26 NOV', sub: 'Producer · South · 02',
      color: '#F47C8F', glow: 'rgba(244, 124, 143, 0.55)', tint: 'rgba(244, 124, 143, 0.14)',
      label: 'BIRTHDAY',
    },
    {
      name: 'Riaz Khan', kind: 'anniversary', occasion: '5 years',
      date: 'WED 27 NOV', sub: 'Producer · South · 02',
      color: '#B59FD8', glow: 'rgba(181, 159, 216, 0.5)', tint: 'rgba(181, 159, 216, 0.14)',
      label: 'WORK ANNIVERSARY',
    },
    {
      name: 'Marsha Singh', kind: 'birthday', occasion: 'Turns 41',
      date: 'FRI 29 NOV', sub: 'UM + Producer · South · 02',
      color: '#FFA075', glow: 'rgba(255, 160, 117, 0.5)', tint: 'rgba(255, 160, 117, 0.14)',
      label: 'BIRTHDAY',
    },
    // ── Page 2 ──
    {
      name: 'Anand Persad', kind: 'anniversary', occasion: '8 years',
      date: 'MON 25 NOV', sub: 'Producer · South · 01',
      color: '#6DCFB0', glow: 'rgba(109, 207, 176, 0.5)', tint: 'rgba(109, 207, 176, 0.14)',
      label: 'WORK ANNIVERSARY',
    },
    {
      name: 'Nisha Patel', kind: 'birthday', occasion: 'Turns 29',
      date: 'THU 28 NOV', sub: 'Producer · South · 01',
      color: KIOSK.gold, glow: 'rgba(232, 183, 62, 0.55)', tint: 'rgba(232, 183, 62, 0.14)',
      label: 'BIRTHDAY',
    },
    {
      name: 'Trevor Ramnauth', kind: 'anniversary', occasion: '3 years',
      date: 'SUN 30 NOV', sub: 'Producer · South · 03',
      color: '#7DC4F0', glow: 'rgba(125, 196, 240, 0.5)', tint: 'rgba(125, 196, 240, 0.14)',
      label: 'WORK ANNIVERSARY',
    },
  ];

  const cardsPerPage = 3;
  const totalPages = Math.ceil(allCelebrations.length / cardsPerPage);

  // Each card slot tracks the celebration index it's currently showing + an
  // independent visibility flag for the opacity transition.
  const [slot0, setSlot0] = React.useState(0);
  const [slot1, setSlot1] = React.useState(1);
  const [slot2, setSlot2] = React.useState(2);
  const [vis0,  setVis0]  = React.useState(true);
  const [vis1,  setVis1]  = React.useState(true);
  const [vis2,  setVis2]  = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(0);
  const pageRef = React.useRef(0);

  React.useEffect(() => {
    if (totalPages <= 1) return;
    const swap = (setVis, setSlot, newIdx) => {
      setVis(false);
      setTimeout(() => { setSlot(newIdx); setVis(true); }, 480);
    };
    const cycle = () => {
      pageRef.current = (pageRef.current + 1) % totalPages;
      const base = pageRef.current * cardsPerPage;
      setCurrentPage(pageRef.current);
      // Stagger the 3 cards so the reveal cascades left → right
      swap(setVis0, setSlot0, base);
      setTimeout(() => swap(setVis1, setSlot1, base + 1), 1200);
      setTimeout(() => swap(setVis2, setSlot2, base + 2), 2400);
    };
    const interval = setInterval(cycle, 9000);
    return () => clearInterval(interval);
  }, [totalPages]);

  const slotIndices = [slot0, slot1, slot2];
  const visList     = [vis0,  vis1,  vis2];

  return (
    <KioskFrame>
      {/* Confetti backdrop (behind content) + distant balloons behind cards */}
      <Confetti />
      <Balloons foreground={false} />

      <div style={{
        padding: `46px ${PAD_X}px 38px`, height: '100%',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        position: 'relative', zIndex: 1,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <KioskEyebrow color={KIOSK.gold}>★ Celebrating this week</KioskEyebrow>
            <KioskTitle size={58}>Birthdays &amp;&nbsp;Anniversaries.</KioskTitle>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO }}>
                WEEK 48 · 2026
              </div>
              {totalPages > 1 && (
                <>
                  <div style={{ width: 1, height: 12, background: 'rgba(244,239,227,0.18)' }}></div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
                    color: KIOSK.gold, fontFamily: KIOSK_FONT_MONO,
                    padding: '3px 8px',
                    border: `1px solid ${KIOSK.gold}44`,
                    borderRadius: 999,
                  }}>
                    {String(currentPage + 1).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
                  </div>
                </>
              )}
            </div>
            <div style={{ fontSize: 13, color: KIOSK.textMute, marginTop: 6 }}>
              {allCelebrations.length} celebrations this week
            </div>
          </div>
        </div>

        {/* 3 cards — crossfade in place when page advances */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22, flex: 1, minHeight: 0 }}>
          {[0, 1, 2].map((i) => {
            const c = allCelebrations[slotIndices[i]];
            return (
              <div key={i} className={'k-rise-' + (i + 1)} style={{
                padding: '26px 24px 24px',
                background: KIOSK.bgRaisedAlt,
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                borderRadius: 22,
                border: `1px solid ${c.color}33`,
                boxShadow: `0 0 50px ${c.glow}25, inset 0 1px 0 rgba(245,240,224,0.1)`,
                position: 'relative', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center',
                opacity: visList[i] ? 1 : 0,
                transition: 'opacity 480ms cubic-bezier(0.4, 0, 0.2, 1), border-color 480ms ease, box-shadow 480ms ease',
              }}>
                {/* Sparkles inside the card */}
                <Sparkle size={12} color={c.color} top={14} left={20} delay={0} />
                <Sparkle size={9}  color={c.color} top={28} left="80%" delay={0.6} />
                <Sparkle size={14} color={c.color} top="42%" left="88%" delay={1.2} />
                <Sparkle size={10} color={c.color} top="62%" left={12} delay={1.8} />

                {/* Top corner glow */}
                <div style={{
                  position: 'absolute', top: -60, right: -60, width: 260, height: 260,
                  background: `radial-gradient(circle at 50% 50%, ${c.glow}, transparent 60%)`,
                  pointerEvents: 'none', opacity: 0.5,
                  transition: 'background 480ms ease',
                }}></div>

                {/* Label pill */}
                <div style={{
                  padding: '5px 11px', borderRadius: 999,
                  background: c.tint, border: `1px solid ${c.color}44`,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                  color: c.color, fontFamily: KIOSK_FONT_MONO,
                  position: 'relative',
                  transition: 'background 480ms ease, border-color 480ms ease, color 480ms ease',
                }}>{c.label}</div>

                {/* Avatar with animated halo */}
                <div style={{
                  marginTop: 22, position: 'relative',
                  width: 168, height: 168,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div className="k-glow-soft" style={{
                    position: 'absolute', inset: -20,
                    background: `radial-gradient(circle, ${c.glow} 0%, ${c.color}33 30%, transparent 70%)`,
                    pointerEvents: 'none',
                  }}></div>
                  <Avatar name={c.name} size={150} ring={c.color} glowStrong />
                </div>

                {/* Name */}
                <div style={{
                  marginTop: 22, fontSize: 24, fontWeight: 700, color: KIOSK.text,
                  letterSpacing: '-0.018em', fontFamily: KIOSK_FONT_DISPLAY, lineHeight: 1.05,
                  position: 'relative',
                }}>{c.name}</div>
                <div style={{
                  fontSize: 11, color: KIOSK.textFaint, marginTop: 4,
                  fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.08em',
                  position: 'relative',
                }}>{c.sub}</div>

                {/* Occasion in a contained block */}
                <div style={{
                  marginTop: 'auto', paddingTop: 18, position: 'relative', width: '100%',
                }}>
                  <div style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: c.tint, border: `1px solid ${c.color}22`,
                    transition: 'background 480ms ease, border-color 480ms ease',
                  }}>
                    <div style={{
                      fontSize: 28, fontWeight: 700, color: c.color,
                      fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.022em',
                      lineHeight: 1, transition: 'color 480ms ease',
                    }}>{c.occasion}</div>
                    <div style={{
                      fontSize: 10.5, color: KIOSK.textMute, marginTop: 6,
                      fontFamily: KIOSK_FONT_MONO, letterSpacing: '0.14em',
                    }}>{c.date}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Foreground confetti + balloons drift up through the foreground, in front of cards */}
      <ForegroundConfetti />
      <Balloons foreground={true} />
    </KioskFrame>
  );
}

Object.assign(window, { RefNoticeboard, RefBirthdays });
