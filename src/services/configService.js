/**
 * configService — write substrate for the Company Config track (Run 5).
 *
 * ── THE LOAD-BEARING INVARIANT (diff-only storage) ──────────────────────────
 * A tenant config doc stores ONLY keys that DIFFER from code defaults. An absent
 * key means "use the code default" (fail-closed). Reset-to-default therefore
 * DELETES the key with Firestore `deleteField()` — it NEVER writes the default
 * value back. This is operator-locked; every write path below upholds it.
 *
 * ── THREE STORAGE MODES ─────────────────────────────────────────────────────
 * Two existing docs already have PRODUCTION readers that expect PLAIN values, so
 * a uniform envelope shape would break them:
 *   • `managerActivityStandards` role-maps are read by a Cloud Function
 *     (functions/war/escalationLogic.js — `orgDefault[role][key]`, nested plain).
 *   • `settings.featureFlags.<key>` is gated by `isFlagOn` with a strict
 *     `=== true` check (src/services/featureFlagsService.js).
 *
 * Hence:
 *   1. ENVELOPE mode  — forward substrate for net-new grouped docs. Each setting
 *      is stored as `{ value, who, whoName, date }`. No production consumer yet.
 *   2. PLAIN-LEGACY mode — for `managerActivityStandards`. Values stay plain and
 *      NESTED (dot-paths are expanded) so the CF reader keeps working.
 *   3. FLAG mode — for `settings.featureFlags`. `<key> = true` (never `false`);
 *      OFF deletes the key. Provenance lives in a SIBLING `featureFlagsMeta` map
 *      so `isFlagOn`'s `=== true` contract on `featureFlags` is untouched.
 *
 * Every config write is batched ATOMICALLY with its per-key audit entries: the
 * change and its audit trail commit together or not at all.
 */
import {
  doc,
  writeBatch,
  serverTimestamp,
  deleteField,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { buildAuditEntry, addAuditEntryToBatch } from './configAuditService';

/**
 * Hard allowlist of togglable feature-flag keys. Mirror of
 * scripts/verification/vh/flag-toggle.cjs `ALLOWED_FLAGS` and
 * src/services/featureFlagsService.js `FEATURE_FLAG_KEYS`. Nothing is imported
 * from scripts/ — this is an independent, verified copy.
 */
export const ALLOWED_FLAG_KEYS = ['persistencyV2', 'policyLedgerCampaignLens', 'awardsProvenance'];

function configDocRef(tenantId, docId) {
  return doc(db, `tenants/${tenantId}/config/${docId}`);
}

/** Display-stringify a value for the audit trail. Null/undefined → null. */
function toDisplay(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function assertAllowedFlag(flagKey) {
  if (!ALLOWED_FLAG_KEYS.includes(flagKey)) {
    throw new Error(`configService: feature flag "${flagKey}" is not in ALLOWED_FLAG_KEYS`);
  }
}

/** Expand a dotted path into `target` as nested objects, assigning `value` at the leaf. */
function assignNested(target, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// ── Read (all three modes share this fail-closed read path) ──────────────────

/**
 * getConfigDoc — raw stored map for a config doc. Absent doc / read error /
 * missing tenantId → `{}` (fail-closed; identical shape to
 * featureFlagsService.getFeatureFlags so an absent config never blocks render).
 *
 * @param {string} tenantId
 * @param {string} docId
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getConfigDoc(tenantId, docId) {
  if (!tenantId || !docId) return {};
  try {
    const snap = await getDoc(configDocRef(tenantId, docId));
    if (!snap.exists()) return {};
    const data = snap.data();
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

// ── ENVELOPE mode ────────────────────────────────────────────────────────────

/**
 * saveConfigValues — write ONLY the passed keys, each as an envelope
 * `{ value, who, whoName, date }`, merge-set onto the config doc. Batched with
 * one audit entry per key. Never materializes defaults for un-passed keys.
 *
 * @param {string} tenantId
 * @param {string} docId
 * @param {Record<string, unknown>} updates  `{ [settingKey]: value }`
 * @param {{uid: string, name: string}} actor
 */
export async function saveConfigValues(tenantId, docId, updates, actor) {
  const batch = writeBatch(db);
  const ref = configDocRef(tenantId, docId);
  const payload = {};
  for (const [key, value] of Object.entries(updates)) {
    payload[key] = {
      value,
      who: actor?.uid ?? null,
      whoName: actor?.name ?? null,
      date: serverTimestamp(),
    };
    addAuditEntryToBatch(
      batch,
      tenantId,
      buildAuditEntry({ settingId: key, section: docId, from: null, to: toDisplay(value), actor }),
    );
  }
  batch.set(ref, payload, { merge: true });
  await batch.commit();
}

/**
 * resetConfigValues — delete the passed keys (diff-only reset to default).
 * `deleteField()` per key, merge-set. One audit entry per key, `to = 'DEFAULT'`.
 * On a non-existent doc the merge-set of delete sentinels is a safe no-op (no throw).
 *
 * @param {string} tenantId
 * @param {string} docId
 * @param {string[]} keys
 * @param {{uid: string, name: string}} actor
 * @param {Record<string, unknown>} [fromValues]  prior values (for audit `from`)
 */
export async function resetConfigValues(tenantId, docId, keys, actor, fromValues = {}) {
  const batch = writeBatch(db);
  const ref = configDocRef(tenantId, docId);
  const payload = {};
  for (const key of keys) {
    payload[key] = deleteField();
    addAuditEntryToBatch(
      batch,
      tenantId,
      buildAuditEntry({
        settingId: key,
        section: docId,
        from: toDisplay(fromValues[key]),
        to: 'DEFAULT',
        actor,
      }),
    );
  }
  batch.set(ref, payload, { merge: true });
  await batch.commit();
}

// ── PLAIN-LEGACY mode (managerActivityStandards) ─────────────────────────────

/**
 * savePlainValues — write plain (un-enveloped) values at dot-paths, expanded to
 * NESTED objects so the Cloud Function reader (`orgDefault[role][key]`) keeps
 * working. Root `updatedBy` / `updatedAt` match the existing writer contract
 * (managerActivityStandardsService.setManagerActivityStandards). merge-set deep-
 * merges nested maps, so untouched siblings survive. Batched with audit entries.
 *
 * @param {string} tenantId
 * @param {string} docId
 * @param {Record<string, unknown>} updates  `{ [dotPath]: plainValue }` e.g. `'unit_manager.jfwCount': 5`
 * @param {{uid: string, name: string}} actor
 * @param {{fromValues?: Record<string, unknown>, sectionLabel?: string}} [meta]
 *   Optional, NON-BREAKING (Run 5, Item 2A). `fromValues` (keyed by dot-path)
 *   supplies the audit `from` display value; `sectionLabel` overrides the audit
 *   `section` with a human label (e.g. 'Activity Standards') instead of `docId`.
 *   Both default to the pre-extension behavior when omitted.
 */
export async function savePlainValues(tenantId, docId, updates, actor, meta = {}) {
  const { fromValues = {}, sectionLabel } = meta;
  const batch = writeBatch(db);
  const ref = configDocRef(tenantId, docId);
  const payload = { updatedBy: actor?.uid ?? null, updatedAt: serverTimestamp() };
  for (const [dotPath, value] of Object.entries(updates)) {
    assignNested(payload, dotPath, value);
    addAuditEntryToBatch(
      batch,
      tenantId,
      buildAuditEntry({
        settingId: dotPath,
        section: sectionLabel ?? docId,
        from: toDisplay(fromValues[dotPath]),
        to: toDisplay(value),
        actor,
      }),
    );
  }
  batch.set(ref, payload, { merge: true });
  await batch.commit();
}

/**
 * resetPlainValues — delete plain values at dot-paths (diff-only reset). Uses
 * `batch.update` with dot-path field-path semantics + `deleteField()`. Because
 * `update` throws on a missing doc, we check existence first and no-op when the
 * doc is absent (absent already means default — nothing to reset).
 *
 * @param {string} tenantId
 * @param {string} docId
 * @param {string[]} dotPaths
 * @param {{uid: string, name: string}} actor
 * @param {Record<string, unknown>} [fromValues]  prior values (for audit `from`), keyed by dot-path
 * @param {{sectionLabel?: string}} [meta]  Optional, NON-BREAKING (Run 5, Item 2A).
 *   `sectionLabel` overrides the audit `section` with a human label; omitted →
 *   the pre-extension behavior (`section = docId`).
 */
export async function resetPlainValues(tenantId, docId, dotPaths, actor, fromValues = {}, meta = {}) {
  const { sectionLabel } = meta;
  const ref = configDocRef(tenantId, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return; // absent = already default; nothing to delete
  const batch = writeBatch(db);
  const payload = { updatedBy: actor?.uid ?? null, updatedAt: serverTimestamp() };
  for (const dotPath of dotPaths) {
    payload[dotPath] = deleteField();
    addAuditEntryToBatch(
      batch,
      tenantId,
      buildAuditEntry({
        settingId: dotPath,
        section: sectionLabel ?? docId,
        from: toDisplay(fromValues[dotPath]),
        to: 'DEFAULT',
        actor,
      }),
    );
  }
  batch.update(ref, payload);
  await batch.commit();
}

// ── FLAG mode (settings.featureFlags) ────────────────────────────────────────

/**
 * setFeatureFlagOn — set `featureFlags.<key> = true` (literal true so
 * `isFlagOn`'s `=== true` holds) plus SIBLING `featureFlagsMeta.<key>`
 * provenance, merge-set on `config/settings`. Batched with an audit entry
 * (OFF → ON). Throws on any non-allowlisted key.
 */
export async function setFeatureFlagOn(tenantId, flagKey, actor) {
  assertAllowedFlag(flagKey);
  const batch = writeBatch(db);
  const ref = configDocRef(tenantId, 'settings');
  batch.set(
    ref,
    {
      featureFlags: { [flagKey]: true },
      featureFlagsMeta: {
        [flagKey]: { who: actor?.uid ?? null, whoName: actor?.name ?? null, date: serverTimestamp() },
      },
    },
    { merge: true },
  );
  addAuditEntryToBatch(
    batch,
    tenantId,
    buildAuditEntry({ settingId: flagKey, section: 'featureFlags', from: 'OFF', to: 'ON', actor }),
  );
  await batch.commit();
}

/**
 * setFeatureFlagOff — DELETE both `featureFlags.<key>` and
 * `featureFlagsMeta.<key>` (fail-closed: absent = OFF; a `false` value is NEVER
 * written). merge-set of delete sentinels. Batched with an audit entry (ON → OFF).
 * Throws on any non-allowlisted key.
 */
export async function setFeatureFlagOff(tenantId, flagKey, actor) {
  assertAllowedFlag(flagKey);
  const batch = writeBatch(db);
  const ref = configDocRef(tenantId, 'settings');
  batch.set(
    ref,
    {
      featureFlags: { [flagKey]: deleteField() },
      featureFlagsMeta: { [flagKey]: deleteField() },
    },
    { merge: true },
  );
  addAuditEntryToBatch(
    batch,
    tenantId,
    buildAuditEntry({ settingId: flagKey, section: 'featureFlags', from: 'ON', to: 'OFF', actor }),
  );
  await batch.commit();
}
