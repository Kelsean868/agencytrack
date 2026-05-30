// AgencyTrack — CRO + agent delivery, mobile (390×844).
//   • CroMobileScene   — the CRO's phone view of the Delivery Register: at-risk
//     first, quick status, tap to advance. A custom bottom nav for the CRO.
//   • AgentDeliveryScene — the AGENT's "Policies to collect / deliver" view:
//     what's waiting at the branch to collect, what's out for delivery, each
//     with its own 30-day clock. (The activity wizard's "policies outstanding"
//     question reads off this.)
// Reuses MFrame + app tokens. teal = pipeline · amber = at risk · red = overdue.

// ── CRO mobile bottom nav (custom — CRO has different tabs) ────────────────
function CroMNav({ t, active = 'delivery' }) {
  const tabs = [
    { key: 'home',     Icon: IconHome,   label: 'Desk' },
    { key: 'delivery', Icon: IconBook,   label: 'Delivery' },
    { key: 'submissions', Icon: IconWizard, label: 'Enter' },
    { key: 'settlements', Icon: IconWallet, label: 'Settle' },
    { key: 'report',   Icon: IconChart,  label: 'Report' },
  ];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 76, background: t.surface, borderTop: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', padding: '0 8px 18px', zIndex: 10 }}>
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <tab.Icon size={22} color={on ? t.teal : t.inkFaint} stroke={2} />
              {on && <div style={{ position: 'absolute', inset: -7, background: t.tealTint, borderRadius: 999, zIndex: -1, width: 36, height: 36, top: -7, left: '50%', transform: 'translateX(-50%)' }}></div>}
            </div>
            <div style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, color: on ? t.teal : t.inkMute }}>{tab.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── CRO mobile — Branch Desk (the daily landing) ──────────────────────────
function BranchDeskMobileScene({ t }) {
  const m = deliveryMetrics();
  const atRisk = atRiskPolicies();
  const toEnter = SUB_TO_ENTER;
  const toSettle = SUB_BRANCH_ISSUE;
  const tot = reportTotals();
  const priorities = [
    { icon: IconBell,   tone: 'danger',  title: `Chase ${atRisk.length} at-risk`, sub: 'near the 30-day clawback' },
    { icon: IconWizard, tone: 'warning', title: `Enter ${toEnter.length} on Tatil`, sub: 'new business waiting' },
    { icon: IconWallet, tone: 'gold',    title: `Issue & settle ${toSettle.length}`, sub: 'annuities + funeral' },
    { icon: IconChart,  tone: 'teal',    title: 'Send weekly report', sub: 'due 4pm Friday' },
  ];
  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '8px 16px 12px', background: t.bg, zIndex: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{CRO_ME.branch} · CRO</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 1 }}>Good morning, {CRO_ME.name.split(' ')[0]}</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{CRO_NOW}</div>
      </div>

      <div style={{ position: 'absolute', top: 122, left: 0, right: 0, bottom: 76, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* Stat row */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 8 }}>
          {[['IN DELIVERY', m.open, t.teal], ['AT RISK', m.atRisk, t.warning], ['TO ENTER', toEnter.length, t.warning], ['TO SETTLE', toSettle.length, t.gold]].map(([k, v, c]) => (
            <div key={k} style={{ flex: 1, padding: '11px 8px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 7.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, marginTop: 4 }}>{k}</div>
            </div>
          ))}
        </div>

        {/* Needs you today */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginBottom: 9 }}>NEEDS YOU TODAY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {priorities.map((p, i) => {
              const c = toneColor(t, p.tone), bg = toneBg(t, p.tone);
              return (
                <div key={i} className="a-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: t.surface, border: `1px solid ${p.tone === 'danger' ? t.danger + '44' : t.rule}`, borderRadius: 13 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <p.icon size={18} color={c} stroke={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{p.sub}</div>
                  </div>
                  <IconChevR size={15} color={t.inkFaint} stroke={2.4} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly report status */}
        <div className="a-card" style={{ flexShrink: 0, padding: '14px 16px', background: t.surface, border: `1px solid ${t.teal}33`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: t.tealTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconChart size={18} color={t.teal} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>Weekly report · {ttd(tot.wkApi)}</div>
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>draft ready · {tot.wkApps} apps this week</div>
          </div>
          <span style={{ padding: '5px 10px', background: t.warningTint, color: t.warning, borderRadius: 999, fontSize: 9, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>DUE FRI</span>
        </div>
      </div>

      <CroMNav t={t} active="home" />
    </MFrame>
  );
}

// ── CRO mobile — Delivery Register ────────────────────────────────────────
function CroMobileScene({ t }) {
  const atRisk = atRiskPolicies();
  const rest = openPolicies().filter((p) => !atRisk.includes(p));
  const m = deliveryMetrics();
  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '8px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.rule}`, zIndex: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{CRO_ME.branch} · CRO</div>
        <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 1 }}>Delivery Register</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{m.open} in delivery · {m.atRisk} at risk</div>
      </div>

      <div style={{ position: 'absolute', top: 116, left: 0, right: 0, bottom: 76, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {/* Receive CTA */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: t.teal, color: '#fff', borderRadius: 13, fontSize: 13.5, fontWeight: 700, boxShadow: `0 4px 14px ${t.teal}44` }}>
          <IconPlus size={16} color="#fff" stroke={2.4} /> Receive policies from head office
        </div>

        {atRisk.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>★ AT RISK · CHASE NOW</span>
            </div>
            {atRisk.map((p) => <CroMobileCard key={p.id} t={t} p={p} />)}
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>IN DELIVERY</span>
        </div>
        {rest.map((p) => <CroMobileCard key={p.id} t={t} p={p} />)}
      </div>

      <CroMNav t={t} active="delivery" />
    </MFrame>
  );
}

function CroMobileCard({ t, p }) {
  const clk = deliveryClock(p);
  const col = clk.overdue ? t.danger : clk.atRisk ? t.warning : t.teal;
  const na = nextAction(p.state);
  return (
    <div className="a-card" style={{ flexShrink: 0, padding: '13px 15px', background: t.surface, border: `1px solid ${clk.overdue ? t.danger + '44' : clk.atRisk ? t.warning + '44' : t.rule}`, borderRadius: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{p.owner}</div>
          <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{p.policyNo} · {p.agent}</div>
        </div>
        <DeliveryStatePill t={t} state={p.state} small />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 11 }}>
        <div style={{ textAlign: 'center', minWidth: 50 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: col, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{clk.overdue ? `+${Math.abs(clk.daysLeft)}` : clk.daysLeft}</div>
          <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, marginTop: 2 }}>{clk.overdue ? 'OVER' : 'DAYS'}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 5, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${clk.pct}%`, height: 5, background: col, borderRadius: 999 }}></div>
          </div>
          <div style={{ fontSize: 10, color: t.inkFaint, marginTop: 5, fontFamily: APP_FONT_MONO }}>sent {p.sent} · {clk.daysOut}d ago</div>
        </div>
      </div>
      {na && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 11, padding: '9px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: t.teal }}>
          <na.icon size={14} color={t.teal} stroke={2.2} /> {na.label}
        </div>
      )}
    </div>
  );
}

// ── AGENT mobile — Policies to collect / deliver ──────────────────────────
function AgentDeliveryScene({ t }) {
  const me = 'Marsha Singh';
  const mine = POLICIES.filter((p) => p.agent === me && DELIVERY_STATES[p.state].open);
  const toCollect = mine.filter((p) => p.state === 'received' || p.state === 'notified');
  const toDeliver = mine.filter((p) => p.state === 'collected' || p.state === 'out');
  const atRiskMine = mine.filter((p) => { const c = deliveryClock(p); return c.atRisk || c.overdue; });

  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '8px 16px 12px', background: t.bg, zIndex: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>My deliveries</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 1 }}>Policies to deliver</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{mine.length} outstanding · {atRiskMine.length} near deadline</div>
      </div>

      <div style={{ position: 'absolute', top: 118, left: 0, right: 0, bottom: 92, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* Outstanding hero — ties to the wizard's "policies outstanding" */}
        <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '16px 18px', background: t.surface, border: `1px solid ${atRiskMine.length ? t.warning + '44' : t.rule}`, borderRadius: 17 }}>
          <div className="a-glow-soft" style={{ position: 'absolute', top: -60, right: -50, width: 180, height: 180, background: `radial-gradient(circle, ${atRiskMine.length ? t.warningTint : t.tealTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 40, fontWeight: 700, color: atRiskMine.length ? t.warning : t.teal, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>{mine.length}</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 5 }}>policies outstanding</div>
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: t.rule }}></div>
            <div style={{ flex: 1, fontSize: 12, color: t.ink, lineHeight: 1.5 }}>
              {atRiskMine.length
                ? <><b style={{ color: t.warning }}>{atRiskMine.length} near the 30-day deadline.</b> Deliver and bring the signed receipt back to the branch to protect your commission.</>
                : 'All within the delivery window. Keep them moving.'}
            </div>
          </div>
        </div>

        {/* To collect */}
        {toCollect.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>● AT THE BRANCH · COLLECT</span>
              <span style={{ fontSize: 11, color: t.inkFaint }}>{toCollect.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {toCollect.map((p) => <AgentDeliveryCard key={p.id} t={t} p={p} mode="collect" />)}
            </div>
          </div>
        )}

        {/* To deliver */}
        {toDeliver.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>● WITH YOU · DELIVER</span>
              <span style={{ fontSize: 11, color: t.inkFaint }}>{toDeliver.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {toDeliver.map((p) => <AgentDeliveryCard key={p.id} t={t} p={p} mode="deliver" />)}
            </div>
          </div>
        )}
      </div>

      <MNav t={t} active="home" />
    </MFrame>
  );
}

function AgentDeliveryCard({ t, p, mode }) {
  const clk = deliveryClock(p);
  const col = clk.overdue ? t.danger : clk.atRisk ? t.warning : t.teal;
  return (
    <div className="a-card" style={{ padding: '13px 15px', background: t.surface, border: `1px solid ${clk.overdue ? t.danger + '44' : clk.atRisk ? t.warning + '44' : t.rule}`, borderRadius: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{p.owner}</div>
          <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{p.plan} · {ttd(p.api)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: col, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{clk.overdue ? `+${Math.abs(clk.daysLeft)}` : clk.daysLeft}</div>
          <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, marginTop: 2 }}>{clk.overdue ? 'DAYS OVER' : 'DAYS LEFT'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 11, padding: '9px', background: mode === 'collect' ? t.tealTint : t.warningTint, borderRadius: 9, fontSize: 12, fontWeight: 700, color: mode === 'collect' ? t.teal : t.warning }}>
        {mode === 'collect'
          ? <><IconBook size={14} color={t.teal} /> Ready at the branch to collect</>
          : <><IconArrowR size={14} color={t.warning} stroke={2.4} /> Deliver &amp; return signed receipt</>}
      </div>
    </div>
  );
}

Object.assign(window, { CroMNav, BranchDeskMobileScene, CroMobileScene, CroMobileCard, AgentDeliveryScene, AgentDeliveryCard });
