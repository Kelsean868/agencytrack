// Master Sheet — FUNNEL model. Pure, framework-free column model + per-agent
// weekly accessors for the 8-stage sales funnel edition of the branch Master
// Sheet. The component reads ONLY this module; tests import it directly.
//
// The 8 stages read left→right as parts → outcome: every group CLOSES with its
// KPI column (the emphasized band). Teal is reserved for the terminal KPI (API)
// only; stage KPIs use a neutral ink wash + 700 weight; sub-columns sit back at
// 400/muted. See docs/design-system/screens-v2/design_handoff_sheet_celebrations_planner.
//
// COLUMN MAPPING IS OPERATOR-LOCKED and verified against src/utils/extractFields.js.
// All per-agent weekly values come through extractFields() — NEVER raw Firestore
// fields. Two compositions are operator-pinged assumptions (FLAGGED-A / FLAGGED-B);
// each is isolated to a single line in computeFunnelRow so it flips trivially.

import { computeTotalNewNames, extractTotalProductionCredit } from './extractFields';

// ── Column model — 8 funnel stages ─────────────────────────────────────────
// `kpi`: emphasized band closing the group. `terminal`: strongest emphasis
// (API by default; the NEW NAMES preset moves terminal emphasis to newNames).
// `ik`: contributes to the Activity Standards "Interviews Kept" derived figure.
// `money`: TTD-formatted terminal value. `w`: expanded px width; the collapsed
// KPI width comes from FUNNEL_COLLAPSED_W.
export const FUNNEL_GROUPS = [
  { id: 'p', num: '01', label: 'PROSPECTING ACTIVITIES', short: 'PROSP', cols: [
    { key: 'letters',  label: 'Letters/Em', w: 62 },
    { key: 'seminars', label: 'Seminars',   w: 60 },
    { key: 'canvass',  label: 'Cold Canv',  w: 62 },
    { key: 'refCalls', label: 'Ref Calls',  w: 60 },
    { key: 'pTot',     label: 'Total',       w: 64, kpi: true },
  ] },
  { id: 'ca', num: '02', label: 'CONTACT ATTEMPTS', short: 'ATTEMPTS', cols: [
    { key: 'telAtt', label: 'Tel',   w: 56 },
    { key: 'f2fAtt', label: 'F2F',   w: 54 },
    { key: 'caTot',  label: 'Total', w: 64, kpi: true },
  ] },
  { id: 'cm', num: '03', label: 'CONTACTS MADE', short: 'CONTACTS', cols: [
    { key: 'telCon', label: 'Tel',   w: 56 },
    { key: 'f2fCon', label: 'F2F',   w: 54 },
    { key: 'cmTot',  label: 'Total', w: 64, kpi: true },
  ] },
  { id: 'qa', num: '04', label: 'QUALIFIED APPR.', short: 'QA', cols: [
    { key: 'qa', label: 'Approaches', w: 138, kpi: true },
  ] },
  { id: 'ffi', num: '05', label: 'FFIs', short: 'FFI', cols: [
    { key: 'ffiSch',  label: 'Sched',     w: 60 },
    { key: 'ffiCond', label: 'Conducted', w: 78, kpi: true, ik: true },
  ] },
  { id: 'ci', num: '06', label: 'CIs', short: 'CI', cols: [
    { key: 'ciNew',  label: 'New Bkd',   w: 62 },
    { key: 'ciOld',  label: 'Old Bkd',   w: 62 },
    { key: 'ciCond', label: 'Conducted', w: 78, kpi: true, ik: true },
  ] },
  { id: 'res', num: '07', label: 'RESULTS', short: 'RESULTS', cols: [
    { key: 'apps',  label: 'Apps',      w: 56 },
    { key: 'lives', label: 'Lives',     w: 56 },
    { key: 'api',   label: 'API · TTD', w: 104, kpi: true, terminal: true, money: true },
  ] },
  { id: 'ref', num: '08', label: 'REFERRALS', short: 'REFERRALS', cols: [
    { key: 'refs',     label: 'Referrals', w: 68 },
    { key: 'newNames', label: 'New Names', w: 74 },
    { key: 'refTot',   label: 'Total',      w: 64, kpi: true },
  ] },
];

// Collapsed width per group — wide enough for "01 · SHORT" + the toggle glyph.
export const FUNNEL_COLLAPSED_W = { p: 112, ca: 118, cm: 118, qa: 138, ffi: 104, ci: 100, res: 126, ref: 126 };

// QA is a single standalone KPI — always "open", no toggle.
export const FUNNEL_TOGGLABLE_IDS = FUNNEL_GROUPS.filter((g) => g.id !== 'qa').map((g) => g.id);

// Flattened column list with group metadata (groupStart drives the boundary rule).
export const FUNNEL_COLS = FUNNEL_GROUPS.flatMap((g) =>
  g.cols.map((c, i) => ({ ...c, groupId: g.id, groupNum: g.num, groupStart: i === 0 }))
);

// Lead (sticky) columns: rank · agent·unit · status. px widths + left offsets.
export const FUNNEL_LEAD_W = [34, 174, 104];
export const FUNNEL_LEAD_LEFT = [0, FUNNEL_LEAD_W[0], FUNNEL_LEAD_W[0] + FUNNEL_LEAD_W[1]];

// ── Per-agent weekly funnel values ──────────────────────────────────────────
// `f` is the extractFields() result for one submission; `submission` is the raw
// doc (API is read via extractTotalProductionCredit — identical semantics to the
// legacy sheet's API (TTD) column, incl. its conditional colouring upstream).
// serviceCalls is carried on the row for detail surfaces but is EXCLUDED from
// every funnel sum (servicing ≠ new-business activity).
export function computeFunnelRow(f, submission) {
  // ① Prospecting Activities — the 4 top-of-funnel generation channels.
  const letters = f.prospectingLettersSent;
  const seminars = f.seminarsConducted;
  const canvass = f.coldCalls;
  const refCalls = f.referralCalls;
  const pTot = letters + seminars + canvass + refCalls;

  // ② Contact Attempts — reaching a KNOWN person.
  // FLAGGED-A — operator ping 2026-07-10: "Tel" attempts = follow-up calls to a
  // known person (followUpCalls) + seminar/tradeshow follow-up calls
  // (seminarTradeshowCalls). Follow-ups are NOT prospecting, so they sit here,
  // not in stage ①. If the operator rules otherwise, this ONE line changes.
  const telAtt = f.followUpCalls + f.seminarTradeshowCalls;
  const f2fAtt = f.f2fAttempts;
  const caTot = telAtt + f2fAtt;

  // ③ Contacts Made — reached.
  const telCon = f.telContacts;
  const f2fCon = f.f2fContacts;
  const cmTot = telCon + f2fCon;

  // ④ Qualified Approaches — standalone KPI.
  const qa = f.qualifiedApproaches;

  // ⑤ FFIs — Conducted is the KPI (Interviews Kept contributor).
  const ffiSch = f.ffisScheduled;
  const ffiCond = f.ffiConducted;

  // ⑥ CIs — Conducted is the KPI (Interviews Kept contributor).
  const ciNew = f.newCIBooked;
  const ciOld = f.oldCIBooked;
  const ciCond = f.ciConducted;

  // ⑦ Results — API is the terminal KPI.
  const apps = f.applicationsSold;
  const lives = f.livesSold;
  const api = extractTotalProductionCredit(submission);

  // ⑧ Referrals — group Total is the canonical computeTotalNewNames().
  // FLAGGED-B — operator ping 2026-07-10: canonical totalNewNames INCLUDES
  // referralsObtained, so a naive Referrals + New-Names sum would double-count.
  // Decompose instead: Referrals = referralsObtained; New Names = the 4 OTHER
  // channels = total − referralsObtained. Keeps the group Total EXACTLY equal to
  // the canonical import (do NOT define an alternate 5-field sum here — Rule per
  // computeTotalNewNames doc-comment). Flip = redefine these two lines only.
  const refTot = computeTotalNewNames(f);
  const refs = f.referralsObtained;
  const newNames = refTot - refs;

  return {
    letters, seminars, canvass, refCalls, pTot,
    telAtt, f2fAtt, caTot,
    telCon, f2fCon, cmTot,
    qa,
    ffiSch, ffiCond,
    ciNew, ciOld, ciCond,
    apps, lives, api,
    refs, newNames, refTot,
    // Carried for detail surfaces; intentionally NOT part of any funnel sum.
    serviceCalls: f.serviceCalls,
  };
}

// View model for the collapse/expand mechanic. `expanded` is a Set of group
// ids; a collapsed group renders only its KPI column(s) at the collapsed width.
// QA is a single standalone KPI — always open, no toggle.
export function funnelView(expanded) {
  const groups = FUNNEL_GROUPS.map((g) => {
    const open = g.id === 'qa' ? true : expanded.has(g.id);
    const vcols = (open ? g.cols : g.cols.filter((c) => c.kpi)).map((c, i) => ({
      ...c,
      w: open ? c.w : Math.max(c.w, FUNNEL_COLLAPSED_W[g.id] || 100),
      groupId: g.id, groupNum: g.num, groupStart: i === 0, open,
    }));
    return { ...g, open, vcols };
  });
  return { groups, cols: groups.flatMap((gr) => gr.vcols) };
}

// Interviews Kept — the FFI + CI Conducted derived figure across a row set.
export function computeInterviewsKept(rows) {
  return rows.reduce((s, r) => s + (r.ffiCond || 0) + (r.ciCond || 0), 0);
}

// Single-week funnel "exception" predicate — a report not yet submitted (a draft
// is an unfinished week). Shared by the Master Sheet exceptions toggle and the
// Meeting-Mode projection scene so the exceptions cut means the SAME thing on
// both surfaces. `row` carries a `status` string ('submitted' | 'draft' | …);
// anything other than 'submitted' (incl. absent) is an exception.
export function funnelRowIsException(row) {
  return (row?.status ?? 'draft') !== 'submitted';
}

// Per-column team totals across a row set (each row is a computeFunnelRow result).
export function computeFunnelTotals(rows, cols = FUNNEL_COLS) {
  const tot = {};
  for (const c of cols) tot[c.key] = rows.reduce((s, r) => s + (r[c.key] || 0), 0);
  return tot;
}
