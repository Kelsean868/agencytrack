// AgencyTrack — On-Track Engine. The connective tissue that closes the loop:
//   CAMPAIGN tier  →  backward-solve (the repo's ratio chain, made campaign- &
//   time-aware)  →  THIS WEEK's activity prescription  →  HIT-LIST fuel  →
//   PLANNER booking  →  ledger settle  →  back to the campaign tracker.
// Persistency is threaded as an actionable reinstatement nudge, not just a gate.
//
// Reuses: app-tokens (ttd, icons), app-mobile (MFrame, M_W/M_H), planner-shared
// (ActChip, ACT_CODE, actStyle, CounterBar, PBtn, PHeader, PBody, PLabel),
// campaigns-v2-shared (PersGate, PERS_GATE, gateFor, XMAS_TIERS, ttd),
// app-shell (Topbar, AmbientBg, Eyebrow, Pill, Ava-style). Grounded in the real
// repo: goalsService playground ratios + lib/deriveApps + yearPlanProjection.

// ── The conversion chain — mirrors the repo's playground ratio fields ──────
// goalsService stores: playgroundAvgPolicyAPI, playgroundCiToSaleRatio,
// playgroundDialsToCIRatio, playgroundProspectRatio. We express the full ladder
// agent activity codes use (P.C → A.I → F.F.I → C.I → Sale) as stage multipliers.
const RATIOS = {
  avgPolicyAPI: 9_667,   // ~$58K gap ≈ 6 apps; matches deriveApps' DEFAULT_AVG_POLICY_API spirit
  ciToSale:     0.5,     // close rate — 1 sale needs 2 C.I  (playgroundCiToSaleRatio)
  ffiToCI:      0.67,    // 1 C.I needs ~1.5 F.F.I
  aiToFFI:      0.75,    // 1 F.F.I needs ~1.33 A.I
  dialsToAI:    0.20,    // 1 A.I needs ~5 prospecting dials (playgroundDialsToCIRatio chain)
};

// prescribe(appsGap, weeksLeft) → required per-week activity by code.
// This is the keystone: a campaign gap + time remaining → a weekly to-do.
function prescribe(appsGap, weeksLeft) {
  const w = Math.max(1, weeksLeft);
  const salesPerWk = appsGap / w;            // settled apps needed per week
  const ci  = salesPerWk / RATIOS.ciToSale;  // C.I per week
  const ffi = ci  / RATIOS.ffiToCI;
  const ai  = ffi / RATIOS.aiToFFI;
  const pc  = ai  / RATIOS.dialsToAI;        // prospecting dials/calls per week
  return {
    SALE: Math.round(salesPerWk * 10) / 10,
    CI:  Math.ceil(ci),
    FFI: Math.ceil(ffi),
    AI:  Math.ceil(ai),
    PC:  Math.ceil(pc),
  };
}

// ── DATA — Marsha Singh, anchored to the Christmas "Champion" tier ─────────
const OT = {
  agent: 'Marsha Singh',
  campaign: 'Christmas Campaign 2025',
  scope: 'Company-wide · all advisors',
  // The anchored tier (from XMAS_TIERS · Champion).
  tier: { name: 'Champion', level: 3, api: 200_000, apps: 20, cash: 7_000, voucher: 2_000 },
  nextTier: { name: 'VIP', level: 4, api: 275_000, apps: 20, cash: 20_000, voucher: 2_000 },
  // Where she stands.
  settledApi: 142_000, settledApps: 14,
  pipelineApi: 26_000, pipelineApps: 3,   // submitted, not yet settled
  weeksLeft: 6, daysLeft: 41,
  pers: 88,                                // current avg persistency → gate
  // This week's booked activity (from the planner) vs what's prescribed.
  bookedThisWeek: { CI: 1, FFI: 3, AI: 2, PC: 12 },
};
OT.gapApi  = Math.max(0, OT.tier.api  - OT.settledApi);
OT.gapApps = Math.max(0, OT.tier.apps - OT.settledApps);
OT.need    = prescribe(OT.gapApps, OT.weeksLeft);

// ── MONEY NEEDS — the other anchor. Income goal → API → apps → BASELINE weekly
// activity. Mirrors the repo's MoneyNeedsPanel + goalsService playground fields.
// This is the always-on floor; a campaign is a temporary lift on top of it.
const MONEY_NEEDS = {
  incomeGoal: 180_000, taxRate: 0.0, renewalIncome: 36_000, commissionRate: 0.40,
  // income − renewals = first-year commission needed; ÷ rate = API to write.
  // (180k − 36k) / 0.40 = 360k … pared to a realistic personal target after renewals build.
  annualApi: 240_000, annualApps: 25, persistencyTarget: 90,
  workingWeeks: 46,
};
// Baseline weekly need = annual apps spread across working weeks, back-solved.
MONEY_NEEDS.weekly = prescribe(MONEY_NEEDS.annualApps, MONEY_NEEDS.workingWeeks);

// The resolved weekly prescription = the HIGHER of baseline (Money Needs) and
// campaign push, per activity code. Company floor would be a third input.
function resolvedNeed(baseline, push) {
  const out = {};
  for (const k of ['CI', 'FFI', 'AI', 'PC']) out[k] = Math.max(baseline[k] || 0, push[k] || 0);
  return out;
}
OT.resolved = resolvedNeed(MONEY_NEEDS.weekly, OT.need);

// Hit-list fuel — campaign-scoped, source-typed (the spreadsheet's three lists).
// Each row carries the activity stage it would fill, so it maps onto the
// prescription shortfall directly.
const HITLIST = {
  prospect: [
    { name: 'Anand Maharaj',   stage: 'CI',  why: 'F.F.I done · Whole Life 250K · ready to close', api: 18_400, hot: true },
    { name: 'Nisha Persad',    stage: 'AI',  why: 'Referral from Kavita · not yet seen', api: 9_000 },
    { name: 'Dexter Charles',  stage: 'AI',  why: 'Pension transfer · callback due', api: 14_000 },
    { name: 'Shivani Boodram', stage: 'FFI', why: 'Approach done · young family', api: 7_500 },
  ],
  crosssell: [
    { name: 'Kavita Ramlogan', stage: 'CI',  why: 'Owns Life · gap: Critical Illness rider', api: 6_200, hot: true },
    { name: 'Marlon Joseph',   stage: 'AI',  why: 'Owns Motor · no Life · new baby', api: 11_000 },
  ],
  reinstate: [
    { name: 'Anand (lapsed WL)', stage: 'REINST', why: 'Lapsed 90 days · falls off 12-mo record soon', api: 17_500, hot: true, deadline: 'LPO by 12 Jul' },
    { name: 'Reshma Ali',        stage: 'REINST', why: 'Outstanding premium · ACH not pulling', api: 4_800 },
  ],
};

// ── PRIMITIVES ─────────────────────────────────────────────────────────────

// Anchor header — "you are tracking THIS goal". The top of the loop.
function AnchorHeader({ t, ot, top = 44, onBack }) {
  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, padding: '14px 18px 12px', background: t.bg, zIndex: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Tracking</span>
        <span style={{ padding: '2px 8px', borderRadius: 999, background: t.inkAccentTint, color: t.inkAccent, fontSize: 9.5, fontWeight: 700, fontFamily: APP_FONT_MONO }}>COMPANY</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>{ot.weeksLeft} WEEKS LEFT</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 7 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.05 }}>{ot.tier.name} tier</div>
          <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2 }}>{ot.campaign} · {ttd(ot.tier.cash)} + {ttd(ot.tier.voucher)} voucher</div>
        </div>
        <div style={{ padding: '6px 10px', borderRadius: 10, background: t.surface, border: `1px solid ${t.rule}`, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>CHANGE</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: t.teal }}>goal</div>
        </div>
      </div>
    </div>
  );
}

// Gap meter — settled / pipeline / gap toward the tier (two bars: API + apps).
function GapMeter({ t, ot }) {
  const pctSettled = (ot.settledApi / ot.tier.api) * 100;
  const pctPipe = (ot.pipelineApi / ot.tier.api) * 100;
  const appsSettledPct = (ot.settledApps / ot.tier.apps) * 100;
  const appsPipePct = (ot.pipelineApps / ot.tier.apps) * 100;
  const Bar = ({ label, settled, pipe, now, target, fmt }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{fmt(now)}<span style={{ color: t.inkFaint }}> / {fmt(target)}</span></span>
      </div>
      <div style={{ height: 9, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
        <div className="a-progress-grow" style={{ width: `${Math.min(100, settled)}%`, background: t.teal }} />
        <div style={{ width: `${Math.min(100 - settled, pipe)}%`, background: `repeating-linear-gradient(45deg, ${t.teal}66, ${t.teal}66 4px, ${t.teal}33 4px, ${t.teal}33 8px)` }} />
      </div>
    </div>
  );
  return (
    <div className="a-card" style={{ padding: '14px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <Bar label="SETTLED API" settled={pctSettled} pipe={pctPipe} now={ot.settledApi} target={ot.tier.api} fmt={ttd} />
        <Bar label="APPS" settled={appsSettledPct} pipe={appsPipePct} now={ot.settledApps} target={ot.tier.apps} fmt={(v) => v} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 11, borderTop: `1px solid ${t.rule}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 9, height: 9, borderRadius: 2, background: t.teal }} /><span style={{ fontSize: 10.5, color: t.inkMute }}>Settled</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 9, height: 9, borderRadius: 2, background: `repeating-linear-gradient(45deg, ${t.teal}66, ${t.teal}66 3px, ${t.teal}22 3px, ${t.teal}22 6px)` }} /><span style={{ fontSize: 10.5, color: t.inkMute }}>Submitted</span></div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>{ttd(ot.gapApi)} · {ot.gapApps} apps to go</span>
      </div>
    </div>
  );
}

// Prescription row — the backward-solve made concrete: per-week need vs booked.
function PrescriptionRow({ t, code, need, booked }) {
  const short = booked < need;
  const s = actStyle(t, code);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <div style={{ width: 46, flexShrink: 0 }}><ActChip t={t} type={code} size="s" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
          <div className="a-progress-grow" style={{ width: `${Math.min(100, (booked / need) * 100)}%`, height: 7, background: short ? t.warning : t.success, borderRadius: 999 }} />
        </div>
      </div>
      <div style={{ flexShrink: 0, fontFamily: APP_FONT_MONO, fontSize: 12, fontWeight: 700, color: short ? t.warning : t.success, minWidth: 70, textAlign: 'right' }}>
        {booked}<span style={{ color: t.inkFaint, fontWeight: 600 }}> / {need}/wk</span>
      </div>
    </div>
  );
}

// Persistency gate nudge — the gate as a fixable to-do, not just a verdict.
function GateNudge({ t, ot, compact }) {
  const g = gateFor(ot.pers);
  const fullCash = ot.tier.cash + ot.tier.voucher;
  const bankedNow = Math.round(fullCash * g.payout);
  return (
    <div className="a-card" style={{ padding: '13px 15px', background: t.warningTint, border: `1px solid ${t.warning}33`, borderRadius: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <IconShield size={17} color={t.warning} stroke={2} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Persistency {ot.pers}% → {g.label} payout</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>Banking {ttd(bankedNow)} of {ttd(fullCash)}. Lift to 90% for the full prize.</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: t.surface, borderRadius: 10, border: `1px solid ${t.rule}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: t.dangerTint, color: t.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconRepeat size={15} color={t.danger} stroke={2.2} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: t.ink }}>Reinstate {ttd(17_500)} to clear the gate</div>
          <div style={{ fontSize: 10, color: t.inkMute, marginTop: 1 }}>2 lapsed policies on your reinstatement list</div>
        </div>
        <IconChevR size={15} color={t.inkMute} stroke={2.2} />
      </div>
    </div>
  );
}

// Hit-list row — the fuel. Carries the stage it fills so it maps to the gap.
const STAGE_LABEL = { CI: 'Close-ready', FFI: 'Fact-find', AI: 'Approach', REINST: 'Reinstate' };
function HitRow({ t, row, accent }) {
  const code = row.stage === 'REINST' ? null : row.stage;
  return (
    <div className="a-card" style={{ padding: '11px 13px', background: t.surface, border: `1px solid ${row.hot ? `${accent}44` : t.rule}`, borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {code ? <ActChip t={t} type={code} size="s" /> : <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 9.5, fontWeight: 700, fontFamily: APP_FONT_MONO, color: t.danger, background: t.dangerTint }}>REINST</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.why}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{ttd(row.api)}</div>
          {row.deadline && <div style={{ fontSize: 9, fontWeight: 700, color: t.danger, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{row.deadline}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
        <div style={{ flex: 1, padding: '8px 4px', borderRadius: 8, background: t.teal, color: '#fff', fontSize: 11.5, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><IconPlus size={12} color="#fff" stroke={2.4} />Book {STAGE_LABEL[row.stage]}</div>
        <div style={{ width: 78, padding: '8px 4px', borderRadius: 8, background: t.surfaceSoft, border: `1px solid ${t.rule}`, color: t.inkMute, fontSize: 11.5, fontWeight: 700, textAlign: 'center' }}>Call</div>
      </div>
    </div>
  );
}

// DualAnchor — shows the two goal sources feeding the engine and how this
// week's number resolves to the HIGHER of them. The piece that ties Money
// Needs (baseline floor) and the Campaign (temporary push) into one target.
function DualAnchor({ t, code = 'CI' }) {
  const baseline = MONEY_NEEDS.weekly[code];
  const push = OT.need[code];
  const resolved = OT.resolved[code];
  const campaignTaller = push >= baseline;
  const Anchor = ({ icon, tone, label, sub, val, on }) => (
    <div style={{ flex: 1, padding: '11px 12px', borderRadius: 11, background: on ? `${tone}14` : t.surfaceSoft, border: `1.5px solid ${on ? `${tone}66` : t.rule}`, position: 'relative' }}>
      {on && <div style={{ position: 'absolute', top: -7, right: 9, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO, color: '#fff', background: tone, padding: '1px 6px', borderRadius: 999 }}>DRIVES</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon}<span style={{ fontSize: 10.5, fontWeight: 700, color: t.ink }}>{label}</span></div>
      <div style={{ fontSize: 10, color: t.inkMute, marginTop: 3 }}>{sub}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: on ? tone : t.inkMute, fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>{val} <span style={{ fontSize: 10, color: t.inkFaint, fontWeight: 600 }}>C.I/wk</span></div>
    </div>
  );
  return (
    <div className="a-card" style={{ padding: '14px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginBottom: 3 }}>Why this week's target</div>
      <div style={{ fontSize: 11, color: t.inkMute, marginBottom: 12, lineHeight: 1.45 }}>Your standing floor vs. the campaign push — you work to whichever is taller.</div>
      <div style={{ display: 'flex', gap: 9, alignItems: 'stretch' }}>
        <Anchor on={!campaignTaller} tone={t.gold} label="Money Needs" sub={`${ttd(MONEY_NEEDS.incomeGoal)} income`} val={baseline}
          icon={<IconTarget size={13} color={t.gold} stroke={2.2} />} />
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: t.inkFaint }}>vs</div>
        <Anchor on={campaignTaller} tone={t.teal} label="Christmas push" sub={`${OT.tier.name} by deadline`} val={push}
          icon={<IconBolt size={13} color={t.teal} stroke={2.2} />} />
      </div>
      <div style={{ marginTop: 11, padding: '10px 12px', background: t.tealTint, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
        <IconCheck size={15} color={t.teal} stroke={2.4} />
        <div style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: t.ink }}>This week, aim <b>{resolved} C.I</b> — the campaign is asking more than your baseline {baseline}.</div>
      </div>
    </div>
  );
}

// ── The Christmas API ladder (7 rungs, real doc) + tier-ladder view ────────
// Default behaviour: the engine ratchets — it tracks the NEXT rung above your
// settled position automatically; clear it and it advances. "Aim higher" is an
// optional stretch overlay that re-points the prescription at a higher rung
// (changes this week's number, not what you win — qualify ladder pays what you clear).
const XTIERS = [
  { name: 'Pioneer',  api: 770_000, apps: 20, cash: 70_000, voucher: 3_500 },
  { name: 'Elite',    api: 575_000, apps: 20, cash: 52_000, voucher: 2_500 },
  { name: 'Premier',  api: 375_000, apps: 20, cash: 30_000, voucher: 2_500 },
  { name: 'VIP',      api: 275_000, apps: 20, cash: 20_000, voucher: 2_000 },
  { name: 'Champion', api: 200_000, apps: 20, cash: 7_000,  voucher: 2_000 },
  { name: 'Pro',      api: 150_000, apps: 20, cash: 5_000,  voucher: 1_500 },
  { name: 'Stella',   api: 100_000, apps: 20, cash: 3_000,  voucher: 0 },
];

// TierLadder — vertical rungs high→low, settled position marked, next rung the
// live default, an optional aimed rung pulled up as a stretch.
function TierLadder({ t, settledApi, settledApps, aimedName }) {
  // next-default = lowest rung whose API exceeds settled (the ratchet target).
  const ascending = [...XTIERS].slice().reverse(); // low→high
  const nextDefault = ascending.find((r) => settledApi < r.api);
  const appsShort = settledApps < 20;
  return (
    <div className="a-card" style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '13px 15px', borderBottom: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>Christmas ladder · API category</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>You bank whatever rung you clear · 20-app floor on all</div>
        </div>
        <div style={{ padding: '4px 9px', borderRadius: 999, background: t.tealTint, color: t.teal, fontSize: 10, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{ttd(settledApi)}</div>
      </div>
      <div>
        {XTIERS.map((r, i) => {
          const cleared = settledApi >= r.api;
          const isNext = nextDefault && r.name === nextDefault.name;
          const isAim = r.name === aimedName;
          const gap = Math.max(0, r.api - settledApi);
          const tone = cleared ? t.success : isAim ? t.teal : isNext ? t.gold : t.inkFaint;
          const bg = isAim ? t.tealTint : isNext ? t.goldTint : 'transparent';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 15px', background: bg, borderBottom: i < XTIERS.length - 1 ? `1px solid ${t.rule}` : 'none' }}>
              {/* rung marker */}
              <div style={{ width: 26, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                {cleared
                  ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.successTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconCheck size={13} color={t.success} stroke={2.6} /></div>
                  : <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isAim || isNext ? tone : t.rule}`, boxSizing: 'border-box' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: cleared ? t.inkMute : t.ink }}>{r.name}</span>
                  {isAim && <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: 8.5, fontWeight: 700, fontFamily: APP_FONT_MONO, color: '#fff', background: t.teal }}>AIMING</span>}
                  {isNext && !isAim && <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: 8.5, fontWeight: 700, fontFamily: APP_FONT_MONO, color: t.gold, background: t.surface, border: `1px solid ${t.gold}55` }}>NEXT</span>}
                </div>
                <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, marginTop: 2 }}>{ttd(r.api)} · {ttd(r.cash)}{r.voucher ? ` + ${ttd(r.voucher)} voucher` : ''}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {cleared
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>CLEARED</span>
                  : <span style={{ fontSize: 10.5, fontWeight: 700, color: tone, fontFamily: APP_FONT_MONO }}>+{ttd(gap)}</span>}
                {!cleared && (isNext || isAim) && <div style={{ fontSize: 9, color: t.inkFaint, marginTop: 2 }}>{isAim ? 'tap to stop aiming' : 'tap to aim higher'}</div>}
              </div>
            </div>
          );
        })}
      </div>
      {appsShort && (
        <div style={{ padding: '10px 15px', background: t.warningTint, borderTop: `1px solid ${t.warning}33`, display: 'flex', alignItems: 'center', gap: 9 }}>
          <IconShield size={14} color={t.warning} stroke={2} />
          <div style={{ flex: 1, fontSize: 11, color: t.ink, fontWeight: 600 }}>{settledApps}/20 apps — clear the app floor to bank <b>any</b> tier.</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  RATIOS, prescribe, OT, MONEY_NEEDS, resolvedNeed, HITLIST, STAGE_LABEL, XTIERS,
  AnchorHeader, GapMeter, PrescriptionRow, GateNudge, HitRow, DualAnchor, TierLadder,
});
