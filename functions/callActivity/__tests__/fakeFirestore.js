'use strict';

/**
 * fakeFirestore — an in-memory Firestore with REAL transaction semantics.
 *
 * The existing slice-A fake (functions/callSources/__tests__/callSources.test.js)
 * models get/set/update and nothing else, which is all those callables need.
 * Slice B's correctness argument is about CONCURRENCY, so a fake that serialises
 * everything would make the load-bearing test pass for the wrong reason.
 *
 * ── WHAT THIS FAKE MODELS THAT A DICTIONARY DOES NOT ────────────────────────
 *  · OPTIMISTIC CONCURRENCY. Every doc carries a version. A transaction records
 *    the version of everything it READ, and at commit re-checks them. If any
 *    moved, the whole transaction is discarded and the callback re-runs against
 *    fresh data — exactly what Firestore does, and exactly what makes a
 *    check-then-write implementation fail here.
 *  · BUFFERED WRITES. Writes are held until commit and are invisible to the
 *    transaction that made them, so a test cannot accidentally read its own
 *    uncommitted state and conclude the guard works.
 *  · FieldValue sentinels resolved AT COMMIT against the committed value, which
 *    is what makes increment() a genuine atomic add rather than a read-modify-
 *    write in disguise.
 *  · set() with merge deep-merging nested maps, so the dialsByType nesting is
 *    exercised for real. A flat merge here would hide the dotted-path trap that
 *    setNested() exists to avoid.
 *
 * Interleaving needs no explicit gate: every tx.get is a real promise, so two
 * concurrent runTransaction callbacks driven by Promise.all naturally interleave
 * their reads before either commits.
 */

const INCREMENT = Symbol('increment');
const SERVER_TIMESTAMP = Symbol('serverTimestamp');

const FieldValue = {
  increment: (n) => ({ __sentinel: INCREMENT, n }),
  serverTimestamp: () => ({ __sentinel: SERVER_TIMESTAMP }),
};

const Timestamp = {
  fromDate: (d) => ({
    toDate: () => d,
    __isTimestamp: true,
  }),
};

function isSentinel(v) {
  return v !== null && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, '__sentinel');
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !isSentinel(v) && !v.__isTimestamp && typeof v.toDate !== 'function';
}

/** Deep clone that leaves sentinels and Timestamp-likes by reference. */
function clone(v) {
  if (!isPlainObject(v)) return v;
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = clone(val);
  return out;
}

/**
 * Resolve one patch value against the value already stored. This is where
 * increment() becomes an atomic add: `base` is the COMMITTED value, read at
 * commit time and not when the transaction callback ran.
 */
function resolveValue(base, patch, now) {
  if (isSentinel(patch)) {
    if (patch.__sentinel === INCREMENT) return (typeof base === 'number' ? base : 0) + patch.n;
    return now;
  }
  if (isPlainObject(patch)) {
    const target = isPlainObject(base) ? base : {};
    return mergeInto(target, patch, now);
  }
  return clone(patch);
}

function mergeInto(base, patch, now) {
  const out = isPlainObject(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(patch)) out[k] = resolveValue(out[k], v, now);
  return out;
}

class FakeFirestore {
  constructor({ now = '<ts>' } = {}) {
    this.store = new Map(); // path -> { data, version }
    this.now = now;
    this.commits = 0;
    this.retries = 0;
  }

  // ---- test-side helpers -------------------------------------------------
  seed(path, data) {
    this.store.set(path, { data: clone(data), version: 1 });
  }

  read(path) {
    const e = this.store.get(path);
    return e ? e.data : undefined;
  }

  exists(path) {
    return this.store.has(path);
  }

  // ---- Firestore surface -------------------------------------------------
  doc(path) {
    const db = this;
    return {
      path,
      id: path.split('/').pop(),
      _db: db,
      // Non-transactional read. Present because real DocumentReferences have
      // it, and because the mutation-verification exercise needs a faithful
      // way to express "the check happened OUTSIDE the transaction".
      async get() {
        const entry = db.store.get(path);
        return {
          exists: Boolean(entry),
          id: path.split('/').pop(),
          ref: db.doc(path),
          data: () => (entry ? clone(entry.data) : undefined),
        };
      },
    };
  }

  collection(path) {
    return new FakeQuery(this, path, []);
  }

  async runTransaction(fn) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const reads = new Map(); // path -> version observed (0 = absent)
      const writes = [];

      const tx = {
        get: async (ref) => {
          const entry = this.store.get(ref.path);
          reads.set(ref.path, entry ? entry.version : 0);
          // Buffered writes are deliberately NOT visible here.
          return {
            exists: Boolean(entry),
            id: ref.id,
            ref,
            data: () => (entry ? clone(entry.data) : undefined),
          };
        },
        set: (ref, data, options) => {
          writes.push({ op: 'set', path: ref.path, data, merge: Boolean(options && options.merge) });
        },
        update: (ref, data) => {
          writes.push({ op: 'update', path: ref.path, data });
        },
        delete: (ref) => {
          writes.push({ op: 'delete', path: ref.path });
        },
      };

      const result = await fn(tx);

      // ---- commit: re-verify every version observed during the callback ----
      let conflict = false;
      for (const [path, version] of reads) {
        const entry = this.store.get(path);
        if ((entry ? entry.version : 0) !== version) {
          conflict = true;
          break;
        }
      }
      if (conflict) {
        this.retries += 1;
        continue; // discard buffered writes entirely and re-run
      }

      for (const w of writes) {
        if (w.op === 'delete') {
          this.store.delete(w.path);
          continue;
        }
        const existing = this.store.get(w.path);
        if (w.op === 'update' && !existing) {
          throw new Error('update() on missing document: ' + w.path);
        }
        const base = existing ? existing.data : undefined;
        const nextData =
          w.op === 'update' || w.merge
            ? mergeInto(base, w.data, this.now)
            : mergeInto(undefined, w.data, this.now);
        this.store.set(w.path, {
          data: nextData,
          version: (existing ? existing.version : 0) + 1,
        });
      }
      this.commits += 1;
      return result;
    }
    throw new Error('transaction failed after too many retries');
  }
}

class FakeQuery {
  constructor(db, path, filters, limit) {
    this.db = db;
    this.path = path;
    this.filters = filters;
    this._limit = limit;
  }

  where(field, op, value) {
    if (op !== '==') throw new Error('fake supports == only');
    return new FakeQuery(this.db, this.path, [...this.filters, { field, value }], this._limit);
  }

  limit(n) {
    return new FakeQuery(this.db, this.path, this.filters, n);
  }

  async get() {
    const prefix = this.path + '/';
    let docs = [];
    for (const [path, entry] of this.db.store) {
      // Direct children only — a subcollection is not part of its parent.
      if (!path.startsWith(prefix)) continue;
      if (path.slice(prefix.length).includes('/')) continue;
      if (this.filters.every((f) => entry.data[f.field] === f.value)) {
        docs.push({
          id: path.split('/').pop(),
          ref: this.db.doc(path),
          exists: true,
          data: () => clone(entry.data),
        });
      }
    }
    if (this._limit !== undefined) docs = docs.slice(0, this._limit);
    return { empty: docs.length === 0, size: docs.length, docs };
  }
}

module.exports = { FakeFirestore, FieldValue, Timestamp };
