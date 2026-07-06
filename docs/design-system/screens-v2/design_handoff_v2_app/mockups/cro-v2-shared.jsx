// AgencyTrack — CRO sign-on v2. Shared shell + data model + primitives.
//
// THE ROLE: the Customer Relationship Officer is the branch's operational hub
// and the human at the ledger's point of entry. She:
//   • receives printed policies from head office, notifies agents, tracks
//     collection + delivery, and the 30-day clawback clock (Delivery Register);
//   • data-enters every policy that passes through the branch (Submissions);
//   • issues + settles the two branch-issued products — Annuities & Funeral
//     Expense — and keys the issue/settlement date for everything else;
//   • generates the Friday 4 pm weekly production report that feeds Monday.
//
// THE CLOCK: commission is withheld and clawed back if a policy isn't delivered
// within 30 DAYS of the date HEAD OFFICE SENT it (per the dispatch memo). A
// client may also decline within that window — "Not Taken".
//
// "Now" is the app's internal clock: Fri 28 Nov 2025 (Week 48), consistent with
// the rest of v2. Policy ages are precomputed (daysOut) off that reference.
// Reuses app-tokens (ttd, icons, APP_LIGHT/DARK, APP_W/APP_H, fonts),
// app-shell (Topbar, AmbientBg, Eyebrow, Pill), app-mobile (MFrame).

const CRO_ME = { name: 'Anessa Baptiste', role: 'Customer Relationship Officer', branch: 'South Branch', initials: 'AB' };
const CRO_NOW = 'Fri 28 Nov · Week 48';

// ── Delivery lifecycle ────────────────────────────────────────────────────
// order drives the timeline; `open` = still in the delivery pipeline (counts
// against the clock); terminal states close it.
const DELIVERY_STATES = {
  received:   { label: 'Received',        short: 'Received',   tone: 'teal',    order: 1, open: true,  blurb: 'Logged in from head office. Notify the agent to collect.' },
  notified:   { label: 'Agent notified',  short: 'Notified',   tone: 'teal',    order: 2, open: true,  blurb: 'Agent emailed that contracts are ready to collect.' },
  collected:  { label: 'Collected',       short: 'Collected',  tone: 'warning', order: 3, open: true,  blurb: 'Agent signed the book and took the contracts out.' },
  out:        { label: 'Out for delivery',short: 'Out',        tone: 'warning', order: 4, open: true,  blurb: 'With the agent for delivery to the policy owner.' },
  delivered:  { label: 'Delivered',       short: 'Delivered',  tone: 'success', order: 5, open: false, blurb: 'Policy owner signed & dated the delivery receipt.' },
  returned_receipt: { label: 'Receipt in', short: 'Receipt in', tone: 'success', order: 6, open: false, blurb: 'Original receipt returned to branch; system updated.' },
  not_taken:  { label: 'Not Taken',       short: 'Not Taken',  tone: 'danger',  order: 0, open: false, blurb: 'Client declined the policy within the 30-day window.' },
  undeliverable: { label: 'Undeliverable',short: 'Returned',   tone: 'danger',  order: 0, open: false, blurb: 'Could not be delivered — returned to branch.' },
  clawed:     { label: 'Clawed back',     short: 'Clawed',     tone: 'danger',  order: 0, open: false, blurb: 'Passed 30 days undelivered — commission clawed back.' },
};
const CLAWBACK_DAYS = 30;
const AT_RISK_DAYS = 7;   // <= this many days left → at risk

function deliveryClock(p) {
  const daysOut = p.daysOut;
  const daysLeft = CLAWBACK_DAYS - daysOut;
  const st = DELIVERY_STATES[p.state];
  const done = st && !st.open;
  const overdue = !done && daysLeft < 0;
  const atRisk = !done && daysLeft >= 0 && daysLeft <= AT_RISK_DAYS;
  return { daysOut, daysLeft, done, overdue, atRisk, pct: Math.max(0, Math.min(100, (daysOut / CLAWBACK_DAYS) * 100)) };
}

// ── The branch's policy delivery book (digital) ───────────────────────────
// sent = head-office dispatch date (drives clock) · daysOut = CRO_NOW − sent.
const POLICIES = [
  { id: 'p1',  policyNo: 'TL-2026-08661', owner: 'Anil Boodram',     product: 'Universal Life',  plan: 'Platinum Edge',  api: 36000, agent: 'Marsha Singh',    unit: 'S·02', sent: 'Nov 24', daysOut: 4,  received: 'Nov 25', state: 'received' },
  { id: 'p2',  policyNo: 'TL-2026-08655', owner: 'Sara Khan',        product: 'Life',            plan: 'Tatil Term 20',  api: 18600, agent: 'Riaz Khan',       unit: 'S·02', sent: 'Nov 22', daysOut: 6,  received: 'Nov 24', state: 'notified', notified: 'Nov 24' },
  { id: 'p3',  policyNo: 'TL-2026-08640', owner: 'Kavita Ramlal',    product: 'Universal Life',  plan: 'Platinum Edge',  api: 30000, agent: 'Selina Mohammed', unit: 'S·03', sent: 'Nov 18', daysOut: 10, received: 'Nov 20', state: 'collected', notified: 'Nov 20', collected: 'Nov 26' },
  { id: 'p4',  policyNo: 'TL-2026-08612', owner: 'Priya Naidu',      product: 'Life',            plan: 'Whole Life Premier', api: 27600, agent: 'Riaz Khan',  unit: 'S·02', sent: 'Nov 8',  daysOut: 20, received: 'Nov 11', state: 'out', notified: 'Nov 11', collected: 'Nov 21' },
  { id: 'p5',  policyNo: 'TL-2026-08571', owner: 'Devon Ali',        product: 'Life',            plan: 'Tatil Term 10',  api: 16800, agent: 'Anand Persad',    unit: 'S·01', sent: 'Oct 30', daysOut: 29, received: 'Nov 3',  state: 'out', notified: 'Nov 3', collected: 'Nov 12' },
  { id: 'p6',  policyNo: 'TL-2026-08498', owner: 'Marcus Lee',       product: 'Universal Life',  plan: 'Platinum Edge',  api: 32400, agent: 'Marsha Singh',    unit: 'S·02', sent: 'Oct 26', daysOut: 33, received: 'Oct 29', state: 'out', notified: 'Oct 29', collected: 'Nov 6' },
  { id: 'p7',  policyNo: 'TL-2026-08455', owner: 'Renee Baptiste',   product: 'Life',            plan: 'Tatil Term 20',  api: 21600, agent: 'Kamla Singh',     unit: 'S·01', sent: 'Nov 14', daysOut: 14, received: 'Nov 17', state: 'delivered', notified: 'Nov 17', collected: 'Nov 19', delivered: 'Nov 25' },
  { id: 'p8',  policyNo: 'TL-2026-08390', owner: 'Omar Ali',         product: 'Universal Life',  plan: 'Platinum Edge',  api: 48000, agent: 'Marsha Singh',    unit: 'S·02', sent: 'Nov 4',  daysOut: 24, received: 'Nov 6',  state: 'returned_receipt', notified: 'Nov 6', collected: 'Nov 10', delivered: 'Nov 18' },
  { id: 'p9',  policyNo: 'TL-2026-08321', owner: 'Jamal Khan',       product: 'Life',            plan: 'Tatil Term 10',  api: 14400, agent: 'Avinash Maharaj', unit: 'S·02', sent: 'Nov 16', daysOut: 12, received: 'Nov 19', state: 'not_taken', notified: 'Nov 19', collected: 'Nov 22' },
  { id: 'p10', policyNo: 'TL-2026-08277', owner: 'Hema Lakhan',      product: 'Life',            plan: 'Whole Life Premier', api: 25200, agent: 'Anand Persad', unit: 'S·01', sent: 'Oct 22', daysOut: 37, received: 'Oct 25', state: 'clawed', notified: 'Oct 25', collected: 'Nov 2' },
  { id: 'p11', policyNo: 'TL-2026-08210', owner: 'Trevor Ramnauth',  product: 'Universal Life',  plan: 'Platinum Edge',  api: 42000, agent: 'Selina Mohammed', unit: 'S·03', sent: 'Nov 20', daysOut: 8,  received: 'Nov 24', state: 'notified', notified: 'Nov 24' },
  { id: 'p12', policyNo: 'TL-2026-08188', owner: 'Carla Joseph',     product: 'Life',            plan: 'Tatil Term 20',  api: 19200, agent: 'Riaz Khan',       unit: 'S·02', sent: 'Nov 26', daysOut: 2,  received: 'Nov 27', state: 'received' },
];
function policyById(id) { return POLICIES.find((p) => p.id === id); }

// Buckets for the register
function openPolicies()   { return POLICIES.filter((p) => DELIVERY_STATES[p.state].open); }
function atRiskPolicies()  { return openPolicies().filter((p) => { const c = deliveryClock(p); return c.atRisk || c.overdue; }); }
function closedPolicies()  { return POLICIES.filter((p) => !DELIVERY_STATES[p.state].open); }

// ── Delivery metrics (the dashboard) ──────────────────────────────────────
function deliveryMetrics() {
  const delivered = POLICIES.filter((p) => p.state === 'delivered' || p.state === 'returned_receipt');
  // days-to-deliver where we have both sent + delivered (use daysOut-at-delivery proxy)
  const ttd_days = [6, 14, 14]; // illustrative: Omar 14, Renee 11, etc — keep simple avg
  const avgDays = 12;
  const onTime = delivered.filter((p) => true).length; // all delivered were on time in this set
  const total = POLICIES.length;
  return {
    avgDays,
    onTimePct: 92,
    delivered: delivered.length,
    open: openPolicies().length,
    atRisk: atRiskPolicies().length,
    clawed: POLICIES.filter((p) => p.state === 'clawed').length,
    notTaken: POLICIES.filter((p) => p.state === 'not_taken').length,
    total,
  };
}

// Per-agent delivery rollup (for the dashboard + manager visibility)
const DELIVERY_BY_AGENT = [
  { agent: 'Marsha Singh',    unit: 'S·02', open: 2, delivered: 2, avgDays: 11, onTime: 100 },
  { agent: 'Riaz Khan',       unit: 'S·02', open: 3, delivered: 0, avgDays: 9,  onTime: 100 },
  { agent: 'Selina Mohammed', unit: 'S·03', open: 2, delivered: 0, avgDays: 13, onTime: 100 },
  { agent: 'Anand Persad',    unit: 'S·01', open: 1, delivered: 0, avgDays: 18, onTime: 50 },
  { agent: 'Kamla Singh',     unit: 'S·01', open: 0, delivered: 1, avgDays: 8,  onTime: 100 },
  { agent: 'Avinash Maharaj', unit: 'S·02', open: 0, delivered: 0, avgDays: 0,  onTime: 0 },
];

// ── Submissions / data-entry queue ────────────────────────────────────────
// New business the CRO keys into Tatil. Branch-issued products (Annuity,
// Funeral Expense) she can ALSO issue + settle; everything else is enter-only,
// and Tatil returns it later with an issue date (= settlement date).
const BRANCH_ISSUED = ['Annuity', 'Funeral Expense'];
const SUBMISSIONS = [
  { id: 's1', policyNo: '—',             owner: 'Lystra Sookram', product: 'Annuity',         plan: 'Tatil Secure Annuity', api: 60000, premium: 5000, agent: 'Marsha Singh', unit: 'S·02', date: 'Nov 27', state: 'to_enter', branchIssued: true },
  { id: 's2', policyNo: '—',             owner: 'Errol James',    product: 'Funeral Expense', plan: 'Dignity Plan',         api: 4800,  premium: 400,  agent: 'Riaz Khan',    unit: 'S·02', date: 'Nov 27', state: 'to_enter', branchIssued: true },
  { id: 's3', policyNo: 'TL-2026-08712', owner: 'Nadia Persad',   product: 'Universal Life',  plan: 'Platinum Edge',        api: 33600, premium: 2800, agent: 'Selina Mohammed', unit: 'S·03', date: 'Nov 26', state: 'entered' },
  { id: 's4', policyNo: 'TL-2026-08709', owner: 'Kern Bridglal',  product: 'Life',            plan: 'Tatil Term 20',        api: 16800, premium: 1400, agent: 'Anand Persad', unit: 'S·01', date: 'Nov 26', state: 'entered' },
  { id: 's5', policyNo: '—',             owner: 'Farah Ali',      product: 'Annuity',         plan: 'Tatil Secure Annuity', api: 48000, premium: 4000, agent: 'Kamla Singh',  unit: 'S·01', date: 'Nov 25', state: 'to_enter', branchIssued: true },
  { id: 's6', policyNo: 'TL-2026-08698', owner: 'Dexter Joseph',  product: 'Life',            plan: 'Whole Life Premier',   api: 30000, premium: 2500, agent: 'Marsha Singh', unit: 'S·02', date: 'Nov 25', state: 'entered' },
];
const SUB_TO_ENTER = SUBMISSIONS.filter((s) => s.state === 'to_enter');
const SUB_BRANCH_ISSUE = SUBMISSIONS.filter((s) => s.branchIssued && s.state === 'to_enter');

// ── Weekly production report (Friday 4pm) ─────────────────────────────────
// Branch production the CRO compiles + sends. Mirrors the production report
// the meeting + PDFs render. Per-agent week/MTD/YTD apps + API.
const WEEKLY_REPORT = {
  weekLabel: 'Week 48 · ending Fri 28 Nov 2025',
  branch: 'South Branch',
  agents: [
    { name: 'Marsha Singh',    unit: 'S·02', wkApps: 4, wkApi: 24400, mtdApps: 11, mtdApi: 69200, ytdApps: 41, ytdApi: 487000 },
    { name: 'Anand Persad',    unit: 'S·01', wkApps: 3, wkApi: 18600, mtdApps: 8,  mtdApi: 52800, ytdApps: 36, ytdApi: 442000 },
    { name: 'Selina Mohammed', unit: 'S·03', wkApps: 3, wkApi: 17400, mtdApps: 9,  mtdApi: 51200, ytdApps: 38, ytdApi: 396000 },
    { name: 'Riaz Khan',       unit: 'S·02', wkApps: 4, wkApi: 14600, mtdApps: 10, mtdApi: 44800, ytdApps: 30, ytdApi: 358000 },
    { name: 'Kamla Singh',     unit: 'S·01', wkApps: 2, wkApi: 11200, mtdApps: 6,  mtdApi: 31600, ytdApps: 27, ytdApi: 312000 },
    { name: 'Avinash Maharaj', unit: 'S·02', wkApps: 1, wkApi: 8200,  mtdApps: 4,  mtdApi: 22400, ytdApps: 22, ytdApi: 254000 },
  ],
};
function reportTotals() {
  const a = WEEKLY_REPORT.agents;
  return {
    wkApps: a.reduce((s, x) => s + x.wkApps, 0), wkApi: a.reduce((s, x) => s + x.wkApi, 0),
    mtdApps: a.reduce((s, x) => s + x.mtdApps, 0), mtdApi: a.reduce((s, x) => s + x.mtdApi, 0),
    ytdApps: a.reduce((s, x) => s + x.ytdApps, 0), ytdApi: a.reduce((s, x) => s + x.ytdApi, 0),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// SHELL
// ──────────────────────────────────────────────────────────────────────────
const CRO_NAV = [
  { title: null, items: [
    { key: 'home',       Icon: IconHome,   label: 'Branch Desk' },
  ]},
  { title: 'Operations', items: [
    { key: 'delivery',   Icon: IconBook,   label: 'Delivery Register' },
    { key: 'submissions',Icon: IconWizard, label: 'Submissions' },
    { key: 'settlements',Icon: IconWallet, label: 'Settlements' },
  ]},
  { title: 'Branch', items: [
    { key: 'report',     Icon: IconChart,  label: 'Weekly Report' },
    { key: 'metrics',    Icon: IconTarget, label: 'Delivery Metrics' },
  ]},
];

function CROSidebar({ t, active }) {
  return (
    <div style={{ width: SIDEBAR_W, background: t.surface, borderRight: `1px solid ${t.rule}`, display: 'flex', flexDirection: 'column', padding: '20px 12px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px', borderBottom: `1px solid ${t.rule}`, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: t.teal, color: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.04em' }}><AgencyLogo size={32} /></div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em' }}>AgencyTrack</div>
          <div style={{ fontSize: 10, color: t.inkMute, marginTop: 1 }}>CRO · South Branch</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {CRO_NAV.map((s, si) => (
          <div key={si} style={{ marginBottom: 14 }}>
            {s.title && <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 12px 6px', fontFamily: APP_FONT_MONO }}>{s.title}</div>}
            {s.items.map((it) => {
              const isActive = active === it.key;
              // live badge on Delivery Register = at-risk count
              const badge = it.key === 'delivery' ? atRiskPolicies().length : it.key === 'submissions' ? SUB_TO_ENTER.length : null;
              return (
                <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 9, background: isActive ? t.tealTint : 'transparent', color: isActive ? t.teal : t.inkMute, fontSize: 13, fontWeight: 600, position: 'relative' }}>
                  {isActive && <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: t.teal, borderRadius: 999 }}></div>}
                  <it.Icon size={17} color={isActive ? t.teal : t.inkMute} stroke={1.8} />
                  <div style={{ flex: 1 }}>{it.label}</div>
                  {badge ? <div style={{ padding: '1px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, background: it.key === 'delivery' ? t.danger : t.teal, color: '#fff', fontFamily: APP_FONT_MONO }}>{badge}</div> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <RoleSwitcher t={t} current="cro" />
      <div style={{ padding: '12px 10px', borderTop: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.goldTint, color: t.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY }}>{CRO_ME.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{CRO_ME.name}</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>CRO</div>
        </div>
      </div>
    </div>
  );
}

function CROShell({ t, active, title, subtitle, children }) {
  return (
    <div style={{ width: APP_W, height: APP_H, background: t.bg, color: t.ink, fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      <AmbientBg t={t} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex' }}>
        <CROSidebar t={t} active={active} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar t={t} title={title} subtitle={subtitle} modeMode={t.mode} />
          <div style={{ flex: 1, overflow: 'hidden', padding: '24px 28px' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ── Primitives ────────────────────────────────────────────────────────────
function CroEyebrow({ t, color, children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: color || t.teal, fontFamily: APP_FONT_MONO }}>{children}</div>;
}

function toneColor(t, tone) {
  return tone === 'success' ? t.success : tone === 'warning' ? t.warning : tone === 'danger' ? t.danger : tone === 'gold' ? t.gold : t.teal;
}
function toneBg(t, tone) {
  return tone === 'success' ? t.successTint : tone === 'warning' ? t.warningTint : tone === 'danger' ? t.dangerTint : tone === 'gold' ? t.goldTint : t.tealTint;
}

function DeliveryStatePill({ t, state, small = false }) {
  const st = DELIVERY_STATES[state];
  const c = toneColor(t, st.tone), bg = toneBg(t, st.tone);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: small ? '2px 8px' : '3px 10px', borderRadius: 999, background: bg, color: c, fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>{st.short}</span>
  );
}

// Clawback clock — days-left meter against the 30-day deadline
function ClawbackClock({ t, p, showLabel = true }) {
  const c = deliveryClock(p);
  if (c.done) {
    return <span style={{ fontSize: 11, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>✓ closed</span>;
  }
  const col = c.overdue ? t.danger : c.atRisk ? t.warning : t.teal;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 92 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: col, fontFamily: APP_FONT_DISPLAY }}>{c.overdue ? `+${Math.abs(c.daysLeft)}` : c.daysLeft}</span>
        <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{c.overdue ? 'days over' : 'days left'}</span>
      </div>
      <div style={{ height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${c.pct}%`, height: 4, background: col, borderRadius: 999 }}></div>
      </div>
    </div>
  );
}

Object.assign(window, {
  CRO_ME, CRO_NOW, DELIVERY_STATES, CLAWBACK_DAYS, AT_RISK_DAYS, deliveryClock,
  POLICIES, policyById, openPolicies, atRiskPolicies, closedPolicies,
  deliveryMetrics, DELIVERY_BY_AGENT, BRANCH_ISSUED, SUBMISSIONS, SUB_TO_ENTER, SUB_BRANCH_ISSUE,
  WEEKLY_REPORT, reportTotals, CRO_NAV, CROSidebar, CROShell,
  CroEyebrow, toneColor, toneBg, DeliveryStatePill, ClawbackClock,
});
