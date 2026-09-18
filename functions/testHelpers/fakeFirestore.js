'use strict';

/**
 * fakeFirestore.js — the in-memory Firestore the portfolioImport tests run on.
 *
 * Follows the `sendComplianceNudge` / `leaderboardAggregate` precedent in this
 * folder: firebase-admin is mocked rather than emulated, so the unit tests stay
 * fast and hermetic. The EMULATOR run is a separate, explicit exercise — see the
 * P4a paste-back — because an in-memory fake cannot prove that a real batch
 * commit or a real `where` clause behaves as expected.
 *
 * What this fake DOES model faithfully, because the code under test depends on
 * each one: auto-ids, subcollections, batched writes with a commit count, and
 * `where(field, '==', value)` over a collection.
 */

function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

function createFakeDb() {
  /** path → data */
  const docs = new Map();
  const commits = [];
  let autoId = 0;

  const childrenOf = (collPath) => [...docs.keys()]
    // Direct children only: `a/b/c` is in `a/b`, `a/b/c/d/e` is not.
    .filter((p) => p.startsWith(`${collPath}/`) && !p.slice(collPath.length + 1).includes('/'));

  function docRef(path) {
    return {
      path,
      get id() { return path.slice(path.lastIndexOf('/') + 1); },
      async get() {
        const data = docs.get(path);
        return { exists: data !== undefined, id: this.id, data: () => clone(data), ref: this };
      },
      async set(data, options) {
        const prev = options && options.merge ? docs.get(path) || {} : {};
        docs.set(path, { ...prev, ...clone(data) });
      },
      async update(data) {
        if (!docs.has(path)) throw new Error(`update on missing doc ${path}`);
        docs.set(path, { ...docs.get(path), ...clone(data) });
      },
      async delete() { docs.delete(path); },
      collection(name) { return collRef(`${path}/${name}`); },
    };
  }

  function collRef(path) {
    const query = (filters) => ({
      where(field, op, value) {
        if (op !== '==') throw new Error(`fake db supports '==' only, got ${op}`);
        return query([...filters, [field, value]]);
      },
      async get() {
        const matched = childrenOf(path)
          .map((p) => ({ p, d: docs.get(p) }))
          .filter(({ d }) => filters.every(([f, v]) => d[f] === v));
        return {
          size: matched.length,
          empty: matched.length === 0,
          docs: matched.map(({ p, d }) => ({
            id: p.slice(p.lastIndexOf('/') + 1),
            data: () => clone(d),
            ref: docRef(p),
          })),
        };
      },
    });

    return {
      path,
      doc(id) { autoId += 1; return docRef(`${path}/${id || `auto${autoId}`}`); },
      where(field, op, value) { return query([]).where(field, op, value); },
      get() { return query([]).get(); },
    };
  }

  return {
    _docs: docs,
    _commits: commits,
    /** Seeds a document directly, bypassing the write path. */
    _seed(path, data) { docs.set(path, clone(data)); },
    doc(path) { return docRef(path); },
    collection(path) { return collRef(path); },
    batch() {
      const ops = [];
      return {
        set(ref, data, options) { ops.push({ kind: 'set', path: ref.path, data, options }); },
        update(ref, data) { ops.push({ kind: 'update', path: ref.path, data }); },
        delete(ref) { ops.push({ kind: 'delete', path: ref.path }); },
        async commit() {
          // Firestore rejects a batch over 500 writes. The fake enforces it so a
          // chunking bug fails HERE rather than at ~250 policies in production.
          if (ops.length > 500) throw new Error(`batch too large: ${ops.length} writes`);
          commits.push(ops.length);
          for (const op of ops) {
            if (op.kind === 'delete') docs.delete(op.path);
            else if (op.kind === 'update') docs.set(op.path, { ...docs.get(op.path), ...clone(op.data) });
            else {
              const prev = op.options && op.options.merge ? docs.get(op.path) || {} : {};
              docs.set(op.path, { ...prev, ...clone(op.data) });
            }
          }
          ops.length = 0;
        },
      };
    },
  };
}

/** The pieces of firebase-functions these modules touch. */
function createFakeFunctions() {
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  return {
    HttpsError,
    https: {
      HttpsError,
      // `runWith(...).https.onCall(fn)` — the shape index.js requires at load time.
      onCall: (fn) => { const w = (d, c) => fn(d, c); w._onCall = fn; return w; },
    },
    logger: { error() {}, warn() {}, info() {} },
  };
}

module.exports = { createFakeDb, createFakeFunctions };
