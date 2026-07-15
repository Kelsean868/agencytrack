// Company Config — desktop scenes: Targets & Minimums, Recognition &
// Gamification, Feature Flags, the row-grammar specimen, and the
// search-within-config state.

// ── TARGETS & MINIMUMS ────────────────────────────────────────────────────
const TENURE_BANDS = [
  { band: 'L1', range: ['0', '12'],  floor: 'TTD 250K', weekly: 'TTD 5.2K' },
  { band: 'L2', range: ['13', '24'], floor: 'TTD 350K', weekly: 'TTD 7.3K' },
  { band: 'L3', range: ['25', '36'], floor: 'TTD 450K', weekly: 'TTD 9.4K' },
  { band: 'L4', range: ['37', '∞'],  floor: 'TTD 550K', weekly: 'TTD 11.5K' },
];

function BandTable({ t }) {
  const th = { fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase', textAlign: 'left', padding: '0 0 8px' };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '26px 96px 1fr 150px 130px 30px', gap: 12, alignItems: 'center' }}>
        <div></div>
        <div style={th}>Band</div>
        <div style={th}>Tenure (months)</div>
        <div style={{ ...th, textAlign: 'right' }}>Annual API floor</div>
        <div style={{ ...th, textAlign: 'right' }}>Weekly floor</div>
        <div></div>
      </div>
      {TENURE_BANDS.map((b, i) => (
        <div key={b.band} style={{ display: 'grid', gridTemplateColumns: '26px 96px 1fr 150px 130px 30px', gap: 12, alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${t.rule}` }}>
          <IconDrag t={t} />
          <CcField t={t} value={b.band} width={72} mono={false} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <CcField t={t} value={b.range[0]} width={62} />
            <span style={{ fontSize: 11, color: t.inkFaint }}>to</span>
            <CcField t={t} value={b.range[1]} width={62} disabled={b.range[1] === '∞'} />
            {b.range[1] === '∞' && <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>OPEN</span>}
          </div>
          <div style={{ textAlign: 'right' }}><CcField t={t} value={b.floor} width={122} /></div>
          <div style={{ textAlign: 'right', fontSize: 12, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{b.weekly} <span style={{ fontSize: 9.5, color: t.inkFaint }}>· ÷48</span></div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.inkFaint} strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 11, borderTop: `1px solid ${t.rule}`, marginTop: 2 }}>
        <CcGhost t={t}><IconPlus size={13} color={t.ink} /> Add band</CcGhost>
        <div style={{ fontSize: 11, color: t.inkFaint, lineHeight: 1.4 }}>Bands must cover month 0 onward with no gaps — the last band stays open-ended. Weekly floors derive automatically (annual ÷ 48).</div>
      </div>
    </div>
  );
}

function TargetsScene({ t }) {
  return (
    <ConfigChrome t={t} active="targets">
      <CfgSectionHead t={t} section="targets" blurb="The production floors every agent is measured against — by tenure band. These drive AT FLOOR / BELOW flags on dashboards, Master Sheet and WARs." />
      <CfgGroup t={t} title="TENURE-BAND MINIMUMS" sub="Edit a band's name, range or floor directly. Drag to reorder; ranges re-validate on save.">
        <BandTable t={t} />
      </CfgGroup>
      <CfgGroup t={t} title="PACE & WARNINGS">
        <CfgRow t={t} first state="custom" def="80%" date="12 Jun 2026"
          label="Pace-warning threshold"
          desc="Agents show AT FLOOR when weekly pace drops below this share of their band minimum."
          control={<CcField t={t} value="85" suffix="%" changed />} />
        <CfgRow t={t} state="default"
          label="Below-floor grace period"
          desc="Consecutive weeks below floor before the exception escalates to the branch manager."
          control={<CcSeg t={t} options={['1 wk', '2 wk', '4 wk']} value="2 wk" />} />
      </CfgGroup>
      <CfgGroup t={t} title="CLUB & COMPANY THRESHOLDS">
        <CfgRow t={t} first state="default"
          label="Company API floor"
          desc="The organisation-wide annual production minimum, quoted in campaigns and goal-setting."
          control={<CcField t={t} value="TTD 9.60M" width={122} />} />
        <CfgRow t={t} state="soon" tier="TIER 2"
          label="MDRT threshold"
          desc="Mirrors the official MDRT commission requirement, converted to TTD · settled API. Pace figures are applied by Cloud Functions, so editing unlocks with Tier 2."
          control={<CcField t={t} value="TTD 1.02M" width={122} disabled />} />
      </CfgGroup>
    </ConfigChrome>
  );
}

// ── RECOGNITION & GAMIFICATION ────────────────────────────────────────────
const POINTS_SCALE = [
  { act: 'Call', code: 'CALL', pts: '1' },
  { act: 'Contact', code: 'CONT', pts: '2' },
  { act: 'Appointment kept', code: 'APPT', pts: '5' },
  { act: 'Fact find', code: 'FF', pts: '8' },
  { act: 'Closing interview', code: 'CI', pts: '10' },
  { act: 'Application submitted', code: 'APP', pts: '15' },
  { act: 'Referral collected', code: 'REF', pts: '3' },
];

function PointsTable({ t }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 88px', gap: 12, alignItems: 'center', paddingBottom: 8 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>ACTIVITY</div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>CODE</div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, textAlign: 'right' }}>POINTS</div>
      </div>
      {POINTS_SCALE.map((r) => (
        <div key={r.code} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 88px', gap: 12, alignItems: 'center', padding: '6px 0', borderTop: `1px solid ${t.rule}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{r.act}</div>
          <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{r.code}</div>
          <div style={{ textAlign: 'right' }}><CcField t={t} value={r.pts} width={64} /></div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: t.inkFaint, paddingTop: 10, borderTop: `1px solid ${t.rule}`, marginTop: 2, lineHeight: 1.45 }}>
        Points feed streaks, the leaderboard and campaigns. Production standing always stays API-based — points never replace it.
      </div>
    </div>
  );
}

function MilestoneChips({ t }) {
  const stones = ['4', '8', '12', '26', '52'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {stones.map((s) => (
        <div key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 8px 6px 12px', background: t.surface, border: `1.5px solid ${t.ruleStrong}`, borderRadius: 9 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{s}</span>
          <span style={{ fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO }}>WK</span>
          <svg width="11" height="11" viewBox="0 0 24 24" stroke={t.inkFaint} strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </div>
      ))}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: `1.5px dashed ${t.ruleStrong}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: t.inkMute }}>
        <IconPlus size={12} color={t.inkMute} /> Add milestone
      </div>
    </div>
  );
}

function RecognitionScene({ t }) {
  return (
    <ConfigChrome t={t} active="recognition">
      <CfgSectionHead t={t} section="recognition" blurb="How effort gets seen: the points scale behind streaks and the leaderboard, milestone moments, and how loud celebration is allowed to be." />
      <CfgGroup t={t} title="POINTS SCALE" accent={t.gold} sub="What each captured activity is worth on the leaderboard and in campaigns.">
        <PointsTable t={t} />
      </CfgGroup>
      <CfgGroup t={t} title="STREAK MILESTONES" accent={t.gold}>
        <CfgRow t={t} first state="default"
          label="Milestone thresholds"
          desc="Weeks of unbroken reporting that earn a recognition moment. Each milestone fires once."
          control={<MilestoneChips t={t} />} />
        <CfgRow t={t} state="default"
          label="Streak grace"
          desc="One missed week doesn't break a streak — once per quarter."
          control={<CcToggle t={t} on />} />
      </CfgGroup>
      <CfgGroup t={t} title="LEADERBOARD" accent={t.gold}>
        <CfgRow t={t} first state="custom" def="Unit" date="4 Mar 2026" who="Rajiv Maharaj"
          label="Visibility scope"
          desc="How far beyond their own team an agent can see ranked names."
          control={<CcSeg t={t} options={['Unit', 'Branch', 'Whole company']} value="Branch" />} />
        <CfgRow t={t} state="default"
          label="Show TTD amounts"
          desc="Off shows API bands instead of exact figures on ranked lists."
          control={<CcToggle t={t} on={false} />} />
      </CfgGroup>
      <CfgGroup t={t} title="CELEBRATION" accent={t.gold}>
        <CfgRow t={t} first state="default"
          label="Celebration intensity"
          desc="Full adds the confetti + sound moment in Daily Capture and Meeting Mode. Always respects reduced-motion."
          control={<CcSeg t={t} options={['Off', 'Subtle', 'Full']} value="Subtle" />} />
      </CfgGroup>
    </ConfigChrome>
  );
}

// ── FEATURE FLAGS ─────────────────────────────────────────────────────────
const FLAGS = [
  { key: 'persistency.v2_model', name: 'Persistency v2 model', on: true, who: 'Alicia Gopaul', date: '2 Jun 2026',
    desc: 'Rolling 24-month lifecycle persistency (time-weighted credits − debits). Switching restates persistency organisation-wide.' },
  { key: 'planner.scheduler', name: 'Planner & Scheduler', on: false,
    desc: 'Weekly planner with joint-call escalation to unit managers.' },
  { key: 'financing.track_k', name: 'Track K financing', on: false,
    desc: 'Financing validation dashboards and the take-home waterfall.' },
  { key: 'kiosk.branch_display', name: 'Branch kiosk display', on: false,
    desc: 'Read-only lobby screen: leaderboard + recognition loop. Configure under Kiosk once enabled.' },
  { key: 'capture.whatsapp_nudges', name: 'WhatsApp nudges', on: false,
    desc: 'Reminder messages for agents with a weekly report still open on Friday.' },
];

function FlagRow({ t, f, first }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 0', borderTop: first ? 'none' : `1px solid ${t.rule}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{f.name}</span>
          <span style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, padding: '2px 7px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 5 }}>{f.key}</span>
        </div>
        <div style={{ fontSize: 11.5, color: t.inkFaint, marginTop: 4, lineHeight: 1.45, maxWidth: 540 }}>{f.desc}</div>
        {f.on && <Provenance t={t} who={f.who} date={f.date} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 2 }}>
        {f.on ? (
          <React.Fragment>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: t.tealTint, borderRadius: 999, fontSize: 9.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em' }}>
              <IconCheck size={11} color={t.teal} stroke={2.6} /> ON
            </span>
            <CcGhost t={t}>Disable</CcGhost>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <span style={{ padding: '4px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 999, fontSize: 9.5, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em' }}>NOT SET → OFF</span>
            <CcGhost t={t} danger><IconAlert size={13} color={t.danger} /> Enable for everyone</CcGhost>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function FlagsScene({ t }) {
  return (
    <ConfigChrome t={t} active="flags">
      <CfgSectionHead t={t} section="flags" blurb="Early features you can switch on for your whole tenant before they graduate into their own config sections." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 12, flexShrink: 0 }}>
        <IconShield size={17} color={t.inkMute} />
        <div style={{ fontSize: 12, color: t.inkMute, lineHeight: 1.5 }}>
          Flags are <b style={{ color: t.ink }}>fail-closed</b>: any flag absent from your tenant is off. Enabling takes effect immediately for all <b style={{ color: t.ink }}>214 users</b> and is written to the audit log. Every other section here uses the same doc pattern — an absent key means current behavior, never a surprise.
        </div>
      </div>
      <CfgGroup t={t} title="AVAILABLE FLAGS" sub="Enable affordances are deliberately loud — a flag flip changes the product for everyone at once.">
        {FLAGS.map((f, i) => <FlagRow key={f.key} t={t} f={f} first={i === 0} />)}
      </CfgGroup>
    </ConfigChrome>
  );
}

// ── SEARCH-WITHIN-CONFIG STATE — dropdown over the Targets scene ──────────
function SearchScene({ t }) {
  const results = [
    { section: 'Targets & Minimums', label: 'MDRT threshold', value: 'TTD 1.02M · HARDCODED' },
    { section: 'Awards & Clubs', label: 'MDRT club — qualification & badge', value: 'DEFAULT' },
    { section: 'Reporting Cadence', label: 'MDRT pace on monthly report', value: 'ON' },
  ];
  return (
    <ConfigChrome t={t} active="targets" searchState={{ query: 'mdrt', results }}>
      <CfgSectionHead t={t} section="targets" blurb="The production floors every agent is measured against — by tenure band. These drive AT FLOOR / BELOW flags on dashboards, Master Sheet and WARs." />
      <CfgGroup t={t} title="TENURE-BAND MINIMUMS" sub="Edit a band's name, range or floor directly. Drag to reorder; ranges re-validate on save.">
        <BandTable t={t} />
      </CfgGroup>
      <CfgGroup t={t} title="PACE & WARNINGS">
        <CfgRow t={t} first state="custom" def="80%" date="12 Jun 2026"
          label="Pace-warning threshold"
          desc="Agents show AT FLOOR when weekly pace drops below this share of their band minimum."
          control={<CcField t={t} value="85" suffix="%" changed />} />
      </CfgGroup>
    </ConfigChrome>
  );
}

// ── ROW-GRAMMAR SPECIMEN — the locked/default duality, side by side ───────
function GrammarSpecimen({ t }) {
  const rows = [
    { tag: '01 · DEFAULT (INHERITED)', note: 'Platform value, live and editable. The faint DEFAULT tag is the only marker — quiet, because it\u2019s the common case.',
      row: <CfgRow t={t} first state="default" label="Below-floor grace period" desc="Consecutive weeks below floor before escalation." control={<CcSeg t={t} options={['1 wk', '2 wk', '4 wk']} value="2 wk" />} /> },
    { tag: '02 · TENANT-OVERRIDDEN', note: 'Teal dot + teal field border. Provenance names the person and date; reset restores the platform default in one tap.',
      row: <CfgRow t={t} first state="custom" def="80%" date="12 Jun 2026" label="Pace-warning threshold" desc="Agents show AT FLOOR below this share of band minimum." control={<CcField t={t} value="85" suffix="%" changed />} /> },
    { tag: '03 · PLATFORM-MANAGED', note: 'Grey + lock chip: the platform still owns this value. A temporary state, not permanent design — every setting on this surface is on the path to tenant-editable.',
      row: <CfgRow t={t} first state="platform" label="Currency & rounding" desc="All money renders through the platform ttd() rule." value="TTD · COMPACT" /> },
    { tag: '04 · HARDCODED · UNLOCKS BY TIER', note: 'Real value, disabled control; the warning chip names the unlock tier so admins know when editing lands. Same row, chip removed, once the plumbing ships.',
      row: <CfgRow t={t} first state="soon" tier="TIER 2" label="MDRT threshold" desc="Mirrors the official MDRT requirement in TTD." control={<CcField t={t} value="TTD 1.02M" width={122} disabled />} /> },
  ];
  return (
    <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', background: t.bg, padding: 28, fontFamily: APP_FONT_SANS, color: t.ink, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>SETTING-ROW GRAMMAR</div>
        <div style={{ fontSize: 19, fontWeight: 800, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 4 }}>One row, four states.</div>
      </div>
      {rows.map((r) => (
        <div key={r.tag} style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ paddingTop: 14 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkMute, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{r.tag}</div>
            <div style={{ fontSize: 11, color: t.inkFaint, marginTop: 4, lineHeight: 1.5 }}>{r.note}</div>
          </div>
          <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, padding: '2px 18px' }}>{r.row}</div>
        </div>
      ))}
    </div>
  );
}

// ── UNLOCK PLAN — implementation tiers behind the locked treatments ───────
const TIER1 = {
  eyebrow: 'TIER 1 · SRC-ONLY READS',
  cost: 'CHEAP · MOST OF THE WIN',
  items: [
    ['Points scale', 'Recognition'], ['Streak milestone thresholds', 'Recognition'],
    ['Award & club values', 'Awards & Clubs'], ['Career level names', 'Organization'],
    ['Delivery display bands', 'Policy & Delivery'], ['Kiosk timing', 'Kiosk'],
    ['Pace-warning %', 'Targets & Minimums'],
  ],
  notes: [
    'Values only the client reads today — swapping a module constant for a config-doc read.',
    'One config doc per section, fail-closed: an absent key = current behavior, exactly the featureFlags pattern.',
    'Awards already ships full override plumbing — replicate that pattern across the board.',
  ],
};
const TIER2 = {
  eyebrow: 'TIER 2 · CF-READ CONSTANTS',
  cost: 'MODERATE · NEEDS CARE',
  items: [
    ['Nudge cron & schedules', 'Reporting Cadence'], ['Gamification points (onSubmissionWrite)', 'Recognition'],
    ['MDRT pace figures', 'Targets & Minimums'], ['Tenure bands as CFs apply them', 'Targets & Minimums'],
  ],
  notes: [
    'Cloud Functions read config at runtime instead of module constants.',
    'Retires the ESM/CJS dual-copy: one Firestore source of truth — fixes the drift risk instead of adding one.',
    'Watch CF cold-start reads and the no-cross-bundle-import rule.',
  ],
};

function TierCard({ t, tier, accent }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: accent, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{tier.eyebrow}</div>
        <div style={{ flex: 1 }}></div>
        <div style={{ fontSize: 9, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em', padding: '3px 8px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 999 }}>{tier.cost}</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tier.items.map(([label, section]) => (
          <div key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>{label}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{section}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${t.rule}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {tier.notes.map((n, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: accent, marginTop: 5, flexShrink: 0 }}></div>
            <div style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.5 }}>{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnlockPlan({ t }) {
  return (
    <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', background: t.bg, padding: 28, fontFamily: APP_FONT_SANS, color: t.ink, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>UNLOCK PLAN</div>
        <div style={{ fontSize: 19, fontWeight: 800, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 4 }}>Everything here becomes editable.</div>
        <div style={{ fontSize: 12, color: t.inkMute, marginTop: 5, lineHeight: 1.5, maxWidth: 780 }}>The locked treatments are release states, not design. Two implementation tiers move every hardcoded value into tenant config — each with fail-closed defaults, so an untouched tenant behaves exactly as it does today.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <TierCard t={t} tier={TIER1} accent={t.teal} />
        <TierCard t={t} tier={TIER2} accent={t.warning} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
        <IconCheck size={15} color={t.teal} stroke={2.4} />
        <div style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.5 }}>As each tier lands, its rows simply lose the chip and gain the standard DEFAULT → CUSTOM lifecycle — no redesign, provenance and reset included from day one.</div>
      </div>
    </div>
  );
}

Object.assign(window, {
  TENURE_BANDS, POINTS_SCALE, FLAGS,
  BandTable, PointsTable, MilestoneChips, FlagRow,
  TargetsScene, RecognitionScene, FlagsScene, SearchScene, GrammarSpecimen,
  TIER1, TIER2, TierCard, UnlockPlan,
});
