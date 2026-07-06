// Planner & Scheduler — MANAGER tier: desktop scenes (1280×800).
// Ships its own manager shell (sidebar with RoleSwitcher current="manager")
// reusing Topbar / RoleSwitcher / AmbientBg / AgencyLogo. Reuses the manager
// primitives + data from planner-manager-shared and CounterBar/DayStripCell/
// ActChip from planner-shared.

function MgrDeskSidebar({ t, active = 'planner' }) {
  const groups = [
    { title: null, items: [
      { key: 'home', Icon: IconHome, label: 'Dashboard' },
      { key: 'myplanner', Icon: IconClock, label: 'My Planner' },
      { key: 'planner', Icon: IconUsers, label: 'Team Planner', badge: 'NEW' },
      { key: 'master', Icon: IconGrid, label: 'Master Sheet' },
    ]},
    { title: 'Coaching', items: [
      { key: 'coaching', Icon: IconTarget, label: '1-on-1 Packs' },
      { key: 'escal', Icon: IconArrowR, label: 'Escalations', badge: '3' },
    ]},
    { title: 'Branch', items: [
      { key: 'reports', Icon: IconChart, label: 'Reports' },
      { key: 'compliance', Icon: IconShield, label: 'Compliance' },
    ]},
  ];
  return (
    <div style={{ width: 232, background: t.surface, borderRight: `1px solid ${t.rule}`, display: 'flex', flexDirection: 'column', padding: '20px 12px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px', borderBottom: `1px solid ${t.rule}`, marginBottom: 12 }}>
        <AgencyLogo size={32} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em' }}>AgencyTrack</div>
          <div style={{ fontSize: 10, color: t.inkMute, marginTop: 1 }}>Tatil Life · South</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 14 }}>
            {g.title && <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 12px 6px', fontFamily: APP_FONT_MONO }}>{g.title}</div>}
            {g.items.map((it) => {
              const on = active === it.key;
              return (
                <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 9, background: on ? t.tealTint : 'transparent', color: on ? t.teal : t.inkMute, fontSize: 13, fontWeight: 600, position: 'relative' }}>
                  {on && <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: t.teal, borderRadius: 999 }} />}
                  <it.Icon size={17} color={on ? t.teal : t.inkMute} stroke={1.8} />
                  <div style={{ flex: 1 }}>{it.label}</div>
                  {it.badge && <div style={{ padding: '1px 6px', borderRadius: 999, fontSize: 8.5, fontWeight: 700, background: it.badge === 'NEW' ? t.gold : t.danger, color: it.badge === 'NEW' ? t.surface : '#fff', letterSpacing: '0.04em' }}>{it.badge}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <RoleSwitcher t={t} current="manager" />
      <div style={{ padding: '12px 10px', borderTop: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Ava t={t} name="Devon Ramlal" size={34} bg={t.goldTint} fg={t.gold} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Devon Ramlal</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>Unit Manager · S·02</div>
        </div>
      </div>
    </div>
  );
}

function MgrDeskFrame({ t, active = 'planner', title, subtitle, pad = '20px 24px', children }) {
  return (
    <div style={{ width: APP_W, height: APP_H, background: t.bg, color: t.ink, fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      <AmbientBg t={t} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex' }}>
        <MgrDeskSidebar t={t} active={active} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar t={t} title={title} subtitle={subtitle} modeMode={t.mode} />
          <div style={{ flex: 1, overflow: 'hidden', padding: pad }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function MgrRailCard({ t, title, right, children, pad = '15px 16px', style = {} }) {
  return (
    <div style={{ padding: pad, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, ...style }}>
      {title && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{title}</div>{right}</div>}
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 1 · TEAM OVERVIEW (desktop)
// ──────────────────────────────────────────────────────────────────────────
function MgrTeamDesk({ t }) {
  return (
    <MgrDeskFrame t={t} active="planner" title="Your team" subtitle="Unit S·02 · leading indicators · next week">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, color: t.inkMute }}><b style={{ color: t.ink }}>6 agents</b> · 4 on track · 2 could use a nudge</div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, color: t.inkMute }}>
              <IconShield size={13} color={t.inkFaint} /> Stalled ratio is <b>aggregate &amp; private</b>
            </div>
          </div>
          {/* roster header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>
            <div style={{ width: 168 }}>AGENT</div>
            <div style={{ flex: 1 }}>BOOKED VS MINIMUM</div>
            <div style={{ width: 110 }}>KEPT-RATE</div>
            <div style={{ width: 130 }}>STALLED</div>
            <div style={{ width: 28 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TEAM.map((a, i) => (
              <div key={i} style={{ padding: '13px 16px', background: t.surface, border: `1px solid ${a.soft ? `${t.warning}33` : t.rule}`, borderRadius: 13, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 168, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Ava t={t} name={a.name} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.unit} · {a.level}{a.soft ? '' : ''}</div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <BookedVsMin t={t} booked={a.booked} min={a.min} />
                  {a.soft && <div style={{ marginTop: 8 }}><SoftWeek t={t} reason={a.soft} /></div>}
                </div>
                <div style={{ width: 110, flexShrink: 0 }}><KeptRate t={t} pct={a.kept} spark={a.keptSpark} /></div>
                <div style={{ width: 130, flexShrink: 0 }}><StalledRatio t={t} pct={a.stalled} trend={a.stalledTrend} showLabel={false} /></div>
                <div style={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}><IconChevR size={16} color={t.inkFaint} stroke={2.2} /></div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MgrRailCard t={t} title="Unit pulse">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { k: 'ON TRACK', v: '4 / 6', c: t.success },
                { k: 'SOFT WEEKS', v: '2', c: t.warning },
                { k: 'ESCALATIONS', v: '3', c: t.teal },
                { k: 'UNIT KEPT', v: '82%', c: t.ink },
              ].map((x, i) => (
                <div key={i} style={{ padding: '11px 12px', background: t.surfaceSoft, borderRadius: 10 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: x.c, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>{x.k}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 5, lineHeight: 1 }}>{x.v}</div>
                </div>
              ))}
            </div>
          </MgrRailCard>
          <MgrRailCard t={t} title="Coach this week" style={{ background: t.tealTint, borderColor: `${t.teal}33` }}>
            {TEAM.filter((a) => a.soft).map((a, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < arr.length - 1 ? `1px solid ${t.teal}22` : 'none' }}>
                <Ava t={t} name={a.name} size={30} bg={t.surface} fg={t.teal} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{a.name}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{a.soft}</div>
                </div>
                <div style={{ padding: '6px 11px', background: t.teal, color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Pack</div>
              </div>
            ))}
          </MgrRailCard>
        </div>
      </div>
    </MgrDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2 · 1-ON-1 COACHING PACK (desktop) ⭐
// ──────────────────────────────────────────────────────────────────────────
function MgrCoachingDesk({ t }) {
  const a = TEAM.find((x) => x.name === 'Riaz Khan');
  const wins = ['Most A.I booked in the unit (3)', 'Kept every F.F.I this week', 'Re-engaged 2 cold leads'];
  return (
    <MgrDeskFrame t={t} active="coaching" title="1-on-1 · Riaz Khan" subtitle="Weekly coaching pack · auto-assembled · 20 min">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '18px 22px', background: t.teal, borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -50, right: -30, width: 220, height: 220, background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 65%)' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
              <Ava t={t} name="Riaz Khan" size={52} bg="rgba(255,255,255,0.18)" fg="#fff" />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, opacity: 0.85 }}>THIS WEEK’S AGENDA</div>
                <div style={{ fontSize: 21, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, marginTop: 5, letterSpacing: '-0.015em' }}>Help Riaz fill Thu–Fri and close the open annuity.</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <MgrRailCard t={t} title="Booked vs minimum · next week" style={{ flex: 1 }}>
              <BookedVsMin t={t} booked={a.booked} min={a.min} />
              <div style={{ fontSize: 11.5, color: t.warning, marginTop: 12, fontWeight: 600 }}>4 C.I and 3 F.F.I short — the Thu–Fri gap is the fix.</div>
            </MgrRailCard>
            <MgrRailCard t={t} title="Kept-rate · 5 weeks" style={{ width: 240 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{a.kept}%</div>
                <Spark t={t} data={a.keptSpark} color={t.warning} w={120} h={40} />
              </div>
            </MgrRailCard>
          </div>
          {/* aggregate stalled — constraint made visible */}
          <MgrRailCard t={t}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>STALLED PIPELINE · TREND</div>
                <div style={{ fontSize: 13, color: t.ink, marginTop: 4, fontWeight: 600 }}>Up this month — coach the follow-up habit</div>
              </div>
              <StalledRatio t={t} pct={a.stalled} trend={a.stalledTrend} big />
            </div>
            <div style={{ marginTop: 12, padding: '12px 14px', background: t.surfaceSoft, borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <IconShield size={16} color={t.inkFaint} stroke={2} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.5 }}><b style={{ color: t.ink }}>Aggregate only — by design.</b> The individual stalled prospects behind this number stay private to Riaz. Coach the pattern, not the names; he escalates anyone he wants help with (below).</div>
            </div>
          </MgrRailCard>
          <MgrRailCard t={t} title="He asked for help with">
            {ESCALATIONS.filter((e) => e.agent === 'Riaz Khan').map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                <ActChip t={t} type="CI" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{e.prospect}</div>
                  <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1, fontStyle: 'italic' }}>“{e.objection}” · {e.pushes} pushes</div>
                </div>
                <AskPill t={t} ask={e.ask} />
                <div style={{ padding: '8px 13px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12, fontWeight: 700 }}>Schedule joint CI</div>
              </div>
            ))}
          </MgrRailCard>
        </div>
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MgrRailCard t={t} title="Open with a win" style={{ background: t.successTint, borderColor: `${t.success}33` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {wins.map((w, i) => <WinChip key={i} t={t}>{w}</WinChip>)}
            </div>
          </MgrRailCard>
          <MgrRailCard t={t} title="The conversation">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Celebrate the A.I booking streak', 'Look at the Thu–Fri gap together', 'Joint-CI the Curtis annuity', 'Agree one follow-up habit'].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, fontFamily: APP_FONT_MONO, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                  <div style={{ fontSize: 12, color: t.ink, lineHeight: 1.4 }}>{s}</div>
                </div>
              ))}
            </div>
          </MgrRailCard>
          <div style={{ marginTop: 'auto' }}><PBtn t={t} kind="primary" icon={<IconArrowR size={15} color="#fff" stroke={2.4} />}>Share agenda with Riaz</PBtn></div>
        </div>
      </div>
    </MgrDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3 · ESCALATION INBOX (desktop) ⭐
// ──────────────────────────────────────────────────────────────────────────
function MgrEscalationsDesk({ t, empty }) {
  if (empty) {
    return (
      <MgrDeskFrame t={t} active="escal" title="Escalations" subtitle="Prospects your agents chose to share for help">
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
          <div className="a-scale-in" style={{ width: 88, height: 88, borderRadius: '50%', background: t.successTint, border: `2px solid ${t.success}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}><IconCheck size={42} color={t.success} stroke={2.2} /></div>
          <div style={{ fontSize: 24, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Nothing escalated right now</div>
          <div style={{ fontSize: 13.5, color: t.inkMute, marginTop: 10, lineHeight: 1.6 }}>Your team is handling their pipelines. When an agent wants help on a specific prospect, it appears here — and only what they choose to share. Escalations are always agent-initiated and reversible.</div>
        </div>
      </MgrDeskFrame>
    );
  }
  const prio = { high: { fg: t.danger, bg: t.dangerTint, label: 'HIGH' }, med: { fg: t.warning, bg: t.warningTint, label: 'MED' } };
  return (
    <MgrDeskFrame t={t} active="escal" title="Escalations" subtitle="Prospects your agents chose to share for help · opt-in & reversible">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {ESCALATIONS.map((e, i) => {
            const p = prio[e.priority] || prio.med;
            return (
              <div key={i} style={{ padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 150, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Ava t={t} name={e.agent} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap' }}>{e.agent}</div>
                    <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{e.unit} · {e.since}</div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>{e.prospect}</div>
                    <div style={{ padding: '2px 7px', borderRadius: 999, fontSize: 8.5, fontWeight: 700, color: p.fg, background: p.bg, fontFamily: APP_FONT_MONO }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO }}>· {e.product} · {e.pushes} pushes</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: t.ink, fontStyle: 'italic', marginTop: 4 }}>“{e.objection}”</div>
                </div>
                <AskPill t={t} ask={e.ask} />
                <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                  <div style={{ padding: '9px 15px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><IconUsers size={14} color="#fff" stroke={2.2} />{e.ask === 'advice' ? 'Reply' : e.ask === 'take-call' ? 'Take call' : 'Joint CI'}</div>
                  <div style={{ padding: '9px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, color: t.inkMute, borderRadius: 9, fontSize: 12.5, fontWeight: 700 }}>Prep</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ width: 272, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MgrRailCard t={t} title="What they’re asking">
            {Object.keys(ASK).map((k, i) => {
              const count = ESCALATIONS.filter((e) => e.ask === k).length;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: i < 2 ? `1px solid ${t.rule}` : 'none' }}>
                  <AskPill t={t} ask={k} />
                  <div style={{ flex: 1 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{count}</div>
                </div>
              );
            })}
          </MgrRailCard>
          <MgrRailCard t={t} style={{ background: t.surfaceSoft }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <IconShield size={16} color={t.inkFaint} stroke={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.55 }}>You only see these because the agent <b style={{ color: t.ink }}>chose to share</b>. They can pull any escalation back at any time. Nothing here appears on a leaderboard or kiosk.</div>
            </div>
          </MgrRailCard>
        </div>
      </div>
    </MgrDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 4 · TEAM CAPACITY + JOINT-CALL SCHEDULING (desktop)
// ──────────────────────────────────────────────────────────────────────────
function MgrCapacityDesk({ t }) {
  const bandColor = (b) => (b === 'heavy' ? t.warning : b === 'light' ? t.inkAccent : t.success);
  const maxLoad = Math.max(...CAPACITY.map((c) => c.total));
  return (
    <MgrDeskFrame t={t} active="planner" title="Your week" subtitle="Joint calls with agents + team capacity">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Eyebrow t={t}>Your next 8 days</Eyebrow>
            <div style={{ display: 'flex', gap: 8, marginTop: 9, overflow: 'hidden' }}>
              {MGR_DAY_STRIP.map((d, i) => <DayStripCell key={i} t={t} d={d} selected={d.today} />)}
            </div>
          </div>
          <MgrRailCard t={t} title="Joint calls booked with agents" style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {JOINT_CALLS.map((j, i) => (
                <div key={i} style={{ padding: '12px 14px', background: t.surfaceSoft, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 96, flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{j.time}</div>
                    <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{j.day.split(' · ')[0]} · {j.day.split(' · ')[1]}</div>
                  </div>
                  <ActChip t={t} type={j.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{j.prospect}</div>
                    <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>with {j.agent}</div>
                  </div>
                  <span style={{ padding: '4px 11px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, color: t.teal, background: t.tealTint }}>{j.kind}</span>
                </div>
              ))}
            </div>
          </MgrRailCard>
        </div>
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MgrRailCard t={t} title="Team capacity · next week" right={<span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>BALANCE LOAD</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {CAPACITY.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 92, flexShrink: 0, fontSize: 12, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ flex: 1, height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                    <div className="a-progress-grow" style={{ width: `${(c.total / maxLoad) * 100}%`, height: 7, background: bandColor(c.band), borderRadius: 999 }} />
                  </div>
                  <div style={{ width: 52, textAlign: 'right', fontSize: 9, fontWeight: 700, color: bandColor(c.band), fontFamily: APP_FONT_MONO, textTransform: 'uppercase' }}>{c.band}</div>
                </div>
              ))}
            </div>
          </MgrRailCard>
          <MgrRailCard t={t} style={{ background: t.tealTint, borderColor: `${t.teal}33` }}>
            <Eyebrow t={t}>Redistribute</Eyebrow>
            <div style={{ fontSize: 13, color: t.ink, marginTop: 7, lineHeight: 1.5 }}>Jamal is light (12 open slots) while Anand is heavy. Move a shared referral or two his way before the week locks.</div>
          </MgrRailCard>
        </div>
      </div>
    </MgrDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 5 · BRANCH EVENTS (desktop, BM)
// ──────────────────────────────────────────────────────────────────────────
function MgrEventsDesk({ t }) {
  return (
    <MgrDeskFrame t={t} active="planner" title="Branch events" subtitle="Branch Manager · push events onto agents’ agendas">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: t.inkMute }}>Scheduled events appear on every targeted agent’s planner.</div>
            <div style={{ flex: 1 }} />
            <div style={{ padding: '9px 15px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><IconPlus size={14} color="#fff" stroke={2.4} />Schedule event</div>
          </div>
          {BRANCH_EVENTS.map((e, i) => (
            <div key={i} style={{ padding: '16px 18px', background: t.surface, border: `1px ${e.state === 'draft' ? 'dashed' : 'solid'} ${e.state === 'draft' ? t.ruleStrong : t.rule}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ padding: '4px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700, color: t.inkAccent, background: t.inkAccentTint, fontFamily: APP_FONT_MONO, flexShrink: 0 }}>{e.type}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{e.title}</div>
                <div style={{ fontSize: 12, color: t.inkMute, marginTop: 3 }}>{e.reach}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{e.date}</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 2 }}>{e.time}</div>
              </div>
              <div style={{ width: 86, textAlign: 'center', flexShrink: 0 }}>
                {e.state === 'draft'
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>DRAFT</span>
                  : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}><IconCheck size={12} color={t.success} stroke={2.4} />PUSHED</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MgrRailCard t={t} title="Reach this quarter">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>3</div>
              <div style={{ fontSize: 12, color: t.inkMute }}>events on agendas</div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: t.inkMute, lineHeight: 1.5 }}>Free blocks land on agents’ planners as <b style={{ color: t.ink }}>company seminar / training / tradeshow</b> — the same types they book themselves.</div>
          </MgrRailCard>
          <MgrRailCard t={t} style={{ background: t.surfaceSoft }}>
            <Eyebrow t={t}>Tip</Eyebrow>
            <div style={{ fontSize: 12, color: t.ink, marginTop: 7, lineHeight: 1.5 }}>Schedule training away from phone-day mornings so it doesn’t eat agents’ booking time.</div>
          </MgrRailCard>
        </div>
      </div>
    </MgrDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 6 · BRANCH BOOKING HEALTH (desktop, BM) — private management view
// ──────────────────────────────────────────────────────────────────────────
function MgrBranchHealthDesk({ t }) {
  return (
    <MgrDeskFrame t={t} active="reports" title="Branch booking health" subtitle="Forward booked activity · private management view">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { k: 'BOOKED API · 4 WK', v: 'TTD 5.5M', s: 'forward pipeline', c: t.teal },
              { k: 'AVG FILL VS MIN', v: '69%', s: 'across 3 units', c: t.warning },
              { k: 'SOFT WEEKS', v: '6', s: 'agents to coach', c: t.gold },
            ].map((x, i) => (
              <div key={i} style={{ padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: x.c, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{x.k}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 8, lineHeight: 1 }}>{x.v}</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 5 }}>{x.s}</div>
              </div>
            ))}
          </div>
          <MgrRailCard t={t} title="Units · forward fill vs minimums" style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {UNITS.map((u, i) => (
                <div key={i} style={{ padding: '13px 15px', background: u.you ? t.tealTint : t.surfaceSoft, border: u.you ? `1px solid ${t.teal}33` : '1px solid transparent', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 120, flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{u.code}</div>
                    <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{u.mgr}{u.you && <span style={{ color: t.teal, fontWeight: 700 }}> · you</span>}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ height: 9, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                      <div className="a-progress-grow" style={{ width: `${u.fill}%`, height: 9, background: u.fill >= 70 ? t.success : u.fill >= 60 ? t.warning : t.danger, borderRadius: 999 }} />
                    </div>
                  </div>
                  <div style={{ width: 44, textAlign: 'right', fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{u.fill}%</div>
                  <div style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{u.bookedApi}</div>
                  <div style={{ width: 70, textAlign: 'right', fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{u.agents} agt · {u.soft} soft</div>
                </div>
              ))}
            </div>
          </MgrRailCard>
        </div>
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MgrRailCard t={t} style={{ background: t.surfaceSoft }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <IconShield size={18} color={t.inkFaint} stroke={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: t.inkMute, lineHeight: 1.55 }}>This roll-up is a <b style={{ color: t.ink }}>private management view</b>. It never appears on a leaderboard, kiosk or TV — those rank reconciled production, not forward bookings.</div>
            </div>
          </MgrRailCard>
          <MgrRailCard t={t} title="Where to focus">
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Unit S·03</div>
            <div style={{ fontSize: 12, color: t.inkMute, marginTop: 5, lineHeight: 1.5 }}>58% fill and 3 soft weeks — the lowest forward book. A unit booking push this week moves the branch most.</div>
          </MgrRailCard>
        </div>
      </div>
    </MgrDeskFrame>
  );
}

Object.assign(window, {
  MgrDeskSidebar, MgrDeskFrame, MgrRailCard,
  MgrTeamDesk, MgrCoachingDesk, MgrEscalationsDesk, MgrCapacityDesk, MgrEventsDesk, MgrBranchHealthDesk,
});
