// Planner & Scheduler — MANAGER tier: mobile scenes (390×844).
// Reuses MFrame, PHeader, PBody, PBtn, PLabel (planner-shared) + ManagerNav and
// the manager primitives/data (planner-manager-shared).

function MgrHeaderRight({ t }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <IconBell size={17} color={t.inkMute} />
        <div style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: t.danger, border: `2px solid ${t.surface}` }} />
      </div>
      <Ava t={t} name="Devon Ramlal" size={36} bg={t.goldTint} fg={t.gold} />
    </div>
  );
}

// Privacy legend — makes the aggregate/private nature unmistakable (#1,#2).
function PrivacyNote({ t, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
      <IconShield size={15} color={t.inkFaint} stroke={2} />
      <div style={{ fontSize: 10.5, color: t.inkMute, lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 1 · TEAM OVERVIEW — leading indicators, the manager's landing
// ──────────────────────────────────────────────────────────────────────────
function MgrTeam({ t }) {
  const soft = TEAM.filter((a) => a.soft).length;
  const onTrack = TEAM.length - soft;
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="UNIT S·02 · NEXT WEEK" title="Your team" right={<MgrHeaderRight t={t} />} />
      <PBody t={t} top={108}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* unit pulse */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { k: 'ON TRACK', v: `${onTrack}/6`, c: t.success },
              { k: 'SOFT WK', v: String(soft), c: t.warning },
              { k: 'ESCAL.', v: '3', c: t.teal },
              { k: 'KEPT', v: '82%', c: t.ink },
            ].map((x, i) => (
              <div key={i} style={{ padding: '10px 10px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: x.c, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>{x.k}</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 5 }}>{x.v}</div>
              </div>
            ))}
          </div>

          {/* coaching prompt (opportunity framing, not a flag) */}
          <div style={{ padding: '12px 14px', background: t.tealTint, border: `1px solid ${t.teal}2e`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 11 }}>
            <div className="a-breathe" style={{ width: 34, height: 34, borderRadius: '50%', background: t.surface, border: `1px solid ${t.teal}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconBolt size={16} color={t.teal} stroke={2} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>2 agents could use a nudge</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>Riaz &amp; Priya are light on next week’s C.I — book a quick chat.</div>
            </div>
          </div>

          <PrivacyNote t={t}>Stalled ratio is <b>aggregate &amp; private</b> — a trend to coach, never a list of names.</PrivacyNote>

          {/* roster */}
          <PLabel t={t}>Roster · booked vs minimum</PLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TEAM.slice(0, 4).map((a, i) => (
              <div key={i} style={{ padding: '12px 13px', background: t.surface, border: `1px solid ${a.soft ? `${t.warning}33` : t.rule}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Ava t={t} name={a.name} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.unit} · {a.level}</div>
                  </div>
                  <StalledRatio t={t} pct={a.stalled} trend={a.stalledTrend} showLabel={false} />
                  {a.escal > 0 && <div style={{ width: 18, height: 18, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{a.escal}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <BookedVsMin t={t} booked={a.booked} min={a.min} compact />
                  <KeptRate t={t} pct={a.kept} spark={a.keptSpark} />
                </div>
                {a.soft && <div style={{ marginTop: 10 }}><SoftWeek t={t} reason={a.soft} /></div>}
              </div>
            ))}
          </div>
        </div>
      </PBody>
      <ManagerNav t={t} active="team" badge={3} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2 · 1-ON-1 COACHING PACK ⭐ — auto-assembled per-agent agenda
// ──────────────────────────────────────────────────────────────────────────
function MgrCoaching({ t }) {
  const a = TEAM.find((x) => x.name === 'Riaz Khan');
  const wins = ['Most A.I booked in the unit (3)', 'Kept every F.F.I this week'];
  return (
    <MFrame t={t}>
      <PHeader t={t} onBack eyebrow="WEEKLY 1-ON-1 PACK" title="Riaz Khan" right={<Ava t={t} name="Riaz Khan" size={36} />} />
      <PBody t={t} top={108}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* supportive intro */}
          <div style={{ padding: '14px 16px', background: t.teal, borderRadius: 14, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -30, width: 150, height: 150, background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 65%)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, opacity: 0.85 }}>THIS WEEK’S AGENDA · 20 MIN</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, marginTop: 7, lineHeight: 1.25 }}>Help Riaz fill Thu–Fri and close the open annuity.</div>
            </div>
          </div>

          {/* planned vs actual */}
          <div style={{ padding: '14px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <PLabel t={t}>Booked vs minimum · next week</PLabel>
            <BookedVsMin t={t} booked={a.booked} min={a.min} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.rule}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>KEPT-RATE · 5 WK</div>
                <div style={{ fontSize: 12, color: t.inkMute, marginTop: 3 }}>Easing — worth a gentle word</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{a.kept}%</div>
              </div>
              <Spark t={t} data={a.keptSpark} color={t.warning} w={66} h={26} />
            </div>
          </div>

          {/* AGGREGATE stalled ratio — constraint made visible */}
          <div style={{ padding: '14px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>STALLED PIPELINE</div>
                <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 3 }}>Trending up — coach the follow-up habit</div>
              </div>
              <StalledRatio t={t} pct={a.stalled} trend={a.stalledTrend} big />
            </div>
            <div style={{ marginTop: 12, padding: '10px 12px', background: t.surfaceSoft, borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <IconShield size={15} color={t.inkFaint} stroke={2} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: t.inkMute, lineHeight: 1.5 }}><b style={{ color: t.ink }}>Aggregate only.</b> Individual stalled prospects stay private to Riaz. Coach the pattern, not the names — he escalates anyone he wants help with.</div>
            </div>
          </div>

          {/* escalations he raised */}
          <div>
            <PLabel t={t}>He asked for help with</PLabel>
            {ESCALATIONS.filter((e) => e.agent === 'Riaz Khan').map((e, i) => (
              <div key={i} style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 11 }}>
                <ActChip t={t} type={e.type || 'CI'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{e.prospect}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{e.product} · {e.pushes} pushes</div>
                </div>
                <AskPill t={t} ask={e.ask} />
              </div>
            ))}
          </div>

          {/* wins */}
          <div>
            <PLabel t={t}>Wins to open with</PLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {wins.map((w, i) => <WinChip key={i} t={t}>{w}</WinChip>)}
            </div>
          </div>

          <PBtn t={t} kind="primary" icon={<IconArrowR size={15} color="#fff" stroke={2.4} />}>Share agenda with Riaz</PBtn>
        </div>
      </PBody>
      <ManagerNav t={t} active="coaching" badge={3} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3 · ESCALATION INBOX ⭐ — prospects agents CHOSE to escalate (opt-in)
// ──────────────────────────────────────────────────────────────────────────
function MgrEscalations({ t, empty }) {
  if (empty) {
    return (
      <MFrame t={t}>
        <PHeader t={t} eyebrow="AGENTS ASKED FOR HELP" title="Escalations" right={<MgrHeaderRight t={t} />} />
        <div style={{ position: 'absolute', top: 108, left: 0, right: 0, bottom: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 36px', textAlign: 'center' }}>
          <div className="a-scale-in" style={{ width: 76, height: 76, borderRadius: '50%', background: t.successTint, border: `2px solid ${t.success}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}><IconCheck size={36} color={t.success} stroke={2.2} /></div>
          <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Nothing escalated</div>
          <div style={{ fontSize: 13, color: t.inkMute, marginTop: 8, lineHeight: 1.55 }}>Your team is handling their pipelines. When an agent wants help on a specific prospect, it lands here — they choose what to share.</div>
        </div>
        <ManagerNav t={t} active="escal" badge={0} />
      </MFrame>
    );
  }
  const prio = { high: { fg: t.danger, bg: t.dangerTint, label: 'HIGH' }, med: { fg: t.warning, bg: t.warningTint, label: 'MED' } };
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="AGENTS ASKED FOR HELP" title="Escalations" right={<MgrHeaderRight t={t} />} />
      <PBody t={t} top={108}>
        <div style={{ fontSize: 12, color: t.inkMute, marginBottom: 12, lineHeight: 1.45 }}><b style={{ color: t.ink }}>{ESCALATIONS.length} prospects</b> your agents opted to share for help. They can pull any back anytime.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ESCALATIONS.map((e, i) => {
            const p = prio[e.priority] || prio.med;
            return (
              <div key={i} style={{ padding: '13px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                  <Ava t={t} name={e.agent} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: t.ink }}>{e.agent}</div>
                    <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{e.unit} · escalated {e.since} ago</div>
                  </div>
                  <AskPill t={t} ask={e.ask} />
                </div>
                <div style={{ padding: '11px 12px', background: t.surfaceSoft, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{e.prospect}</div>
                    <div style={{ flex: 1 }} />
                    <div style={{ padding: '2px 7px', borderRadius: 999, fontSize: 8.5, fontWeight: 700, color: p.fg, background: p.bg, fontFamily: APP_FONT_MONO }}>{p.label}</div>
                  </div>
                  <div style={{ fontSize: 11, color: t.inkMute, marginTop: 3 }}>{e.product} · {e.pushes} pushes</div>
                  <div style={{ fontSize: 11.5, color: t.ink, fontStyle: 'italic', marginTop: 7 }}>“{e.objection}”</div>
                </div>
                <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
                  <div style={{ flex: 1.3 }}><PBtn t={t} kind="primary" icon={<IconUsers size={13} color="#fff" stroke={2.2} />}>{e.ask === 'advice' ? 'Reply with advice' : e.ask === 'take-call' ? 'Take the call' : 'Schedule joint CI'}</PBtn></div>
                  <div style={{ width: 92 }}><PBtn t={t} kind="secondary">Prep card</PBtn></div>
                </div>
              </div>
            );
          })}
        </div>
      </PBody>
      <ManagerNav t={t} active="escal" badge={3} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 4 · TEAM CAPACITY + JOINT-CALL SCHEDULING
// ──────────────────────────────────────────────────────────────────────────
function MgrCapacity({ t }) {
  const bandColor = (b) => (b === 'heavy' ? t.warning : b === 'light' ? t.inkAccent : t.success);
  const maxLoad = Math.max(...CAPACITY.map((c) => c.total));
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="JOINT CALLS + CAPACITY" title="Your week" right={<MgrHeaderRight t={t} />} />
      <PBody t={t} top={108} pad="0">
        <div style={{ padding: '0 18px 4px' }}>
          <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
            {MGR_DAY_STRIP.map((d, i) => <DayStripCell key={i} t={t} d={d} selected={d.today} />)}
          </div>
        </div>
        <div style={{ padding: '8px 18px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <PLabel t={t}>Joint calls booked with agents</PLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {JOINT_CALLS.map((j, i) => (
                <div key={i} style={{ padding: '11px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 52, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{j.time.split(' ')[0]}</div>
                    <div style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{j.day.split(' · ')[0]}</div>
                  </div>
                  <ActChip t={t} type={j.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.prospect}</div>
                    <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>with {j.agent}</div>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 9, fontWeight: 700, color: t.teal, background: t.tealTint, fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>{j.kind}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <PLabel t={t} right={<span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>NEXT WEEK</span>}>Team capacity</PLabel>
            <div style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CAPACITY.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 92, flexShrink: 0, fontSize: 12, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ flex: 1, height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                    <div className="a-progress-grow" style={{ width: `${(c.total / maxLoad) * 100}%`, height: 7, background: bandColor(c.band), borderRadius: 999 }} />
                  </div>
                  <div style={{ width: 56, textAlign: 'right', fontSize: 9.5, fontWeight: 700, color: bandColor(c.band), fontFamily: APP_FONT_MONO, textTransform: 'uppercase' }}>{c.band}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PBody>
      <ManagerNav t={t} active="schedule" badge={3} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 5 · BRANCH EVENTS (BM) — schedule a branch-wide event onto agendas
// ──────────────────────────────────────────────────────────────────────────
function MgrEvents({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="BRANCH MANAGER" title="Branch events" right={<div style={{ padding: '8px 12px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><IconPlus size={13} color="#fff" stroke={2.4} />New</div>} />
      <PBody t={t} top={108}>
        <PrivacyNote t={t}>Events push onto agents’ planner agendas across the ~2-month horizon.</PrivacyNote>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BRANCH_EVENTS.map((e, i) => (
            <div key={i} style={{ padding: '13px 15px', background: t.surface, border: `1px solid ${e.state === 'draft' ? t.ruleStrong : t.rule}`, borderStyle: e.state === 'draft' ? 'dashed' : 'solid', borderRadius: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: t.inkAccent, background: t.inkAccentTint, fontFamily: APP_FONT_MONO }}>{e.type}</span>
                <div style={{ flex: 1 }} />
                {e.state === 'draft'
                  ? <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>DRAFT</span>
                  : <span style={{ fontSize: 9.5, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>SCHEDULED</span>}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>{e.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: t.ink, fontFamily: APP_FONT_MONO }}>{e.date} · {e.time}</div>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: t.inkDim }} />
                <div style={{ fontSize: 11.5, color: t.inkMute }}>{e.reach}</div>
              </div>
            </div>
          ))}
        </div>
      </PBody>
      <ManagerNav t={t} active="more" badge={3} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 6 · BRANCH BOOKING HEALTH (BM) — forward roll-up, PRIVATE (never public)
// ──────────────────────────────────────────────────────────────────────────
function MgrBranchHealth({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="FORWARD BOOKING" title="Branch health" right={<MgrHeaderRight t={t} />} />
      <PBody t={t} top={108}>
        <PrivacyNote t={t}>Management view — <b>not</b> shown on any leaderboard, kiosk or TV.</PrivacyNote>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* roll-up */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { k: 'BOOKED API', v: 'TTD 5.5M', s: 'next 4 weeks', c: t.teal },
              { k: 'AVG FILL', v: '69%', s: 'vs minimums', c: t.warning },
              { k: 'SOFT WKS', v: '6', s: 'across 3 units', c: t.gold },
            ].map((x, i) => (
              <div key={i} style={{ padding: '11px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: x.c, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>{x.k}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 5 }}>{x.v}</div>
                <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 3 }}>{x.s}</div>
              </div>
            ))}
          </div>
          {/* unit comparison */}
          <div>
            <PLabel t={t}>Units · forward fill</PLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {UNITS.map((u, i) => (
                <div key={i} style={{ padding: '12px 13px', background: u.you ? t.tealTint : t.surface, border: `1px solid ${u.you ? `${t.teal}44` : t.rule}`, borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{u.code}</div>
                    <div style={{ fontSize: 11, color: t.inkMute }}>{u.mgr}{u.you && <span style={{ color: t.teal, fontWeight: 700 }}> · you</span>}</div>
                    <div style={{ flex: 1 }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{u.bookedApi}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9 }}>
                    <div style={{ flex: 1, height: 6, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                      <div className="a-progress-grow" style={{ width: `${u.fill}%`, height: 6, background: u.fill >= 70 ? t.success : u.fill >= 60 ? t.warning : t.danger, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{u.fill}%</div>
                    <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{u.soft} soft</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PBody>
      <ManagerNav t={t} active="more" badge={3} />
    </MFrame>
  );
}

// ── States — loading + error for Team overview ────────────────────────────
function MgrTeamLoading({ t }) {
  const sk = (w, h, r = 6) => ({ width: w, height: h, borderRadius: r, background: t.surfaceMute });
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="UNIT S·02 · NEXT WEEK" title="Your team" right={<MgrHeaderRight t={t} />} />
      <PBody t={t} top={108}>
        <div className="a-glow-soft" style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.85 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>{[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 56, ...sk('auto', 56, 11) }} />)}</div>
          <div style={{ height: 56, ...sk('auto', 56, 12), marginTop: 4 }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ padding: '12px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}><div style={{ width: 32, height: 32, borderRadius: '50%', background: t.surfaceMute }} /><div style={sk(110, 13)} /><div style={{ flex: 1 }} /><div style={sk(54, 18, 999)} /></div>
              <div style={sk('70%', 14)} />
            </div>
          ))}
        </div>
      </PBody>
      <ManagerNav t={t} active="team" badge={3} />
    </MFrame>
  );
}
function MgrTeamError({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="UNIT S·02 · NEXT WEEK" title="Your team" right={<MgrHeaderRight t={t} />} />
      <div style={{ position: 'absolute', top: 108, left: 0, right: 0, bottom: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 36px', textAlign: 'center' }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, background: t.dangerTint, border: `1.5px solid ${t.danger}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}><IconAlert size={34} color={t.danger} stroke={1.8} /></div>
        <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Couldn’t load your team</div>
        <div style={{ fontSize: 13, color: t.inkMute, marginTop: 8, lineHeight: 1.55 }}>Leading-indicator data didn’t sync. Your agents’ booking still saves on their phones — retry in a moment.</div>
        <div style={{ marginTop: 22, width: '100%' }}><PBtn t={t} kind="primary" icon={<IconRepeat size={15} color="#fff" stroke={2.2} />}>Try again</PBtn></div>
      </div>
      <ManagerNav t={t} active="team" badge={3} />
    </MFrame>
  );
}

Object.assign(window, {
  MgrHeaderRight, PrivacyNote,
  MgrTeam, MgrCoaching, MgrEscalations, MgrCapacity, MgrEvents, MgrBranchHealth,
  MgrTeamLoading, MgrTeamError,
});
