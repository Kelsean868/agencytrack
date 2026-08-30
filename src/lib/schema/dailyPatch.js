/**
 * dailyPatch — what Daily Capture is allowed to write, and what it must not.
 *
 * ── THE PROBLEM THIS EXISTS TO SOLVE ────────────────────────────────────────
 * The daily doc has TWO writers and they write in different ways.
 *
 *   Daily Capture writes ABSOLUTE values. The agent loads the day, types
 *   numbers, and saves — historically the WHOLE form, every field present,
 *   through setDoc({ merge: true }). merge:true does not mean "merge numbers";
 *   it means an ABSENT key is left alone and a PRESENT key overwrites.
 *
 *   functions/callActivity/ingestCallActivity.js writes INCREMENTS. Every KQM
 *   call bumps its fields with FieldValue.increment, all day, with nobody
 *   looking at the screen.
 *
 * So an agent who opened Daily Capture at 09:00, made thirty calls in KQM, and
 * pressed Save at 17:00 wrote `dials: 0` over all thirty of them — from stale
 * form state loaded before any of them existed. No error, no warning, and the
 * number that reaches a manager is simply wrong.
 *
 * ── THE FIX: SEND ONLY WHAT THE AGENT ACTUALLY TOUCHED ──────────────────────
 * merge:true's asymmetry is the whole lever. A field the agent never touched is
 * simply LEFT OUT of the write, so Firestore keeps whatever the ingest put
 * there. This closes the common case completely: an agent who does not type
 * into a call field cannot destroy a call field.
 *
 * ⚠ IT DOES NOT CLOSE THE CASE WHERE THE AGENT TYPES INTO ONE. If they type
 * `dials: 3` while KQM has logged 14, their 3 wins — because at that point it is
 * a genuine disagreement between two writers and this module cannot know which
 * is right. That is what `detectConflicts` is for: it makes the disagreement
 * VISIBLE at save time rather than silent forever. Stated plainly because the
 * shape of the remaining hole is the thing a future reader most needs to know.
 *
 * Partial writes are safe by construction: the aggregator reads every field
 * with optional chaining through `i()`/`p()` coercion, and the ingest endpoint
 * has always created partial daily docs itself.
 */

/**
 * The fields ingestCallActivity can write, as TOP-LEVEL daily-doc keys.
 *
 * ⚠ THIS IS A HAND-KEPT TWIN of WRITABLE_FIELDS in
 * functions/callActivity/outcomeMap.js, which derives the same set by running
 * every legal effect set through mapEffects. It is restated rather than
 * imported because Cloud Functions are CJS and src/ is ESM — the same split
 * that makes validateToken.js restate validateTokenData.
 *
 * The twin is not left to trust: dailyPatch.test.js requires the CJS module and
 * asserts the two agree. If someone adds an effect there and not here, that test
 * fails rather than this list quietly going stale — which matters, because a
 * missing entry here means a field that silently loses its ingested value again.
 *
 * `dialsByType` appears as the top-level map; outcomeMap emits the dotted leaf
 * paths ('dialsByType.cold'), and the test collapses them before comparing.
 */
export const INGEST_WRITTEN_FIELDS = Object.freeze([
  'appointmentsSet',
  'ciConducted',
  'dials',
  'dialsByType',
  'ffiConducted',
  'ffisScheduled',
  'newNamesAdded',
  'policiesDelivered',
  'qualifiedApproaches',
  'serviceCalls',
  'serviceContacts',
  'solutionPresentations',
  'telContacts',
]);

/**
 * ⚠ THE LADDER FIELDS ARE DIFFERENT FROM THE REST OF THIS LIST, AND IT MATTERS.
 *
 * `dials` and `telContacts` have no Daily Capture input the agent uses in
 * anger — the ingest owns them outright, and their presence here is close to
 * belt-and-braces. The five ladder fields (qualifiedApproaches,
 * solutionPresentations, ffiConducted, ciConducted, policiesDelivered) are the
 * opposite: agents have typed those by hand every day since the form existed,
 * because until the ladder slice nothing else could write them.
 *
 * So this is the field set where the two writers genuinely COLLIDE, and the
 * asymmetry above is doing real work rather than guarding a theoretical case:
 *
 *   · agent does not touch "FFIs conducted" → it is omitted, KQM's count stands
 *   · agent types into it                   → their number wins, and
 *                                             detectConflicts raises the banner
 *
 * Which is right. An agent who types a ladder number is asserting something
 * about their own day that this module has no standing to overrule — but they
 * should be TOLD that KQM already logged a different one, which is exactly what
 * the banner does.
 */

const INGEST_SET = new Set(INGEST_WRITTEN_FIELDS);

/** True when this daily-doc key is one the call ingest also writes. */
export function isIngestWritten(key) {
  return INGEST_SET.has(key);
}

/**
 * buildDailyPatch — the subset of form state to actually write.
 *
 * @param {object} data       full Daily Capture form state
 * @param {Iterable<string>} dirtyKeys top-level keys the agent touched
 * @returns {object} a patch safe to hand to saveDailyEntry
 *
 * Keys are taken from `data` verbatim, including nested objects
 * (`newBusiness`, `dialsByType`, `socialPlatformBreakdown`). A nested object is
 * written WHOLE when any of its leaves is dirty — which is correct for the
 * three agent-owned maps, and is why `dialsByType` must never be marked dirty
 * by the UI: no Daily Capture input writes it, and writing it whole would
 * flatten the ingest's per-bucket split.
 */
export function buildDailyPatch(data, dirtyKeys) {
  const patch = {};
  if (!data || typeof data !== 'object') return patch;
  for (const key of dirtyKeys ?? []) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    // Never writable by this form. Belt and braces: the UI has no input for it,
    // but a future input added without reading this file would otherwise
    // silently overwrite the ingest's bucket split with the form's zeroes.
    if (key === 'dialsByType') continue;
    patch[key] = data[key];
  }
  return patch;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * detectConflicts — which dirty fields moved underneath the agent while the
 * form was open.
 *
 * Compares the value read when the form LOADED against the value in Firestore
 * NOW. A difference on an ingest-written field means calls landed while the
 * agent was typing, and saving would discard them.
 *
 * Only ingest-written fields are checked. A difference on an agent-owned field
 * means the same agent edited the same day in another tab, which is a different
 * problem and not one this slice was scoped to solve.
 *
 * @param {object} baseline values at form load
 * @param {object} stored   values re-read immediately before saving
 * @param {Iterable<string>} dirtyKeys
 * @returns {Array<{field: string, wasAtLoad: number, isNow: number, yours: number}>}
 */
export function detectConflicts(baseline, stored, dirtyKeys, data) {
  const out = [];
  if (!stored || typeof stored !== 'object') return out;
  for (const key of dirtyKeys ?? []) {
    if (!isIngestWritten(key) || key === 'dialsByType') continue;
    const wasAtLoad = num(baseline?.[key]);
    const isNow = num(stored?.[key]);
    if (wasAtLoad === isNow) continue;
    out.push({ field: key, wasAtLoad, isNow, yours: num(data?.[key]) });
  }
  return out;
}

/**
 * Human-readable field names for the conflict banner. Deliberately the agents'
 * own words — the same labels the inputs carry — not the schema keys.
 */
export const FIELD_LABELS = Object.freeze({
  appointmentsSet: 'Appointments set',
  ciConducted: 'CIs conducted',
  dials: 'Dials',
  ffiConducted: 'FFIs conducted',
  ffisScheduled: 'FFIs scheduled',
  newNamesAdded: 'New names added',
  policiesDelivered: 'Policies delivered',
  qualifiedApproaches: 'Qualified approaches',
  serviceCalls: 'Service calls',
  serviceContacts: 'Service contacts',
  solutionPresentations: 'Solution presentations',
  telContacts: 'Telephone contacts',
});

export function describeConflict(c) {
  const label = FIELD_LABELS[c.field] ?? c.field;
  return `${label}: KQM Calls logged ${c.isNow} since you opened this; your entry says ${c.yours}.`;
}
