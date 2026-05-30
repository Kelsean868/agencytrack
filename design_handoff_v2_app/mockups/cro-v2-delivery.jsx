// AgencyTrack — CRO Delivery Register + Metrics. Desktop.
//   • DeliveryRegisterScene — the digital "book": at-risk hero + worklist of
//     every policy in the delivery pipeline, the 30-day clawback clock on each,
//     filterable. A drill drawer walks one policy receive→notify→collect→
//     deliver, logs the dates + agent signature, and shows the lifecycle.
//   • DeliveryMetricsScene — avg days-to-deliver, % on-time, by agent/unit,
//     plus the clawback/Not-Taken leakage that feeds commission + reconciliation.
// Wraps CROShell. teal = pipeline · amber = at risk · red = clawed/overdue.

// ── Lifecycle timeline (vertical, in the drawer) ──────────────────────────
const LIFECYCLE_ORDER = ['received', 'notified', 'collected', 'out', 'delivered', 'returned_receipt'];

function LifecycleTimeline({ t, p }) {
  const curOrder = DELIVERY_STATES[p.state].order;
  const terminal = ['not_taken', 'undeliverable', 'clawed'].includes(p.state);
  const dateFor = (k) => p[k] || null;
  const steps = [
    { key: 'received',  label: 'Received from head office', date: dateFor('received') },
    { key: 'notified',  label: 'Agent notified', date: dateFor('notified') },
    { key: 'collected', label: 'Collected by agent', date: dateFor('collected') },
    { key: 'out',       label: 'Out for delivery', date: null },
    { key: 'delivered', label: 'Delivered · receipt signed', date: dateFor('delivered') },
    { key: 'returned_receipt', label: 'Receipt returned to branch', date: null },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {steps.map((s, i) => {
        const ord = DELIVERY_STATES[s.key].order;
        const done = !terminal && ord <= curOrder;
        const here = !terminal && ord === curOrder;
        const c = here ? t.teal : done ? t.success : t.inkDim;
        return (
          <div key={s.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18 }}>
              <div style={{ width: here ? 14 : 11, height: here ? 14 : 11, borderRadius: '50%', background: done || here ? c : t.surface, border: `2px solid ${c}`, flexShrink: 0 }}></div>
              {i < steps.length - 1 && <div style={{ width: 2, height: 22, background: ord < curOrder ? t.success : t.rule }}></div>}
            </div>
            <div style={{ paddingBottom: 12, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: here ? 700 : 600, color: here ? t.ink : done ? t.inkMute : t.inkFaint }}>{s.label}{here ? ' · here' : ''}</div>
              {s.date && <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{s.date}</div>}
            </div>
          </div>
        );
      })}
      {terminal && (
        <div style={{ marginTop: 6, padding: '10px 12px', background: t.dangerTint, border: `1px solid ${t.danger}33`, borderRadius: 10, fontSize: 12, color: t.ink }}>
          {DELIVERY_STATES[p.state].blurb}
        </div>
      )}
    </div>
  );
}

// ── Worklist row ──────────────────────────────────────────────────────────
function DeliveryRow({ t, p, active, onOpen }) {
  const clk = deliveryClock(p);
  return (
    <div onClick={onOpen} className="a-card" style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
      background: active ? t.tealTint : t.surface,
      border: `1px solid ${active ? t.teal + '88' : clk.overdue ? t.danger + '44' : clk.atRisk ? t.warning + '44' : t.rule}`,
      borderRadius: 12, cursor: 'pointer',
    }}>
      <div style={{ width: 150, flexShrink: 0, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.owner}</div>
        <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{p.policyNo}</div>
      </div>
      <div style={{ width: 150, flexShrink: 0, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: t.inkMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.plan}</div>
        <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{ttd(p.api)} · {p.product}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{p.agent}</div>
        <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{p.unit} · sent {p.sent}</div>
      </div>
      <div style={{ width: 110, flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}><DeliveryStatePill t={t} state={p.state} /></div>
      <div style={{ width: 96, flexShrink: 0 }}><ClawbackClock t={t} p={p} /></div>
      <IconChevR size={15} color={t.inkFaint} stroke={2.4} />
    </div>
  );
}

// ── Next-action button set for the drawer (depends on state) ──────────────
function CroActionBtn({ t, label, icon: Ic, primary, tone = 'teal' }) {
  const c = toneColor(t, tone);
  return (
    <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 15px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: primary ? c : t.surface, color: primary ? '#fff' : t.inkMute, border: primary ? 'none' : `1px solid ${t.rule}`, boxShadow: primary ? `0 2px 8px ${c}44` : 'none' }}>
      {Ic && <Ic size={15} color={primary ? '#fff' : t.inkMute} stroke={2.2} />} {label}
    </div>
  );
}

function nextAction(state) {
  switch (state) {
    case 'received':  return { label: 'Notify agent to collect', icon: IconBell };
    case 'notified':  return { label: 'Log collection (agent signs)', icon: IconCheck };
    case 'collected': return { label: 'Mark out for delivery', icon: IconArrowR };
    case 'out':       return { label: 'Log delivery · receipt signed', icon: IconCheck };
    case 'delivered': return { label: 'Log receipt returned to branch', icon: IconBook };
    default: return null;
  }
}

// ── Reconcile/deliver drawer ──────────────────────────────────────────────
function DeliveryDrawer({ t, id }) {
  const p = policyById(id) || POLICIES[0];
  const clk = deliveryClock(p);
  const na = nextAction(p.state);
  const col = clk.overdue ? t.danger : clk.atRisk ? t.warning : t.teal;

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)', animation: 'app-fade-in 280ms ease both', zIndex: 20 }}></div>
      <div className="a-card" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 480, background: t.surface, borderLeft: `1px solid ${t.rule}`, zIndex: 21, display: 'flex', flexDirection: 'column', animation: 'app-slide-in 320ms cubic-bezier(0.22,1,0.36,1) both', boxShadow: '-12px 0 40px rgba(0,0,0,0.16)' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${t.rule}` }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>✕ Close</span>
          <div style={{ flex: 1 }}></div>
          <DeliveryStatePill t={t} state={p.state} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {/* Identity */}
          <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY }}>{p.owner}</div>
          <div style={{ fontSize: 12, color: t.inkMute, marginTop: 2, fontFamily: APP_FONT_MONO }}>{p.policyNo} · {p.plan} · {ttd(p.api)} API</div>

          {/* Clock banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, padding: '14px 16px', background: clk.done ? t.successTint : `${col}14`, border: `1px solid ${clk.done ? t.success + '33' : col + '44'}`, borderRadius: 13 }}>
            <div style={{ textAlign: 'center', minWidth: 64 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: clk.done ? t.success : col, fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{clk.done ? '✓' : clk.overdue ? `+${Math.abs(clk.daysLeft)}` : clk.daysLeft}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO, marginTop: 3 }}>{clk.done ? 'CLOSED' : clk.overdue ? 'DAYS OVER' : 'DAYS LEFT'}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>
                {clk.done ? 'Delivery complete' : clk.overdue ? 'Past the 30-day deadline' : clk.atRisk ? 'Approaching the clawback deadline' : 'Within the delivery window'}
              </div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 3, lineHeight: 1.5 }}>
                Head office sent this <b>{p.sent}</b> · {clk.daysOut} days ago. Commission is clawed back at {CLAWBACK_DAYS} days undelivered.
              </div>
            </div>
          </div>

          {/* Lifecycle */}
          <div style={{ marginTop: 18 }}>
            <CroEyebrow t={t} color={t.teal}>Delivery lifecycle</CroEyebrow>
            <div style={{ marginTop: 12 }}><LifecycleTimeline t={t} p={p} /></div>
          </div>

          {/* Agent + servicing */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>SERVICING AGENT</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginTop: 3 }}>{p.agent}</div>
              <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{p.unit}</div>
            </div>
            <div style={{ flex: 1, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>DISPATCH MEMO</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginTop: 3 }}>Sent {p.sent}</div>
              <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>received {p.received}</div>
            </div>
          </div>
        </div>

        {/* Footer — the next action(s) */}
        <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: `1px solid ${t.rule}`, display: 'flex', flexWrap: 'wrap', gap: 9 }}>
          {na ? (
            <>
              <CroActionBtn t={t} primary icon={na.icon} label={na.label} />
              {p.state === 'out' && <CroActionBtn t={t} label="Not Taken" tone="danger" />}
              {(p.state === 'collected' || p.state === 'out') && <CroActionBtn t={t} label="Undeliverable" tone="danger" />}
            </>
          ) : (
            <div style={{ fontSize: 11.5, color: t.inkMute, textAlign: 'center', width: '100%' }}>
              {p.state === 'clawed' ? 'Commission clawed back. Escalate to head office if disputed.' : p.state === 'not_taken' ? 'Client declined — logged as Not Taken, removed from production.' : '✓ Delivered & reconciled. Settlement date confirmed.'}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Summary tile ──────────────────────────────────────────────────────────
function DeliveryTile({ t, label, count, sub, color }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '13px 16px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }}></span>
        <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 9 }}>{count}</div>
      <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 5 }}>{sub}</div>
    </div>
  );
}

// ── DELIVERY REGISTER SCENE ───────────────────────────────────────────────
function DeliveryRegisterScene({ t, drawer = null, filter = 'open' }) {
  const m = deliveryMetrics();
  const list = filter === 'risk' ? atRiskPolicies()
    : filter === 'closed' ? closedPolicies()
    : openPolicies();
  const filters = [
    { key: 'open', label: 'In delivery', count: openPolicies().length },
    { key: 'risk', label: 'At risk', count: atRiskPolicies().length },
    { key: 'closed', label: 'Closed', count: closedPolicies().length },
  ];
  return (
    <CROShell t={t} active="delivery" title="Delivery Register" subtitle={`The branch delivery book · ${CRO_NOW}`}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden', position: 'relative' }}>
        {/* At-risk hero */}
        <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '16px 20px', background: t.surface, border: `1px solid ${m.atRisk ? t.warning + '44' : t.rule}`, borderRadius: 14 }}>
          <div className="a-glow-soft" style={{ position: 'absolute', top: -90, right: -60, width: 300, height: 300, background: `radial-gradient(circle, ${t.warningTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22 }}>
            <div style={{ flexShrink: 0 }}>
              <CroEyebrow t={t} color={t.warning}>★ Approaching clawback</CroEyebrow>
              <div style={{ fontSize: 34, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', lineHeight: 1, marginTop: 7 }}>{m.atRisk} {m.atRisk === 1 ? 'policy' : 'policies'}</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 6 }}>within {AT_RISK_DAYS} days of the 30-day deadline · chase the agents now</div>
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: t.rule, margin: '2px 0' }}></div>
            <div style={{ flex: 1, display: 'flex', gap: 12 }}>
              <DeliveryTile t={t} label="IN DELIVERY" count={m.open} sub="open in the pipeline" color={t.teal} />
              <DeliveryTile t={t} label="DELIVERED" count={m.delivered} sub="receipts signed" color={t.success} />
              <DeliveryTile t={t} label="CLAWED BACK" count={m.clawed} sub="passed 30 days" color={t.danger} />
              <DeliveryTile t={t} label="NOT TAKEN" count={m.notTaken} sub="client declined" color={t.inkMute} />
            </div>
          </div>
        </div>

        {/* Filters + receive button */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
            {filters.map((f) => {
              const on = f.key === filter;
              return (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.ink : t.inkMute, border: on ? `1px solid ${t.rule}` : '1px solid transparent' }}>
                  {f.label}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '0 6px', background: on ? (f.key === 'risk' ? t.warningTint : t.tealTint) : 'transparent', color: on ? (f.key === 'risk' ? t.warning : t.teal) : t.inkFaint, borderRadius: 999, fontFamily: APP_FONT_MONO }}>{f.count}</span>
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1 }}></div>
          <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${t.teal}44` }}>
            <IconPlus size={15} color="#fff" stroke={2.4} /> Receive policies
          </div>
        </div>

        {/* Column header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px' }}>
          <div style={{ width: 150, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>POLICY OWNER</div>
          <div style={{ width: 150, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>PLAN</div>
          <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>AGENT</div>
          <div style={{ width: 110, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>STATUS</div>
          <div style={{ width: 96, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>30-DAY CLOCK</div>
          <div style={{ width: 15 }}></div>
        </div>

        {/* Worklist */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, paddingRight: 4 }}>
          {list.map((p) => <DeliveryRow key={p.id} t={t} p={p} active={drawer === p.id} onOpen={() => {}} />)}
        </div>

        {drawer && <DeliveryDrawer t={t} id={drawer} />}
      </div>
    </CROShell>
  );
}

// ── DELIVERY METRICS SCENE ────────────────────────────────────────────────
function DeliveryMetricsScene({ t }) {
  const m = deliveryMetrics();
  const maxOpen = Math.max(...DELIVERY_BY_AGENT.map((a) => a.open + a.delivered), 1);
  return (
    <CROShell t={t} active="metrics" title="Delivery Metrics" subtitle="How fast policies reach clients — and where commission leaks">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
        {/* Top stats */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 14 }}>
          {[
            { eyebrow: 'AVG DAYS TO DELIVER', value: `${m.avgDays}`, sub: 'sent → receipt signed', color: t.teal },
            { eyebrow: 'DELIVERED ON TIME', value: `${m.onTimePct}%`, sub: 'within 30 days', color: t.success },
            { eyebrow: 'CLAWED BACK · QTR', value: `${m.clawed}`, sub: 'commission lost to delay', color: t.danger },
            { eyebrow: 'NOT TAKEN · QTR', value: `${m.notTaken}`, sub: 'declined in window', color: t.inkMute },
          ].map((s) => (
            <div key={s.eyebrow} className="a-card a-rise" style={{ flex: 1, padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
              <CroEyebrow t={t} color={s.color}>{s.eyebrow}</CroEyebrow>
              <div style={{ fontSize: 30, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', lineHeight: 1, marginTop: 9 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 6 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* By agent */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16 }}>
          <div className="a-card" style={{ flex: 1.5, minWidth: 0, padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
              <CroEyebrow t={t} color={t.teal}>Delivery by agent</CroEyebrow>
              <span style={{ fontSize: 11, color: t.inkMute }}>open vs delivered · avg days · on-time %</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 11, paddingRight: 4 }}>
              {DELIVERY_BY_AGENT.map((a) => (
                <div key={a.agent} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 150, flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{a.agent}</div>
                    <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{a.unit}</div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', background: t.surfaceMute }}>
                    {a.delivered > 0 && <div style={{ width: `${(a.delivered / maxOpen) * 100}%`, background: t.success }}></div>}
                    {a.open > 0 && <div style={{ width: `${(a.open / maxOpen) * 100}%`, background: t.teal }}></div>}
                  </div>
                  <div style={{ width: 70, textAlign: 'right', fontSize: 11.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{a.avgDays ? `${a.avgDays}d avg` : '—'}</div>
                  <div style={{ width: 54, textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: a.onTime >= 90 ? t.success : a.onTime >= 60 ? t.warning : a.onTime === 0 ? t.inkFaint : t.danger, fontFamily: APP_FONT_MONO }}>{a.onTime ? `${a.onTime}%` : '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ flexShrink: 0, display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.rule}`, fontSize: 10.5, color: t.inkMute }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: t.success }}></span>Delivered</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: t.teal }}></span>Open in pipeline</span>
            </div>
          </div>

          {/* Why it matters */}
          <div className="a-card" style={{ flex: 1, minWidth: 0, padding: '18px 20px', background: t.surface, border: `1px solid ${t.gold}33`, borderRadius: 14, display: 'flex', flexDirection: 'column' }}>
            <CroEyebrow t={t} color={t.gold}>★ Why this matters</CroEyebrow>
            <div style={{ fontSize: 12.5, color: t.ink, lineHeight: 1.6, marginTop: 12 }}>
              Confirmed delivery is what releases an agent's commission. A policy undelivered at <b>{CLAWBACK_DAYS} days</b> from head-office dispatch has its commission <b>withheld and clawed back</b>.
            </div>
            <div style={{ marginTop: 16, padding: '14px 16px', background: t.dangerTint, border: `1px solid ${t.danger}33`, borderRadius: 12 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: t.danger, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>COMMISSION AT RISK THIS CYCLE</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: t.danger, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 6 }}>{ttd(atRiskPolicies().reduce((s, p) => s + p.api, 0))}</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 5 }}>API across {atRiskPolicies().length} at-risk policies — chase before the clock runs out.</div>
            </div>
            <div style={{ flex: 1 }}></div>
            <div style={{ fontSize: 11, color: t.inkFaint, fontStyle: 'italic', lineHeight: 1.5 }}>Delivery confirmation also writes the policy's settlement date back to the ledger — feeding reconciliation, persistency, and campaigns.</div>
          </div>
        </div>
      </div>
    </CROShell>
  );
}

Object.assign(window, {
  LIFECYCLE_ORDER, LifecycleTimeline, DeliveryRow, CroActionBtn, nextAction,
  DeliveryDrawer, DeliveryTile, DeliveryRegisterScene, DeliveryMetricsScene,
});
