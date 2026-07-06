// Nexus app UI kit — screen content components (Dashboard, Policy Ledger, Awards).
// Composes design-system primitives from the bundle; recreation of the portal views
// described in app/README.md + reference/app-shell.jsx.
const {
  Scorecard, GlassCard, Money, Eyebrow, Pill, Avatar, Button,
  IconArrowR, IconCheck, IconClock, IconTrophy, IconDownload, IconFilter, IconPlus,
} = window.AgencyTrackDesignSystem_ad1cd7;

const AGENTS = [
  { ini: 'MS', name: 'Marsha Singh',    unit: 'S·02', week: 24000, status: ['success', 'ON PACE'] },
  { ini: 'AP', name: 'Anand Persad',    unit: 'S·01', week: 19000, status: ['success', 'ON PACE'] },
  { ini: 'SM', name: 'Selina Mohammed', unit: 'S·03', week: 17000, status: ['success', 'ON PACE'] },
  { ini: 'CJ', name: 'Carla Joseph',    unit: 'S·02', week: 18000, status: ['warning', 'AT FLOOR'] },
  { ini: 'DL', name: 'Devin Lewis',     unit: 'S·01', week: 9000,  status: ['danger', 'BELOW'] },
];

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--rule)',
  borderRadius: 14, padding: '16px 18px',
};
const secTitle = { fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', letterSpacing: '-.012em' };
const rowStyle = { display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--rule)' };
const monoMeta = { fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--inkFaint)' };

function DashboardScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Nexus Glass hero — the one glass card */}
      <GlassCard tint="teal" padding="20px 24px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <Eyebrow size="sm">YTD · Settled API</Eyebrow>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 34, letterSpacing: '-.025em', color: 'var(--ink)', marginTop: 7, lineHeight: 1 }}>
              <Money value={487000} mono={false} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--inkMute)', marginTop: 6 }}>81% of TTD 600K · 5 weeks left in the year</div>
            <div style={{ marginTop: 12, height: 6, background: 'var(--surfaceMute)', borderRadius: 999, overflow: 'hidden', maxWidth: 380 }}>
              <div style={{ width: '81%', height: 6, background: 'linear-gradient(90deg, var(--tealDark), var(--teal))', borderRadius: 999 }}></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 26, flexShrink: 0 }}>
            <div><Eyebrow size="sm" color="var(--success)">Persistency</Eyebrow><div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, color: 'var(--ink)', marginTop: 6 }}>88%</div></div>
            <div><Eyebrow size="sm">Streak</Eyebrow><div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, color: 'var(--ink)', marginTop: 6 }}>12 wks</div></div>
            <div><Eyebrow size="sm" color="var(--gold)">Awards</Eyebrow><div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, color: 'var(--gold)', marginTop: 6 }}>MDRT</div></div>
          </div>
        </div>
      </GlassCard>

      <div style={{ display: 'flex', gap: 14 }}>
        <Scorecard eyebrow="THIS WEEK" value={<Money value={24500} mono={false} />} sub="of TTD 12K floor" progress={100} big />
        <Scorecard eyebrow="CALLS MADE" value="92 / 60" sub="✓ above the floor" accent="var(--success)" />
        <Scorecard eyebrow="FACT FINDS" value="14 / 10" sub="✓ above the floor" accent="var(--success)" />
        <Scorecard eyebrow="APPOINTMENTS" value="16 / 20" sub="4 short of plan" accent="var(--warning)" progress={80} />
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ ...cardStyle, flex: 1.4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={secTitle}>Policies to deliver</div>
            <Pill tone="warning">30-day clock</Pill>
            <span style={{ marginLeft: 'auto' }}><Button size="sm" variant="ghost" icon={<IconArrowR size={13} />}>Delivery register</Button></span>
          </div>
          <div style={{ marginTop: 6 }}>
            <div style={rowStyle}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }}></span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>Anil Boodram</div><div style={monoMeta}>Platinum Edge · TL-08661</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 19, color: 'var(--success)', lineHeight: 1 }}>26</div><div style={{ ...monoMeta, fontSize: 8 }}>DAYS LEFT</div></div>
            </div>
            <div style={{ ...rowStyle, borderBottom: 0 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }}></span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>Sara Khan</div><div style={monoMeta}>Term Life 20 · TL-08655</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 19, color: 'var(--warning)', lineHeight: 1 }}>6</div><div style={{ ...monoMeta, fontSize: 8 }}>DAYS LEFT</div></div>
            </div>
          </div>
        </div>
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={secTitle}>Leaderboard</div>
            <Eyebrow size="sm" color="var(--gold)" star>This week</Eyebrow>
          </div>
          <div style={{ marginTop: 6 }}>
            {AGENTS.slice(0, 3).map((a, i) => (
              <div key={a.ini} style={{ ...rowStyle, ...(i === 2 ? { borderBottom: 0 } : {}) }}>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14, width: 13, textAlign: 'center', color: i === 0 ? 'var(--gold)' : 'var(--inkFaint)' }}>{i + 1}</span>
                <Avatar initials={a.ini} size={28} ring={i === 0} />
                <div style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{a.name}</div>
                <Money value={a.week} size={12} color={i === 0 ? 'var(--gold)' : 'var(--inkMute)'} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerScreen() {
  const rows = [
    { ini: 'KM', name: 'Kareem Mohammed', meta: 'submitted 32.4K · settled 29.8K', tone: 'danger', label: '−TTD 2.6K' },
    { ini: 'ML', name: 'Marcus Lee', meta: 'agent: settled · carrier: NTU', tone: 'danger', label: 'CONFLICT' },
    { ini: 'AB', name: 'Anil Boodram', meta: '36K = 36K', tone: 'success', label: '✓ MATCH' },
    { ini: 'SK', name: 'Sara Khan', meta: '18.2K = 18.2K', tone: 'success', label: '✓ MATCH' },
    { ini: 'JK', name: 'Jamal Khan', meta: 'in carrier file · no agent entry', tone: 'warning', label: 'UNMATCHED' },
  ];
  const toneColor = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14 }}>
        <Scorecard eyebrow="SUBMITTED · NOV" value={<Money value={186000} mono={false} />} big />
        <Scorecard eyebrow="SETTLED · CONFIRMED" value={<Money value={172400} mono={false} />} accent="var(--success)" big />
        <Scorecard eyebrow="EXCEPTIONS" value="3" sub="2 conflicts · 1 unmatched" accent="var(--danger)" big />
      </div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={secTitle}>Reconciliation · South Branch</div>
          <Pill tone="teal">Nov settlement</Pill>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button size="sm" variant="ghost" icon={<IconFilter size={13} />}>Filter</Button>
            <Button size="sm" variant="ghost" icon={<IconDownload size={13} />}>Export</Button>
          </span>
        </div>
        <div style={{ marginTop: 6 }}>
          {rows.map((r, i) => (
            <div key={r.ini + i} style={{ ...rowStyle, ...(i === rows.length - 1 ? { borderBottom: 0 } : {}) }}>
              <Avatar initials={r.ini} size={28} bg="#01696F" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{r.name}</div>
                <div style={monoMeta}>{r.meta}</div>
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: toneColor[r.tone] }}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AwardsScreen() {
  const gates = [
    { band: '≥90%', pay: '100%', solid: true },
    { band: '85–89', pay: '50%' },
    { band: '80–84', pay: '25%' },
    { band: '<80', pay: 'DQ', danger: true },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Gold glass hero — recognition context */}
      <GlassCard tint="gold" padding="20px 24px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--goldTint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconTrophy size={24} color="var(--gold)" />
          </div>
          <div style={{ flex: 1 }}>
            <Eyebrow size="sm" color="var(--goldInk, var(--gold))" star>Christmas campaign · persistency gate</Eyebrow>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 27, letterSpacing: '-.022em', color: 'var(--ink)', marginTop: 6 }}>
              <Money value={70000} mono={false} /> <span style={{ fontSize: 14, fontWeight: 500, fontFamily: 'var(--sans)', color: 'var(--inkMute)' }}>leading · 91% persistency · full payout</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {gates.map((g) => (
              <div key={g.band} style={{
                textAlign: 'center', padding: '8px 12px', borderRadius: 11,
                background: g.solid ? 'var(--gold)' : g.danger ? 'var(--dangerTint)' : 'var(--goldTint)',
                color: g.solid ? '#fff' : g.danger ? 'var(--danger)' : 'var(--goldInk, var(--gold))',
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700 }}>{g.band}</div>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 16 }}>{g.pay}</div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={secTitle}>Campaign standings</div>
            <Eyebrow size="sm" color="var(--gold)" star>Live</Eyebrow>
          </div>
          <div style={{ marginTop: 6 }}>
            {AGENTS.slice(0, 4).map((a, i) => (
              <div key={a.ini} style={{ ...rowStyle, ...(i === 3 ? { borderBottom: 0 } : {}) }}>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14, width: 13, textAlign: 'center', color: i === 0 ? 'var(--gold)' : 'var(--inkFaint)' }}>{i + 1}</span>
                <Avatar initials={a.ini} size={28} bg="#01696F" ring={i === 0} />
                <div style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{a.name}</div>
                <div style={{ ...monoMeta, width: 36 }}>{a.unit}</div>
                <Money value={a.week * 2.9} size={12} color={i === 0 ? 'var(--gold)' : 'var(--inkMute)'} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...cardStyle, width: 330, flexShrink: 0 }}>
          <div style={secTitle}>Awards watch</div>
          <div style={{ marginTop: 6 }}>
            {[
              ['MDRT', 'qualified · 118% of requirement', 'gold', 'QUALIFIED'],
              ['Eagles Club · Bermuda', 'unlocked at TTD 450K settled', 'gold', 'UNLOCKED'],
              ['Career: Senior Associate II', 'TTD 113K to next level', 'teal', 'IN REACH'],
            ].map(([name, meta, tone, label], i, arr) => (
              <div key={name} style={{ ...rowStyle, ...(i === arr.length - 1 ? { borderBottom: 0 } : {}) }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{name}</div>
                  <div style={monoMeta}>{meta}</div>
                </div>
                <Pill tone={tone}>{label}</Pill>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardScreen, LedgerScreen, AwardsScreen });
