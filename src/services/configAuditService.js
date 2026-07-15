/**
 * configAuditService — append-only audit trail for Company Config changes.
 *
 * Every config mutation (envelope / plain-legacy / flag) writes ONE audit entry
 * per changed setting into `tenants/{tenantId}/configAudit/{autoId}`, batched
 * ATOMICALLY with the config write itself (see configService). The config change
 * and its audit entry land together or not at all.
 *
 * Entries are display-oriented: `from` / `to` are already display-stringified by
 * the caller (configService), so the history drawer (Item 2) renders them
 * verbatim without needing to re-resolve stored values. The optional `correction`
 * reason field is schema-reserved for slice 2 — the builder accepts and threads
 * it now so no migration is required later.
 */
import {
  collection,
  doc,
  serverTimestamp,
  query,
  orderBy,
  limit as fbLimit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * buildAuditEntry — pure builder for one audit entry. No I/O.
 *
 * @param {object} args
 * @param {string} args.settingId          the changed setting key (or dot-path / flag key)
 * @param {string} args.section            the config doc / logical section the setting lives in
 * @param {string|null} args.from          display value BEFORE the change ('OFF', 'DEFAULT', etc.)
 * @param {string|null} args.to            display value AFTER the change ('ON', 'DEFAULT', a value)
 * @param {{uid?: string, name?: string}} args.actor  who made the change
 * @param {string} [args.correction]       optional slice-2 correction reason (omitted when absent)
 * @returns {object} plain audit-entry object with a serverTimestamp `at`
 */
export function buildAuditEntry({ settingId, section, from, to, actor, correction }) {
  return {
    settingId,
    section,
    from,
    to,
    who: actor?.uid ?? null,
    whoName: actor?.name ?? null,
    at: serverTimestamp(),
    ...(correction ? { correction } : {}),
  };
}

/**
 * addAuditEntryToBatch — stage one audit entry on an existing writeBatch at a
 * fresh auto-id doc under `tenants/{tenantId}/configAudit`. Returns the ref.
 */
export function addAuditEntryToBatch(batch, tenantId, entry) {
  const ref = doc(collection(db, `tenants/${tenantId}/configAudit`));
  batch.set(ref, entry);
  return ref;
}

/**
 * getConfigAudit — newest-first read of the tenant's config audit trail.
 * Fail-closed to `[]` on absent tenantId or any read error (the history drawer
 * must never crash the config surface). Consumed by Item 2.
 *
 * @param {string} tenantId
 * @param {{limit?: number}} [opts]
 * @returns {Promise<Array<object>>}
 */
export async function getConfigAudit(tenantId, { limit = 50 } = {}) {
  if (!tenantId) return [];
  try {
    const col = collection(db, `tenants/${tenantId}/configAudit`);
    const q = query(col, orderBy('at', 'desc'), fbLimit(limit));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}
