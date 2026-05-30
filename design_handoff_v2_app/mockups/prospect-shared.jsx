// Prospect Prep v2 (repo: "Joint-Call Prep" / F3 ProspectInfoPanel).
//
// HARD CONSTRAINTS from the repo (do not drift into a CRM):
//   • Appointment-bound (§0 guardrail): every prep has a required
//     intendedAppointmentDate. It's prep for ONE upcoming joint call with a
//     manager — NOT a prospect pipeline.
//   • Agent-authored, manager-READABLE (inverse of coaching notes): the agent
//     owns/edits; managers in scope read, never write.
//   • Prep → "Log Policy" closes the loop into the policy ledger.
//
// v2 reframes the flat form-list into "prep for THIS call": a hero next-call
// card with countdown + readiness, the four objections turned into a
// rehearsal aid, a clean manager read view, and a quiet convert moment.

// ── Repo pick-lists (verbatim from prospectInfoService.js) ──────────────────
const PP_SOURCES = {
  seminar: 'Seminar', 'booth-event': 'Booth Event', referral: 'Referral',
  'cold-call': 'Cold Call', 'social-media': 'Social Media', orphan: 'Orphan Policy',
  'existing-client': 'Existing Client', 'family-friend': 'Family / Friend',
  'bank-referral': 'Bank Referral (BOA)', self: 'Self', other: 'Other',
};
const PP_APPT_TYPES = { '2nd-interview': '2nd Interview', 'closing-interview': 'Closing Interview' };
const PP_POLICY_TYPES = {
  'critical-illness': 'Critical Illness', 'final-expense': 'Final Expense / Micro-Life',
  'term-life': 'Term Life', 'whole-life': 'Whole Life', 'universal-life': 'Universal Life',
  endowment: 'Endowment', 'pension-annuity': 'Pension / Annuity', 'mortgage-credit-life': 'Mortgage / Credit Life',
};

// The four objections — turned from dead checkboxes into a rehearsal aid.
const PP_OBJECTIONS = {
  'no-money':      { label: 'No Money',      means: 'Doesn\u2019t see room in the budget right now.', counter: 'Reframe cost vs the cost of being uninsured; show a smaller starter premium.' },
  'no-need':       { label: 'No Need',       means: 'Doesn\u2019t feel the risk applies to them yet.',  counter: 'Use their own dependents / goals; a needs-analysis makes the gap concrete.' },
  'no-hurry':      { label: 'No Hurry',      means: 'Believes it can wait.',                           counter: 'Premiums rise with age; insurability isn\u2019t guaranteed later. Lock today\u2019s rate.' },
  'no-confidence': { label: 'No Confidence', means: 'Unsure about you, the product, or the company.',  counter: 'Lean on Tatil\u2019s track record + your joint call with the manager as proof.' },
};

// ── Sample preps — Marsha, "today" = Thu 27 Nov ─────────────────────────────
const PROSPECT_SAMPLE = {
  agent: 'Marsha Singh',
  today: 'THU · 27 NOV',
  manager: { name: 'T. Ramcharan', role: 'Unit Manager' },

  preps: [
    {
      id: 'p1', clientName: 'Anil & Reshma Persaud', clientAge: 38, clientOccupation: 'Small-business owners',
      source: 'referral', appointmentType: 'closing-interview', policyType: 'whole-life',
      objections: ['no-money', 'no-hurry'],
      date: 'FRI · 28 NOV', time: '2:00 PM', inDays: 1, prepped: true,
      estApi: 14000, note: 'Referred by the Mohammeds. Wants cover for both kids\u2019 education. Bring the education-endowment illustration.',
    },
    {
      id: 'p2', clientName: 'Kevon Baptiste', clientAge: 29, clientOccupation: 'Software developer',
      source: 'social-media', socialPlatform: 'Instagram', appointmentType: '2nd-interview', policyType: 'term-life',
      objections: ['no-need'],
      date: 'TUE · 02 DEC', time: '11:00 AM', inDays: 5, prepped: false,
      estApi: 7200, note: '',
    },
    {
      id: 'p3', clientName: 'Sangeeta Ramlogan', clientAge: 45, clientOccupation: 'Nurse',
      source: 'existing-client', appointmentType: 'closing-interview', policyType: 'critical-illness',
      objections: ['no-confidence'],
      date: 'THU · 04 DEC', time: '4:30 PM', inDays: 7, prepped: false,
      estApi: 9600, note: 'Existing motor client, cross-sell CI. Husband had a scare last year.',
    },
  ],

  // a converted one (prep → policy logged)
  converted: {
    clientName: 'The Mohammed Family', policyType: 'endowment', api: 16800,
    appointmentType: 'closing-interview', date: 'MON · 24 NOV',
  },
};

// ── helpers ─────────────────────────────────────────────────────────────────
function ppK(n) {
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000)   return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}
function ppTtd(n) { return `TTD ${ppK(n)}`; }
function ppInitials(name) {
  return name.replace(/&|\band\b/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
}
function ppCountdown(inDays) {
  if (inDays <= 0) return 'TODAY';
  if (inDays === 1) return 'TOMORROW';
  return `IN ${inDays} DAYS`;
}

// ── ApptBadge — countdown chip; amber when imminent + not prepped ───────────
function ApptBadge({ t, inDays, prepped }) {
  const imminent = inDays <= 1;
  const urgent = imminent && !prepped;
  const tone = urgent ? t.warning : imminent ? t.teal : t.inkMute;
  const tint = urgent ? t.warningTint : imminent ? t.tealTint : t.surfaceMute;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
      background: tint, color: tone, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone }}></span>
      {ppCountdown(inDays)}
    </span>
  );
}

// ── Pill atom ───────────────────────────────────────────────────────────────
function PPpill({ t, children, tone = 'ink' }) {
  const map = { ink: [t.surfaceMute, t.inkMute], teal: [t.tealTint, t.teal], gold: [t.goldTint, t.gold], warn: [t.warningTint, t.warning] };
  const [bg, fg] = map[tone] || map.ink;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, background: bg, color: fg, fontSize: 10, fontWeight: 700, letterSpacing: '0.02em' }}>{children}</span>
  );
}

// ── ObjectionChip — rehearsal aid (label + meaning + counter) ───────────────
function ObjectionChip({ t, value, expanded = false }) {
  const o = PP_OBJECTIONS[value];
  if (!o) return null;
  if (!expanded) {
    return <PPpill t={t} tone="warn">{o.label}</PPpill>;
  }
  return (
    <div style={{ padding: '11px 13px', borderRadius: 10, background: t.warningTint, border: `1px solid ${t.warning}33` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: t.warning }}>{o.label}</span>
        <span style={{ fontSize: 10, color: t.inkMute, fontStyle: 'italic' }}>— {o.means}</span>
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 7, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, marginTop: 1, color: t.teal }}><IconBolt size={12} color={t.teal} stroke={2.2} /></div>
        <div style={{ fontSize: 11, color: t.ink, lineHeight: 1.45 }}>{o.counter}</div>
      </div>
    </div>
  );
}

// ── PPManagerBanner ─────────────────────────────────────────────────────────
function PPManagerBanner({ t, data }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: t.goldTint, border: `1px solid ${t.gold}55`, borderRadius: 11, flexShrink: 0 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.gold, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>TR</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: t.ink }}>
          {data.agent.split(' ')[0]}'s prep for your joint call — <span style={{ color: t.gold }}>read-only</span>. Coach the approach; she owns the record.
        </div>
        <div style={{ fontSize: 10, color: t.inkMute, marginTop: 2, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
          MANAGER VIEW · {data.manager.name.toUpperCase()} · {data.manager.role.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  PP_SOURCES, PP_APPT_TYPES, PP_POLICY_TYPES, PP_OBJECTIONS, PROSPECT_SAMPLE,
  ppK, ppTtd, ppInitials, ppCountdown, ApptBadge, PPpill, ObjectionChip, PPManagerBanner,
});
