// Branch Performance Report — refined PDF replacement for the raw CSV export.
// Cover + 3 content pages, A4 native size. Reuses tokens from pdf-shared.jsx.

// ─── Roster — the agent rows ──────────────────────────────────────────────
const BRANCH_AGENTS = [
  { rank: 1,  name: 'Marsha Singh',      unit: 'South · 02', weeks: 38, ytdApi: 487000, apps: 41, avg: 11878, conv: 79, pers: 88, level: 'L4',  flag: null },
  { rank: 2,  name: 'Anand Persad',      unit: 'South · 01', weeks: 44, ytdApi: 442000, apps: 36, avg: 12278, conv: 81, pers: 91, level: 'L4',  flag: null },
  { rank: 3,  name: 'Selina Mohammed',   unit: 'South · 03', weeks: 40, ytdApi: 396000, apps: 38, avg: 10421, conv: 71, pers: 87, level: 'L3',  flag: null },
  { rank: 4,  name: 'Riaz Khan',         unit: 'South · 02', weeks: 42, ytdApi: 358000, apps: 30, avg: 11933, conv: 76, pers: 90, level: 'L3',  flag: null },
  { rank: 5,  name: 'Kamla Singh',       unit: 'South · 01', weeks: 41, ytdApi: 312000, apps: 27, avg: 11556, conv: 68, pers: 86, level: 'L3',  flag: null },
  { rank: 6,  name: 'Trevor Ramnauth',   unit: 'South · 03', weeks: 38, ytdApi: 287000, apps: 24, avg: 11958, conv: 73, pers: 89, level: 'L3',  flag: null },
  { rank: 7,  name: 'Avinash Maharaj',   unit: 'South · 02', weeks: 36, ytdApi: 254000, apps: 22, avg: 11545, conv: 65, pers: 84, level: 'L2',  flag: null },
  { rank: 8,  name: 'Hema Lakhan',       unit: 'South · 01', weeks: 39, ytdApi: 231000, apps: 21, avg: 11000, conv: 72, pers: 91, level: 'L2',  flag: null },
  { rank: 9,  name: 'Jamal Khan',        unit: 'South · 03', weeks: 28, ytdApi: 198000, apps: 18, avg: 11000, conv: 58, pers: 82, level: 'L2',  flag: 'compliance' },
  { rank: 10, name: 'Priya Naidu',       unit: 'South · 01', weeks: 34, ytdApi: 156000, apps: 15, avg: 10400, conv: 60, pers: 72, level: 'L1',  flag: 'persistency' },
  { rank: 11, name: 'Devin Lewis',       unit: 'South · 02', weeks: 32, ytdApi: 122000, apps: 12, avg: 10167, conv: 62, pers: 76, level: 'L1',  flag: 'floor' },
];

const BRANCH_TOTALS = {
  api:        8420000,
  goal:       12000000,
  apps:       612,
  agents:     28,
  units:      3,
  compliance: 92,    // percent
  persistency:87,
  mdrtPacers: 6,
};

// ─── Mini bar used inside the roster ──────────────────────────────────────
function RosterBar({ value, max, color = PDF.teal }) {
  const pct = Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <div style={{ position: 'relative', height: 5, background: PDF.rule, borderRadius: 3 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 5, width: `${pct}%`, background: color, borderRadius: 3 }}></div>
    </div>
  );
}

// ─── COVER ────────────────────────────────────────────────────────────────
function BranchCover() {
  return (
    <div style={{
      width: A4_W, height: A4_H, background: PDF.paperCream,
      color: PDF.ink, fontFamily: SANS,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Left-edge accent */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: PDF.teal }}></div>

      {/* Top lockup */}
      <div style={{
        position: 'absolute', top: 38, left: 56, right: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 200 200" style={{ display: 'block', borderRadius: 6 }}>
            <rect x="0" y="0" width="200" height="200" rx="44" fill="#014e52" />
            <path d="M100 28 Q65 28 37 42 Q30 45 30 56 L30 115 Q30 160 100 188 Q170 160 170 115 L170 56 Q170 45 163 42 Q135 28 100 28 Z" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.55" strokeWidth="2.5" />
            <rect x="72" y="127" width="11" height="18" rx="2.5" fill="white" fillOpacity="0.30" />
            <rect x="87" y="117" width="11" height="28" rx="2.5" fill="white" fillOpacity="0.50" />
            <rect x="102" y="105" width="11" height="40" rx="2.5" fill="white" fillOpacity="0.75" />
            <rect x="117" y="93" width="11" height="52" rx="2.5" fill="white" />
            <circle cx="122.5" cy="86" r="4.5" fill="#4ecdc4" />
            <polyline points="120,87 122.5,84 125,87" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.012em' }}>AgencyTrack</div>
            <div style={{ fontSize: 9, color: PDF.inkMute, marginTop: 1 }}>Tatil Life · Trinidad &amp; Tobago</div>
          </div>
        </div>
        <div style={{
          fontSize: 8.5, color: PDF.inkMute, letterSpacing: '0.14em',
          textTransform: 'uppercase', fontWeight: 700,
        }}>Confidential</div>
      </div>

      {/* Eyebrow + headline */}
      <div style={{ position: 'absolute', top: 180, left: 56, right: 56 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18,
        }}>
          <span style={{
            fontSize: 9, color: PDF.teal, fontWeight: 700,
            letterSpacing: '0.18em', fontFamily: MONO,
          }}>2026 · YTD</span>
          <div style={{ flex: 1, height: 1, background: PDF.ruleStrong }}></div>
          <span style={{
            fontSize: 9, color: PDF.inkMute, fontWeight: 600,
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>Branch Performance Report</span>
        </div>

        <div style={{
          fontSize: 11, color: PDF.inkMute, letterSpacing: '0.16em',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: 14,
        }}>South Branch</div>

        <div style={{
          fontSize: 48, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.03em',
          lineHeight: 0.98, fontFamily: SERIF_DISPLAY,
        }}>
          28 agents.<br />
          One quarter to&nbsp;close.
        </div>

        <div style={{
          fontSize: 12, color: PDF.inkMute, marginTop: 18,
          lineHeight: 1.55,
        }}>
          <span style={{ color: PDF.ink, fontWeight: 600 }}>Trevor Ramcharan</span>
          <span style={{ color: PDF.inkFaint, padding: '0 8px' }}>·</span>
          Branch Manager
          <br />
          3 units · 28 active agents · South region
        </div>
      </div>

      {/* Hero stat block */}
      <div style={{
        position: 'absolute', bottom: 110, left: 56, right: 56,
        display: 'flex', alignItems: 'stretch', gap: 14,
      }}>
        {/* Hero settled API */}
        <div style={{
          flex: 1, padding: '20px 22px',
          background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 14,
        }}>
          <div style={{
            fontSize: 8.5, color: PDF.teal, fontWeight: 700,
            letterSpacing: '0.18em', fontFamily: MONO, marginBottom: 6,
          }}>BRANCH · YTD SETTLED API</div>
          <div style={{
            fontSize: 36, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.028em',
            lineHeight: 1, fontFamily: SERIF_DISPLAY,
          }}>TTD 8.42M</div>
          <div style={{
            fontSize: 10, color: PDF.inkMute, marginTop: 8, lineHeight: 1.5,
          }}>
            70% of the TTD 12M branch goal<br />
            <span style={{ color: PDF.inkFaint }}>TTD 3.58M remaining · 5 weeks to year-end</span>
          </div>
        </div>

        {/* Donut */}
        <div style={{
          width: 178, padding: '14px 16px',
          background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Donut percent={70} size={140} stroke={12} label="70%" sub="of branch goal" />
        </div>
      </div>

      {/* Footer meta */}
      <div style={{
        position: 'absolute', bottom: 36, left: 56, right: 56,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        paddingTop: 14, borderTop: `1px solid ${PDF.rule}`,
      }}>
        <div>
          <div style={{
            fontSize: 8, color: PDF.inkFaint, letterSpacing: '0.14em',
            textTransform: 'uppercase', fontWeight: 700, marginBottom: 4,
          }}>Reporting period</div>
          <div style={{ fontSize: 10, color: PDF.ink, fontWeight: 600 }}>
            01 Jan — 25 Nov 2026
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 8, color: PDF.inkFaint, letterSpacing: '0.14em',
            textTransform: 'uppercase', fontWeight: 700, marginBottom: 4,
          }}>Issued</div>
          <div style={{ fontSize: 10, color: PDF.ink, fontWeight: 600 }}>
            26 November 2026
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE 2 — Branch totals + Unit rollup ─────────────────────────────────
function BranchPage2() {
  return (
    <PdfPage runningHeader pageNumber={2} totalPages={4} agentName="South Branch">
      <div style={{ padding: `20px ${PAD}px 0` }}>
        <SectionMark n="01" title="The branch, in numbers" subtitle="Year-to-date headline figures across all 28 agents and 3 units." />

        {/* 4-tile row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          {[
            { eyebrow: 'YTD API · SETTLED',  value: 'TTD 8.42M', sub: '+22% vs LY' },
            { eyebrow: 'APPLICATIONS',        value: '612',       sub: '38 PPP · 574 NB' },
            { eyebrow: 'ACTIVE AGENTS',       value: '28',        sub: '6 on MDRT pace' },
            { eyebrow: 'BRANCH PERSISTENCY',  value: '87%',       sub: '7pp above floor' },
          ].map(t => (
            <div key={t.eyebrow} style={{
              padding: '12px 14px',
              background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 10,
            }}>
              <div style={{
                fontSize: 8, color: PDF.teal, fontWeight: 700,
                letterSpacing: '0.14em', fontFamily: MONO, marginBottom: 6,
              }}>{t.eyebrow}</div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.02em',
                lineHeight: 1.05, fontFamily: SERIF_DISPLAY,
              }}>{t.value}</div>
              <div style={{ fontSize: 8.5, color: PDF.inkMute, marginTop: 4 }}>{t.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 02 — Unit Rollup */}
      <div style={{ padding: `20px ${PAD}px 0` }}>
        <SectionMark n="02" title="Performance by unit" subtitle="API and applications, with each unit's contribution to the branch total." />

        {/* Stacked bar — visual + table */}
        {[
          { unit: 'South · 01', mgr: 'A. Persad',    agents: 10, api: 3120000, apps: 224, pers: 91, pct: 37 },
          { unit: 'South · 02', mgr: 'M. Singh',     agents: 10, api: 2980000, apps: 218, pers: 85, pct: 35 },
          { unit: 'South · 03', mgr: 'S. Mohammed',  agents: 8,  api: 2320000, apps: 170, pers: 87, pct: 28 },
        ].map((u, i, arr) => (
          <div key={u.unit} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 0',
            borderBottom: i < arr.length - 1 ? `1px solid ${PDF.rule}` : 'none',
          }}>
            <div style={{ width: 110 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.01em' }}>{u.unit}</div>
              <div style={{ fontSize: 8.5, color: PDF.inkFaint, marginTop: 1, fontFamily: MONO }}>UNIT MGR · {u.mgr}</div>
            </div>
            <div style={{ width: 56, textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: PDF.inkMute }}>Agents</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO }}>{u.agents}</div>
            </div>
            <div style={{ flex: 1, paddingLeft: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 9, color: PDF.inkMute }}>Settled API</div>
                <div style={{ fontSize: 9, color: PDF.ink, fontWeight: 700, fontFamily: MONO }}>TTD {(u.api / 1000).toFixed(0)}k</div>
              </div>
              <RosterBar value={u.pct} max={37} />
              <div style={{ fontSize: 8, color: PDF.inkFaint, marginTop: 4 }}>{u.pct}% of branch · {u.apps} applications</div>
            </div>
            <div style={{ width: 74, textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: PDF.inkMute }}>Persistency</div>
              <div style={{
                fontSize: 13, fontWeight: 700, fontFamily: MONO,
                color: u.pers >= 90 ? PDF.success : PDF.ink,
              }}>{u.pers}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Section 03 — Branch vs Targets */}
      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="03" title="Branch progress to targets" />

        <div style={{ position: 'relative', height: 28 }}>
          <div style={{ position: 'absolute', inset: 0, background: PDF.rule, borderRadius: 6 }}></div>
          <div style={{ position: 'absolute', left: 0, top: 0, width: '58%', height: 28, background: PDF.teal, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}></div>
          <div style={{ position: 'absolute', left: '58%', top: 0, width: '12%', height: 28, background: PDF.tealMid, opacity: 0.55 }}></div>
          {[
            { x: 33, color: PDF.ink },
            { x: 67, color: PDF.warning },
            { x: 100, color: PDF.success, hide: true },
          ].filter(m => !m.hide).map((m, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${m.x}%`, top: -3, bottom: -3,
              width: 1.5, background: m.color,
            }}></div>
          ))}
        </div>

        <div style={{ position: 'relative', height: 22, marginTop: 4 }}>
          {[
            { x: 33,  label: 'Floor (28×250k)', value: 'TTD 7M',  color: PDF.ink },
            { x: 67,  label: 'Pace',           value: 'TTD 8M',  color: PDF.warning },
            { x: 100, label: 'Goal',           value: 'TTD 12M', color: PDF.success },
          ].map((m, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${m.x}%`, top: 0,
              transform: m.x === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
              textAlign: m.x === 100 ? 'right' : 'center',
            }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em', color: m.color, textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontSize: 8.5, color: PDF.inkMute, fontFamily: MONO, marginTop: 1 }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 18,
          padding: '12px 14px', background: PDF.paperPanel,
          borderRadius: 10, border: `1px solid ${PDF.rule}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: PDF.teal }}></div>
            <div style={{ fontSize: 9, color: PDF.inkMute }}>Settled · TTD 6.96M</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: PDF.tealMid, opacity: 0.55 }}></div>
            <div style={{ fontSize: 9, color: PDF.inkMute }}>Pending · TTD 1.46M</div>
          </div>
          <div style={{ flex: 1 }}></div>
          <div style={{ fontSize: 9, color: PDF.ink }}>
            <span style={{ color: PDF.teal, fontWeight: 700 }}>TTD 8.42M</span> achieved · <span style={{ color: PDF.inkFaint }}>70% of goal</span>
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

// ─── PAGE 3 — Agent leaderboard ───────────────────────────────────────────
function BranchPage3() {
  const maxApi = Math.max(...BRANCH_AGENTS.map(a => a.ytdApi));
  return (
    <PdfPage runningHeader pageNumber={3} totalPages={4} agentName="South Branch">
      <div style={{ padding: `20px ${PAD}px 0` }}>
        <SectionMark n="04" title="Agent roster" subtitle="11 of 28 agents shown — ranked by YTD settled API. Coloured bars scale to the top performer." />

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingBottom: 6, marginBottom: 4,
          borderBottom: `1px solid ${PDF.ruleStrong}`,
        }}>
          <div style={{ width: 18, fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>#</div>
          <div style={{ width: 130, fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>AGENT · UNIT</div>
          <div style={{ width: 32, textAlign: 'right', fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>WK</div>
          <div style={{ flex: 1, fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>YTD API · TTD</div>
          <div style={{ width: 30, textAlign: 'right', fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>APPS</div>
          <div style={{ width: 38, textAlign: 'right', fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>CI→APP</div>
          <div style={{ width: 38, textAlign: 'right', fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>PERS.</div>
          <div style={{ width: 28, textAlign: 'right', fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>LVL</div>
        </div>

        {BRANCH_AGENTS.map((a, i) => {
          // top 3 get a medal mark
          const isTop3 = a.rank <= 3;
          const medalGrad = a.rank === 1
            ? 'radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 50%, #b45309 100%)'
            : a.rank === 2
              ? 'radial-gradient(circle at 32% 28%, #f1f5f9 0%, #94a3b8 50%, #475569 100%)'
              : 'radial-gradient(circle at 32% 28%, #fed7aa 0%, #c08d6b 50%, #92400e 100%)';
          const persColor = a.pers >= 90 ? PDF.success : a.pers >= 80 ? PDF.ink : PDF.warning;
          return (
            <div key={a.name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 0',
              borderBottom: i < BRANCH_AGENTS.length - 1 ? `1px solid ${PDF.rule}` : 'none',
            }}>
              <div style={{ width: 18 }}>
                {isTop3 ? (
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: medalGrad, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 800, letterSpacing: '-0.04em',
                    boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.18), inset 0 1px 2px rgba(255,255,255,0.4)',
                  }}>{a.rank}</div>
                ) : (
                  <div style={{ fontSize: 9.5, color: PDF.inkFaint, fontFamily: MONO, fontWeight: 600, textAlign: 'left' }}>{a.rank}</div>
                )}
              </div>
              <div style={{ width: 130 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.005em' }}>{a.name}</div>
                <div style={{ fontSize: 8.5, color: PDF.inkFaint, marginTop: 1, fontFamily: MONO }}>{a.unit}</div>
              </div>
              <div style={{ width: 32, textAlign: 'right', fontSize: 9.5, fontFamily: MONO, color: PDF.inkMute }}>{a.weeks}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: PDF.ink, fontFamily: MONO }}>{(a.ytdApi / 1000).toFixed(0)}k</div>
                  <div style={{ fontSize: 8, color: PDF.inkFaint, fontFamily: MONO }}>{Math.round(a.ytdApi / maxApi * 100)}%</div>
                </div>
                <RosterBar value={a.ytdApi} max={maxApi} color={a.flag === 'floor' ? PDF.warning : PDF.teal} />
              </div>
              <div style={{ width: 30, textAlign: 'right', fontSize: 9.5, fontFamily: MONO, color: PDF.ink }}>{a.apps}</div>
              <div style={{ width: 38, textAlign: 'right', fontSize: 9.5, fontFamily: MONO, color: a.conv >= 70 ? PDF.success : PDF.inkMute }}>{a.conv}%</div>
              <div style={{ width: 38, textAlign: 'right', fontSize: 9.5, fontFamily: MONO, color: persColor }}>{a.pers}%</div>
              <div style={{ width: 28, textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block', padding: '1px 5px', borderRadius: 4,
                  background: PDF.paperPanel, color: PDF.inkMute,
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.04em', fontFamily: MONO,
                }}>{a.level}</span>
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: 10, padding: '8px 12px', background: PDF.paperPanel, borderRadius: 8, border: `1px solid ${PDF.rule}` }}>
          <div style={{ fontSize: 9, color: PDF.inkMute, lineHeight: 1.5 }}>
            <span style={{ color: PDF.ink, fontWeight: 600 }}>17 more agents</span> not shown.
            Full roster available in the Master Sheet export. Persistency colours: <span style={{ color: PDF.success, fontWeight: 600 }}>≥90%</span> · <span style={{ color: PDF.ink, fontWeight: 600 }}>80–89%</span> · <span style={{ color: PDF.warning, fontWeight: 600 }}>&lt;80%</span>.
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

// ─── PAGE 4 — Compliance + Top performers + At-risk ───────────────────────
function BranchPage4() {
  return (
    <PdfPage runningHeader pageNumber={4} totalPages={4} agentName="South Branch">
      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="05" title="Weekly compliance" subtitle="On-time submission rate this year. 92% means 26 of 28 agents have submitted ≥40 of the 47 closed weeks." />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 24,
          padding: '14px 18px', background: PDF.paperCream,
          border: `1px solid ${PDF.rule}`, borderRadius: 12,
        }}>
          <Donut percent={92} size={92} stroke={8} label="92%" sub="on time" />
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { label: 'Submitted on time', value: '26 / 28', color: PDF.success },
              { label: 'Late this week',    value: '1',       color: PDF.warning },
              { label: 'Missed this week',  value: '1',       color: PDF.danger  },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 8.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: SERIF_DISPLAY, letterSpacing: '-0.022em', marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 06 — Top Performers */}
      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="06" title="Top performers this year" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { rank: 1, name: 'Marsha Singh',    unit: 'South · 02', api: 487000, sub: 'On MDRT pace · 79% CI→App', grad: 'radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 50%, #b45309 100%)' },
            { rank: 2, name: 'Anand Persad',    unit: 'South · 01', api: 442000, sub: '44 weeks submitted · 91% persistency', grad: 'radial-gradient(circle at 32% 28%, #f1f5f9 0%, #94a3b8 50%, #475569 100%)' },
            { rank: 3, name: 'Selina Mohammed', unit: 'South · 03', api: 396000, sub: '38 applications · highest in S-03', grad: 'radial-gradient(circle at 32% 28%, #fed7aa 0%, #c08d6b 50%, #92400e 100%)' },
          ].map(p => (
            <div key={p.name} style={{
              padding: '14px 14px 12px',
              background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 12,
              position: 'relative',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: p.grad, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, letterSpacing: '-0.04em',
                fontFamily: SERIF_DISPLAY,
                boxShadow: 'inset 0 -1.5px 3px rgba(0,0,0,0.18), inset 0 1.5px 3px rgba(255,255,255,0.4), 0 3px 10px rgba(0,0,0,0.06)',
                marginBottom: 10,
              }}>{p.rank}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.012em' }}>{p.name}</div>
              <div style={{ fontSize: 8.5, color: PDF.inkFaint, fontFamily: MONO, marginTop: 1 }}>{p.unit}</div>
              <div style={{
                fontSize: 18, fontWeight: 700, color: PDF.ink, marginTop: 8,
                letterSpacing: '-0.018em', fontFamily: SERIF_DISPLAY, lineHeight: 1,
              }}>TTD {(p.api / 1000).toFixed(0)}k</div>
              <div style={{ fontSize: 9, color: PDF.inkMute, marginTop: 6, lineHeight: 1.4 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 07 — At-risk */}
      <div style={{ padding: `14px ${PAD}px 0` }}>
        <SectionMark n="07" title="Agents needing attention" subtitle="Flagged by persistency below 80%, YTD API below the company floor, or 3+ missed deadlines this quarter." />

        {[
          { name: 'Devin Lewis',  unit: 'South · 02', flag: 'Below floor',   detail: 'TTD 122k YTD · TTD 128k below floor', color: PDF.danger,  bg: PDF.dangerTint },
          { name: 'Priya Naidu',  unit: 'South · 01', flag: 'Persistency',   detail: '72% — 8pp below the 80% threshold',    color: PDF.warning, bg: PDF.warningTint },
          { name: 'Jamal Khan',   unit: 'South · 03', flag: 'Compliance',    detail: '3 missed deadlines this quarter',      color: PDF.warning, bg: PDF.warningTint },
        ].map((r, i, arr) => (
          <div key={r.name} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '8px 0',
            borderBottom: i < arr.length - 1 ? `1px solid ${PDF.rule}` : 'none',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }}></div>
            <div style={{ width: 150 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.01em' }}>{r.name}</div>
              <div style={{ fontSize: 8.5, color: PDF.inkFaint, marginTop: 1, fontFamily: MONO }}>{r.unit}</div>
            </div>
            <div style={{ flex: 1, fontSize: 9.5, color: PDF.inkMute, lineHeight: 1.4 }}>{r.detail}</div>
            <Pill color={r.color} bg={r.bg}>{r.flag}</Pill>
          </div>
        ))}
      </div>

      {/* Branch focus callout */}
      <div style={{ padding: `12px ${PAD}px 0` }}>
        <div style={{
          padding: '12px 16px',
          background: PDF.teal,
          borderRadius: 12,
          color: PDF.paper,
        }}>
          <div style={{
            fontSize: 8.5, color: 'rgba(255,255,255,0.75)', fontWeight: 700,
            letterSpacing: '0.16em', fontFamily: MONO, marginBottom: 6,
          }}>BRANCH FOCUS · Q4 2026</div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: PDF.paper,
            letterSpacing: '-0.012em', lineHeight: 1.3, fontFamily: SERIF_DISPLAY,
          }}>
            TTD 3.58M to close the year on goal &mdash; 6 agents on MDRT pace already carry over half of it.
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

// ─── Current CSV — small reference artboard ───────────────────────────────
function CurrentCsv() {
  const headers = ['Agent Name', 'Unit', 'Weeks Submitted', 'YTD API', 'YTD Apps', 'YTD Dials', 'YTD Tel Contacts', 'YTD F2F Approaches', 'YTD FFI', 'YTD CI', 'Avg API per App', 'CI-to-App Rate (%)', 'Persistency (%)', 'Career Level', 'Last Submission Date'];
  const rows = [
    ['Marsha Singh',     'South-02', 38, 487000, 41, 1718, 410, 217, 110, 72,  11878, 79, 88, 'Senior Associate', '2026-11-17'],
    ['Anand Persad',     'South-01', 44, 442000, 36, 1848, 462, 252, 121, 80,  12278, 81, 91, 'Senior Associate', '2026-11-17'],
    ['Selina Mohammed',  'South-03', 40, 396000, 38, 1640, 380, 200, 110, 73,  10421, 71, 87, 'Associate',        '2026-11-10'],
    ['Riaz Khan',        'South-02', 42, 358000, 30, 1722, 415, 218, 109, 65,  11933, 76, 90, 'Associate',        '2026-11-17'],
    ['Kamla Singh',      'South-01', 41, 312000, 27, 1640, 398, 203, 102, 60,  11556, 68, 86, 'Associate',        '2026-11-17'],
    ['Trevor Ramnauth',  'South-03', 38, 287000, 24, 1520, 360, 188,  93, 56,  11958, 73, 89, 'Associate',        '2026-11-10'],
    ['Avinash Maharaj',  'South-02', 36, 254000, 22, 1404, 320, 168,  86, 51,  11545, 65, 84, 'Senior Salesperson', '2026-11-03'],
    ['Hema Lakhan',      'South-01', 39, 231000, 21, 1521, 350, 175,  88, 50,  11000, 72, 91, 'Senior Salesperson', '2026-11-17'],
  ];

  const csvLine = (cells) => cells.map(v => {
    const s = String(v);
    return s.includes(',') ? `"${s}"` : s;
  }).join(',');

  return (
    <div style={{
      width: A4_W, height: A4_H, background: PDF.paper,
      fontFamily: MONO, fontSize: 8.5, color: PDF.ink,
      padding: '24px 22px', overflow: 'hidden', position: 'relative',
      boxSizing: 'border-box',
    }}>
      {/* OS window chrome */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        paddingBottom: 12, borderBottom: `1px solid ${PDF.rule}`, marginBottom: 14,
      }}>
        <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }}></div>
        <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }}></div>
        <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }}></div>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: SANS, fontSize: 11, color: PDF.inkMute, letterSpacing: '-0.005em' }}>
          AgencyTrack_Branch_Report_2026-11-26.csv
        </div>
        <div style={{ width: 11 }}></div>
      </div>

      <div style={{
        fontSize: 9, fontFamily: SANS, color: PDF.inkMute,
        marginBottom: 10, lineHeight: 1.5,
      }}>
        Today, branch managers tap <span style={{ background: PDF.paperPanel, padding: '1px 6px', borderRadius: 4, color: PDF.ink, fontFamily: MONO }}>Export CSV</span> and get this — 15 columns, one row per agent, no narrative.
      </div>

      {/* CSV content */}
      <div style={{ background: PDF.paperPanel, border: `1px solid ${PDF.rule}`, borderRadius: 8, padding: '12px 14px', overflow: 'hidden' }}>
        <div style={{
          color: PDF.teal, fontWeight: 700, fontSize: 8,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{csvLine(headers)}</div>
        <div style={{ height: 1, background: PDF.rule, margin: '6px 0' }}></div>
        {rows.map((r, i) => (
          <div key={i} style={{
            color: PDF.inkMute, fontSize: 8,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            padding: '2px 0',
          }}>{csvLine(r)}</div>
        ))}
        <div style={{ color: PDF.inkFaint, fontSize: 8, padding: '2px 0' }}>... 20 more rows ...</div>
      </div>

      {/* Caption */}
      <div style={{
        position: 'absolute', bottom: 24, left: 22, right: 22,
        fontFamily: SANS, fontSize: 10, color: PDF.inkMute, lineHeight: 1.55,
      }}>
        <div style={{
          fontSize: 8.5, color: PDF.inkFaint, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6,
        }}>What's missing</div>
        <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
          <li>No branch identity, period, or issuing manager — recipient must reconstruct context.</li>
          <li>Top performers, at-risk agents, and unit rollups are invisible without a pivot table.</li>
          <li>Not shareable as-is — it has to be re-formatted before going to upline or to a meeting.</li>
        </ul>
      </div>
    </div>
  );
}

Object.assign(window, {
  BRANCH_AGENTS, BRANCH_TOTALS,
  BranchCover, BranchPage2, BranchPage3, BranchPage4, CurrentCsv,
});
