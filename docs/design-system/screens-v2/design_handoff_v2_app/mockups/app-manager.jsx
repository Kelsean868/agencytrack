// Manager-facing screens — Manager Dashboard + MasterSheet.

// ──────────────────────────────────────────────────────────────────────────
// MANAGER DASHBOARD
// ──────────────────────────────────────────────────────────────────────────
function ManagerDashboard({ t }) {
  return (
    <AppShell t={t} active="home" title="Branch Dashboard" subtitle="South Branch · Trevor Ramcharan · Week 48">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Header line */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY }}>
              Good morning, Trevor.
            </div>
            <div style={{ fontSize: 13, color: t.inkMute, marginTop: 4 }}>
              3 agents need attention before tomorrow's stand-up.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              padding: '8px 14px', background: t.surface, border: `1px solid ${t.rule}`,
              borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: t.ink,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <IconClock size={13} color={t.inkMute} /> Week 48 · 24 Nov
              <IconChevD size={12} color={t.inkMute} stroke={2.4} />
            </div>
            <div style={{
              padding: '8px 14px', background: t.teal, color: t.surface,
              borderRadius: 9, fontSize: 12.5, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: `0 2px 6px ${t.teal}44`,
            }}>
              <IconPlus size={13} color={t.surface} stroke={2.4} /> Start Meeting
            </div>
          </div>
        </div>

        {/* Needs attention — exception-first row */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <Eyebrow t={t} color={t.warning}>★ Needs attention · 3</Eyebrow>
            <div style={{ fontSize: 11, color: t.inkMute }}>Items resolve when the underlying state changes</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { kind: 'Below floor',  agent: 'Devin Lewis',  detail: 'TTD 122k YTD · TTD 128k below', color: t.danger, bg: t.dangerTint, Icon: IconAlert },
              { kind: 'Missed WAR',   agent: 'Jamal Khan',   detail: '3 missed this quarter',         color: t.warning, bg: t.warningTint, Icon: IconClock },
              { kind: 'Persistency',  agent: 'Priya Naidu',  detail: '72% · 8pp below threshold',     color: t.warning, bg: t.warningTint, Icon: IconRepeat },
            ].map((c, i) => (
              <div key={i} style={{
                padding: '14px 16px', background: c.bg, borderRadius: 11,
                border: `1px solid ${c.color}33`,
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
                <div className="a-breathe" style={{
                  width: 32, height: 32, borderRadius: '50%', background: t.surface,
                  border: `1px solid ${c.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <c.Icon size={15} color={c.color} stroke={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: c.color, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{c.kind.toUpperCase()}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em', marginTop: 3 }}>{c.agent}</div>
                  <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 3, lineHeight: 1.4 }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Branch KPI strip — compact scorecards (no circular gauges) */}
        <div>
          <Eyebrow t={t}>This year · branch</Eyebrow>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Scorecard t={t} eyebrow="YTD SETTLED API"  value="TTD 8.42M" sub="70% of TTD 12M goal" accent={t.teal} progress={70} />
            <Scorecard t={t} eyebrow="APPLICATIONS"     value="612"        sub="+22% vs LY"        accent={t.gold} />
            <Scorecard t={t} eyebrow="ACTIVE AGENTS"    value="28"         sub="6 on MDRT pace"    accent={t.teal} />
            <Scorecard t={t} eyebrow="PERSISTENCY"      value="89%"        sub="4pp above floor"   accent={t.success} />
            <Scorecard t={t} eyebrow="COMPLIANCE · WK"  value="92%"        sub="26 of 28"          accent={t.success} />
          </div>
        </div>

        {/* Two-column lower */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, flex: 1, minHeight: 0 }}>

          {/* Left — Master Sheet preview */}
          <div style={{
            padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`,
            borderRadius: 14, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <Eyebrow t={t}>Top performers · this week</Eyebrow>
              <div style={{ fontSize: 11, color: t.teal, fontWeight: 700 }}>Open MasterSheet →</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { rank: 1, name: 'Marsha Singh',     unit: 'S·02', api: 24400, apps: 3 },
                { rank: 2, name: 'Anand Persad',     unit: 'S·01', api: 21800, apps: 3 },
                { rank: 3, name: 'Selina Mohammed',  unit: 'S·03', api: 19200, apps: 2 },
                { rank: 4, name: 'Riaz Khan',        unit: 'S·02', api: 17600, apps: 2 },
                { rank: 5, name: 'Carla Joseph',     unit: 'S·02', api: 16400, apps: 2 },
              ].map((a) => (
                <div key={a.rank} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 10px', borderRadius: 8,
                }}>
                  <div style={{
                    width: 22, fontSize: 11, fontWeight: 700,
                    color: a.rank <= 3 ? t.gold : t.inkFaint,
                    fontFamily: APP_FONT_DISPLAY, textAlign: 'center',
                  }}>{a.rank}</div>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', background: t.tealTint,
                    color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY,
                  }}>{a.name.split(' ').map(s => s[0]).join('')}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{a.name}</div>
                    <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em', marginTop: 1 }}>{a.unit}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{ttd(a.api)}</div>
                    <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.apps} APPS</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Recent activity feed */}
          <div style={{
            padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`,
            borderRadius: 14, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <Eyebrow t={t}>Recent</Eyebrow>
              <div style={{ fontSize: 11, color: t.teal, fontWeight: 700 }}>View all</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { color: t.success,   Icon: IconCheck, text: '5 weekly reports submitted',   sub: 'Mon · S·02 unit complete' },
                { color: t.gold,      Icon: IconMedal, text: 'Marsha Singh hit MDRT pace',   sub: 'TTD 487k YTD' },
                { color: t.warning,   Icon: IconAlert, text: 'Devin Lewis late on Sun report', sub: 'Auto-nudged Sun 9 PM' },
                { color: t.inkAccent, Icon: IconTrophy,text: 'November awards lunch scheduled', sub: 'Fri 28 · 12:30 PM' },
              ].map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: `${a.color}22`, color: a.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <a.Icon size={14} color={a.color} stroke={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{a.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MASTERSHEET
// ──────────────────────────────────────────────────────────────────────────
function MasterSheet({ t }) {
  const agents = [
    { rank: 1, name: 'Marsha Singh',    unit: 'S·02', api: 487000, apps: 41, conv: 79, pers: 88, level: 'L4',  flag: null },
    { rank: 2, name: 'Anand Persad',    unit: 'S·01', api: 442000, apps: 36, conv: 81, pers: 91, level: 'L4',  flag: null },
    { rank: 3, name: 'Selina Mohammed', unit: 'S·03', api: 396000, apps: 38, conv: 71, pers: 87, level: 'L3',  flag: null },
    { rank: 4, name: 'Riaz Khan',       unit: 'S·02', api: 358000, apps: 30, conv: 76, pers: 90, level: 'L3',  flag: null },
    { rank: 5, name: 'Kamla Singh',     unit: 'S·01', api: 312000, apps: 27, conv: 68, pers: 86, level: 'L3',  flag: null },
    { rank: 6, name: 'Trevor Ramnauth', unit: 'S·03', api: 287000, apps: 24, conv: 73, pers: 89, level: 'L3',  flag: null },
    { rank: 7, name: 'Avinash Maharaj', unit: 'S·02', api: 254000, apps: 22, conv: 65, pers: 84, level: 'L2',  flag: null },
    { rank: 8, name: 'Hema Lakhan',     unit: 'S·01', api: 231000, apps: 21, conv: 72, pers: 91, level: 'L2',  flag: null },
    { rank: 9, name: 'Jamal Khan',      unit: 'S·03', api: 198000, apps: 18, conv: 58, pers: 82, level: 'L2',  flag: 'compliance' },
    { rank: 10,name: 'Priya Naidu',     unit: 'S·01', api: 156000, apps: 15, conv: 60, pers: 72, level: 'L1',  flag: 'persistency' },
    { rank: 11,name: 'Devin Lewis',     unit: 'S·02', api: 122000, apps: 12, conv: 62, pers: 76, level: 'L1',  flag: 'floor' },
  ];
  const presets = ['All', 'Production', 'Recruiting', 'Compliance', 'Persistency'];
  const maxApi = agents[0].api;

  const headerCellStyle = {
    padding: '10px 12px', fontSize: 9.5, fontWeight: 700,
    color: t.inkMute, letterSpacing: '0.1em', textTransform: 'uppercase',
    fontFamily: APP_FONT_MONO, textAlign: 'right',
  };

  return (
    <AppShell t={t} active="home" title="Master Sheet" subtitle="South Branch · Week 48 · 28 agents">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Action bar — column presets + exceptions toggle + search + export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
            {presets.map((p, i) => (
              <div key={p} style={{
                padding: '6px 12px', borderRadius: 7,
                fontSize: 12, fontWeight: 700, letterSpacing: '0.005em',
                background: i === 1 ? t.surface : 'transparent',
                color: i === 1 ? t.ink : t.inkMute,
                boxShadow: i === 1 ? `0 1px 2px rgba(0,0,0,0.04)` : 'none',
                border: i === 1 ? `1px solid ${t.rule}` : 'none',
              }}>{p}</div>
            ))}
          </div>

          <div style={{ flex: 1 }}></div>

          {/* Exceptions toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 12px', background: t.warningTint, border: `1px solid ${t.warning}44`,
            borderRadius: 9,
          }}>
            <div style={{
              width: 28, height: 16, background: t.warning, borderRadius: 999, position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: t.surface,
              }}></div>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: t.warning, letterSpacing: '0.04em' }}>Show only exceptions</div>
          </div>

          <div style={{
            padding: '7px 12px', background: t.surface, border: `1px solid ${t.rule}`,
            borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, color: t.inkMute,
            fontSize: 12.5, fontWeight: 600,
          }}>
            <IconFilter size={13} color={t.inkMute} /> Filter
          </div>
          <div style={{
            padding: '7px 12px', background: t.surface, border: `1px solid ${t.rule}`,
            borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, color: t.inkMute,
            fontSize: 12.5, fontWeight: 600,
          }}>
            <IconDownload size={13} color={t.inkMute} /> Export CSV
          </div>
        </div>

        {/* Compact summary scorecards above the table */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Scorecard t={t} eyebrow="TOTAL API · YTD"  value="TTD 8.42M" accent={t.teal} />
          <Scorecard t={t} eyebrow="TOTAL APPS"       value="612"       accent={t.gold} />
          <Scorecard t={t} eyebrow="AVG CONV. RATE"   value="71%"       accent={t.success} />
          <Scorecard t={t} eyebrow="AVG PERSISTENCY"  value="86%"       accent={t.success} />
          <Scorecard t={t} eyebrow="EXCEPTIONS"       value="3"         sub="2 warnings · 1 critical" accent={t.warning} />
        </div>

        {/* Table */}
        <div style={{
          flex: 1, background: t.surface, border: `1px solid ${t.rule}`,
          borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '36px 1.4fr 0.7fr 1fr 0.7fr 0.7fr 0.7fr 0.6fr 1fr',
            borderBottom: `1px solid ${t.ruleStrong}`, background: t.surfaceSoft,
          }}>
            <div style={{ ...headerCellStyle, textAlign: 'center' }}>#</div>
            <div style={{ ...headerCellStyle, textAlign: 'left' }}>AGENT · UNIT</div>
            <div style={headerCellStyle}>WEEKS</div>
            <div style={headerCellStyle}>YTD API · TTD</div>
            <div style={headerCellStyle}>APPS</div>
            <div style={headerCellStyle}>CI→APP</div>
            <div style={headerCellStyle}>PERS.</div>
            <div style={headerCellStyle}>LVL</div>
            <div style={{ ...headerCellStyle, textAlign: 'right', paddingRight: 16 }}>STATUS</div>
          </div>
          {/* Rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {agents.slice(0, 8).map((a, i) => {
              const persColor = a.pers >= 90 ? t.success : a.pers >= 80 ? t.ink : t.warning;
              const flag = a.flag;
              return (
                <div key={a.rank} style={{
                  display: 'grid', gridTemplateColumns: '36px 1.4fr 0.7fr 1fr 0.7fr 0.7fr 0.7fr 0.6fr 1fr',
                  alignItems: 'center', padding: '0',
                  background: i % 2 === 0 ? t.surface : t.surfaceRaised,
                  borderBottom: `1px solid ${t.rule}`,
                  position: 'relative',
                }}>
                  <div style={{
                    padding: '12px 0', textAlign: 'center',
                    fontSize: 12, fontWeight: 700, color: a.rank <= 3 ? t.gold : t.inkFaint,
                    fontFamily: APP_FONT_DISPLAY,
                  }}>{a.rank}</div>
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', background: t.tealTint,
                      color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0,
                    }}>{a.name.split(' ').map(s => s[0]).join('')}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, letterSpacing: '-0.005em' }}>{a.name}</div>
                      <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1, letterSpacing: '0.04em' }}>{a.unit}</div>
                    </div>
                  </div>
                  <div style={{ padding: '12px', textAlign: 'right', fontSize: 12.5, color: t.ink, fontFamily: APP_FONT_MONO }}>{a.apps + 18}</div>
                  <div style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{(a.api / 1000).toFixed(0)}k</div>
                    <div style={{ height: 3, background: t.surfaceMute, borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
                      <div className="a-progress-grow" style={{ width: `${(a.api / maxApi) * 100}%`, height: 3, background: flag === 'floor' ? t.warning : t.teal, borderRadius: 999 }}></div>
                    </div>
                  </div>
                  <div style={{ padding: '12px', textAlign: 'right', fontSize: 12.5, color: t.ink, fontFamily: APP_FONT_MONO }}>{a.apps}</div>
                  <div style={{ padding: '12px', textAlign: 'right', fontSize: 12.5, color: a.conv >= 70 ? t.success : t.inkMute, fontFamily: APP_FONT_MONO, fontWeight: 600 }}>{a.conv}%</div>
                  <div style={{ padding: '12px', textAlign: 'right', fontSize: 12.5, color: persColor, fontFamily: APP_FONT_MONO, fontWeight: 600 }}>{a.pers}%</div>
                  <div style={{ padding: '12px', textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', borderRadius: 5,
                      background: t.surfaceSoft, color: t.inkMute,
                      fontSize: 10, fontWeight: 700, fontFamily: APP_FONT_MONO,
                    }}>{a.level}</span>
                  </div>
                  <div style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {flag === 'floor' ? (
                      <Pill t={t} color={t.danger} bg={t.dangerTint}>Below floor</Pill>
                    ) : flag === 'persistency' ? (
                      <Pill t={t} color={t.warning} bg={t.warningTint}>Pers. ↓</Pill>
                    ) : flag === 'compliance' ? (
                      <Pill t={t} color={t.warning} bg={t.warningTint}>Compliance</Pill>
                    ) : (
                      <Pill t={t} color={t.success} bg={t.successTint}>On track</Pill>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

Object.assign(window, { ManagerDashboard, MasterSheet });
