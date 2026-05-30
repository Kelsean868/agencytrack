// Agency Performance Report — scoped to the Sales Manager's full agency.
// Cross-branch view: rolls up all branches, all units, all agents in the tenant.

// Branches per prodreport-v2-shared.jsx PR_BRANCHES — South / North / East /
// Central. API 24.8M of a 36.9M goal (67%); 84 agents across 10 units.
const AGENCY_BRANCHES = [
  { rank: 1, name: 'South Branch',   mgr: 'Trevor Ramcharan', agents: 28, units: 3, api: 8420000, goal: 12000000, pct: 70, pers: 87, mdrt: 6 },
  { rank: 2, name: 'North Branch',   mgr: 'Lystra Boodoo',    agents: 24, units: 3, api: 7180000, goal: 10500000, pct: 68, pers: 89, mdrt: 5 },
  { rank: 3, name: 'East Branch',    mgr: 'Dexter Ramlogan',  agents: 18, units: 2, api: 5240000, goal: 8000000,  pct: 66, pers: 85, mdrt: 4 },
  { rank: 4, name: 'Central Branch', mgr: 'Anisa Mohammed',   agents: 14, units: 2, api: 3960000, goal: 6400000,  pct: 62, pers: 88, mdrt: 3 },
];

// Ranked by canonical YTD settled API (reconciled to the Branch/Unit reports
// and the live app: Marsha 487K, Anand 442K, Selina 396K). Krishna (North)
// legitimately leads agency-wide; Marsha is the South #1 at agency rank 2.
const AGENCY_TOPS = [
  { rank: 1, name: 'Krishna Maharaj', branch: 'North · 01',  api: 558000, sub: '52 apps · 92% persistency',     grad: 'radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 50%, #b45309 100%)' },
  { rank: 2, name: 'Marsha Singh',    branch: 'South · 02',  api: 487000, sub: 'On MDRT pace · UM + producer', grad: 'radial-gradient(circle at 32% 28%, #f1f5f9 0%, #94a3b8 50%, #475569 100%)' },
  { rank: 3, name: 'Devraj Persad',   branch: 'Central · 01',api: 478000, sub: '38 apps · top in Central',      grad: 'radial-gradient(circle at 32% 28%, #fed7aa 0%, #c08d6b 50%, #92400e 100%)' },
  { rank: 4, name: 'Anand Persad',    branch: 'South · 01',  api: 442000, sub: '44 weeks submitted · L4',       grad: 'radial-gradient(circle at 32% 28%, #ddd6fe 0%, #a78bfa 50%, #5b21b6 100%)' },
  { rank: 5, name: 'Selina Mohammed', branch: 'South · 03',  api: 396000, sub: 'Eagles Club pacer',             grad: 'radial-gradient(circle at 32% 28%, #99f6e4 0%, #14b8a6 50%, #0e7490 100%)' },
];

const AGENCY_LEVELS = [
  { level: 7, name: 'Executive',          count: 0 },
  { level: 6, name: 'Senior Manager',     count: 0 },
  { level: 5, name: 'Manager',            count: 3 },
  { level: 4, name: 'Senior Associate',   count: 11 },
  { level: 3, name: 'Associate',          count: 22 },
  { level: 2, name: 'Senior Salesperson', count: 26 },
  { level: 1, name: 'Salesperson',        count: 22 },
];

// ─── COVER ────────────────────────────────────────────────────────────────
function AgencyCover() {
  return (
    <div style={{
      width: A4_W, height: A4_H, background: PDF.paperCream,
      color: PDF.ink, fontFamily: SANS,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: PDF.teal }}></div>

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
        }}>Confidential · C-suite</div>
      </div>

      <div style={{ position: 'absolute', top: 174, left: 56, right: 56 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 9, color: PDF.teal, fontWeight: 700, letterSpacing: '0.18em', fontFamily: MONO }}>2026 · YTD</span>
          <div style={{ flex: 1, height: 1, background: PDF.ruleStrong }}></div>
          <span style={{ fontSize: 9, color: PDF.inkMute, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Agency Performance Report</span>
        </div>

        <div style={{
          fontSize: 11, color: PDF.inkMute, letterSpacing: '0.16em',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: 12,
        }}>Tatil Life · Trinidad &amp; Tobago</div>

        <div style={{
          fontSize: 44, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.03em',
          lineHeight: 0.98, fontFamily: SERIF_DISPLAY,
        }}>
          84 agents.<br />
          4 branches.<br />
          TTD&nbsp;12M to&nbsp;close.
        </div>

        <div style={{
          fontSize: 12, color: PDF.inkMute, marginTop: 16, lineHeight: 1.55,
        }}>
          <span style={{ color: PDF.ink, fontWeight: 600 }}>Roshan Bhagaloo</span>
          <span style={{ color: PDF.inkFaint, padding: '0 8px' }}>·</span>
          Sales Manager · National
          <br />
          10 unit managers · 18 agents on MDRT pace · 4 below the company floor
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 110, left: 56, right: 56,
        display: 'flex', alignItems: 'stretch', gap: 14,
      }}>
        <div style={{
          flex: 1, padding: '20px 22px',
          background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 14,
        }}>
          <div style={{
            fontSize: 8.5, color: PDF.teal, fontWeight: 700,
            letterSpacing: '0.18em', fontFamily: MONO, marginBottom: 6,
          }}>AGENCY · YTD SETTLED API</div>
          <div style={{
            fontSize: 40, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.028em',
            lineHeight: 1, fontFamily: SERIF_DISPLAY,
          }}>TTD 24.8M</div>
          <div style={{
            fontSize: 10, color: PDF.inkMute, marginTop: 8, lineHeight: 1.5,
          }}>
            67% of the TTD 36.9M agency goal · TTD 12.1M to close<br />
            <span style={{ color: PDF.inkFaint }}>+19% vs the same period last year</span>
          </div>
        </div>

        <div style={{
          width: 178, padding: '14px 16px',
          background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Donut percent={67} size={140} stroke={12} label="67%" sub="of agency goal" />
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 36, left: 56, right: 56,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        paddingTop: 14, borderTop: `1px solid ${PDF.rule}`,
      }}>
        <div>
          <div style={{ fontSize: 8, color: PDF.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Reporting period</div>
          <div style={{ fontSize: 10, color: PDF.ink, fontWeight: 600 }}>01 Jan — 25 Nov 2026</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, color: PDF.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Issued</div>
          <div style={{ fontSize: 10, color: PDF.ink, fontWeight: 600 }}>26 November 2026</div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE 2 — Agency totals + Branch leaderboard ─────────────────────────
function AgencyPage2() {
  const maxApi = Math.max(...AGENCY_BRANCHES.map(b => b.api));
  return (
    <PdfPage runningHeader pageNumber={2} totalPages={4} agentName="National Agency">
      <div style={{ padding: `20px ${PAD}px 0` }}>
        <SectionMark n="01" title="The agency, in numbers" subtitle="Year-to-date totals across 3 branches, 9 units, 84 agents." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {[
            { eyebrow: 'API',          value: '24.8M', sub: '+19% LY' },
            { eyebrow: 'APPS',         value: '1,847', sub: '22/agent' },
            { eyebrow: 'AGENTS',       value: '84',    sub: '6 hires YTD' },
            { eyebrow: 'BRANCHES',     value: '4',     sub: '10 units' },
            { eyebrow: 'MDRT PACE',    value: '18',    sub: '21% of force' },
            { eyebrow: 'PERSISTENCY',  value: '87%',   sub: '+1pp vs LY' },
          ].map(t => (
            <div key={t.eyebrow} style={{
              padding: '10px 11px',
              background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 10,
            }}>
              <div style={{ fontSize: 7.5, color: PDF.teal, fontWeight: 700, letterSpacing: '0.12em', fontFamily: MONO, marginBottom: 5 }}>{t.eyebrow}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.02em', lineHeight: 1.05, fontFamily: SERIF_DISPLAY }}>{t.value}</div>
              <div style={{ fontSize: 8, color: PDF.inkMute, marginTop: 3 }}>{t.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: `20px ${PAD}px 0` }}>
        <SectionMark n="02" title="Branch leaderboard" subtitle="Ranked by YTD settled API. Bars scale to the leading branch; donut shows progress to each branch's goal." />

        {AGENCY_BRANCHES.map((b, i, arr) => (
          <div key={b.name} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 0',
            borderBottom: i < arr.length - 1 ? `1px solid ${PDF.rule}` : 'none',
          }}>
            <div style={{ width: 22 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: b.rank === 1 ? 'radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 50%, #b45309 100%)'
                           : b.rank === 2 ? 'radial-gradient(circle at 32% 28%, #f1f5f9 0%, #94a3b8 50%, #475569 100%)'
                           : b.rank === 3 ? 'radial-gradient(circle at 32% 28%, #fed7aa 0%, #c08d6b 50%, #92400e 100%)'
                           : PDF.paperPanel,
                color: b.rank <= 3 ? 'white' : PDF.inkMute, fontSize: 9, fontWeight: 800, letterSpacing: '-0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: b.rank <= 3 ? 'inset 0 -1px 2px rgba(0,0,0,0.18), inset 0 1px 2px rgba(255,255,255,0.4)' : 'none',
                border: b.rank <= 3 ? 'none' : `1px solid ${PDF.ruleStrong}`,
              }}>{b.rank}</div>
            </div>
            <div style={{ width: 130 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.012em' }}>{b.name}</div>
              <div style={{ fontSize: 8.5, color: PDF.inkFaint, marginTop: 1, fontFamily: MONO }}>BM · {b.mgr}</div>
            </div>
            <div style={{ width: 64, textAlign: 'right' }}>
              <div style={{ fontSize: 8.5, color: PDF.inkMute }}>Agents</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO }}>{b.agents}</div>
              <div style={{ fontSize: 8, color: PDF.inkFaint, fontFamily: MONO, marginTop: 2 }}>{b.units} units</div>
            </div>
            <div style={{ flex: 1, paddingLeft: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ fontSize: 9, color: PDF.inkMute }}>Settled API</div>
                <div style={{ fontSize: 10, color: PDF.ink, fontWeight: 700, fontFamily: MONO }}>TTD {(b.api / 1000000).toFixed(2)}M</div>
              </div>
              <RosterBar value={b.api} max={maxApi} />
              <div style={{ fontSize: 8, color: PDF.inkFaint, marginTop: 4 }}>{b.pct}% of branch goal &middot; TTD {(b.goal / 1000000).toFixed(1)}M target</div>
            </div>
            <div style={{ width: 60, textAlign: 'right' }}>
              <div style={{ fontSize: 8.5, color: PDF.inkMute }}>MDRT</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: PDF.gold }}>{b.mdrt}</div>
              <div style={{ fontSize: 8, color: PDF.inkFaint, fontFamily: MONO, marginTop: 2 }}>{b.pers}% pers.</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="03" title="Agency progress to goal" />

        <div style={{ position: 'relative', height: 28 }}>
          <div style={{ position: 'absolute', inset: 0, background: PDF.rule, borderRadius: 6 }}></div>
          <div style={{ position: 'absolute', left: 0, top: 0, width: '67%', height: 28, background: PDF.teal, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}></div>
          {[
            { x: 58, color: PDF.warning },
          ].map((m, i) => (
            <div key={i} style={{ position: 'absolute', left: `${m.x}%`, top: -3, bottom: -3, width: 1.5, background: m.color }}></div>
          ))}
        </div>
        <div style={{ position: 'relative', height: 22, marginTop: 4 }}>
          {[
            { x: 58,  label: 'Pace · TTD 21.4M', color: PDF.warning },
            { x: 100, label: 'Goal · TTD 36.9M', color: PDF.success, right: true },
          ].map((m, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${m.x}%`, top: 0,
              transform: m.right ? 'translateX(-100%)' : 'translateX(-50%)',
              textAlign: m.right ? 'right' : 'center',
            }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.08em', color: m.color, textTransform: 'uppercase', fontFamily: MONO }}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 18,
          padding: '12px 14px', background: PDF.paperPanel,
          borderRadius: 10, border: `1px solid ${PDF.rule}`,
        }}>
          <div style={{ fontSize: 9, color: PDF.ink }}>
            <span style={{ color: PDF.teal, fontWeight: 700 }}>TTD 24.8M</span> achieved &middot; <span style={{ color: PDF.inkFaint }}>67% of goal &middot; 9pp ahead of pace</span>
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

// ─── PAGE 3 — Top performers + Career level distribution ─────────────────
function AgencyPage3() {
  const maxLevel = Math.max(...AGENCY_LEVELS.map(l => l.count));
  return (
    <PdfPage runningHeader pageNumber={3} totalPages={4} agentName="National Agency">
      <div style={{ padding: `20px ${PAD}px 0` }}>
        <SectionMark n="04" title="Top performers across the agency" subtitle="The 5 highest YTD producers, regardless of branch. Hand-pick from this list for company-wide recognition." />

        {AGENCY_TOPS.map((p, i, arr) => (
          <div key={p.name} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '10px 0',
            borderBottom: i < arr.length - 1 ? `1px solid ${PDF.rule}` : 'none',
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: p.grad, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, letterSpacing: '-0.04em',
              fontFamily: SERIF_DISPLAY,
              boxShadow: 'inset 0 -1.5px 3px rgba(0,0,0,0.18), inset 0 1.5px 3px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.06)',
              flexShrink: 0,
            }}>{p.rank}</div>
            <div style={{ width: 150 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.012em' }}>{p.name}</div>
              <div style={{ fontSize: 8.5, color: PDF.inkFaint, fontFamily: MONO, marginTop: 1 }}>{p.branch}</div>
            </div>
            <div style={{ flex: 1, fontSize: 9.5, color: PDF.inkMute, lineHeight: 1.4 }}>{p.sub}</div>
            <div style={{
              fontSize: 17, fontWeight: 700, color: PDF.ink, fontFamily: SERIF_DISPLAY,
              letterSpacing: '-0.022em', lineHeight: 1,
            }}>TTD {(p.api / 1000).toFixed(0)}k</div>
          </div>
        ))}
      </div>

      <div style={{ padding: `22px ${PAD}px 0` }}>
        <SectionMark n="05" title="Talent pipeline" subtitle="Career level distribution across the 84-agent force. Watch the L2 cohort — that's where most of next year's L3 promotions come from." />

        {/* Horizontal bar per level */}
        {AGENCY_LEVELS.map((lv, i) => (
          <div key={lv.level} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 0',
          }}>
            <div style={{ width: 24, fontSize: 9.5, fontFamily: MONO, color: PDF.inkMute, fontWeight: 700, textAlign: 'right' }}>L{lv.level}</div>
            <div style={{ width: 130, fontSize: 10, color: PDF.ink, fontWeight: 600 }}>{lv.name}</div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, background: PDF.paperPanel, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  width: `${(lv.count / maxLevel) * 100}%`,
                  height: 12,
                  background: lv.level >= 5 ? PDF.gold : lv.level >= 3 ? PDF.teal : lv.level >= 1 ? PDF.tealMid : PDF.rule,
                  borderRadius: 4,
                  minWidth: lv.count > 0 ? 2 : 0,
                }}></div>
              </div>
            </div>
            <div style={{ width: 30, textAlign: 'right', fontSize: 11, fontWeight: 700, fontFamily: MONO, color: lv.count === 0 ? PDF.inkFaint : PDF.ink }}>{lv.count}</div>
          </div>
        ))}

        <div style={{
          marginTop: 14, padding: '12px 14px',
          background: PDF.paperPanel, borderRadius: 10, border: `1px solid ${PDF.rule}`,
        }}>
          <div style={{ fontSize: 9.5, color: PDF.ink, lineHeight: 1.55 }}>
            <span style={{ color: PDF.gold, fontWeight: 700 }}>3 agents</span> at Manager level — the leadership bench.
            <span style={{ color: PDF.inkFaint }}> 17% of the force is L4+, against a Tatil Life target of 20%.</span>
            <br />
            <span style={{ color: PDF.teal, fontWeight: 700 }}>26 agents</span> at L2 are 1–2 quarters of momentum away from L3.
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

// ─── PAGE 4 — Compliance + Risk + Strategic focus ────────────────────────
function AgencyPage4() {
  return (
    <PdfPage runningHeader pageNumber={4} totalPages={4} agentName="National Agency">
      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="06" title="Agency-wide compliance" subtitle="On-time weekly submission rate. 91% means 76 of 84 agents submitted ≥40 of the 47 closed weeks this year." />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 24,
          padding: '14px 18px', background: PDF.paperCream,
          border: `1px solid ${PDF.rule}`, borderRadius: 12,
        }}>
          <Donut percent={91} size={92} stroke={8} label="91%" sub="on time" />
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Submitted',  value: '76 / 84', color: PDF.success },
              { label: 'Late',       value: '5',       color: PDF.warning },
              { label: 'Missed',     value: '3',       color: PDF.danger  },
              { label: 'Best branch',value: 'North',   color: PDF.teal, sub: '94%' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 8, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: SERIF_DISPLAY, letterSpacing: '-0.022em', marginTop: 4 }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: 8.5, color: PDF.inkMute, fontFamily: MONO, marginTop: 2 }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="07" title="Pipeline health" subtitle="Counts that matter for next quarter's planning." />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { label: 'MDRT pacers',         value: '18', sub: '21% of force · target 25%',   color: PDF.gold,    bg: PDF.goldTint    },
            { label: 'Below company floor', value: '4',  sub: 'Spread across 3 branches',     color: PDF.danger,  bg: PDF.dangerTint  },
            { label: 'Persistency < 80%',   value: '6',  sub: 'Recovery plan needed',         color: PDF.warning, bg: PDF.warningTint },
          ].map(p => (
            <div key={p.label} style={{
              padding: '14px 14px', background: p.bg,
              border: `1px solid ${p.color}33`, borderRadius: 10,
            }}>
              <div style={{ fontSize: 8.5, color: p.color, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: MONO }}>{p.label}</div>
              <div style={{
                fontSize: 26, fontWeight: 700, color: p.color,
                letterSpacing: '-0.022em', fontFamily: SERIF_DISPLAY, marginTop: 4, lineHeight: 1,
              }}>{p.value}</div>
              <div style={{ fontSize: 9, color: PDF.inkMute, marginTop: 6, lineHeight: 1.4 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: `12px ${PAD}px 0` }}>
        <div style={{
          padding: '14px 18px',
          background: PDF.teal,
          borderRadius: 12,
          color: PDF.paper,
        }}>
          <div style={{
            fontSize: 8.5, color: 'rgba(255,255,255,0.75)', fontWeight: 700,
            letterSpacing: '0.16em', fontFamily: MONO, marginBottom: 6,
          }}>STRATEGIC FOCUS &middot; Q4 2026</div>
          <div style={{
            fontSize: 14, fontWeight: 700, color: PDF.paper,
            letterSpacing: '-0.012em', lineHeight: 1.3, fontFamily: SERIF_DISPLAY,
          }}>
            TTD 12.1M to close the year on goal. Two levers carry most of it.
          </div>
          <div style={{ marginTop: 8, fontSize: 9.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.55 }}>
            <span style={{ color: PDF.paper, fontWeight: 700 }}>1. Activate the L2 cohort.</span> 26 agents are one strong quarter from L3 &mdash;
            an Eagles Club push lifts the band and the API together.
            <br />
            <span style={{ color: PDF.paper, fontWeight: 700 }}>2. Recover the 10 at-risk.</span> 4 below floor + 6 with persistency under 80% &mdash;
            assign each a 1-on-1 with their UM in week 1 of Q4.
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

Object.assign(window, {
  AGENCY_BRANCHES, AGENCY_TOPS, AGENCY_LEVELS,
  AgencyCover, AgencyPage2, AgencyPage3, AgencyPage4,
});
