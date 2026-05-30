// AgencyTrack — CRO Branch Desk. The CRO's daily landing (nav 'home').
// A single glance at what needs her today: at-risk deliveries, business to
// enter, branch products to settle, and whether the weekly report is out —
// each a one-tap jump into the relevant surface. Wraps CROShell active="home".

function BranchDeskScene({ t }) {
  const m = deliveryMetrics();
  const atRisk = atRiskPolicies();
  const toEnter = SUB_TO_ENTER;
  const toSettle = SUB_BRANCH_ISSUE;
  const tot = reportTotals();
  const atRiskApi = atRisk.reduce((s, p) => s + p.api, 0);

  // Today's priority queue — ordered by urgency
  const priorities = [
    { icon: IconBell,   tone: 'danger',  title: `Chase ${atRisk.length} at-risk ${atRisk.length === 1 ? 'delivery' : 'deliveries'}`, sub: `${ttd(atRiskApi)} API near the 30-day clawback`, cta: 'Open register' },
    { icon: IconWizard, tone: 'warning', title: `Enter ${toEnter.length} submissions on Tatil`, sub: 'New business waiting from this week', cta: 'Data entry' },
    { icon: IconWallet, tone: 'gold',    title: `Issue & settle ${toSettle.length} branch ${toSettle.length === 1 ? 'product' : 'products'}`, sub: 'Annuities + Funeral Expense', cta: 'Settlements' },
    { icon: IconChart,  tone: 'teal',    title: 'Send the weekly production report', sub: 'Due 4:00 PM Friday · feeds Monday', cta: 'Weekly report' },
  ];

  return (
    <CROShell t={t} active="home" title="Branch Desk" subtitle={`Good morning, ${CRO_ME.name.split(' ')[0]} · ${CRO_NOW}`}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
        {/* Stat strip */}
        <div className="a-card a-rise" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0, padding: '16px 22px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
          {[
            { k: 'IN DELIVERY', v: m.open, c: t.teal },
            { k: 'AT RISK', v: m.atRisk, c: t.warning },
            { k: 'TO ENTER', v: toEnter.length, c: t.warning },
            { k: 'TO SETTLE', v: toSettle.length, c: t.gold },
            { k: 'DELIVERED · WK', v: m.delivered, c: t.success },
            { k: 'AVG DAYS', v: m.avgDays, c: t.ink },
          ].map((s, i, arr) => (
            <React.Fragment key={s.k}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginTop: 5 }}>{s.k}</div>
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, height: 38, background: t.rule }}></div>}
            </React.Fragment>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16 }}>
          {/* Needs you today */}
          <div style={{ flex: 1.4, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11, minHeight: 0 }}>
            <CroEyebrow t={t} color={t.teal}>Needs you today</CroEyebrow>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 11, paddingRight: 4 }}>
              {priorities.map((p, i) => {
                const c = toneColor(t, p.tone), bg = toneBg(t, p.tone);
                return (
                  <div key={i} className="a-card a-rise" style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '16px 18px', background: t.surface, border: `1px solid ${p.tone === 'danger' ? t.danger + '44' : t.rule}`, borderRadius: 14, animationDelay: `${i * 60}ms` }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <p.icon size={21} color={c} stroke={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: t.inkMute, marginTop: 2 }}>{p.sub}</div>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: t.teal, flexShrink: 0 }}>
                      {p.cta} <IconChevR size={13} color={t.teal} stroke={2.4} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — at-risk snapshot + report status */}
          <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
            {/* At-risk deliveries */}
            <div className="a-card" style={{ flex: 1, minHeight: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.warning}33`, borderRadius: 14, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
                <CroEyebrow t={t} color={t.warning}>★ At-risk deliveries</CroEyebrow>
                <span style={{ fontSize: 11, color: t.inkMute }}>{atRisk.length}</span>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
                {atRisk.map((p) => {
                  const c = deliveryClock(p);
                  const col = c.overdue ? t.danger : t.warning;
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{p.owner}</div>
                        <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{p.agent} · {p.policyNo}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: col, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{c.overdue ? `+${Math.abs(c.daysLeft)}` : c.daysLeft}</div>
                        <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, marginTop: 2 }}>{c.overdue ? 'OVER' : 'DAYS'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly report status */}
            <div className="a-card" style={{ flexShrink: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.teal}33`, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: t.tealTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconChart size={19} color={t.teal} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>Weekly report</div>
                  <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{WEEKLY_REPORT.weekLabel.split('·')[0].trim()} · draft ready</div>
                </div>
                <span style={{ padding: '5px 11px', background: t.warningTint, color: t.warning, borderRadius: 999, fontSize: 10, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>DUE FRI 4PM</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 13, borderTop: `1px solid ${t.rule}` }}>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>WEEK API</div><div style={{ fontSize: 16, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY, marginTop: 3 }}>{ttd(tot.wkApi)}</div></div>
                <div><div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>WEEK APPS</div><div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 3 }}>{tot.wkApps}</div></div>
                <div style={{ flex: 1 }}></div>
                <div style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12, fontWeight: 700 }}>Review &amp; send</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CROShell>
  );
}

Object.assign(window, { BranchDeskScene });
