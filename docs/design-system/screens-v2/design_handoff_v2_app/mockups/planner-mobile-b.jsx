// Planner & Scheduler — mobile scenes (B): Status churn, Freed-slot fill,
// Follow-up worklist, Prep card, Plan→Actual handoff. Full MFrame (390×844).

// Small reusable dimmed timeline backdrop for action sheets.
function MiniBackdrop({ t, title = 'Today' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, top: 44, opacity: 0.5, pointerEvents: 'none' }}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 23, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{title}</div>
        <div style={{ marginTop: 14 }}>
          <ApptRow t={t} appt={TODAY_APPTS[1]} />
          <ApptRow t={t} appt={{ ...TODAY_APPTS[5], status: 'scheduled' }} railLine={false} />
        </div>
      </div>
    </div>
  );
}

function SheetShell({ t, title, sub, children, padBottom = 22 }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
      background: t.surface, borderRadius: '22px 22px 0 0', borderTop: `1px solid ${t.rule}`,
      boxShadow: '0 -8px 40px rgba(0,0,0,0.18)', paddingBottom: padBottom,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9 }}>
        <div style={{ width: 38, height: 5, borderRadius: 999, background: t.ruleStrong }} />
      </div>
      {title && (
        <div style={{ padding: '12px 18px 0', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>{title}</div>
            {sub && <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{sub}</div>}
          </div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.surfaceSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute, fontSize: 18 }}>×</div>
        </div>
      )}
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 5 · STATUS CHURN — quick actions on a tapped appointment
// ──────────────────────────────────────────────────────────────────────────
function ChurnSheet({ t }) {
  const actions = [
    { key: 'kept', label: 'Kept', desc: 'It happened', Icon: IconCheck, fg: t.success, bg: t.successTint },
    { key: 'resched', label: 'Reschedule', desc: 'Change the time', Icon: IconClock, fg: t.teal, bg: t.tealTint },
    { key: 'postpone', label: 'Postpone', desc: 'Push to later', Icon: IconArrowR, fg: t.warning, bg: t.warningTint },
    { key: 'cancel', label: 'Cancel', desc: 'Kept on record', Icon: IconAlert, fg: t.danger, bg: t.dangerTint },
  ];
  return (
    <MFrame t={t}>
      <MiniBackdrop t={t} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.42)', backdropFilter: 'blur(1.5px)', zIndex: 18 }} />
      <SheetShell t={t}>
        {/* tapped appointment summary */}
        <div style={{ padding: '14px 18px 0' }}>
          <div style={{ padding: '13px 15px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 13, display: 'flex', alignItems: 'center', gap: 11 }}>
            <ActChip t={t} type="CI" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>Reshma Ali</div>
              <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>Annuity top-up · 3:00 PM · 1h</div>
            </div>
            <StatusPill t={t} status="scheduled" />
          </div>
        </div>
        {/* actions grid */}
        <div style={{ padding: '14px 18px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {actions.map((a) => (
            <div key={a.key} style={{ padding: '14px 14px', background: t.surface, border: `1.5px solid ${a.fg}33`, borderRadius: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <a.Icon size={17} color={a.fg} stroke={2.2} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>{a.label}</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
        {/* secondary links */}
        <div style={{ padding: '14px 18px 0', display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><PBtn t={t} kind="ghost" icon={<IconArrowR size={14} color={t.teal} stroke={2.2} />}>Prep card</PBtn></div>
          <div style={{ flex: 1 }}><PBtn t={t} kind="secondary">Copy WhatsApp</PBtn></div>
        </div>
      </SheetShell>
    </MFrame>
  );
}

// 5b · Retained churn — cancelled/postponed stay in the timeline (never deleted)
const CHURN_TL = [
  { time: '8:30',  mer: 'AM', type: 'FFI', dur: '45m', who: 'Kavita Ramlogan', note: 'Education plan', status: 'kept' },
  { time: '10:00', mer: 'AM', type: 'CI',  dur: '1h',  who: 'Anand Maharaj', note: 'Whole Life · 250K', amount: 'TTD 18,400', status: 'kept' },
  { time: '1:30',  mer: 'PM', type: 'AI',  dur: '45m', who: 'Nisha Persad', note: 'Referral', status: 'postponed', reschedTo: 'Thu 25 · 11:00' },
  { time: '3:00',  mer: 'PM', type: 'CI',  dur: '1h',  who: 'Reshma Ali', note: 'Annuity top-up', status: 'cancelled' },
];
function ChurnRetained({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} onBack eyebrow="TUE · 23 JUN" title="Today"
        right={<div style={{ padding: '7px 11px', background: t.successTint, color: t.success, borderRadius: 9, fontSize: 11, fontWeight: 700, fontFamily: APP_FONT_MONO }}>2 KEPT</div>} />
      <PBody t={t} top={104}>
        <div style={{ padding: '10px 13px', background: t.dangerTint, border: `1px solid ${t.danger}33`, borderRadius: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconAlert size={16} color={t.danger} />
          <div style={{ flex: 1, fontSize: 12, color: t.ink, fontWeight: 600 }}>Cancelled & postponed stay on record — nothing is deleted.</div>
        </div>
        {CHURN_TL.map((a, i) => <ApptRow key={i} t={t} appt={a} railLine={i < CHURN_TL.length - 1} />)}
      </PBody>
      <PlannerNav t={t} active="today" badge={4} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 6 · FREED-SLOT SUGGESTED FILL — surfaced when an appointment is cancelled
// ──────────────────────────────────────────────────────────────────────────
function FreedFill({ t }) {
  const opts = [
    { tag: 'FOLLOW-UP DUE', name: 'Dexter Charles', why: 'Said call back month-end', meta: 'Pension transfer · TTD 240K', Icon: IconRepeat, fg: t.warning, bg: t.warningTint },
    { tag: 'READY ANYTIME', name: 'Aaliyah Baptiste', why: 'On your waitlist — "call whenever"', meta: 'Family Income Benefit', Icon: IconBolt, fg: t.teal, bg: t.tealTint },
    { tag: 'PROSPECTING', name: 'Log as P.C time', why: 'Turn the freed hour into calls', meta: '8 prospects to dial', Icon: IconSearch, fg: t.inkAccent, bg: t.inkAccentTint },
  ];
  return (
    <MFrame t={t}>
      <MiniBackdrop t={t} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.42)', backdropFilter: 'blur(1.5px)', zIndex: 18 }} />
      <SheetShell t={t}>
        <div style={{ padding: '12px 18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="a-breathe" style={{ width: 40, height: 40, borderRadius: 12, background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconClock size={19} color={t.teal} stroke={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Fill the freed slot</div>
              <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>3:00 PM is open — Reshma cancelled</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '15px 18px 0', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {opts.map((o, i) => (
            <div key={i} className="a-card" style={{ padding: '13px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: o.bg, color: o.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <o.Icon size={17} color={o.fg} stroke={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: o.fg, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{o.tag}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginTop: 2 }}>{o.name}</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.why}</div>
              </div>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconPlus size={15} color="#fff" stroke={2.4} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 18px 0' }}><PBtn t={t} kind="secondary">Leave it open</PBtn></div>
      </SheetShell>
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 7 · FOLLOW-UP WORKLIST — batched, ~50% convert so this is central
// ──────────────────────────────────────────────────────────────────────────
function Followups({ t }) {
  const toneMap = { warning: { fg: t.warning, bg: t.warningTint }, danger: { fg: t.danger, bg: t.dangerTint } };
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="DUE FOR A CALLBACK" title="Follow-ups"
        right={<div style={{ width: 36, height: 36, borderRadius: 10, background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute }}><IconFilter size={16} color={t.inkMute} /></div>} />
      <PBody t={t} top={104}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: t.inkMute }}><b style={{ color: t.ink }}>{FOLLOWUPS.length} due</b> · about half convert</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO }}>Book all</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {FOLLOWUPS.map((f, i) => {
            const tn = toneMap[f.tone] || toneMap.warning;
            return (
              <div key={i} style={{ padding: '13px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{f.name.split(' ').map((s) => s[0]).join('')}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.meta}</div>
                  </div>
                  <div style={{ padding: '3px 9px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, color: tn.fg, background: tn.bg, letterSpacing: '0.04em', fontFamily: APP_FONT_MONO, flexShrink: 0 }}>{f.due.toUpperCase()}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, padding: '7px 10px', background: t.surfaceSoft, borderRadius: 9 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: tn.fg, flexShrink: 0 }} />
                  <div style={{ fontSize: 11.5, color: t.ink, fontStyle: 'italic' }}>“{f.why}”</div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <div style={{ flex: 1.4, padding: '9px 4px', borderRadius: 9, background: t.teal, color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><IconPlus size={12} color="#fff" stroke={2.4} />Book</div>
                  {['Snooze', 'Re-qualify', 'Release'].map((b) => (
                    <div key={b} style={{ flex: 1, padding: '9px 4px', borderRadius: 9, background: t.surfaceSoft, border: `1px solid ${t.rule}`, color: t.inkMute, fontSize: 11.5, fontWeight: 700, textAlign: 'center' }}>{b}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PBody>
      <PlannerNav t={t} active="followups" badge={FOLLOWUPS.length} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 8 · PREP CARD — history, objections, product interest + WhatsApp confirm
// ──────────────────────────────────────────────────────────────────────────
function PrepCard({ t }) {
  return (
    <MFrame t={t}>
      <PHeader t={t} onBack eyebrow="PREP · BEFORE YOU GO IN" title="Anand Maharaj"
        right={<div style={{ width: 36, height: 36, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY }}>AM</div>} />
      <PBody t={t} top={108}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* next appt context */}
          <div style={{ padding: '13px 15px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 13, display: 'flex', alignItems: 'center', gap: 11 }}>
            <ActChip t={t} type="CI" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>Closing interview · Today 10:00</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>Whole Life · 250K cover · TTD 18,400 API</div>
            </div>
          </div>

          {/* product interest + last contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <div style={{ padding: '12px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>LAST CONTACT</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 5 }}>6 days ago</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 3 }}>F.F.I · 17 Jun</div>
            </div>
            <div style={{ padding: '12px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>INTERESTED IN</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {['Whole Life', 'Critical Illness'].map((p) => <span key={p} style={{ padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: t.teal, background: t.tealTint }}>{p}</span>)}
              </div>
            </div>
          </div>

          {/* objections */}
          <div style={{ padding: '13px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, marginBottom: 9 }}>LOGGED OBJECTIONS</div>
            {[
              { o: '“Premium feels high”', a: 'Showed monthly cost vs daily spend' },
              { o: '“Need to check with wife”', a: 'She joins today\u2019s call' },
            ].map((x, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 9, paddingBottom: i < arr.length - 1 ? 9 : 0, marginBottom: i < arr.length - 1 ? 9 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${t.rule}` : 'none' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.warning, marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{x.o}</div>
                  <div style={{ fontSize: 11, color: t.inkMute, marginTop: 2 }}>↳ {x.a}</div>
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp confirm — app never sends; agent pastes */}
          <div style={{ padding: '13px 15px', background: t.successTint, border: `1px solid ${t.success}33`, borderRadius: 13 }}>
            <div style={{ fontSize: 11, color: t.ink, lineHeight: 1.5, padding: '10px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 10, fontFamily: APP_FONT_MONO }}>
              Morning Anand! Confirming our 10:00 today re your Whole Life cover. See you then — Marsha, Tatil Life.
            </div>
            <div style={{ marginTop: 10 }}><PBtn t={t} kind="primary" icon={<IconCheck size={15} color="#fff" stroke={2.4} />}>Copy WhatsApp confirmation</PBtn></div>
            <div style={{ fontSize: 10, color: t.inkMute, textAlign: 'center', marginTop: 7 }}>Copies to clipboard — you paste &amp; send it yourself</div>
          </div>
        </div>
      </PBody>
      <PlannerNav t={t} active="today" badge={4} />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 9 · PLAN → ACTUAL HANDOFF — evening pre-fill (the core payoff)
// ──────────────────────────────────────────────────────────────────────────
const HANDOFF_ROWS = [
  { type: 'FFI', planned: 1, actual: 1, who: 'Kavita Ramlogan', kept: true },
  { type: 'CI',  planned: 2, actual: 1, who: 'Anand Maharaj · sale', kept: true, sale: 'TTD 18,400' },
  { type: 'SC',  planned: 1, actual: 1, who: 'Marlon Joseph', kept: true },
  { type: 'AI',  planned: 1, actual: 0, who: 'Nisha Persad · postponed', kept: false },
];
function Handoff({ t, done }) {
  if (done) {
    return (
      <MFrame t={t}>
        <div style={{ position: 'absolute', inset: 0, top: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' }}>
          <div className="a-scale-in" style={{ width: 84, height: 84, borderRadius: '50%', background: t.successTint, border: `2px solid ${t.success}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
            <IconCheck size={42} color={t.success} stroke={2.4} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>Day logged</div>
          <div style={{ fontSize: 13.5, color: t.inkMute, marginTop: 8, lineHeight: 1.55 }}>3 kept · 1 sale · <b style={{ color: t.gold }}>TTD 18,400 API</b> flowed straight into your weekly report. No re-typing.</div>
          <div style={{ marginTop: 22, width: '100%' }}><PBtn t={t} kind="primary" icon={<IconArrowR size={15} color="#fff" stroke={2.4} />}>Open weekly report</PBtn></div>
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: t.inkMute }}>Plan tomorrow</div>
        </div>
        <PlannerNav t={t} active="today" badge={4} />
      </MFrame>
    );
  }
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="EVENING · WRAP UP" title="How did today go?"
        right={<div style={{ padding: '7px 11px', background: t.tealTint, color: t.teal, borderRadius: 9, fontSize: 11, fontWeight: 700, fontFamily: APP_FONT_MONO }}>9:42 PM</div>} />
      <PBody t={t} top={108}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* hero: planned vs kept */}
          <div style={{ padding: '16px 18px', background: t.teal, borderRadius: 14, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -30, width: 160, height: 160, background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 65%)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, opacity: 0.85 }}>WE PRE-FILLED IT FROM YOUR PLAN</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <div style={{ fontSize: 38, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>3<span style={{ fontSize: 22, opacity: 0.7 }}> / 6</span></div>
                <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>kept — just confirm below</div>
              </div>
            </div>
          </div>

          {/* mapped rows */}
          <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, flex: 1 }}>FROM PLAN → REPORT</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>KEPT</div>
            </div>
            {HANDOFF_ROWS.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderBottom: i < HANDOFF_ROWS.length - 1 ? `1px solid ${t.rule}` : 'none', opacity: r.kept ? 1 : 0.6 }}>
                <ActChip t={t} type={r.type} size="s" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.who}</div>
                  {r.sale && <div style={{ fontSize: 11, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, marginTop: 1 }}>{r.sale} API</div>}
                </div>
                {r.kept ? (
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: t.successTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconCheck size={15} color={t.success} stroke={2.6} /></div>
                ) : (
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>MOVED</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11.5, color: t.inkMute, textAlign: 'center', padding: '0 8px', lineHeight: 1.5 }}>Tap any row to adjust. The postponed A.I rebooked itself to Thursday.</div>
          <PBtn t={t} kind="primary" icon={<IconArrowR size={15} color="#fff" stroke={2.4} />}>Confirm &amp; send to weekly report</PBtn>
        </div>
      </PBody>
      <PlannerNav t={t} active="today" badge={4} />
    </MFrame>
  );
}

Object.assign(window, { MiniBackdrop, SheetShell, ChurnSheet, ChurnRetained, FreedFill, Followups, PrepCard, Handoff });
