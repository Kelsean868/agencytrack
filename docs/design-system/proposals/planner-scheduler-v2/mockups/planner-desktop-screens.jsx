// Planner & Scheduler — desktop versions of every screen. Reuses
// PlannerDeskFrame (sidebar + topbar) + mobile primitives, reflowed into a
// master / right-rail desktop layout. Modals (Add / Churn / Freed) render over
// a faded board. Loads after planner-desktop.jsx.

function RailCard({ t, title, right, children, pad = '15px 16px', style = {} }) {
  return (
    <div style={{ padding: pad, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{title}</div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function MainCard({ t, children, style = {} }) {
  return <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, padding: '20px 22px', ...style }}>{children}</div>;
}

// Compact follow-up row used in rails / lists.
function FollowupRail({ t, f }) {
  const tn = f.tone === 'danger' ? { fg: t.danger, bg: t.dangerTint } : { fg: t.warning, bg: t.warningTint };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: `1px solid ${t.rule}` }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{f.name.split(' ').map((s) => s[0]).join('')}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
        <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.why}</div>
      </div>
      <div style={{ padding: '6px 11px', background: t.teal, color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Book</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// TODAY (desktop)
// ──────────────────────────────────────────────────────────────────────────
function PlannerTodayDesk({ t }) {
  return (
    <PlannerDeskFrame t={t} active="planner" title="Today" subtitle="Tuesday · 23 June 2026">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* day pulse */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { k: 'BOOKED', v: '6', s: 'appointments', c: t.teal },
              { k: 'KEPT', v: '1', s: 'so far today', c: t.success },
              { k: 'FREE', v: '2', s: 'open gaps', c: t.warning },
              { k: 'API TODAY', v: 'TTD 18.4K', s: '1 sale closed', c: t.gold, big: true },
            ].map((x, i) => (
              <div key={i} style={{ padding: '13px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: x.c, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{x.k}</div>
                <div style={{ fontSize: x.big ? 19 : 24, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 7 }}>{x.v}</div>
                <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 4 }}>{x.s}</div>
              </div>
            ))}
          </div>
          {/* timeline */}
          <MainCard t={t} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Your day</div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 11.5, color: t.inkMute }}>Click a gap to book · click an appointment for actions</div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', maxWidth: 560 }}>
              <ApptRow t={t} appt={TODAY_APPTS[0]} />
              <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 12px' }}>
                <div style={{ width: 52, textAlign: 'right', paddingRight: 12, fontSize: 10, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO }}>9:18</div>
                <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}><div style={{ width: 9, height: 9, borderRadius: '50%', background: t.teal, boxShadow: `0 0 0 3px ${t.tealTint}` }} /></div>
                <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${t.teal}, ${t.teal}00)`, borderRadius: 999, marginLeft: 2 }} />
                <div style={{ fontSize: 9.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, marginLeft: 6, letterSpacing: '0.1em' }}>NOW</div>
              </div>
              <ApptRow t={t} appt={TODAY_APPTS[1]} />
              <ApptRow t={t} appt={TODAY_APPTS[2]} />
              <GapRow t={t} time="4:00" mer="PM" free="1h free" />
              <ApptRow t={t} appt={TODAY_APPTS[6]} railLine={false} />
            </div>
          </MainCard>
        </div>
        {/* rail */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <RailCard t={t} title="Follow-ups due" right={<Pill t={t} color={t.warning} bg={t.warningTint}>{FOLLOWUPS.length} due</Pill>}>
            {FOLLOWUPS.map((f, i) => <FollowupRail key={i} t={t} f={f} />)}
            <div style={{ marginTop: 11 }}><PBtn t={t} kind="ghost" icon={<IconArrowR size={14} color={t.teal} stroke={2.2} />}>Open worklist</PBtn></div>
          </RailCard>
          <div style={{ padding: '15px 17px', background: t.tealTint, border: `1px dashed ${t.teal}55`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconPlus size={19} color="#fff" stroke={2.4} /></div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>Quick book</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>Prospect or free block · ⌘B</div>
            </div>
          </div>
        </div>
      </div>
    </PlannerDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DAY TIMELINE (desktop)
// ──────────────────────────────────────────────────────────────────────────
function PlannerDayDesk({ t }) {
  return (
    <PlannerDeskFrame t={t} active="planner" title="Thursday · 25 June" subtitle="Day timeline · click a gap to fill it">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <MainCard t={t} style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>5 booked · 2 closing interviews</div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: t.surfaceSoft, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ display: 'flex', transform: 'scaleX(-1)' }}><IconChevR size={15} color={t.inkMute} stroke={2.2} /></span></div>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: t.surfaceSoft, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconChevR size={15} color={t.inkMute} stroke={2.2} /></div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', maxWidth: 560 }}>
            {THU_APPTS.map((it, i) => {
              const last = i === THU_APPTS.length - 1;
              return it.kind === 'gap'
                ? <GapRow key={i} t={t} time={it.time} mer={it.mer} free={it.free} railLine={!last} />
                : <ApptRow key={i} t={t} appt={it.a} railLine={!last} />;
            })}
          </div>
        </MainCard>
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <RailCard t={t} title="This day vs minimum">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {WEEK_TARGETS.map((w, i) => <CounterBar key={i} t={t} type={w.type} booked={w.booked} target={w.target} />)}
            </div>
          </RailCard>
          <RailCard t={t} title="Fill the 2 open gaps" style={{ background: t.tealTint, borderColor: `${t.teal}33` }}>
            {[
              { who: 'Dexter Charles', why: 'Follow-up due today', slot: '10:30 AM' },
              { who: 'Aaliyah Baptiste', why: 'Waitlist · ready anytime', slot: '4:00 PM' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i === 0 ? `1px solid ${t.teal}22` : 'none' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, width: 54, flexShrink: 0 }}>{s.slot}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{s.who}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{s.why}</div>
                </div>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconPlus size={14} color="#fff" stroke={2.4} /></div>
              </div>
            ))}
          </RailCard>
        </div>
      </div>
    </PlannerDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// FOLLOW-UP WORKLIST (desktop)
// ──────────────────────────────────────────────────────────────────────────
function FollowupsDesk({ t }) {
  const tone = (f) => (f.tone === 'danger' ? { fg: t.danger, bg: t.dangerTint } : { fg: t.warning, bg: t.warningTint });
  return (
    <PlannerDeskFrame t={t} active="followups" title="Follow-ups" subtitle="Due for a callback · about half convert">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, color: t.inkMute }}><b style={{ color: t.ink }}>{FOLLOWUPS.length} prospects</b> waiting on a callback</div>
            <div style={{ flex: 1 }} />
            <div style={{ padding: '8px 14px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12, fontWeight: 700 }}>Book all into open slots</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FOLLOWUPS.map((f, i) => {
              const tn = tone(f);
              return (
                <div key={i} style={{ padding: '15px 17px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 15 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{f.name.split(' ').map((s) => s[0]).join('')}</div>
                  <div style={{ width: 190, flexShrink: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>{f.name}</div>
                    <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2 }}>{f.meta}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: tn.fg, flexShrink: 0 }} />
                    <div style={{ fontSize: 12.5, color: t.ink, fontStyle: 'italic' }}>“{f.why}”</div>
                  </div>
                  <div style={{ padding: '3px 10px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, color: tn.fg, background: tn.bg, fontFamily: APP_FONT_MONO, flexShrink: 0 }}>{f.due.toUpperCase()}</div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <div style={{ padding: '8px 14px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><IconPlus size={13} color="#fff" stroke={2.4} />Book</div>
                    {['Snooze', 'Re-qualify', 'Release'].map((b) => (
                      <div key={b} style={{ padding: '8px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, color: t.inkMute, borderRadius: 9, fontSize: 12, fontWeight: 700 }}>{b}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ width: 272, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <RailCard t={t} title="Worklist health">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 38, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>~50%</div>
              <div style={{ fontSize: 12, color: t.inkMute }}>convert to a booking</div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                { k: 'Overdue', v: '1', c: t.danger },
                { k: 'Due today', v: '2', c: t.warning },
                { k: 'This week', v: '1', c: t.inkMute },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.c }} />
                  <div style={{ flex: 1, fontSize: 12.5, color: t.ink }}>{r.k}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{r.v}</div>
                </div>
              ))}
            </div>
          </RailCard>
          <RailCard t={t} style={{ background: t.warningTint, borderColor: `${t.warning}33` }}>
            <Eyebrow t={t} color={t.warning}>Don’t let these go cold</Eyebrow>
            <div style={{ fontSize: 13, color: t.ink, marginTop: 7, lineHeight: 1.5 }}>Curtis Mohammed is <b>2 days overdue</b>. Re-quote the annuity and book before he forgets the conversation.</div>
          </RailCard>
        </div>
      </div>
    </PlannerDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// PREP CARD (desktop)
// ──────────────────────────────────────────────────────────────────────────
function PrepDesk({ t }) {
  return (
    <PlannerDeskFrame t={t} active="planner" title="Prep · Anand Maharaj" subtitle="Before you go in · Closing interview today 10:00">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MainCard t={t}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, fontFamily: APP_FONT_DISPLAY }}>AM</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Anand Maharaj</div>
                <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 2 }}>San Fernando · referred by Kavita Ramlogan</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Whole Life', 'Critical Illness'].map((p) => <span key={p} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: t.teal, background: t.tealTint }}>{p}</span>)}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 18 }}>
              {[
                { k: 'LAST CONTACT', v: '6 days ago', s: 'F.F.I · 17 Jun' },
                { k: 'PRODUCT', v: 'Whole Life', s: '250K cover' },
                { k: 'API AT STAKE', v: 'TTD 18,400', s: 'if closed today', c: t.gold },
              ].map((x, i) => (
                <div key={i} style={{ padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{x.k}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: x.c || t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>{x.v}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 3 }}>{x.s}</div>
                </div>
              ))}
            </div>
          </MainCard>
          <MainCard t={t} style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.warning, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, marginBottom: 13 }}>LOGGED OBJECTIONS · HOW YOU HANDLED THEM</div>
            {[
              { o: '“Premium feels high”', a: 'Showed monthly cost vs daily spend — landed well' },
              { o: '“Need to check with wife”', a: 'She joins today’s call — bring the joint-life option' },
              { o: '“Already have group cover at work”', a: 'Group ends when the job does — personal cover is portable' },
            ].map((x, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 11, paddingBottom: i < arr.length - 1 ? 12 : 0, marginBottom: i < arr.length - 1 ? 12 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${t.rule}` : 'none' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.warning, marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{x.o}</div>
                  <div style={{ fontSize: 12, color: t.inkMute, marginTop: 3 }}>↳ {x.a}</div>
                </div>
              </div>
            ))}
          </MainCard>
        </div>
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <RailCard t={t} style={{ background: t.tealTint, borderColor: `${t.teal}33` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ActChip t={t} type="CI" />
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>Today · 10:00 AM</div>
            </div>
            <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 8 }}>Confirmed via WhatsApp · 1h · your office</div>
          </RailCard>
          <RailCard t={t} title="Confirm the appointment">
            <div style={{ fontSize: 12, color: t.ink, lineHeight: 1.55, padding: '12px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, fontFamily: APP_FONT_MONO }}>
              Morning Anand! Confirming our 10:00 today re your Whole Life cover. See you then — Marsha, Tatil Life.
            </div>
            <div style={{ marginTop: 11 }}><PBtn t={t} kind="primary" icon={<IconCheck size={15} color="#fff" stroke={2.4} />}>Copy WhatsApp confirmation</PBtn></div>
            <div style={{ fontSize: 10, color: t.inkMute, textAlign: 'center', marginTop: 7 }}>Copies to clipboard — you paste &amp; send it yourself</div>
          </RailCard>
        </div>
      </div>
    </PlannerDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// PLAN → ACTUAL HANDOFF (desktop)
// ──────────────────────────────────────────────────────────────────────────
function HandoffDesk({ t }) {
  return (
    <PlannerDeskFrame t={t} active="planner" title="Wrap up today" subtitle="Evening · 9:42 PM · we pre-filled your report from the plan">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '20px 24px', background: t.teal, borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -50, right: -30, width: 220, height: 220, background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 65%)' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, opacity: 0.85 }}>FROM YOUR PLAN</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                  <div style={{ fontSize: 46, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>3<span style={{ fontSize: 26, opacity: 0.7 }}> / 6</span></div>
                  <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.92 }}>kept — confirm, don’t re-type</div>
                </div>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.25)' }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, opacity: 0.85 }}>API WRITTEN</div>
                <div style={{ fontSize: 30, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, marginTop: 8, letterSpacing: '-0.02em' }}>TTD 18,400</div>
              </div>
            </div>
          </div>
          <MainCard t={t} style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '13px 20px', borderBottom: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, flex: 1 }}>FROM PLAN → WEEKLY REPORT</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>KEPT</div>
            </div>
            {HANDOFF_ROWS.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < HANDOFF_ROWS.length - 1 ? `1px solid ${t.rule}` : 'none', opacity: r.kept ? 1 : 0.6 }}>
                <ActChip t={t} type={r.type} />
                <div style={{ width: 120, flexShrink: 0, fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{ACT_NAME[r.type]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{r.who}</div>
                  {r.sale && <div style={{ fontSize: 11.5, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, marginTop: 1 }}>{r.sale} API</div>}
                </div>
                {r.kept
                  ? <div style={{ width: 28, height: 28, borderRadius: 8, background: t.successTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconCheck size={16} color={t.success} stroke={2.6} /></div>
                  : <div style={{ fontSize: 10.5, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>REBOOKED THU</div>}
              </div>
            ))}
          </MainCard>
        </div>
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <RailCard t={t} title="Tomorrow · Wed 24 Jun">
            {DESK_WEEK[2].appts.map((ap, i) => <div key={i} style={{ marginBottom: 7 }}><DeskApptChip t={t} ap={ap} /></div>)}
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 4 }}>2 booked · 1 postponed A.I lands here at 11:00.</div>
          </RailCard>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ fontSize: 11.5, color: t.inkMute, textAlign: 'center', lineHeight: 1.5 }}>Tap any row to adjust before it posts.</div>
            <PBtn t={t} kind="primary" icon={<IconArrowR size={15} color="#fff" stroke={2.4} />}>Confirm &amp; send to weekly report</PBtn>
          </div>
        </div>
      </div>
    </PlannerDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MODALS (desktop) — Add / Churn / Freed over a faded board
// ──────────────────────────────────────────────────────────────────────────
function DeskModal({ t, w = 480, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.5)', backdropFilter: 'blur(2px)' }} />
      <div className="a-scale-in" style={{ position: 'relative', width: w, maxHeight: 680, background: t.surface, borderRadius: 18, border: `1px solid ${t.rule}`, boxShadow: '0 30px 90px rgba(0,0,0,0.4)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}
function ModalHead({ t, title, sub }) {
  return (
    <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.surfaceSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute, fontSize: 19 }}>×</div>
    </div>
  );
}

function AddDesk({ t, mode = 'prospect' }) {
  return (
    <div style={{ width: APP_W, height: APP_H, position: 'relative', overflow: 'hidden' }}>
      <PlannerDesktop t={t} />
      <DeskModal t={t}>
        <ModalHead t={t} title="Book appointment" sub="Wed · Jun 24" />
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SegTabs t={t} active={mode} options={[
            { key: 'prospect', label: 'Prospect', icon: <IconSearch size={13} color={mode === 'prospect' ? t.ink : t.inkMute} /> },
            { key: 'free', label: 'Free block', icon: <IconClock size={13} color={mode === 'free' ? t.ink : t.inkMute} /> },
          ]} />
          {mode === 'prospect' ? (
            <FieldRow t={t} label="Who">
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                <IconSearch size={15} color={t.inkMute} />
                <div style={{ flex: 1, fontSize: 13.5, color: t.ink, fontWeight: 600 }}>Kavita Ramlogan</div>
                <IconCheck size={16} color={t.teal} stroke={2.4} />
              </div>
            </FieldRow>
          ) : (
            <FieldRow t={t} label="Block type">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {['Training', 'Company seminar', 'Tradeshow', 'Prospecting time', 'Personal'].map((b, i) => (
                  <div key={i} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: i === 0 ? t.teal : t.surfaceSoft, color: i === 0 ? '#fff' : t.inkMute, border: `1px solid ${i === 0 ? t.teal : t.rule}` }}>{b}</div>
                ))}
              </div>
            </FieldRow>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><FieldRow t={t} label="Time"><div style={{ padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13.5, fontWeight: 700, color: t.ink, display: 'flex', justifyContent: 'space-between' }}>10:00 AM <IconChevD size={14} color={t.inkMute} /></div></FieldRow></div>
            <div style={{ width: 130 }}><FieldRow t={t} label="Length"><div style={{ padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13.5, fontWeight: 700, color: t.ink, display: 'flex', justifyContent: 'space-between' }}>1h <IconChevD size={14} color={t.inkMute} /></div></FieldRow></div>
          </div>
          {mode === 'prospect' && (
            <FieldRow t={t} label="Activity type">
              <div style={{ display: 'flex', gap: 7 }}>
                {['PC', 'SC', 'AI', 'FFI', 'CI'].map((ty) => {
                  const on = ty === 'CI'; const s = actStyle(t, ty);
                  return <div key={ty} style={{ flex: 1, textAlign: 'center', padding: '11px 4px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, fontFamily: APP_FONT_MONO, background: on ? s.bg : t.surfaceSoft, color: on ? (s.solid ? '#fff' : s.fg) : t.inkMute, border: `1.5px solid ${on ? (s.solid ? s.bg : s.fg) : t.rule}` }}>{ACT_CODE[ty]}</div>;
                })}
              </div>
            </FieldRow>
          )}
        </div>
        <div style={{ padding: '4px 22px 20px', display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><PBtn t={t} kind="secondary">Save &amp; add another</PBtn></div>
          <div style={{ flex: 1 }}><PBtn t={t} kind="primary" icon={<IconCheck size={15} color="#fff" stroke={2.4} />}>Save</PBtn></div>
        </div>
      </DeskModal>
    </div>
  );
}

function ChurnDesk({ t }) {
  const actions = [
    { label: 'Kept', desc: 'It happened', Icon: IconCheck, fg: t.success, bg: t.successTint },
    { label: 'Reschedule', desc: 'Change the time', Icon: IconClock, fg: t.teal, bg: t.tealTint },
    { label: 'Postpone', desc: 'Push to later', Icon: IconArrowR, fg: t.warning, bg: t.warningTint },
    { label: 'Cancel', desc: 'Kept on record', Icon: IconAlert, fg: t.danger, bg: t.dangerTint },
  ];
  return (
    <div style={{ width: APP_W, height: APP_H, position: 'relative', overflow: 'hidden' }}>
      <PlannerTodayDesk t={t} />
      <DeskModal t={t} w={460}>
        <ModalHead t={t} title="Reshma Ali" sub="C.I · Annuity top-up · 3:00 PM" />
        <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
          {actions.map((a, i) => (
            <div key={i} style={{ padding: '16px 16px', background: t.surface, border: `1.5px solid ${a.fg}33`, borderRadius: 13, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><a.Icon size={18} color={a.fg} stroke={2.2} /></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>{a.label}</div>
                <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '4px 22px 20px', display: 'flex', gap: 11 }}>
          <div style={{ flex: 1 }}><PBtn t={t} kind="ghost" icon={<IconArrowR size={14} color={t.teal} stroke={2.2} />}>Prep card</PBtn></div>
          <div style={{ flex: 1 }}><PBtn t={t} kind="secondary">Copy WhatsApp</PBtn></div>
        </div>
      </DeskModal>
    </div>
  );
}

function FreedDesk({ t }) {
  const opts = [
    { tag: 'FOLLOW-UP DUE', name: 'Dexter Charles', why: 'Said call back month-end', Icon: IconRepeat, fg: t.warning, bg: t.warningTint },
    { tag: 'READY ANYTIME', name: 'Aaliyah Baptiste', why: 'On your waitlist — "call whenever"', Icon: IconBolt, fg: t.teal, bg: t.tealTint },
    { tag: 'PROSPECTING', name: 'Log as P.C time', why: 'Turn the freed hour into 8 calls', Icon: IconSearch, fg: t.inkAccent, bg: t.inkAccentTint },
  ];
  return (
    <div style={{ width: APP_W, height: APP_H, position: 'relative', overflow: 'hidden' }}>
      <PlannerTodayDesk t={t} />
      <DeskModal t={t} w={500}>
        <ModalHead t={t} title="Fill the freed slot" sub="3:00 PM is open — Reshma cancelled" />
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {opts.map((o, i) => (
            <div key={i} style={{ padding: '14px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: o.bg, color: o.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><o.Icon size={19} color={o.fg} stroke={2} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: o.fg, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{o.tag}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, marginTop: 2 }}>{o.name}</div>
                <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{o.why}</div>
              </div>
              <div style={{ padding: '9px 14px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><IconPlus size={14} color="#fff" stroke={2.4} />Book</div>
            </div>
          ))}
          <div style={{ marginTop: 2 }}><PBtn t={t} kind="secondary">Leave it open</PBtn></div>
        </div>
      </DeskModal>
    </div>
  );
}

Object.assign(window, {
  RailCard, MainCard, FollowupRail,
  PlannerTodayDesk, PlannerDayDesk, FollowupsDesk, PrepDesk, HandoffDesk,
  DeskModal, ModalHead, AddDesk, ChurnDesk, FreedDesk,
});
