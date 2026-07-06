// Unit Performance Report — scoped to a single Unit Manager's 10 agents.
// Same design system as Agent + Branch reports. Mock data below.

const UNIT_AGENTS = [
  { rank: 1,  name: 'Marsha Singh',     role: 'UM · Producer', weeks: 38, ytdApi: 487000, apps: 41, dialCt: 24, ctF2F: 53, f2fFFI: 51, ffiCI: 64, ciApp: 79, pers: 88, flag: null },
  { rank: 2,  name: 'Riaz Khan',        role: 'Producer',      weeks: 42, ytdApi: 358000, apps: 30, dialCt: 22, ctF2F: 48, f2fFFI: 47, ffiCI: 61, ciApp: 76, pers: 90, flag: null },
  { rank: 3,  name: 'Carla Joseph',     role: 'Producer',      weeks: 39, ytdApi: 332000, apps: 28, dialCt: 26, ctF2F: 54, f2fFFI: 50, ffiCI: 58, ciApp: 71, pers: 89, flag: null },
  { rank: 4,  name: 'Nisha Patel',      role: 'Producer',      weeks: 41, ytdApi: 312000, apps: 27, dialCt: 21, ctF2F: 44, f2fFFI: 52, ffiCI: 63, ciApp: 74, pers: 87, flag: null },
  { rank: 5,  name: 'Aaron Holder',     role: 'Producer',      weeks: 37, ytdApi: 287000, apps: 26, dialCt: 19, ctF2F: 38, f2fFFI: 46, ffiCI: 55, ciApp: 68, pers: 85, flag: 'contactF2F' },
  { rank: 6,  name: 'Sandhya Singh',    role: 'Producer',      weeks: 36, ytdApi: 268000, apps: 24, dialCt: 23, ctF2F: 51, f2fFFI: 49, ffiCI: 62, ciApp: 70, pers: 86, flag: null },
  { rank: 7,  name: 'Avinash Maharaj',  role: 'Producer',      weeks: 36, ytdApi: 254000, apps: 22, dialCt: 18, ctF2F: 41, f2fFFI: 49, ffiCI: 57, ciApp: 65, pers: 84, flag: 'dialContact' },
  { rank: 8,  name: 'Tariq Beharry',    role: 'Producer',      weeks: 34, ytdApi: 234000, apps: 21, dialCt: 20, ctF2F: 47, f2fFFI: 44, ffiCI: 60, ciApp: 66, pers: 82, flag: 'f2fFFI' },
  { rank: 9,  name: 'Ravi Lochan',      role: 'Producer',      weeks: 30, ytdApi: 178000, apps: 16, dialCt: 17, ctF2F: 39, f2fFFI: 42, ffiCI: 54, ciApp: 62, pers: 80, flag: 'compliance' },
  { rank: 10, name: 'Devin Lewis',      role: 'Producer',      weeks: 32, ytdApi: 122000, apps: 12, dialCt: 16, ctF2F: 36, f2fFFI: 38, ffiCI: 52, ciApp: 62, pers: 76, flag: 'floor' },
];

const UNIT_TOTALS = {
  api:        2832000,
  goal:       4000000,
  apps:       247,
  agents:     10,
  compliance: 90,
  persistency:85,
};

// ─── COVER ────────────────────────────────────────────────────────────────
function UnitCover() {
  return (
    <div style={{
      width: A4_W, height: A4_H, background: PDF.paperCream,
      color: PDF.ink, fontFamily: SANS,
      position: 'relative', overflow: 'hidden',
    }}>
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

      <div style={{ position: 'absolute', top: 180, left: 56, right: 56 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
          <span style={{ fontSize: 9, color: PDF.teal, fontWeight: 700, letterSpacing: '0.18em', fontFamily: MONO }}>2026 · YTD</span>
          <div style={{ flex: 1, height: 1, background: PDF.ruleStrong }}></div>
          <span style={{ fontSize: 9, color: PDF.inkMute, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Unit Performance Report</span>
        </div>

        <div style={{
          fontSize: 11, color: PDF.inkMute, letterSpacing: '0.16em',
          textTransform: 'uppercase', fontWeight: 600, marginBottom: 14,
        }}>South Branch · Unit 02</div>

        <div style={{
          fontSize: 48, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.03em',
          lineHeight: 0.98, fontFamily: SERIF_DISPLAY,
        }}>
          10 agents.<br />
          One unit to&nbsp;coach.
        </div>

        <div style={{
          fontSize: 12, color: PDF.inkMute, marginTop: 18, lineHeight: 1.55,
        }}>
          <span style={{ color: PDF.ink, fontWeight: 600 }}>Marsha Singh</span>
          <span style={{ color: PDF.inkFaint, padding: '0 8px' }}>·</span>
          Unit Manager &amp; Producing Agent
          <br />
          Reports to Trevor Ramcharan · South Branch
        </div>
      </div>

      {/* Hero stat */}
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
          }}>UNIT · YTD SETTLED API</div>
          <div style={{
            fontSize: 36, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.028em',
            lineHeight: 1, fontFamily: SERIF_DISPLAY,
          }}>TTD 2.83M</div>
          <div style={{
            fontSize: 10, color: PDF.inkMute, marginTop: 8, lineHeight: 1.5,
          }}>
            71% of the TTD 4.0M unit goal · Avg TTD 283k per agent<br />
            <span style={{ color: PDF.inkFaint }}>TTD 1.17M remaining · 5 weeks to year-end</span>
          </div>
        </div>

        <div style={{
          width: 178, padding: '14px 16px',
          background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Donut percent={71} size={140} stroke={12} label="71%" sub="of unit goal" />
        </div>
      </div>

      {/* Footer meta */}
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

// ─── PAGE 2 — Unit snapshot + agent roster ────────────────────────────────
function UnitPage2() {
  const maxApi = Math.max(...UNIT_AGENTS.map(a => a.ytdApi));
  return (
    <PdfPage runningHeader pageNumber={2} totalPages={4} agentName="South · 02">
      <div style={{ padding: `20px ${PAD}px 0` }}>
        <SectionMark n="01" title="The unit, in numbers" subtitle="Year-to-date headline figures across all 10 agents in the unit." />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          {[
            { eyebrow: 'YTD API · SETTLED',  value: 'TTD 2.83M', sub: '71% of goal' },
            { eyebrow: 'APPLICATIONS',        value: '247',       sub: '24.7 avg per agent' },
            { eyebrow: 'COMPLIANCE',          value: '90%',       sub: '9 of 10 on time' },
            { eyebrow: 'PERSISTENCY',         value: '85%',       sub: '5pp above floor' },
          ].map(t => (
            <div key={t.eyebrow} style={{
              padding: '12px 14px',
              background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 10,
            }}>
              <div style={{ fontSize: 8, color: PDF.teal, fontWeight: 700, letterSpacing: '0.14em', fontFamily: MONO, marginBottom: 6 }}>{t.eyebrow}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.02em', lineHeight: 1.05, fontFamily: SERIF_DISPLAY }}>{t.value}</div>
              <div style={{ fontSize: 8.5, color: PDF.inkMute, marginTop: 4 }}>{t.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="02" title="Agent roster" subtitle="All 10 agents, ranked by YTD settled API. Coloured bars scale to the top producer." />

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingBottom: 6, marginBottom: 4,
          borderBottom: `1px solid ${PDF.ruleStrong}`,
        }}>
          <div style={{ width: 18, fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>#</div>
          <div style={{ width: 130, fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>AGENT · ROLE</div>
          <div style={{ width: 30, textAlign: 'right', fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>WK</div>
          <div style={{ flex: 1, fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>YTD API · TTD</div>
          <div style={{ width: 28, textAlign: 'right', fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>APPS</div>
          <div style={{ width: 38, textAlign: 'right', fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>CI→APP</div>
          <div style={{ width: 38, textAlign: 'right', fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>PERS.</div>
          <div style={{ width: 64, textAlign: 'right', fontSize: 7.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>STATUS</div>
        </div>

        {UNIT_AGENTS.map((a, i) => {
          const persColor = a.pers >= 90 ? PDF.success : a.pers >= 80 ? PDF.ink : PDF.warning;
          const flagPill = a.flag === 'floor'
            ? <Pill color={PDF.danger}  bg={PDF.dangerTint}>Below floor</Pill>
            : a.flag === 'compliance'
              ? <Pill color={PDF.warning} bg={PDF.warningTint}>Compliance</Pill>
              : a.flag === 'contactF2F' || a.flag === 'dialContact' || a.flag === 'f2fFFI'
                ? <Pill color={PDF.warning} bg={PDF.warningTint}>Coach</Pill>
                : <Pill color={PDF.success} bg={PDF.successTint}>On track</Pill>;

          return (
            <div key={a.name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 0',
              borderBottom: i < UNIT_AGENTS.length - 1 ? `1px solid ${PDF.rule}` : 'none',
            }}>
              <div style={{ width: 18, fontSize: 9.5, color: PDF.inkFaint, fontFamily: MONO, fontWeight: 600 }}>{a.rank}</div>
              <div style={{ width: 130 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.005em' }}>{a.name}</div>
                <div style={{ fontSize: 8.5, color: a.role === 'UM · Producer' ? PDF.teal : PDF.inkFaint, marginTop: 1, fontFamily: MONO, fontWeight: a.role === 'UM · Producer' ? 700 : 400 }}>{a.role}</div>
              </div>
              <div style={{ width: 30, textAlign: 'right', fontSize: 9.5, fontFamily: MONO, color: PDF.inkMute }}>{a.weeks}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: PDF.ink, fontFamily: MONO }}>{(a.ytdApi / 1000).toFixed(0)}k</div>
                  <div style={{ fontSize: 8, color: PDF.inkFaint, fontFamily: MONO }}>{Math.round(a.ytdApi / maxApi * 100)}%</div>
                </div>
                <RosterBar value={a.ytdApi} max={maxApi} color={a.flag === 'floor' ? PDF.warning : PDF.teal} />
              </div>
              <div style={{ width: 28, textAlign: 'right', fontSize: 9.5, fontFamily: MONO, color: PDF.ink }}>{a.apps}</div>
              <div style={{ width: 38, textAlign: 'right', fontSize: 9.5, fontFamily: MONO, color: a.ciApp >= 70 ? PDF.success : PDF.inkMute }}>{a.ciApp}%</div>
              <div style={{ width: 38, textAlign: 'right', fontSize: 9.5, fontFamily: MONO, color: persColor }}>{a.pers}%</div>
              <div style={{ width: 64, textAlign: 'right' }}>{flagPill}</div>
            </div>
          );
        })}
      </div>
    </PdfPage>
  );
}

// ─── PAGE 3 — Coaching focus + company-floor scorecard ────────────────────
// Canonical taxonomy (meeting-v2-shared.jsx): agents are banded against the
// eight weekly company-floor activity standards, in fixed order. Coaching
// ratios use the live AgentReportView names (Approach→FFI / FFI→CI / CI→App /
// Closing) — not the retired Dial→Contact→F2F benchmark chain.
function UnitPage3() {
  // Agents flagged where this week's activity falls under a company floor.
  const coachingFocus = [
    {
      name: 'Aaron Holder', flag: 'Appointments',
      thisWeek: 16, floor: 20,
      action: 'Aaron has the call and contact volume but loses momentum at the appointment ask. Run two role-plays on the booking script — he is two appointments a week off the floor.',
    },
    {
      name: 'Tariq Beharry', flag: 'Fact Finds',
      thisWeek: 7, floor: 10,
      action: 'Tariq is meeting people but not converting to fact-finds. Walk through prospect qualification before each F2F — his Approach → FFI ratio trails the unit.',
    },
    {
      name: 'Avinash Maharaj', flag: 'Contacts Made',
      thisWeek: 34, floor: 40,
      action: 'Dial volume is steady; the contact rate trails. Shift calls into the 10am–noon and 3pm–5pm peak windows to clear the Contacts Made floor.',
    },
  ];

  // Unit weekly averages against the eight company floors (fixed order).
  const unitFloors = [
    { label: 'Calls Made',         avg: 58,  floor: 60 },
    { label: 'Contacts Made',      avg: 41,  floor: 40 },
    { label: 'Appointments',       avg: 19,  floor: 20 },
    { label: 'Interviews Kept',    avg: 15,  floor: 15 },
    { label: 'Fact Finds',         avg: 9,   floor: 10 },
    { label: 'Closing Interviews', avg: 10,  floor: 10 },
    { label: 'Clients Sold',       avg: 1,   floor: 1 },
    { label: 'Referrals',          avg: 104, floor: 100 },
  ];

  // Canonical coaching ratios (unit averages) — same labels as the live view.
  const unitRatios = [
    { label: 'Approach → FFI', value: '47%' },
    { label: 'FFI → CI',       value: '58%' },
    { label: 'CI → App',       value: '71%' },
    { label: 'Closing ratio',  value: '68%' },
  ];

  return (
    <PdfPage runningHeader pageNumber={3} totalPages={4} agentName="South · 02">
      <div style={{ padding: `20px ${PAD}px 0` }}>
        <SectionMark n="03" title="Coaching focus" subtitle="Agents below a company-floor activity standard this week. Tackle these in your next 1-on-1." />

        {coachingFocus.map((c, i, arr) => {
          const pct = Math.round((c.thisWeek / c.floor) * 100);
          return (
            <div key={c.name} style={{
              display: 'flex', gap: 16, alignItems: 'flex-start',
              padding: '14px 16px',
              background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 12,
              marginBottom: i < arr.length - 1 ? 8 : 0,
            }}>
              {/* Left — agent + floor gap */}
              <div style={{ width: 150, flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: PDF.warning, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: MONO }}>{c.flag}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.012em', marginTop: 2, fontFamily: SERIF_DISPLAY }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 8, color: PDF.inkFaint, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>This week</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: PDF.danger, fontFamily: MONO }}>{c.thisWeek}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 8, color: PDF.inkFaint, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Floor</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: PDF.inkMute, fontFamily: MONO }}>{c.floor}</div>
                  </div>
                </div>
                <div style={{ marginTop: 9, height: 4, background: PDF.paperPanel, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: 4, background: PDF.warning, borderRadius: 999 }}></div>
                </div>
              </div>

              {/* Right — recommended action */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8.5, color: PDF.teal, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: MONO, marginBottom: 5 }}>
                  Recommended action
                </div>
                <div style={{ fontSize: 10.5, color: PDF.ink, lineHeight: 1.5 }}>
                  {c.action}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="04" title="Unit company-floor scorecard" subtitle="Unit weekly average per agent against each company-floor standard, in fixed order, plus the coaching ratios." />

        <div style={{ background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', background: PDF.teal, padding: '8px 12px' }}>
            <div style={{ flex: 2, color: PDF.paper, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>ACTIVITY STANDARD</div>
            <div style={{ flex: 1, textAlign: 'right', color: PDF.paper, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>UNIT AVG</div>
            <div style={{ flex: 1, textAlign: 'right', color: PDF.paper, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>FLOOR</div>
            <div style={{ width: 80, textAlign: 'right', color: PDF.paper, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>STATUS</div>
          </div>
          {unitFloors.map((r, i) => {
            const on = r.avg >= r.floor;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', padding: '7px 12px',
                borderBottom: `1px solid ${PDF.rule}`,
                background: i % 2 === 0 ? PDF.paperPanel : PDF.paper,
              }}>
                <div style={{ flex: 2, fontSize: 10, fontWeight: 700, color: PDF.ink }}>{r.label}</div>
                <div style={{ flex: 1, textAlign: 'right', fontSize: 10, fontWeight: 700, fontFamily: MONO, color: on ? PDF.success : PDF.warning }}>{r.avg}</div>
                <div style={{ flex: 1, textAlign: 'right', fontSize: 10, fontFamily: MONO, color: PDF.inkMute }}>{r.floor}</div>
                <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
                  <Pill color={on ? PDF.success : PDF.warning} bg={on ? PDF.successTint : PDF.warningTint}>
                    {on ? 'At floor' : 'Below'}
                  </Pill>
                </div>
              </div>
            );
          })}
          {/* Coaching ratios strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 12px', background: PDF.paperCream }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: PDF.inkMute, letterSpacing: '0.1em', fontFamily: MONO, textTransform: 'uppercase' }}>Coaching ratios</div>
            {unitRatios.map((rt) => (
              <div key={rt.label} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontSize: 9, color: PDF.inkMute }}>{rt.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: PDF.teal, fontFamily: MONO }}>{rt.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

// ─── PAGE 4 — Compliance + Top + At-risk + Focus ─────────────────────────
function UnitPage4() {
  return (
    <PdfPage runningHeader pageNumber={4} totalPages={4} agentName="South · 02">
      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="05" title="Weekly compliance" subtitle="On-time submission rate this year. 90% means 9 of 10 agents submitted ≥38 of the 47 closed weeks." />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 24,
          padding: '14px 18px', background: PDF.paperCream,
          border: `1px solid ${PDF.rule}`, borderRadius: 12,
        }}>
          <Donut percent={90} size={92} stroke={8} label="90%" sub="on time" />
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { label: 'On time this week', value: '9 / 10', color: PDF.success },
              { label: 'Late this week',    value: '0',      color: PDF.warning },
              { label: 'Missed this week',  value: '1',      color: PDF.danger  },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 8.5, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: SERIF_DISPLAY, letterSpacing: '-0.022em', marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: `16px ${PAD}px 0` }}>
        <SectionMark n="06" title="Top performers in your unit" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { rank: 1, name: 'Marsha Singh',  api: 487000, sub: 'On MDRT pace · UM + producer', grad: 'radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 50%, #b45309 100%)' },
            { rank: 2, name: 'Riaz Khan',     api: 358000, sub: '42 weeks · 90% persistency', grad: 'radial-gradient(circle at 32% 28%, #f1f5f9 0%, #94a3b8 50%, #475569 100%)' },
            { rank: 3, name: 'Carla Joseph',  api: 332000, sub: '28 apps · 71% CI→App',         grad: 'radial-gradient(circle at 32% 28%, #fed7aa 0%, #c08d6b 50%, #92400e 100%)' },
          ].map(p => (
            <div key={p.name} style={{
              padding: '14px 14px 12px',
              background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 12,
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
              <div style={{
                fontSize: 18, fontWeight: 700, color: PDF.ink, marginTop: 8,
                letterSpacing: '-0.018em', fontFamily: SERIF_DISPLAY, lineHeight: 1,
              }}>TTD {(p.api / 1000).toFixed(0)}k</div>
              <div style={{ fontSize: 9, color: PDF.inkMute, marginTop: 6, lineHeight: 1.4 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: `14px ${PAD}px 0` }}>
        <SectionMark n="07" title="Agents needing attention" subtitle="Flagged by persistency below 80%, YTD API below the company floor, or 3+ missed deadlines this quarter." />

        {[
          { name: 'Devin Lewis',  flag: 'Below floor',  detail: 'TTD 122k YTD · TTD 128k below floor', color: PDF.danger,  bg: PDF.dangerTint },
          { name: 'Ravi Lochan',  flag: 'Compliance',   detail: '7 missed weeks YTD (30/37 submitted)',     color: PDF.warning, bg: PDF.warningTint },
        ].map((r, i, arr) => (
          <div key={r.name} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '8px 0',
            borderBottom: i < arr.length - 1 ? `1px solid ${PDF.rule}` : 'none',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }}></div>
            <div style={{ width: 150 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.01em' }}>{r.name}</div>
            </div>
            <div style={{ flex: 1, fontSize: 9.5, color: PDF.inkMute, lineHeight: 1.4 }}>{r.detail}</div>
            <Pill color={r.color} bg={r.bg}>{r.flag}</Pill>
          </div>
        ))}
      </div>

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
          }}>UNIT FOCUS · Q4 2026</div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: PDF.paper,
            letterSpacing: '-0.012em', lineHeight: 1.3, fontFamily: SERIF_DISPLAY,
          }}>
            Three agents sit one or two activities a week off the company floor &mdash; close that gap on Appointments and Fact Finds and the unit clears goal.
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

Object.assign(window, { UNIT_AGENTS, UNIT_TOTALS, UnitCover, UnitPage2, UnitPage3, UnitPage4 });
