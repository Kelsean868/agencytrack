/**
 * activityLogService — `log(type, message)`, the v3 activity log.
 *
 * The activity feed is this log made visible, and that is the point:
 * `01-ARCHITECTURE.md` §2 calls it "how a reviewer can *watch* the cross-module
 * rules fire instead of taking them on trust." A rule that fires invisibly is a
 * rule nobody can review.
 *
 * ── ⚠ PERSISTENCE IS DELIBERATELY NOT IN THIS SLICE ─────────────────────────
 * This is an IN-MEMORY implementation. It was not forgotten and it is not an
 * oversight — read this before "finishing" it.
 *
 * A real feed needs a Firestore collection, which needs a `firestore.rules`
 * change, which would drag P0-C behind the secondary-reviewer gate for no
 * benefit: nothing renders the feed until Phase 1.8 (Activities). So the
 * INTERFACE lands now — so `commit()` has something to call and later phases
 * have something to code against — and the storage lands with the screen that
 * displays it.
 *
 * ── WHERE PERSISTENCE ATTACHES ──────────────────────────────────────────────
 * `appendEntry()` below is the seam. It is the ONLY function that mutates the
 * buffer. To persist: keep the in-memory buffer as the read model (the feed is
 * a 60-entry window, not a query surface) and add the Firestore write inside
 * `appendEntry` — do NOT scatter writes through `log()`'s callers.
 *
 * A persisted implementation must also decide three things this one does not:
 * per-tenant scoping, who may read another agent's log, and retention. None of
 * those are answerable before the screen exists, which is the other reason to
 * wait.
 *
 * ── CAP ─────────────────────────────────────────────────────────────────────
 * 60 entries, per `01-ARCHITECTURE.md` §2 ("appends to `activities`, capped at
 * 60"). Oldest entries fall off the end.
 */

/** Ring-buffer cap — `01-ARCHITECTURE.md` §2. */
export const MAX_ENTRIES = 60;

/** Newest-first. Module-private: mutated only by `appendEntry`. */
let entries = [];

/** Monotonic id source. Not a document id — purely for stable React keys. */
let nextId = 1;

/**
 * The single mutation seam. Persistence attaches HERE, not in `log()`'s
 * callers — see the header.
 */
function appendEntry(entry) {
  // FROZEN, not merely copied-on-read. `getEntries()` returns a new array, but a
  // shallow copy still hands out live references to the entry objects — a caller
  // could rewrite a logged message in place and the feed would show something
  // that never happened. An activity log whose entries can be edited after the
  // fact is not evidence. Frozen entries make that attempt throw (ESM is strict
  // mode) rather than silently succeed.
  const frozen = Object.freeze(entry);
  entries = [frozen, ...entries].slice(0, MAX_ENTRIES);
  return frozen;
}

/**
 * Append an activity entry.
 *
 * @param {string} type    coarse category, e.g. 'commit' | 'call' | 'task'
 * @param {string} message human-readable, already-composed sentence
 * @returns {{id:number, type:string, message:string, at:number}} the entry
 */
export function log(type, message) {
  return appendEntry({
    id: nextId++,
    type: String(type ?? ''),
    message: String(message ?? ''),
    at: Date.now(),
  });
}

/** Newest-first snapshot. Returns a copy — callers cannot mutate the buffer. */
export function getEntries() {
  return [...entries];
}

/**
 * Reset the buffer. Test-support only: an in-memory module-level buffer would
 * otherwise leak entries between test files sharing a worker.
 */
export function clearEntries() {
  entries = [];
  nextId = 1;
}
