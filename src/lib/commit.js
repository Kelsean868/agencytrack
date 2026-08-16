/**
 * commit(label, fn) — the single seam every v3 mutation passes through.
 *
 * `01-ARCHITECTURE.md` §2: *"**every** mutation goes through this."* It exists so
 * the cross-module rules have somewhere to live that is neither a component nor a
 * Firestore service. Rules that live in components drift into components and rot,
 * which is what happened to every rule in the source build that had a twin.
 *
 * `commit()` performs NO Firestore work itself. It wraps a function that does:
 * sets a syncing flag, awaits `fn`, clears the flag, appends to the activity log
 * on success, and throws a typed error on failure.
 *
 * ── ⚠ NO OFFLINE QUEUE — A DELIBERATE DIVERGENCE FROM THE HANDOFF ───────────
 * `01-ARCHITECTURE.md` §2 specifies *"Offline: pushes `{label}` onto `queued`"*.
 * That is NOT ported, by explicit instruction in the P0-C brief, and the reason
 * is worth keeping:
 *
 * `src/firebase.js` initialises Firestore with `persistentLocalCache` +
 * `persistentMultipleTabManager`. The SDK's own write queue already survives a
 * tab close; an in-memory array does not. Two mechanisms for the same fact is
 * `06-DEFECT-CLASSES.md` §3 — "two sources of truth for the same fact, the
 * expensive class" — which is the defect class this whole phase exists to
 * prevent. Building a queue here would introduce the exact bug the seam was
 * created to avoid.
 *
 * If offline UX needs surfacing later, the Firestore SDK exposes
 * `waitForPendingWrites()` and `onSnapshotsInSync()`. See the FOLLOW_UPS entry —
 * it belongs with the first real caller, not here.
 *
 * ── ERROR IDIOM ─────────────────────────────────────────────────────────────
 * `CommitFailedError` mirrors the existing classes in `commitPlanService.js`
 * (`BelowApiFloorError` et al): `extends Error`, an actionable message via
 * `super()`, an explicit `this.name`, and structured fields attached. One error
 * idiom in this codebase, not two.
 */

import { log } from '../services/activityLogService';

/** True in dev/test builds, false in the production bundle. Mirrors devAssertKnown. */
function isDev() {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/**
 * Thrown when the wrapped function rejects.
 *
 * ⚠ The original failure is ALWAYS preserved on `.cause` and never swallowed.
 * A caller that needs to branch on a domain error does so through the cause:
 *
 *   catch (err) {
 *     if (err.cause instanceof BelowApiFloorError) { ... }
 *   }
 *
 * Everything is wrapped — including already-typed domain errors — so callers
 * have ONE shape to handle rather than "sometimes wrapped, sometimes not",
 * which is the ambiguity that makes error handling rot.
 */
export class CommitFailedError extends Error {
  constructor(label, cause) {
    super(
      `"${label}" could not be saved. ${cause?.message ?? 'The operation failed.'}`
    );
    this.name = 'CommitFailedError';
    this.label = label;
    this.cause = cause;
  }
}

/**
 * Depth counter, not a boolean. Two concurrent commits with a boolean would let
 * the first to finish clear the flag while the second is still in flight, and
 * the UI would report "saved" during an active write.
 */
let inFlight = 0;

/** True while at least one `commit()` is in flight. */
export function isSyncing() {
  return inFlight > 0;
}

/**
 * Run a mutation through the seam.
 *
 * @param {string} label   human-readable, used in the activity log and the error
 * @param {() => Promise<T>|T} fn  the actual mutation; may be sync or async
 * @returns {Promise<T>} whatever `fn` resolves to
 * @throws {CommitFailedError} always — with the original error on `.cause`
 * @template T
 */
export async function commit(label, fn) {
  inFlight += 1;
  try {
    const result = await fn();

    // ⚠ LOGGING MUST NEVER TURN A SUCCESSFUL MUTATION INTO A REPORTED FAILURE.
    // If this call sat in the outer `try`, a throw from `log()` would discard an
    // already-committed `result` and report CommitFailedError for a write that
    // actually landed — and a caller reacting by retrying would re-execute a
    // non-idempotent write. Today `log()` is pure in-memory and will not throw,
    // but activityLogService's header states a Firestore write attaches inside
    // `appendEntry` later; at that point this path would manufacture false
    // failures. Isolated now, before the dependency exists. (CodeRabbit, #892.)
    //
    // Swallowed, not rethrown — the mutation succeeded, and a lost activity
    // entry is not a failed commit. Reported in dev only, matching the
    // devAssertKnown idiom (v3 rule 11: silent fallbacks are loud in dev).
    try {
      log('commit', label);
    } catch (logError) {
      if (isDev()) {
        console.error(
          `[commit] "${label}" SUCCEEDED but its activity-log entry failed. ` +
            `The mutation is committed — this is a logging fault, not a write ` +
            `fault, and is deliberately not surfaced to the caller. ` +
            `Cause: ${logError?.message ?? logError}`,
        );
      }
    }

    return result;
  } catch (cause) {
    throw new CommitFailedError(label, cause);
  } finally {
    // `finally` rather than duplicating in both paths: an early return or a
    // rethrow must never leave the counter stuck above zero.
    inFlight -= 1;
  }
}

/** Test-support only — resets the in-flight counter. */
export function resetSyncingForTests() {
  inFlight = 0;
}
