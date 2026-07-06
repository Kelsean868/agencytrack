// Game Plan v2 — page bodies. Each renders inside a scene (desktop AppShell
// or mobile MFrame). Bodies take `t` (tokens) + `mobile` so one component
// serves light/dark/desktop/mobile.
//
//   HubBody         — step rail + "plan so far" cascade + commit card
//   MoneyNeedsPage  — expense groups + PAYE + commission targets (step 1)
//   YearPlanPage    — split commission/API across product lines (step 2)
//   MonthlyPlanPage — 12-month target-vs-actual + variance suggestions (step 3)

// ════════════════════════════════════════════════════════════════════════
// HUB
// ════════════════════════════════════════════════════════════════════════
function HubBody({ t, data, mobile = false, managerView = false }) {
  const yp = data.yearPlan;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <PlanSectionHead t={t} title="Your 4 steps" sub="Jump to any step" />
        <StepRail t={t} current="year" mobile={mobile} onChain={!mobile} />
      </div>

      <div style={{ display: mobile ? 'flex' : 'flex', flexDirection: mobile ? 'column' : 'row', gap: 16, alignItems: 'flex-start' }}>
        {/* Plan-so-far cascade */}
        <div className="a-card" style={{
          flex: mobile ? undefined : 1.5, minWidth: 0, flexShrink: 0,
          padding: mobile ? '14px 16px' : '16px 18px',
          background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13,
        }}>
          <PlanSectionHead t={t} title="The plan so far" sub="Need → split → months" />
          {/* three connected mini-panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Money Needs summary */}
            <div style={{ padding: '12px 14px', borderRadius: 10, background: t.goldTint, border: `1px solid ${t.gold}44` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.gold, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>STEP 1 · MONEY NEEDS</div>
                  <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 3 }}>Commission you must earn this year</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em' }}>{pTtd(data.money.commissionNeed)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', color: t.inkFaint }}><IconChevD size={16} color={t.inkFaint} stroke={2} /></div>
            {/* Year Plan split */}
            <div style={{ padding: '12px 14px', borderRadius: 10, background: t.tealTint, border: `1px solid ${t.teal}44` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.teal, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>STEP 2 · YEAR PLAN</div>
                  <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 3 }}>Split across product lines → {pTtd(yp.apiTarget)} API</div>
                </div>
              </div>
              <AllocationBar t={t} lines={yp.lines} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', color: t.inkFaint }}><IconChevD size={16} color={t.inkFaint} stroke={2} /></div>
            {/* Monthly */}
            <div style={{ padding: '12px 14px', borderRadius: 10, background: t.surfaceSoft, border: `1px solid ${t.rule}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.inkMute, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>STEP 3 · MONTHLY PLAN</div>
                  <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 3 }}>Broken into 12 months</div>
                </div>
              </div>
              <MiniMonthStrip t={t} months={data.monthly.months} />
            </div>
          </div>
        </div>

        {/* Right column — commit (agent) or suggest (manager) */}
        <div style={{ flex: mobile ? undefined : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, width: mobile ? '100%' : undefined }}>
          {managerView ? (
            <>
              <div className="a-card" style={{
                flexShrink: 0, padding: mobile ? '14px 16px' : '16px 18px',
                background: t.surface, border: `1px solid ${t.gold}55`, borderRadius: 13, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 130, height: 130, background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
                <Eyebrow t={t} color={t.gold}>SUGGEST A CHANGE</Eyebrow>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginTop: 8, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                  Nudge {data.agent.split(' ')[0]}'s plan before she commits
                </div>
                <div style={{ marginTop: 12, padding: '11px 13px', borderRadius: 9, border: `1px solid ${t.rule}`, background: t.surfaceSoft, fontSize: 11.5, color: t.ink, lineHeight: 1.5 }}>
                  Your Life split looks light vs your renewal book — consider lifting Life to 65% and trimming Motor. Happy to talk it through Thursday.
                </div>
                <div style={{ marginTop: 14, padding: '11px 16px', background: t.gold, color: '#fff', borderRadius: 10, fontSize: 13.5, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 12px ${t.gold}44` }}>
                  Send suggestion <IconArrowR size={14} color="#fff" stroke={2.4} />
                </div>
              </div>
              <div className="a-card" style={{
                flexShrink: 0, padding: mobile ? '14px 16px' : '16px 18px',
                background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13,
              }}>
                <PlanSectionHead t={t} title="Plan health" />
                {[
                  { label: 'Above company floor', ok: true },
                  { label: 'Renewals realistic', ok: true },
                  { label: 'Line mix vs her book', ok: false, note: 'Life light' },
                  { label: 'Not yet committed', ok: false, note: 'draft' },
                ].map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: c.ok ? t.success : t.warningTint, border: c.ok ? 'none' : `1px solid ${t.warning}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.ok ? <IconCheck size={11} color="#fff" stroke={3} /> : <IconAlert size={11} color={t.warning} stroke={2.2} />}
                    </div>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: t.ink }}>{c.label}</div>
                    {c.note && <span style={{ fontSize: 9.5, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>{c.note}</span>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="a-card" style={{
                flexShrink: 0, padding: mobile ? '14px 16px' : '16px 18px',
                background: t.surface, border: `1px solid ${t.warning}55`, borderRadius: 13, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 130, height: 130, background: `radial-gradient(circle, ${t.warningTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
                <Eyebrow t={t} color={t.warning}>STEP 4 · REVIEW & COMMIT</Eyebrow>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, marginTop: 8, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                  Lock your plan to set your Goals
                </div>
                <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 6, lineHeight: 1.5 }}>
                  Committing writes <b style={{ color: t.ink }}>{pTtd(data.goalsCommitment.api)} API</b> · <b style={{ color: t.ink }}>{data.goalsCommitment.apps} apps</b> to your Goals page as your personal commitment.
                </div>
                <div style={{ marginTop: 14, padding: '11px 16px', background: t.warning, color: '#fff', borderRadius: 10, fontSize: 13.5, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 12px ${t.warning}44` }}>
                  Commit 2026 plan <IconArrowR size={14} color="#fff" stroke={2.4} />
                </div>
              </div>

              {/* What's left */}
              <div className="a-card" style={{
                flexShrink: 0, padding: mobile ? '14px 16px' : '16px 18px',
                background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13,
              }}>
                <PlanSectionHead t={t} title="Before you commit" />
                {[
                  { label: 'Money Needs worksheet', done: true },
                  { label: 'Year Plan line split', done: true },
                  { label: 'Monthly breakdown', done: true },
                  { label: 'Review with your manager', done: false },
                ].map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: c.done ? t.success : t.surfaceMute, border: c.done ? 'none' : `1px solid ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.done && <IconCheck size={11} color="#fff" stroke={3} />}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: c.done ? t.inkMute : t.ink, textDecoration: c.done ? 'line-through' : 'none' }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Stacked allocation bar — product-line split as a single segmented bar.
function AllocationBar({ t, lines, height = 12 }) {
  return (
    <div>
      <div style={{ display: 'flex', height, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
        {lines.map((l) => (
          <div key={l.key} className="a-progress-grow" style={{ width: `${l.pct}%`, background: toneColor(t, l.tone), transformOrigin: 'left center' }}></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {lines.map((l) => (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: toneColor(t, l.tone) }}></div>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{l.label}</span>
            <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{l.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mini month strip — 12 tiny bars (used in hub + mobile).
function MiniMonthStrip({ t, months }) {
  const max = Math.max(...months.map((m) => Math.max(m.target, m.actual)));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44 }}>
      {months.map((m) => {
        const isCurrent = m.partial;
        const h = Math.max(3, ((m.future ? m.target : m.actual) / max) * 44);
        return (
          <div key={m.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div className="a-bar-grow" style={{
              width: '100%', height: h, borderRadius: 2,
              background: m.future ? t.surfaceMute : isCurrent ? t.warning : t.teal,
              opacity: m.future ? 0.6 : 1, transformOrigin: 'bottom',
              border: isCurrent ? `1px solid ${t.warning}` : 'none',
            }}></div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// YEAR PLAN (step 2)
// ════════════════════════════════════════════════════════════════════════
function YearPlanPage({ t, data, mobile = false, profile }) {
  const yp = data.yearPlan;
  const activeProfile = profile || yp.profile;
  const prof = yp.profiles[activeProfile];
  const lines = prof.lines;
  const totalComm = lines.reduce((s, l) => s + l.commission, 0);
  const totalApi = lines.reduce((s, l) => s + l.api, 0);
  const awardApi = lines.filter((l) => l.award).reduce((s, l) => s + l.api, 0);
  const awardPct = totalApi > 0 ? Math.round((awardApi / totalApi) * 100) : 0;
  const profileTabs = [
    { key: 'composite', label: 'Composite' },
    { key: 'life', label: 'Life only' },
    { key: 'general', label: 'General only' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* License profile + split controls */}
      <div className="a-card" style={{ flexShrink: 0, padding: mobile ? '14px 16px' : '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <Eyebrow t={t} color={t.teal}>YOUR LICENSE · HOW YOU SPLIT BUSINESS</Eyebrow>
            <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 5, lineHeight: 1.45, maxWidth: 440 }}>
              Lines adapt to your license class. Composite agents split Life + General; Life- or General-only agents break out by product. <span style={{ color: t.inkFaint }}>We’ll set this from your license once it’s on file.</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
            {profileTabs.map((p) => {
              const on = p.key === activeProfile;
              return (
                <div key={p.key} style={{
                  padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute,
                  border: on ? `1px solid ${t.teal}44` : '1px solid transparent',
                  boxShadow: on ? '0 1px 2px rgba(40,37,29,0.05)' : 'none',
                }}>{p.label}</div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.rule}` }}>
          <div style={{ fontSize: 12, color: t.inkMute }}>
            Allocate <b style={{ color: t.ink }}>{pTtd(yp.commissionTarget)}</b> commission → <b style={{ color: t.teal }}>{pTtd(totalApi)}</b> API to write
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
            {['Percent', 'Direct $'].map((opt, i) => (
              <div key={opt} style={{
                padding: '6px 13px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                background: i === 0 ? t.surface : 'transparent', color: i === 0 ? t.ink : t.inkMute,
                border: i === 0 ? `1px solid ${t.rule}` : '1px solid transparent',
                boxShadow: i === 0 ? '0 1px 2px rgba(40,37,29,0.05)' : 'none',
              }}>{opt}</div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <AllocationBar t={t} lines={lines} height={16} />
        </div>
      </div>

      {/* Line cards */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        {lines.map((l) => (
          <LineCard key={l.key} t={t} line={l} />
        ))}
        {/* add line (flexible count) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '15px 16px', border: `1px dashed ${t.ruleStrong}`, borderRadius: 12, color: t.inkMute, fontSize: 12.5, fontWeight: 700 }}>
          <IconPlus size={14} color={t.inkMute} stroke={2.4} /> Add a line
        </div>
      </div>

      {/* Award-eligibility summary */}
      <div className="a-card" style={{ flexShrink: 0, padding: '14px 18px', background: awardPct === 0 ? t.warningTint : t.tealTint, border: `1px solid ${awardPct === 0 ? t.warning + '44' : t.teal + '44'}`, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: t.surface, border: `1px solid ${awardPct === 0 ? t.warning + '44' : t.teal + '44'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconMedal size={15} color={awardPct === 0 ? t.warning : t.teal} stroke={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>
              {awardPct === 100
                ? `All ${pTtd(totalApi)} counts toward awards`
                : awardPct === 0
                  ? 'None of this counts toward standard awards'
                  : `${pTtd(awardApi)} of ${pTtd(totalApi)} counts toward awards`}
            </div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>
              {awardPct === 0
                ? 'General & Health build income but aren’t scored for MDRT / Club / Persistency.'
                : awardPct === 100
                  ? 'Every line is a Life product — fully award-eligible.'
                  : 'Only Life production is scored — Health & General build income, not awards.'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em' }}>TOTAL API</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', marginTop: 3 }}>{pTtd(totalApi)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em' }}>AWARD-ELIGIBLE</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: awardPct === 0 ? t.warning : t.teal, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', marginTop: 3 }}>{pTtd(awardApi)} <span style={{ fontSize: 10, color: t.inkMute }}>{awardPct}%</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em' }}>COMMISSION</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', marginTop: 3 }}>{pTtd(totalComm)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LineCard({ t, line }) {
  const c = toneColor(t, line.tone);
  const rate = line.api > 0 ? Math.round((line.commission / line.api) * 100) : 0;
  return (
    <div className="a-card" style={{ padding: '15px 16px', background: t.surface, border: `1px solid ${line.award ? c + '44' : t.rule}`, borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: c, flexShrink: 0 }}></div>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>{line.label}</span>
          <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap', color: line.award ? t.teal : t.inkFaint, background: line.award ? t.tealTint : t.surfaceMute }}>
            {line.award ? '★ COUNTS' : 'NO AWARD'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ padding: '3px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 7, fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{line.pct}%</div>
          <div style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkFaint }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6" /></svg>
          </div>
        </div>
      </div>

      {/* slider track */}
      <div style={{ position: 'relative', marginTop: 12, height: 6, background: t.surfaceMute, borderRadius: 999 }}>
        <div className="a-progress-grow" style={{ width: `${line.pct}%`, height: 6, background: c, borderRadius: 999, transformOrigin: 'left center' }}></div>
        <div style={{ position: 'absolute', left: `${line.pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: t.surface, border: `2px solid ${c}`, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        {[
          { k: 'COMMISSION', v: pTtd(line.commission) },
          { k: 'API', v: pTtd(line.api) },
          { k: 'CASES', v: `${line.cases}` },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, padding: '8px 10px', background: t.surfaceSoft, borderRadius: 8, border: `1px solid ${t.rule}` }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{s.k}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em', marginTop: 4 }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9.5, color: t.inkFaint, marginTop: 9, fontFamily: APP_FONT_MONO, letterSpacing: '0.02em' }}>
        {rate}% first-yr rate · {pTtd(line.avgCase)} avg case
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MONTHLY PLAN (step 3)
// ════════════════════════════════════════════════════════════════════════
function MonthlyPlanPage({ t, data, mobile = false }) {
  const mo = data.monthly;
  const cur = mo.months.find((m) => m.partial);
  const max = Math.max(...mo.months.map((m) => Math.max(m.target, m.actual)));
  const curPace = cur.target * cur.daysPct;
  const curVar = cur.actual - curPace;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 12-month chart */}
      <div className="a-card" style={{ flexShrink: 0, padding: mobile ? '14px 16px' : '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
        <PlanSectionHead t={t} title="Monthly API targets" sub="Ghost = target · solid = actual" right={
          <span style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{pTtd(mo.apiTarget)} / yr</span>
        } />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: mobile ? 4 : 8, height: 150, marginTop: 6 }}>
          {mo.months.map((m) => {
            const tH = (m.target / max) * 150;
            const aH = (m.actual / max) * 150;
            const isCur = m.partial;
            return (
              <div key={m.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ position: 'relative', width: '100%', height: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  {/* target ghost */}
                  <div style={{ position: 'absolute', bottom: 0, width: '78%', height: Math.max(2, tH), borderRadius: 3, background: t.surfaceMute, border: `1px ${isCur ? 'solid' : 'dashed'} ${isCur ? t.warning : t.ruleStrong}` }}></div>
                  {/* actual */}
                  {!m.future && (
                    <div className="a-bar-grow" style={{ position: 'absolute', bottom: 0, width: '78%', height: Math.max(2, aH), borderRadius: 3, background: isCur ? t.warning : (m.actual >= m.target ? t.teal : t.tealLight), transformOrigin: 'bottom', opacity: isCur ? 0.92 : 1 }}></div>
                  )}
                </div>
                <span style={{ fontSize: 8.5, fontWeight: 700, color: isCur ? t.warning : t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>{m.m}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current month + suggestions */}
      <div style={{ display: mobile ? 'flex' : 'flex', flexDirection: mobile ? 'column' : 'row', gap: 16, alignItems: 'flex-start' }}>
        <div className="a-card" style={{ flex: mobile ? undefined : 1, minWidth: 0, width: mobile ? '100%' : undefined, flexShrink: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.warning}55`, borderRadius: 13 }}>
          <Eyebrow t={t} color={t.warning}>THIS MONTH · {cur.m}</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.024em', lineHeight: 1 }}>{pTtd(cur.actual)}</span>
            <span style={{ fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>/ {pTtd(cur.target)}</span>
          </div>
          <div style={{ marginTop: 12, height: 7, background: t.surfaceMute, borderRadius: 999, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 999, overflow: 'hidden' }}>
              <div className="a-progress-grow" style={{ width: `${(cur.actual / cur.target) * 100}%`, height: 7, background: t.warning, borderRadius: 999, transformOrigin: 'left center' }}></div>
            </div>
            <div style={{ position: 'absolute', left: `${cur.daysPct * 100}%`, top: -3, bottom: -3, width: 2, background: t.ink, opacity: 0.5, borderRadius: 1 }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>Day 26 of 30</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: curVar < 0 ? t.warning : t.success, fontFamily: APP_FONT_MONO }}>
              {curVar < 0 ? '▼' : '▲'} {pTtd(Math.abs(curVar))} vs pace
            </span>
          </div>
        </div>

        <div className="a-card" style={{ flex: mobile ? undefined : 1.2, minWidth: 0, width: mobile ? '100%' : undefined, flexShrink: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
          <PlanSectionHead t={t} title="To finish the month" sub="From your variance" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mo.suggestions.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconBolt size={12} color={t.teal} stroke={2.2} />
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: t.ink }}>{s}</div>
                <IconArrowR size={13} color={t.inkFaint} stroke={2} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  HubBody, YearPlanPage, MonthlyPlanPage,
  AllocationBar, MiniMonthStrip, LineCard,
});
