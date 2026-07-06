// AgencyTrack — Policy Reconciliation v2. Shared data + primitives.
//
// THE MODEL (from the user): an agent marks a policy 'Settled' on the Policy
// Ledger with the figures THEY submitted. The Unit/Branch Manager then keys in
// the actual settled figures from Tatil's settlement report and CONFIRMS. If
// the two agree, it's confirmed clean. If they differ — or Tatil shows a
// different status, a duplicate, a partial, a different period, a policy that
// never settled, or a settlement with no ledger entry — it becomes an
// EXCEPTION the agent disputes / the manager resolves.
//
// WHY IT MATTERS: confirmed/settled API is what feeds commissions, awards,
// persistency, and campaign payouts. An unreconciled mismatch = someone paid
// wrong or an award miscounted. Reconciliation is the trust gate beneath the
// "ledger is the single source of truth" model.
//
// Continuous cadence — items appear as settlements arrive.
// Reuses app-tokens (ttd, icons), app-shell, app-motion, manager-v2-shared.

// ── Discrepancy taxonomy ──────────────────────────────────────────────────
// Each settled-policy record carries a `flag`. 'clean' = ready to confirm.
const DISCREPANCY = {
  clean:     { label: 'Clean match',     short: 'Clean',     tone: 'success', blurb: 'Tatil figure matches the submission. Ready to confirm.' },
  amount:    { label: 'Amount mismatch', short: 'Amount',    tone: 'warning', blurb: 'Settled API differs from what was submitted.' },
  partial:   { label: 'Partial settle',  short: 'Partial',   tone: 'warning', blurb: 'Tatil settled for less than the submitted API.' },
  status:    { label: 'Status conflict', short: 'Status',    tone: 'danger',  blurb: 'Agent marked Settled; Tatil shows a different status.' },
  period:    { label: 'Period mismatch', short: 'Period',    tone: 'warning', blurb: 'Settled in a different month than submitted.' },
  duplicate: { label: 'Duplicate',       short: 'Duplicate', tone: 'danger',  blurb: 'Same policy logged twice in the ledger.' },
  missing:   { label: 'Missing settle',  short: 'Missing',   tone: 'danger',  blurb: 'Submitted as settled, but not in Tatil\u2019s file.' },
  unmatched: { label: 'Unmatched',       short: 'Unmatched', tone: 'teal',    blurb: 'Tatil settled it, but there\u2019s no ledger entry.' },
};
function discTone(t, flag) {
  const tone = (DISCREPANCY[flag] || {}).tone || 'inkFaint';
  return tone === 'success' ? t.success : tone === 'warning' ? t.warning : tone === 'danger' ? t.danger : tone === 'teal' ? t.teal : t.inkFaint;
}
function discBg(t, flag) {
  const tone = (DISCREPANCY[flag] || {}).tone || 'inkFaint';
  return tone === 'success' ? t.successTint : tone === 'warning' ? t.warningTint : tone === 'danger' ? t.dangerTint : tone === 'teal' ? t.tealTint : t.surfaceMute;
}

// Resolution state of an exception (after someone acts).
const RECON_STATE = {
  pending:   { label: 'Needs review',  tone: 'warning' },
  disputed:  { label: 'Disputed',      tone: 'danger'  },
  escalated: { label: 'Escalated',     tone: 'danger'  },
  resolved:  { label: 'Resolved',      tone: 'success' },
  confirmed: { label: 'Confirmed',     tone: 'gold'    },
};

// ── Branch-wide settled records awaiting / in reconciliation ──────────────
// submitted = what the agent put on the ledger · settled = Tatil's figure
// (null until the manager keys it in). delta computed where both exist.
const RECON_RECORDS = [
  // Clean matches — ready to confirm in one tap
  { id: 'r1', agent: 'Marsha Singh', unit: 'S·02', policyNo: 'TL-2026-08661', insured: 'Anil Boodram', plan: 'Platinum Edge', product: 'Universal Life',
    submitted: { api: 36000, premium: 3000, freq: 'M', month: 'Nov', status: 'settled' },
    settled:   { api: 36000, premium: 3000, month: 'Nov', status: 'settled' },
    flag: 'clean', state: 'pending', feeds: ['MDRT 2026', 'Christmas Campaign'] },
  { id: 'r2', agent: 'Riaz Khan', unit: 'S·02', policyNo: 'TL-2026-08655', insured: 'Sara Khan', plan: 'Tatil Term 20', product: 'Life',
    submitted: { api: 18600, premium: 1550, freq: 'M', month: 'Nov', status: 'settled' },
    settled:   { api: 18600, premium: 1550, month: 'Nov', status: 'settled' },
    flag: 'clean', state: 'pending', feeds: ['South Sprint'] },

  // Amount mismatch — Tatil rated up, settled higher
  { id: 'r3', agent: 'Marsha Singh', unit: 'S·02', policyNo: 'TL-2026-08503', insured: 'Kareem Mohammed', plan: 'Platinum Edge', product: 'Universal Life',
    submitted: { api: 32400, premium: 2700, freq: 'M', month: 'Nov', status: 'settled' },
    settled:   { api: 29800, premium: 2483, month: 'Nov', status: 'settled' },
    flag: 'amount', state: 'pending', feeds: ['MDRT 2026', 'Christmas Campaign'],
    note: 'Underwriting applied a smoker loading review — settled API came in TTD 2,600 under submission.' },

  // Partial settlement
  { id: 'r4', agent: 'Selina Mohammed', unit: 'S·03', policyNo: 'TL-2026-08540', insured: 'Devon Ali', plan: 'Tatil Whole Life Premier', product: 'Life',
    submitted: { api: 24000, premium: 2000, freq: 'M', month: 'Nov', status: 'settled' },
    settled:   { api: 12000, premium: 1000, month: 'Nov', status: 'settled' },
    flag: 'partial', state: 'disputed', feeds: ['Christmas Campaign'],
    note: 'Client downgraded coverage at issue — only the base rider settled. Agent disputes; says full plan was accepted.' },

  // Status conflict — agent says settled, Tatil shows NTU
  { id: 'r5', agent: 'Anand Persad', unit: 'S·01', policyNo: 'TL-2026-08498', insured: 'Marcus Lee', plan: 'Tatil Term 10', product: 'Life',
    submitted: { api: 16800, premium: 1400, freq: 'M', month: 'Nov', status: 'settled' },
    settled:   { api: 0, premium: 0, month: 'Nov', status: 'ntu' },
    flag: 'status', state: 'pending', feeds: ['Christmas Campaign'],
    note: 'Tatil shows Not Taken Up — client never paid first premium. Agent had logged it as settled.' },

  // Period mismatch
  { id: 'r6', agent: 'Carla Joseph', unit: 'S·02', policyNo: 'TL-2026-08321', insured: 'Renee Baptiste', plan: 'Platinum Edge', product: 'Universal Life',
    submitted: { api: 30000, premium: 2500, freq: 'M', month: 'Oct', status: 'settled' },
    settled:   { api: 30000, premium: 2500, month: 'Nov', status: 'settled' },
    flag: 'period', state: 'pending', feeds: ['MDRT 2026'],
    note: 'Submitted as October production; Tatil settled in November. Affects which month the API counts in.' },

  // Duplicate
  { id: 'r7', agent: 'Kamla Singh', unit: 'S·01', policyNo: 'TL-2026-08277', insured: 'Omar Ali', plan: 'Tatil Term 20', product: 'Life',
    submitted: { api: 21600, premium: 1800, freq: 'M', month: 'Nov', status: 'settled' },
    settled:   { api: 21600, premium: 1800, month: 'Nov', status: 'settled' },
    flag: 'duplicate', state: 'pending', feeds: [],
    note: 'Logged twice (also TL-2026-08278). Confirm one, void the other before it double-counts.' },

  // Missing settlement — submitted, not in Tatil file
  { id: 'r8', agent: 'Riaz Khan', unit: 'S·02', policyNo: 'TL-2026-08612', insured: 'Priya Naidu', plan: 'Tatil Whole Life Premier', product: 'Life',
    submitted: { api: 27600, premium: 2300, freq: 'M', month: 'Nov', status: 'settled' },
    settled:   null,
    flag: 'missing', state: 'escalated', feeds: ['South Sprint'],
    note: 'Marked settled 3 weeks ago but absent from two Tatil files. Escalated to head office to trace.' },

  // Unmatched — Tatil settled it, no ledger entry
  { id: 'r9', agent: 'Avinash Maharaj', unit: 'S·02', policyNo: 'TL-2026-08701', insured: 'Jamal Khan', plan: 'Tatil Term 20', product: 'Life',
    submitted: null,
    settled:   { api: 19200, premium: 1600, month: 'Nov', status: 'settled' },
    flag: 'unmatched', state: 'pending', feeds: [],
    note: 'In Tatil\u2019s file at TTD 19,200 but never logged on the ledger. Match to an agent or add it.' },

  // Already confirmed (history)
  { id: 'r10', agent: 'Marsha Singh', unit: 'S·02', policyNo: 'TL-2026-08245', insured: 'Naomi Hosein', plan: 'Platinum Edge', product: 'Universal Life',
    submitted: { api: 48000, premium: 4000, freq: 'M', month: 'Oct', status: 'settled' },
    settled:   { api: 48000, premium: 4000, month: 'Oct', status: 'settled' },
    flag: 'clean', state: 'confirmed', confirmedBy: 'T. Ramcharan', confirmedOn: '14 Nov', feeds: ['MDRT 2026', 'Christmas Campaign'] },
];

// ── Derived helpers ───────────────────────────────────────────────────────
function recDelta(r) {
  if (!r.submitted || !r.settled) return null;
  return r.settled.api - r.submitted.api;
}
function isException(r) { return r.flag !== 'clean'; }
const RECON_CLEAN     = RECON_RECORDS.filter((r) => r.flag === 'clean' && r.state === 'pending');
const RECON_EXCEPTIONS= RECON_RECORDS.filter((r) => isException(r) && r.state !== 'confirmed' && r.state !== 'resolved');
const RECON_CONFIRMED = RECON_RECORDS.filter((r) => r.state === 'confirmed' || r.state === 'resolved');
const RECON_PENDING_COUNT = RECON_CLEAN.length + RECON_EXCEPTIONS.length;

// TTD at risk = sum of |delta| for amount/partial + full submitted API for
// status/missing (could vanish) + unmatched settled API (could be lost).
function reconAtRisk() {
  let risk = 0;
  for (const r of RECON_EXCEPTIONS) {
    if (r.flag === 'amount' || r.flag === 'partial') risk += Math.abs(recDelta(r) || 0);
    else if (r.flag === 'status' || r.flag === 'missing') risk += (r.submitted?.api || 0);
    else if (r.flag === 'unmatched') risk += (r.settled?.api || 0);
    else if (r.flag === 'duplicate') risk += (r.submitted?.api || 0);
  }
  return risk;
}

// ──────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ──────────────────────────────────────────────────────────────────────────

function ReconEyebrow({ t, color, children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: color || t.teal, fontFamily: APP_FONT_MONO }}>{children}</div>;
}

function Avatar2({ t, name, size = 32, tone = 'teal' }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  const fg = tone === 'gold' ? t.gold : t.teal, bg = tone === 'gold' ? t.goldTint : t.tealTint;
  return <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.38, fontFamily: APP_FONT_DISPLAY }}>{initials}</div>;
}

function DiscrepancyBadge({ t, flag, small = false }) {
  const d = DISCREPANCY[flag];
  const fg = discTone(t, flag), bg = discBg(t, flag);
  const icon = flag === 'clean' ? '✓' : flag === 'unmatched' ? '?' : flag === 'duplicate' ? '⧉' : '!';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: small ? '2px 8px' : '3px 10px', borderRadius: 999, background: bg, color: fg, fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>
      <span>{icon}</span>{small ? d.short : d.label}
    </span>
  );
}

// Delta chip — signed difference, colored by direction
function DeltaChip({ t, delta, big = false }) {
  if (delta == null) return null;
  const zero = delta === 0;
  const c = zero ? t.success : delta < 0 ? t.danger : t.teal;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: big ? 15 : 11.5, fontWeight: 700, color: c, fontFamily: APP_FONT_MONO }}>
      {zero ? '✓ match' : `${sign}${ttd(Math.abs(delta))}`}
    </span>
  );
}

// Compare field — one labelled row of submitted vs settled with a delta read
function CompareField({ t, label, submitted, settled, mismatch }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: `1px solid ${t.rule}` }}>
      <div style={{ width: 96, fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: t.ink, fontFamily: APP_FONT_MONO }}>{submitted}</div>
      <IconChevR size={13} color={t.inkDim} stroke={2} />
      <div style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 700, color: mismatch ? t.danger : t.ink, fontFamily: APP_FONT_MONO }}>{settled}</div>
    </div>
  );
}

// Summary tile
function ReconTile({ t, label, count, value, color, active }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '13px 15px', background: active ? color + '14' : t.surfaceSoft, border: `1px solid ${active ? color + '55' : t.rule}`, borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }}></span>
        <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 9 }}>{count}</div>
      <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 5, fontFamily: APP_FONT_MONO }}>{value}</div>
    </div>
  );
}

Object.assign(window, {
  DISCREPANCY, discTone, discBg, RECON_STATE, RECON_RECORDS,
  recDelta, isException, RECON_CLEAN, RECON_EXCEPTIONS, RECON_CONFIRMED, RECON_PENDING_COUNT, reconAtRisk,
  ReconEyebrow, Avatar2, DiscrepancyBadge, DeltaChip, CompareField, ReconTile,
});
