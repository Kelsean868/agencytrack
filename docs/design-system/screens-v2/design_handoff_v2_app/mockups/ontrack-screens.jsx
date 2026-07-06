// AgencyTrack — On-Track Engine screens. The hero is one scroll that stacks
// the whole loop: anchor (campaign) → gap → THIS WEEK prescription (the
// backward-solve) → planner link → persistency nudge → hit-list fuel.

// ── 1 · GAME PLAN / ON-TRACK (mobile hero) ─────────────────────────────────
function OnTrackHero({ t }) {
  const ot = OT;
  const codes = ['CI', 'FFI', 'AI', 'PC'];
  const shortfall = codes.filter((c) => ot.bookedThisWeek[c] < ot.need[c]);
  return (
    <MFrame t={t}>
      <AnchorHeader t={t} ot={ot} />
      <div style={{ position: 'absolute', top: 138, left: 0, right: 0, bottom: 0, overflow: 'hidden', padding: '0 18px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GapMeter t={t} ot={ot} />

          {/* Two anchors → resolved target (Money Needs floor vs campaign push) */}
          <DualAnchor t={t} code="CI" />

          {/* THE KEYSTONE — backward-solve to this week (resolved need) */}
          <div className="a-card" style={{ padding: '14px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>To stay on track, this week</div>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>BOOKED / NEED</span>
            </div>
            <div style={{ fontSize: 11, color: t.inkMute, marginBottom: 13, lineHeight: 1.45 }}>
              {ot.gapApps} apps over {ot.weeksLeft} weeks ≈ <b style={{ color: t.ink }}>1 sale/wk</b> → at your close ratios that's the activity below.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {codes.map((c) => <PrescriptionRow key={c} t={t} code={c} need={ot.resolved[c]} booked={ot.bookedThisWeek[c]} />)}
            </div>
            <div style={{ marginTop: 13, padding: '10px 12px', background: t.warningTint, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
              <IconBolt size={15} color={t.warning} stroke={2.2} />
              <div style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: t.ink }}>You're short <b>1 C.I</b> and <b>2 A.I</b> this week — fill them from your list.</div>
            </div>
          </div>

          {/* Persistency gate as a fixable to-do */}
          <GateNudge t={t} ot={ot} />

          {/* Hit-list fuel — only what closes this week's shortfall */}
          <div>
            <PLabel t={t} right={<span style={{ fontSize: 10.5, fontWeight: 700, color: t.teal }}>Full list →</span>}>Close the gap · book these</PLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <HitRow t={t} row={HITLIST.prospect[0]} accent={t.teal} />
              <HitRow t={t} row={HITLIST.crosssell[1]} accent={t.teal} />
              <HitRow t={t} row={HITLIST.prospect[1]} accent={t.teal} />
            </div>
          </div>
        </div>
      </div>
    </MFrame>
  );
}

// ── 2 · CAMPAIGN HIT-LIST (mobile) — the fuel, source-typed tabs ───────────
function HitListScreen({ t, source = 'prospect' }) {
  const tabs = [
    { key: 'prospect', label: 'Prospects', n: HITLIST.prospect.length },
    { key: 'crosssell', label: 'Cross-sell', n: HITLIST.crosssell.length },
    { key: 'reinstate', label: 'Reinstate', n: HITLIST.reinstate.length },
  ];
  const accent = source === 'reinstate' ? t.danger : source === 'crosssell' ? t.gold : t.teal;
  const rows = HITLIST[source];
  const totalApi = rows.reduce((s, r) => s + r.api, 0);
  return (
    <MFrame t={t}>
      <PHeader t={t} eyebrow="CHRISTMAS CAMPAIGN · YOUR LIST" title="Hit list"
        right={<div style={{ padding: '7px 11px', background: t.tealTint, color: t.teal, borderRadius: 9, fontSize: 11, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{ttd(totalApi)}</div>} />
      <div style={{ position: 'absolute', top: 104, left: 0, right: 0, padding: '0 18px 10px', zIndex: 6, background: t.bg }}>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
          {tabs.map((tab) => {
            const on = tab.key === source;
            return (
              <div key={tab.key} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.ink : t.inkMute, border: on ? `1px solid ${t.rule}` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {tab.label}<span style={{ fontSize: 9.5, fontFamily: APP_FONT_MONO, color: on ? accent : t.inkFaint }}>{tab.n}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: 'absolute', top: 168, left: 0, right: 0, bottom: 0, overflow: 'hidden', padding: '4px 18px 24px' }}>
        {source === 'reinstate' && (
          <div style={{ padding: '10px 13px', background: t.warningTint, border: `1px solid ${t.warning}33`, borderRadius: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
            <IconShield size={15} color={t.warning} stroke={2} />
            <div style={{ flex: 1, fontSize: 11, color: t.ink, fontWeight: 600 }}>Reinstating these lifts your campaign persistency toward the 90% gate.</div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => <HitRow key={i} t={t} row={r} accent={accent} />)}
        </div>
      </div>
    </MFrame>
  );
}

// ── 3 · ON-TRACK (desktop hero) — reuses the agent planner shell ───────────
function OnTrackDesk({ t }) {
  const ot = OT;
  const codes = ['CI', 'FFI', 'AI', 'PC'];
  return (
    <PlannerDeskFrame t={t} active="lookahead" title="Game Plan" subtitle={`Tracking ${ot.tier.name} · ${ot.campaign} · ${ot.weeksLeft} weeks left`}>
      <div style={{ height: '100%', display: 'flex', gap: 18 }}>
        {/* main: gap + prescription */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* anchor banner */}
          <div style={{ padding: '16px 20px', background: t.teal, borderRadius: 16, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -50, right: -30, width: 220, height: 220, background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 65%)' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, opacity: 0.85 }}>TRACKING · {ot.campaign.toUpperCase()}</div>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, marginTop: 6, letterSpacing: '-0.02em' }}>{ot.tier.name} — {ttd(ot.tier.cash)} + {ttd(ot.tier.voucher)} voucher</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 34, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>{ttd(ot.gapApi)}</div>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{ot.gapApps} apps to go · {ot.weeksLeft} weeks</div>
              </div>
            </div>
          </div>
          <GapMeter t={t} ot={ot} />
          <DualAnchor t={t} code="CI" />
          {/* prescription */}
          <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, padding: '20px 22px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>To stay on track, this week</div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>BOOKED / NEED PER WEEK</span>
            </div>
            <div style={{ fontSize: 12, color: t.inkMute, marginBottom: 18, lineHeight: 1.5, maxWidth: 520 }}>
              {ot.gapApps} apps over {ot.weeksLeft} weeks ≈ <b style={{ color: t.ink }}>1 sale/week</b>. Back-solved through your close ratios (C.I→sale {Math.round(RATIOS.ciToSale * 100)}%), that's the weekly activity to book in the Planner.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
              {codes.map((c) => <PrescriptionRow key={c} t={t} code={c} need={ot.resolved[c]} booked={ot.bookedThisWeek[c]} />)}
            </div>
            <div style={{ marginTop: 18, padding: '12px 15px', background: t.warningTint, borderRadius: 11, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 560 }}>
              <IconBolt size={16} color={t.warning} stroke={2.2} />
              <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: t.ink }}>Short <b>1 C.I</b> and <b>2 A.I</b> this week — fill from the hit-list at right, and they book straight into your planner.</div>
            </div>
          </div>
        </div>
        {/* rail: persistency + hit-list */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <GateNudge t={t} ot={ot} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Close the gap</div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: t.teal }}>Full list →</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <HitRow t={t} row={HITLIST.prospect[0]} accent={t.teal} />
              <HitRow t={t} row={HITLIST.crosssell[1]} accent={t.teal} />
              <HitRow t={t} row={HITLIST.prospect[1]} accent={t.teal} />
            </div>
          </div>
        </div>
      </div>
    </PlannerDeskFrame>
  );
}

Object.assign(window, { OnTrackHero, HitListScreen, OnTrackDesk, TierLadderScreen });

// ── 4 · TIER LADDER (mobile) — auto-ratchet next rung + optional aim higher ─
function TierLadderScreen({ t, aim = 'Champion' }) {
  const ot = OT;
  return (
    <MFrame t={t}>
      <PHeader t={t} onBack eyebrow="CHRISTMAS CAMPAIGN · YOUR RUNG" title="Tier ladder"
        right={<div style={{ padding: '7px 11px', background: t.tealTint, color: t.teal, borderRadius: 9, fontSize: 11, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{ot.weeksLeft} WKS</div>} />
      <div style={{ position: 'absolute', top: 104, left: 0, right: 0, bottom: 0, overflow: 'hidden', padding: '0 18px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* how it works */}
          <div style={{ padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <IconBolt size={15} color={t.teal} stroke={2.2} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: t.inkMute, lineHeight: 1.5 }}>
              The engine tracks your <b style={{ color: t.ink }}>next rung automatically</b> as business settles — you bank whatever you clear. Want to push? <b style={{ color: t.teal }}>Aim higher</b> and this week's targets climb to match.
            </div>
          </div>

          <TierLadder t={t} settledApi={ot.settledApi} settledApps={ot.settledApps} aimedName={aim} />

          {/* effect of the current aim on the prescription */}
          <div style={{ padding: '13px 15px', background: t.tealTint, border: `1px solid ${t.teal}2e`, borderRadius: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <IconTarget size={15} color={t.teal} stroke={2.2} />
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Aiming {aim} → this week</div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>vs NEXT (Pro)</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ c: 'CI', n: ot.resolved.CI, base: 1 }, { c: 'FFI', n: ot.resolved.FFI, base: 2 }, { c: 'AI', n: ot.resolved.AI, base: 2 }].map((x) => (
                <div key={x.c} style={{ flex: 1, padding: '9px 10px', background: t.surface, borderRadius: 10, border: `1px solid ${t.rule}` }}>
                  <ActChip t={t} type={x.c} size="s" />
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>{x.n}<span style={{ fontSize: 9, color: t.inkFaint, fontWeight: 600 }}>/wk</span></div>
                  <div style={{ fontSize: 9, color: t.inkMute, marginTop: 1, fontFamily: APP_FONT_MONO }}>Pro asks {x.base}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 11, padding: '11px 14px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center' }}>Keep aiming {aim}</div>
          </div>
        </div>
      </div>
    </MFrame>
  );
}

Object.assign(window, { TierLadderScreen });
