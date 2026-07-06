// AgencyTrack — Monthly Recruiting v2. Shared data + primitives.
//
// Recruiting new advisors into the agency. Anyone can REFER a prospect; the
// MANAGER owns the pipeline and moves candidates through 8 stages. The target
// is CONFIGURABLE by upper management and can run monthly OR quarterly — the
// only standing guidance today is "at least 1 new licensed advisor per
// quarter", so the surface must read gracefully when no firm target is set.
//
// The final stage (Licensed & active) is the only one that counts as a HIRE,
// and it feeds the "Recruiting" KPI on the manager's Weekly WAR.
// Reuses app-tokens, app-shell, app-motion, manager-v2-shared, app-mobile.

// ── Pipeline stages (ordered) ─────────────────────────────────────────────
const REC_STAGES = [
  { key: 'sourced',    label: 'Sourced',        short: 'Sourced' },
  { key: 'contacted',  label: 'Contacted',      short: 'Contacted' },
  { key: 'seminar',    label: 'Career seminar', short: 'Seminar' },
  { key: 'interview',  label: 'Interview',      short: 'Interview' },
  { key: 'assessment', label: 'Assessment',     short: 'Assessment' },
  { key: 'offer',      label: 'Offer / contracted', short: 'Offer' },
  { key: 'licensing',  label: 'In licensing',   short: 'Licensing' },
  { key: 'licensed',   label: 'Licensed & active', short: 'Licensed' },
];
function stageIndex(key) { return REC_STAGES.findIndex((s) => s.key === key); }

// Stage color ramp — early grey → teal → gold at the hire. Computed off tokens.
function stageColor(t, key) {
  const i = stageIndex(key);
  if (key === 'licensed') return t.success;
  if (key === 'offer' || key === 'licensing') return t.gold;
  // interpolate inkFaint → teal across the first stages
  const ramp = [t.inkFaint, t.inkFaint, t.tealLight, t.tealLight, t.teal];
  return ramp[Math.min(i, ramp.length - 1)];
}

// ── Configurable target ───────────────────────────────────────────────────
// period: 'quarter' | 'month'. value null → no firm target set (guidance only).
const REC_TARGET = {
  period: 'quarter', value: 1, label: 'Q4 2025',
  setBy: 'Head of Sales', isGuidance: true, // true = "at least", soft minimum
  licensedThisPeriod: 1, contractedThisPeriod: 2,
};

// ── Candidates in the South Branch pipeline ───────────────────────────────
// referrer: who named them (any advisor) · owner: manager driving them.
// days: days in current stage · stalled flag when a stage drags.
const REC_CANDIDATES = [
  { name: 'Shivani Maraj',     initials: 'SM', stage: 'licensed',   referrer: 'Marsha Singh',  owner: 'Riaz Khan',         days: 3,  source: 'Agent referral', note: 'Licensed 14 Nov — assigned to S·02. First sale already submitted.', hireDate: '14 Nov' },
  { name: 'Brandon Charles',   initials: 'BC', stage: 'licensing',  referrer: 'Anand Persad',  owner: 'Camille Rampersad', days: 11, source: 'Agent referral', note: 'Pre-licensing course in progress — exam booked 6 Dec.' },
  { name: 'Aaliyah Mohammed',  initials: 'AM', stage: 'offer',      referrer: 'Self-sourced',  owner: 'Riaz Khan',         days: 5,  source: 'Career fair', note: 'Contract signed, onboarding scheduled. Strong profiling result.' },
  { name: 'Terrence Joseph',   initials: 'TJ', stage: 'assessment', referrer: 'Selina Mohammed',owner: 'Renee Baptiste',    days: 8,  source: 'Agent referral', note: 'Completed DISC + aptitude. Reviewing fit for S·01.' },
  { name: 'Divya Ramkissoon',  initials: 'DR', stage: 'interview',  referrer: 'Riaz Khan',     owner: 'Riaz Khan',         days: 4,  source: 'LinkedIn', note: 'Second interview Thu. Banking background — warm on the career switch.' },
  { name: 'Marcus Greaves',    initials: 'MG', stage: 'seminar',    referrer: 'Walk-in',       owner: 'Trevor Ramcharan',  days: 6,  source: 'Branch walk-in', note: 'Attended Tue career seminar. Following up to book an interview.' },
  { name: 'Crystal Ali',       initials: 'CA', stage: 'contacted',  referrer: 'Kamla Singh',   owner: 'Camille Rampersad', days: 16, source: 'Agent referral', note: 'Two attempts — invited to next seminar, awaiting confirmation.', stalled: true },
  { name: 'Damian Roberts',    initials: 'DR', stage: 'contacted',  referrer: 'Self-sourced',  owner: 'Renee Baptiste',    days: 3,  source: 'Career fair', note: 'Initial call done — keen, sending seminar details.' },
  { name: 'Jovan Phillips',    initials: 'JP', stage: 'sourced',    referrer: 'Marsha Singh',  owner: 'Riaz Khan',         days: 2,  source: 'Agent referral', note: 'Named by Marsha — not yet contacted.' },
  { name: 'Renuka Ramdass',    initials: 'RR', stage: 'sourced',    referrer: 'Omar Ali',      owner: 'Trevor Ramcharan',  days: 9,  source: 'Agent referral', note: 'Former client, expressed interest in a career change.' },
];

function candidatesByStage(key) { return REC_CANDIDATES.filter((c) => c.stage === key); }
const REC_TOTAL = REC_CANDIDATES.length;
const REC_STALLED = REC_CANDIDATES.filter((c) => c.stalled).length;
const REC_LICENSED = candidatesByStage('licensed').length;
const REC_LATE_FUNNEL = REC_CANDIDATES.filter((c) => ['offer', 'licensing'].includes(c.stage)).length;

// ──────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ──────────────────────────────────────────────────────────────────────────

function RecEyebrow({ t, color, children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: color || t.teal, fontFamily: APP_FONT_MONO }}>{children}</div>
  );
}

// Completion ring — small donut for % (self-contained so Recruiting doesn't
// depend on the WAR module).
function CompletionRing({ t, pct, size = 48, stroke = 5, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const c = color || (pct >= 80 ? t.success : pct >= 50 ? t.warning : t.danger);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.surfaceMute} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.26, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{pct}</div>
    </div>
  );
}

function StagePill({ t, stage, small = false }) {
  const s = REC_STAGES.find((x) => x.key === stage);
  const c = stageColor(t, stage);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: small ? '2px 8px' : '3px 10px', borderRadius: 999,
      background: `${c}1f`, color: c, fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: '0.05em',
      fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap',
    }}>{stage === 'licensed' ? '★ ' : ''}{s.short}</span>
  );
}

function CandidateAva({ t, initials, size = 34, stage }) {
  const gold = stage === 'licensed' || stage === 'offer' || stage === 'licensing';
  const fg = stage === 'licensed' ? t.success : gold ? t.gold : t.teal;
  const bg = stage === 'licensed' ? t.successTint : gold ? t.goldTint : t.tealTint;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.38, fontFamily: APP_FONT_DISPLAY }}>{initials}</div>
  );
}

// Stage progress timeline — 8 dots, current highlighted (used in drill)
function StageTimeline({ t, stage, vertical = false }) {
  const cur = stageIndex(stage);
  return (
    <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: vertical ? 0 : 4, alignItems: vertical ? 'flex-start' : 'center' }}>
      {REC_STAGES.map((s, i) => {
        const done = i < cur, here = i === cur;
        const c = here ? stageColor(t, s.key) : done ? t.teal : t.inkDim;
        if (vertical) {
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '5px 0' }}>
              <div style={{ width: 22, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: here ? 14 : 10, height: here ? 14 : 10, borderRadius: '50%', background: here || done ? c : t.surface, border: `2px solid ${c}` }}></div>
                {i < REC_STAGES.length - 1 && <div style={{ width: 2, height: 14, background: done ? t.teal : t.rule }}></div>}
              </div>
              <span style={{ fontSize: 12, fontWeight: here ? 700 : 600, color: here ? t.ink : done ? t.inkMute : t.inkFaint }}>{s.label}{here ? ' · here' : ''}</span>
            </div>
          );
        }
        return (
          <React.Fragment key={s.key}>
            <div style={{ width: here ? 12 : 9, height: here ? 12 : 9, borderRadius: '50%', background: here || done ? c : t.surfaceMute, border: here ? `2px solid ${c}` : 'none', flexShrink: 0 }}></div>
            {i < REC_STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: done ? t.teal : t.rule, minWidth: 8 }}></div>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  REC_STAGES, stageIndex, stageColor, REC_TARGET, REC_CANDIDATES,
  candidatesByStage, REC_TOTAL, REC_STALLED, REC_LICENSED, REC_LATE_FUNNEL,
  RecEyebrow, CompletionRing, StagePill, CandidateAva, StageTimeline,
});
