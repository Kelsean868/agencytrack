// Planner & Scheduler — MANAGER tier: PERSONAL PLANNER desktop scenes.
// Reuses MgrDeskFrame / MgrRailCard (planner-manager-desktop) + the personal
// primitives/data (planner-manager-personal). active="myplanner".

// ──────────────────────────────────────────────────────────────────────────
// 1 · MY DAY (desktop, blended)
// ──────────────────────────────────────────────────────────────────────────
function MgrMyDayDesk({ t }) {
  return (
    <MgrDeskFrame t={t} active="myplanner" title="My day" subtitle="Tuesday · 23 June · your own selling + coaching + recruiting day">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* split + pulse */}
          <div style={{ display: 'flex', gap: 12 }}>
            <MgrRailCard t={t} title="How today splits" style={{ flex: 1 }}>
              <TimeSplit t={t} sell={40} coach={30} recruit={30} />
            </MgrRailCard>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { k: 'API TODAY', v: 'TTD 18.4K', c: t.gold },
                { k: 'R.I BOOKED', v: '2/3', c: t.inkAccent },
              ].map((x, i) => (
                <div key={i} style={{ width: 130, padding: '13px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: x.c, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{x.k}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 8, lineHeight: 1 }}>{x.v}</div>
                </div>
              ))}
            </div>
          </div>
          {/* timeline */}
          <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, padding: '20px 22px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Your day · three hats</div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                {['sell', 'coach', 'recruit'].map((s) => <StreamTag key={s} t={t} stream={s} />)}
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', maxWidth: 580 }}>
              <MgrApptRow t={t} ap={MGR_MY_DAY[0]} />
              <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 12px' }}>
                <div style={{ width: 52, textAlign: 'right', paddingRight: 12, fontSize: 10, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO }}>9:18</div>
                <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}><div style={{ width: 9, height: 9, borderRadius: '50%', background: t.teal, boxShadow: `0 0 0 3px ${t.tealTint}` }} /></div>
                <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${t.teal}, ${t.teal}00)`, borderRadius: 999, marginLeft: 2 }} />
                <div style={{ fontSize: 9.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, marginLeft: 6, letterSpacing: '0.1em' }}>NOW</div>
              </div>
              {MGR_MY_DAY.slice(1, 6).map((ap, i) => <MgrApptRow key={i} t={t} ap={ap} />)}
              <MgrApptRow t={t} ap={MGR_MY_DAY[6]} railLine={false} />
            </div>
          </div>
        </div>
        {/* rail */}
        <div style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MgrRailCard t={t} title="Next up · recruiting" style={{ background: t.inkAccentTint, borderColor: `${t.inkAccent}33` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Ava t={t} name="Anisa Mohammed" size={40} bg={t.surface} fg={t.inkAccent} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>Anisa Mohammed</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>R.I · 10:30 · ref by Marsha</div>
              </div>
            </div>
            <div style={{ marginTop: 11 }}><PBtn t={t} kind="ghost" icon={<IconArrowR size={14} color={t.teal} stroke={2.2} />}>Open candidate</PBtn></div>
          </MgrRailCard>
          <MgrRailCard t={t} title="Your week balance">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}><StreamTag t={t} stream="sell" mini /><div style={{ flex: 1 }} /></div>
                {MGR_SELL_TARGETS.map((w, i) => <div key={i} style={{ marginBottom: 8 }}><CounterBar t={t} type={w.code} booked={w.booked} target={w.target} /></div>)}
              </div>
              <div style={{ paddingTop: 4, borderTop: `1px solid ${t.rule}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 9px' }}><StreamTag t={t} stream="recruit" mini /><div style={{ flex: 1 }} /></div>
                {MGR_RECRUIT_TARGETS.map((w, i) => <div key={i} style={{ marginBottom: 8 }}><RTarget t={t} code={w.code} booked={w.booked} target={w.target} /></div>)}
              </div>
            </div>
          </MgrRailCard>
        </div>
      </div>
    </MgrDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2 · MY WEEK (desktop) — personal blended week board
// ──────────────────────────────────────────────────────────────────────────
function MgrMyWeekDesk({ t }) {
  return (
    <MgrDeskFrame t={t} active="myplanner" title="My week" subtitle="Book your own selling, coaching & recruiting commitments">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Eyebrow t={t}>Next 8 days</Eyebrow>
            <div style={{ display: 'flex', gap: 8, marginTop: 9, overflow: 'hidden' }}>{MGR_DAY_STRIP.map((d, i) => <DayStripCell key={i} t={t} d={d} selected={d.today} />)}</div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Week of Jun 22 – 28</div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 8 }}>{['sell', 'coach', 'recruit'].map((s) => <StreamTag key={s} t={t} stream={s} mini />)}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, height: 'calc(100% - 30px)' }}>
              {MGR_WEEK.map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', background: d.today ? t.tealTint : t.surface, border: `1px solid ${d.today ? `${t.teal}44` : t.rule}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '9px 10px', borderBottom: `1px solid ${d.today ? `${t.teal}33` : t.rule}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: d.today ? t.teal : t.inkFaint, fontFamily: APP_FONT_MONO }}>{d.dow.toUpperCase()}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 1 }}>{d.date}</div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: d.count ? (d.today ? t.teal : t.inkMute) : t.inkDim, fontFamily: APP_FONT_MONO }}>{d.count || '—'}</div>
                  </div>
                  <div style={{ flex: 1, padding: 7, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
                    {d.mix.map((c, j) => {
                      const meta = mgrCodeMeta(t, c);
                      const stream = ACT_CODE[c] ? 'sell' : (RCODE[c] ? RCODE[c].stream : 'sell');
                      const sf = streamStyle(t, stream).fg;
                      return (
                        <div key={j} style={{ padding: '5px 7px', borderRadius: 7, background: t.surfaceSoft, borderLeft: `3px solid ${sf}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MgrChip t={t} code={c} size="s" />
                        </div>
                      );
                    })}
                    <div style={{ padding: '6px', borderRadius: 7, border: `1.5px dashed ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: t.inkMute, marginTop: 'auto' }}><IconPlus size={11} color={t.inkMute} stroke={2.4} /><span style={{ fontSize: 10, fontWeight: 600 }}>Add</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ width: 272, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MgrRailCard t={t} title="Sell · vs minimum">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>{MGR_SELL_TARGETS.map((w, i) => <CounterBar key={i} t={t} type={w.code} booked={w.booked} target={w.target} />)}</div>
          </MgrRailCard>
          <MgrRailCard t={t} title="Recruit · this week" style={{ background: t.inkAccentTint, borderColor: `${t.inkAccent}33` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>{MGR_RECRUIT_TARGETS.map((w, i) => <RTarget key={i} t={t} code={w.code} booked={w.booked} target={w.target} />)}</div>
          </MgrRailCard>
          <MgrRailCard t={t} style={{ background: t.surfaceSoft }}>
            <Eyebrow t={t}>Protect your sales time</Eyebrow>
            <div style={{ fontSize: 12, color: t.ink, marginTop: 7, lineHeight: 1.5 }}>Coaching &amp; unit meetings are stacking on Wed. Keep two mornings clear for your own C.I work.</div>
          </MgrRailCard>
        </div>
      </div>
    </MgrDeskFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3 · MY RECRUITING (desktop) — career pipeline + activity
// ──────────────────────────────────────────────────────────────────────────
function MgrRecruitingDesk({ t }) {
  return (
    <MgrDeskFrame t={t} active="myplanner" title="Recruiting" subtitle="Grow your unit · career pipeline + recruiting activity">
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* funnel */}
          <MgrRailCard t={t} title="Career pipeline">
            <div style={{ display: 'flex', gap: 8 }}>
              {RECRUIT_FUNNEL.map((f, i) => {
                const tone = [t.inkAccent, t.teal, t.gold, t.success][i];
                const tint = [t.inkAccentTint, t.tealTint, t.goldTint, t.successTint][i];
                return (
                  <div key={i} style={{ flex: f.count + 1.5, minWidth: 0 }}>
                    <div style={{ height: 56, borderRadius: 11, background: tint, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: tone }}>
                      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{f.count}</div>
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 6, textAlign: 'center' }}>{f.stage.toUpperCase()}</div>
                  </div>
                );
              })}
            </div>
          </MgrRailCard>
          {/* candidates */}
          <MgrRailCard t={t} title="Candidates" style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {RECRUIT_PIPELINE.map((c, i) => (
                <div key={i} style={{ padding: '13px 15px', background: t.surfaceSoft, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Ava t={t} name={c.name} size={38} bg={t.inkAccentTint} fg={t.inkAccent} />
                  <div style={{ width: 180, flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: t.inkMute, marginTop: 2 }}>{c.meta}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconArrowR size={14} color={t.inkAccent} stroke={2.2} />
                    <div style={{ fontSize: 12.5, color: t.ink, fontWeight: 600 }}>Next: {c.next}</div>
                  </div>
                  <StagePill t={t} stage={c.stage} />
                  <div style={{ padding: '8px 14px', background: t.inkAccent, color: '#fff', borderRadius: 9, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Book</div>
                </div>
              ))}
            </div>
          </MgrRailCard>
        </div>
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MgrRailCard t={t} title="This week · recruiting" style={{ background: t.inkAccentTint, borderColor: `${t.inkAccent}33` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>{MGR_RECRUIT_TARGETS.map((w, i) => <RTarget key={i} t={t} code={w.code} booked={w.booked} target={w.target} />)}</div>
          </MgrRailCard>
          <MgrRailCard t={t} title="Career seminar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: t.goldTint, color: t.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconBolt size={20} color={t.gold} stroke={2} /></div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>Sat · Jun 27 · 10:00</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>Career night · 5 invited</div>
              </div>
            </div>
            <div style={{ marginTop: 11 }}><PBtn t={t} kind="secondary">Manage invites</PBtn></div>
          </MgrRailCard>
          <MgrRailCard t={t} style={{ background: t.surfaceSoft }}>
            <Eyebrow t={t}>Tip</Eyebrow>
            <div style={{ fontSize: 12, color: t.ink, marginTop: 7, lineHeight: 1.5 }}>Kern attended the last career night and is keen — book his 2nd interview before he cools.</div>
          </MgrRailCard>
        </div>
      </div>
    </MgrDeskFrame>
  );
}

Object.assign(window, { MgrMyDayDesk, MgrMyWeekDesk, MgrRecruitingDesk, MgrBookDesk });

// ──────────────────────────────────────────────────────────────────────────
// 4 · BOOK (manager) — desktop dialog over the My-Day board
// ──────────────────────────────────────────────────────────────────────────
function MgrBookDesk({ t, mode = 'coach' }) {
  const cfg = MGR_BOOK_MODES[mode];
  const selType = { sell: 'CI', coach: 'ONE', recruit: 'RI', block: 'TRAIN' }[mode];
  const attach = bookAttach(mode, selType);
  const st = streamStyle(t, cfg.stream);
  const isManagerCode = (c) => RCODE[c];
  const AttachIcon = attach && attach.icon === 'search' ? IconSearch : IconUsers;
  return (
    <div style={{ width: APP_W, height: APP_H, position: 'relative', overflow: 'hidden' }}>
      <MgrMyDayDesk t={t} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.5)', backdropFilter: 'blur(2px)' }} />
        <div className="a-scale-in" style={{ position: 'relative', width: 540, background: t.surface, borderRadius: 18, border: `1px solid ${t.rule}`, boxShadow: '0 30px 90px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Book a block</div>
              <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2 }}>Wed · Jun 24 · your planner</div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.surfaceSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute, fontSize: 19 }}>×</div>
          </div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>What kind of block</div>
              <div style={{ display: 'flex', gap: 5, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                {Object.keys(MGR_BOOK_MODES).map((k) => {
                  const on = k === mode; const ks = streamStyle(t, MGR_BOOK_MODES[k].stream);
                  return <div key={k} style={{ flex: 1, textAlign: 'center', padding: '9px 4px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? ks.fg : t.inkMute, border: on ? `1px solid ${ks.fg}44` : '1px solid transparent' }}>{MGR_BOOK_MODES[k].label}</div>;
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>Type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {cfg.types.map((ty) => {
                  const on = ty.code === selType;
                  return <div key={ty.code} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 13px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: on ? st.bg : t.surfaceSoft, color: on ? st.fg : t.inkMute, border: `1.5px solid ${on ? `${st.fg}66` : t.rule}` }}>{(ACT_CODE[ty.code] || isManagerCode(ty.code)) && <MgrChip t={t} code={ty.code} size="s" />}{ty.label}</div>;
                })}
              </div>
            </div>
            {attach ? (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>{attach.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: st.bg, color: st.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AttachIcon size={16} color={st.fg} stroke={2.1} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{attach.value}</div>
                    <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{attach.sub}</div>
                  </div>
                  <IconChevD size={16} color={t.inkMute} />
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>Title</div>
                <div style={{ padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13.5, color: t.ink, fontWeight: 600 }}>Critical Illness refresher</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>Time</div>
                <div style={{ padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13.5, fontWeight: 700, color: t.ink, display: 'flex', justifyContent: 'space-between' }}>{mode === 'recruit' ? '10:30 AM' : mode === 'block' ? '4:00 PM' : '9:30 AM'} <IconChevD size={14} color={t.inkMute} /></div>
              </div>
              <div style={{ width: 130 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>Length</div>
                <div style={{ padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 13.5, fontWeight: 700, color: t.ink, display: 'flex', justifyContent: 'space-between' }}>{mode === 'coach' && selType === 'UNIT' ? '1h' : mode === 'block' ? '2h' : '45m'} <IconChevD size={14} color={t.inkMute} /></div>
              </div>
            </div>
          </div>
          <div style={{ padding: '4px 22px 20px', display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><PBtn t={t} kind="secondary">Save &amp; add another</PBtn></div>
            <div style={{ flex: 1 }}><PBtn t={t} kind="primary" icon={<IconCheck size={15} color="#fff" stroke={2.4} />}>Save</PBtn></div>
          </div>
        </div>
      </div>
    </div>
  );
}
