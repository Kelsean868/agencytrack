/**
 * prospectPrep.js — pure (React-free) helpers for the Prospect Prep surfaces.
 *
 * Countdown math, objection-rehearsal taxonomy + tolerant matching, readiness
 * derivation, next-call selection, and display formatting. All derivations are
 * HONEST against the shipped prospectInfo doc shape (prospectInfoService.js) —
 * fields the mockup carries but the schema lacks (stored `prepped`, `note`,
 * `estApi`, `time`) are NOT invented here. Extending the schema is a separate
 * ruling; these helpers derive from what the wizard actually writes.
 */

// ── Objection rehearsal taxonomy ─────────────────────────────────────────────
//
// Canonical coaching copy ported VERBATIM from the Prospect Prep v2 mockup:
//   docs/design-system/screens-v2/prospect-shared.jsx  (const PP_OBJECTIONS)
// label → what it usually means → a suggested counter. Keyed by the stored
// objection value (matches OBJECTIONS in prospectInfoService.js). This is
// operator-editable coaching copy, not schema — safe to reword in place.
export const OBJECTION_TAXONOMY = {
  'no-money': {
    label: 'No Money',
    means: 'Doesn’t see room in the budget right now.',
    counter: 'Reframe cost vs the cost of being uninsured; show a smaller starter premium.',
  },
  'no-need': {
    label: 'No Need',
    means: 'Doesn’t feel the risk applies to them yet.',
    counter: 'Use their own dependents / goals; a needs-analysis makes the gap concrete.',
  },
  'no-hurry': {
    label: 'No Hurry',
    means: 'Believes it can wait.',
    counter: 'Premiums rise with age; insurability isn’t guaranteed later. Lock today’s rate.',
  },
  'no-confidence': {
    label: 'No Confidence',
    means: 'Unsure about you, the product, or the company.',
    counter: 'Lean on Tatil’s track record + your joint call with the manager as proof.',
  },
};

/** Normalise a label/value for tolerant matching: lower, trim, spaces/underscores → '-'. */
function normObjectionKey(raw) {
  return String(raw ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
}

// Index by BOTH the stored value ('no-money') and the human label ('No Money'),
// so case/space variants and legacy free-text both resolve. Built once.
const OBJECTION_INDEX = (() => {
  const idx = {};
  for (const [value, entry] of Object.entries(OBJECTION_TAXONOMY)) {
    idx[normObjectionKey(value)] = entry;
    idx[normObjectionKey(entry.label)] = entry;
  }
  return idx;
})();

/**
 * Resolve a stored objection to its taxonomy entry (case/space-tolerant).
 * Returns the { label, means, counter } entry, or null when unmatched — the
 * caller renders unmatched labels as a plain chip (honest fallback).
 */
export function matchObjection(raw) {
  return OBJECTION_INDEX[normObjectionKey(raw)] ?? null;
}

// ── Countdown ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

/** Parse 'YYYY-MM-DD' to a UTC-noon Date (noon dodges TZ off-by-one). null on bad input. */
function parseISODate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? '').trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}

/**
 * Countdown from `today` to an appointment's intendedAppointmentDate.
 * Both args are 'YYYY-MM-DD'. Returns:
 *   { inDays, overdue, label, tone }
 * where inDays is signed (negative = past), and tone ∈
 *   'overdue' | 'imminent' (today/tomorrow) | 'upcoming' | 'muted' (unparseable).
 */
export function computeCountdown(intendedDate, today) {
  const appt = parseISODate(intendedDate);
  const now = parseISODate(today);
  if (!appt || !now) return { inDays: null, overdue: false, label: '', tone: 'muted' };

  const inDays = Math.round((appt.getTime() - now.getTime()) / MS_PER_DAY);
  let label;
  let tone;
  if (inDays < -1) {
    label = `${-inDays} DAYS AGO`;
    tone = 'overdue';
  } else if (inDays === -1) {
    label = 'YESTERDAY';
    tone = 'overdue';
  } else if (inDays === 0) {
    label = 'TODAY';
    tone = 'imminent';
  } else if (inDays === 1) {
    label = 'TOMORROW';
    tone = 'imminent';
  } else {
    label = `IN ${inDays} DAYS`;
    tone = 'upcoming';
  }
  return { inDays, overdue: inDays < 0, label, tone };
}

// ── Readiness ────────────────────────────────────────────────────────────────

/**
 * Derive prep readiness HONESTLY from fields that exist on the prospectInfo doc.
 *
 * The mockup's stored `prepped` boolean (and the `note` field that visually
 * distinguished prepped-vs-not in the sample data) are NOT in the shipped
 * schema, so readiness is derived from the two DISCRETIONARY prep fields the
 * agent actually fills — the ones that signal genuine call prep depth:
 *   • policyType present   — the likely product has been identified
 *   • objections listed    — anticipated objections are thought through
 * clientName + intendedAppointmentDate are REQUIRED at creation, so they carry
 * no signal about prep depth and are deliberately excluded.
 *
 * SKIP-LOGGED (mockup fields with no schema backing, intentionally not derived):
 *   prepNote (stored note), estAPI. Adding them is a separate schema ruling.
 *
 * @returns {{ prepped: boolean, present: string[], missing: string[] }}
 */
export function deriveReadiness(prep = {}) {
  const checks = [
    { key: 'policyType', ok: Boolean(prep.policyType && String(prep.policyType).trim()) },
    { key: 'objections', ok: Array.isArray(prep.objections) && prep.objections.length > 0 },
  ];
  const present = checks.filter((c) => c.ok).map((c) => c.key);
  const missing = checks.filter((c) => !c.ok).map((c) => c.key);
  return { prepped: missing.length === 0, present, missing };
}

// ── Next-call selection ──────────────────────────────────────────────────────

/**
 * The soonest UPCOMING (not overdue) prep — inDays >= 0, minimum inDays.
 * Preps arrive asc-sorted by intendedAppointmentDate (item 0.5), but this scans
 * defensively regardless of input order. Returns null when every prep is
 * overdue or undated (in which case the surface renders no hero).
 */
export function pickNextCall(preps = [], today) {
  let best = null;
  let bestDays = Infinity;
  for (const p of preps) {
    const { inDays } = computeCountdown(p.intendedAppointmentDate, today);
    if (inDays == null || inDays < 0) continue;
    if (inDays < bestDays) {
      best = p;
      bestDays = inDays;
    }
  }
  return best;
}

// ── Display helpers ──────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' → 'DD-MM-YYYY' (project display convention). Falls back to raw. */
export function formatDMY(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(dateStr ?? '');
}

/** Local 'YYYY-MM-DD' for "today" — field-agent local date is the right frame. */
export function todayISO(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Up-to-2-char initials from a client name ("Anil & Reshma Persaud" → "AR"). */
export function prospectInitials(name) {
  return String(name ?? '')
    .replace(/&|\band\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}
