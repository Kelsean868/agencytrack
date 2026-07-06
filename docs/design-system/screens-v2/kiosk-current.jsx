// Current kiosk panels — faithful recreation of what ships today.
// Source: src/components/kiosk/panels/* in agencytrack repo.
// Renders the light cream dashboard theme on TV (the actual problem).

const CUR_K = {
  bg:           '#F7F6F2',   // --color-bg
  surface:      '#FFFFFF',   // --color-surface (bg-card)
  raised:       '#FAFAF8',   // --color-surface-raised
  text:         '#28251D',   // --color-text
  textMute:     '#6B6560',   // --color-text-muted
  textFaint:    '#A8A39C',   // --color-text-faint
  border:       '#E5E2DB',
  primary:      '#01696F',
  primaryTint:  '#E6F4F4',
  success:      '#2D7A4F',
  warning:      '#B45309',
  gold:         '#FACC15',
  silver:       '#CBD5E1',
  bronze:       '#D97706',
};

const CUR_SANS = "'Satoshi', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const CUR_DISPLAY = "'Cabinet Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";

function CurFrame({ children }) {
  return (
    <div style={{
      width: TV_W, height: TV_H, background: CUR_K.bg,
      color: CUR_K.text, fontFamily: CUR_SANS,
      position: 'relative', overflow: 'hidden',
    }}>{children}</div>
  );
}

function CurAvatar({ name, size = 56 }) {
  const initials = (name || 'A').split(' ').map(s => s[0]).slice(0, 2).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: CUR_K.primaryTint, color: CUR_K.primary,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: CUR_DISPLAY, fontSize: size * 0.36, fontWeight: 700,
      flexShrink: 0,
    }}>{initials}</div>
  );
}

// ─── Current Welcome ──────────────────────────────────────────────────────
function CurWelcome() {
  return (
    <CurFrame>
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 18, padding: 30,
      }}>
        <div style={{ fontSize: 80, fontWeight: 700, color: CUR_K.primary, fontFamily: CUR_DISPLAY, letterSpacing: '-0.02em' }}>
          Good Morning
        </div>
        <div style={{ fontSize: 26, color: CUR_K.textMute }}>
          Thursday, 26 November 2026
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, color: CUR_K.text, fontFamily: CUR_DISPLAY, letterSpacing: '-0.02em' }}>
          7:42 AM
        </div>
        <div style={{
          marginTop: 12, maxWidth: 800, textAlign: 'center',
          fontSize: 20, color: CUR_K.textMute, fontStyle: 'italic',
        }}>
          &ldquo;Consistency is the key to excellence.&rdquo;
        </div>
        <div style={{ marginTop: 6, fontSize: 16, color: CUR_K.textMute, opacity: 0.5 }}>
          AgencyTrack · Tatil Life
        </div>
      </div>
    </CurFrame>
  );
}

// ─── Current Agent of Month ───────────────────────────────────────────────
function CurAgentOfMonth() {
  const winners = [
    { cat: 'API Champion',    name: 'Marsha Singh',    metric: 'TTD 187,000', icon: '🏆' },
    { cat: 'Apps Leader',     name: 'Anand Persad',    metric: '14 apps',     icon: '🥈' },
    { cat: 'Activity Winner', name: 'Selina Mohammed', metric: '1,840',       icon: '📈' },
  ];
  return (
    <CurFrame>
      <div style={{ padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 32 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: CUR_K.text, fontFamily: CUR_DISPLAY, letterSpacing: '-0.02em' }}>
            Agent of the Month
          </div>
          <div style={{ fontSize: 22, color: CUR_K.textMute, fontWeight: 600 }}>November 2026</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 48 }}>
          {winners.map((w) => (
            <div key={w.cat} style={{
              padding: 28,
              background: CUR_K.surface,
              border: `1px solid ${CUR_K.border}`,
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(40,37,29,0.08)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}>
              <div style={{ fontSize: 56 }}>{w.icon}</div>
              <div style={{ fontSize: 18, color: CUR_K.textMute, fontWeight: 600 }}>{w.cat}</div>
              <CurAvatar name={w.name} size={80} />
              <div style={{ fontSize: 26, fontWeight: 700, color: CUR_K.text, letterSpacing: '-0.012em', textAlign: 'center' }}>
                {w.name}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: CUR_K.primary, fontFamily: CUR_DISPLAY }}>
                {w.metric}
              </div>
            </div>
          ))}
        </div>
      </div>
    </CurFrame>
  );
}

// ─── Current Ranked Leaderboard (TVRankedLeaderboard recreation) ─────────
function CurRankedLeaderboard() {
  const agents = [
    { rank: 1, name: 'Marsha Singh',    api: 487000 },
    { rank: 2, name: 'Anand Persad',    api: 442000 },
    { rank: 3, name: 'Selina Mohammed', api: 396000 },
    { rank: 4, name: 'Riaz Khan',       api: 358000 },
    { rank: 5, name: 'Kamla Singh',     api: 312000 },
    { rank: 6, name: 'Trevor Ramnauth', api: 287000 },
    { rank: 7, name: 'Avinash Maharaj', api: 254000 },
    { rank: 8, name: 'Hema Lakhan',     api: 231000 },
  ];
  function rankIcon(rank) {
    if (rank === 1) return <span style={{ fontSize: 28, color: CUR_K.gold }}>🏆</span>;
    if (rank === 2) return <span style={{ fontSize: 28, color: CUR_K.silver }}>🥈</span>;
    if (rank === 3) return <span style={{ fontSize: 28, color: CUR_K.bronze }}>🥉</span>;
    return <span style={{ width: 28, fontSize: 22, fontWeight: 700, color: CUR_K.textMute, textAlign: 'center' }}>#{rank}</span>;
  }
  return (
    <CurFrame>
      <div style={{ padding: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: CUR_K.text, fontFamily: CUR_DISPLAY, letterSpacing: '-0.012em' }}>
            YTD Leaderboard
          </div>
          <div style={{ fontSize: 18, color: CUR_K.textMute }}>1 / 1</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {agents.map((a) => (
            <div key={a.rank} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '8px 20px',
              background: CUR_K.surface,
              borderRadius: 12,
              border: `1px solid ${CUR_K.border}`,
            }}>
              <div style={{ width: 28, display: 'flex', justifyContent: 'center' }}>{rankIcon(a.rank)}</div>
              <CurAvatar name={a.name} size={48} />
              <div style={{ flex: 1, fontSize: 24, fontWeight: 600, color: CUR_K.text }}>{a.name}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: CUR_K.primary, fontFamily: CUR_DISPLAY }}>
                TTD {(a.api / 1000).toFixed(1)}K
              </div>
            </div>
          ))}
        </div>
      </div>
    </CurFrame>
  );
}

Object.assign(window, { CurWelcome, CurAgentOfMonth, CurRankedLeaderboard });
