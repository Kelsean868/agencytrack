import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * userPrefsService — per-user app preferences (Nav redesign PR-2).
 *
 * Single Firestore doc per user: `tenants/{tenantId}/users/{uid}/prefs/app`.
 * Owner-only (firestore.rules `prefs/{prefId}` block). Written with
 * `{ merge: true }` so independent prefs (pinnedNav now; menuLayout in PR-4)
 * never clobber each other.
 *
 * tenantId + uid are sourced by the caller exactly as `moneyNeedsService` does
 * (from AuthContext: tenantId + user.uid).
 */

const PREFS_DOC_ID = 'app';

function prefsDocRef(tenantId, uid) {
  return doc(db, 'tenants', tenantId, 'users', uid, 'prefs', PREFS_DOC_ID);
}

/**
 * Read the user's prefs doc. Returns the doc data (`{ pinnedNav?, menuLayout?, updatedAt? }`)
 * or null when no doc exists. Callers tolerate a thrown read (offline / rules) by
 * falling back to the localStorage mirror or seeds — never block render on this.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @returns {Promise<{ pinnedNav?: string[], menuLayout?: string, navOrder?: Record<string, string[]>, settings?: Record<string, *> }|null>}
 *   `settings` (Tier 2 · 2.4) is the Settings v2 view-defaults map
 *   (`masterSheetPreset`, `defaultPeriod`, …). Theme is device-local (localStorage),
 *   not in this map.
 *   `navOrder` (Tier 1 · 1.4) is a map keyed by navConfig key
 *   (`agent` | `producingManager` | `manager` | `tenantAdmin`) → the user's
 *   preferred ordered list of nav item ids for that config. Agent/manager nav
 *   ids overlap, so the per-config map avoids id collisions a flat array would hit.
 */
export async function getUserPrefs(tenantId, uid) {
  if (!tenantId || !uid) return null;
  const snap = await getDoc(prefsDocRef(tenantId, uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Persist the pinned-nav id list. Merge-write so a future `menuLayout` (PR-4) on
 * the same doc is preserved.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {string[]} pinnedNav  ordered list of navConfig item ids
 * @returns {Promise<void>}
 */
export async function setPinnedNav(tenantId, uid, pinnedNav) {
  if (!tenantId || !uid) throw new Error('setPinnedNav requires tenantId and uid');
  await setDoc(
    prefsDocRef(tenantId, uid),
    { pinnedNav: Array.isArray(pinnedNav) ? pinnedNav : [], updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Persist the sidebar menu-layout preference (Nav redesign PR-4). Merge-write so
 * the coexisting `pinnedNav` (PR-2) on the same doc is preserved. Validation of
 * the value (`pinned` | `workspace` | `both`) and the agent→pinned clamp live in
 * `useMenuLayout`; this writer only guards tenantId/uid presence.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {'pinned'|'workspace'|'both'} menuLayout
 * @returns {Promise<void>}
 */
export async function setMenuLayout(tenantId, uid, menuLayout) {
  if (!tenantId || !uid) throw new Error('setMenuLayout requires tenantId and uid');
  await setDoc(
    prefsDocRef(tenantId, uid),
    { menuLayout, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Persist the sidebar nav-order preference for one nav config (Tier 1 · 1.4 —
 * desktop sidebar drag-reorder). Stored under `navOrder.{configKey}` so distinct
 * configs (agent / producingManager / manager / tenantAdmin) never clobber each
 * other. Deep-merge-write: `{ merge: true }` merges the nested `navOrder` map, so
 * a write for one config preserves the others (and the coexisting `pinnedNav` /
 * `menuLayout`). Validation (dropping stale ids, within-section semantics) lives
 * in `useNavOrder` + `applyNavOrder`; this writer only guards tenantId/uid/configKey.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {string} configKey  navConfig key the order applies to
 * @param {string[]} orderIds  ordered list of navConfig item ids
 * @returns {Promise<void>}
 */
export async function setNavOrder(tenantId, uid, configKey, orderIds) {
  if (!tenantId || !uid) throw new Error('setNavOrder requires tenantId and uid');
  if (!configKey) throw new Error('setNavOrder requires a configKey');
  await setDoc(
    prefsDocRef(tenantId, uid),
    {
      navOrder: { [configKey]: Array.isArray(orderIds) ? orderIds : [] },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Persist a single App-settings value (Fable Tier 2 · 2.4 — Settings v2 · My
 * Preferences view-defaults). Stored under `settings.{key}` so each pref (e.g.
 * `masterSheetPreset`, `defaultPeriod`) is written independently. Deep-merge:
 * `{ merge: true }` merges the nested `settings` map, so a write for one key
 * preserves the others (and the coexisting `pinnedNav` / `menuLayout` / `navOrder`).
 * ONLY the touched key is written — the caller never rebuilds the whole map, so
 * two devices editing different settings never clobber each other's key.
 *
 * Theme is intentionally NOT stored here — it stays a device-local localStorage
 * pref (see `src/lib/theme.js`), matching the pre-2.4 dark-toggle behavior and
 * the no-FOUC first-paint restore.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {string} key    settings key (e.g. 'masterSheetPreset' | 'defaultPeriod')
 * @param {*} value       serializable value
 * @returns {Promise<void>}
 */
export async function setAppSetting(tenantId, uid, key, value) {
  if (!tenantId || !uid) throw new Error('setAppSetting requires tenantId and uid');
  if (!key) throw new Error('setAppSetting requires a key');
  await setDoc(
    prefsDocRef(tenantId, uid),
    { settings: { [key]: value }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Normalize one saved scenario before it is written. Enforces the project's
 * domain rule that numerics are stored as NUMBERS, never strings (CLAUDE.md:
 * "All numeric fields: parseFloat() enforced before saving to Firestore" /
 * "Never store numeric values as strings"). The decomposition inputs reach us
 * as numbers from `NumField`'s parseFloat-on-change, but a scenario restored
 * from an older doc — or any future caller — must not be able to smuggle a
 * numeric string into the engine, where it would silently corrupt the math.
 * Non-numeric input values are dropped rather than coerced to NaN.
 */
function normalizeScenario(s) {
  const rawInputs = s.inputs && typeof s.inputs === 'object' ? s.inputs : {};
  const inputs = {};
  for (const [k, v] of Object.entries(rawInputs)) {
    const n = parseFloat(v);
    if (Number.isFinite(n)) inputs[k] = n;
  }
  return {
    id: s.id,
    label: s.label,
    savedAt: typeof s.savedAt === 'string' ? s.savedAt : new Date().toISOString(),
    freqKey: typeof s.freqKey === 'string' ? s.freqKey : 'annual',
    inputs,
  };
}

/** Max saved Commission scenarios per agent (R-06). Keeps the single prefs doc
 *  small and the chip row scannable; mirrors the appointment-template cap idiom. */
export const COMMISSION_SCENARIO_CAP = 6;

/**
 * Persist the agent's saved Commission-Playground scenarios (Tier 3b R-06).
 *
 * Storage: the SAME single `prefs/app` doc, merge-written as a
 * `commissionScenarios` array — so it never clobbers pinnedNav / menuLayout /
 * navOrder / settings, and needs no second read.
 *
 * Privacy: the `prefs/{prefId}` rules block is `request.auth.uid == uid` for BOTH
 * read and write, with NO manager arm — so scenarios are own-write and
 * agent-private BY CONSTRUCTION (R-06: "no shared/manager visibility"), with no
 * firestore.rules change and no composite index.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {Array<{id:string,label:string,savedAt:string,inputs:object,freqKey:string}>} scenarios
 * @returns {Promise<void>}
 */
export async function setCommissionScenarios(tenantId, uid, scenarios) {
  if (!tenantId || !uid) throw new Error('setCommissionScenarios requires tenantId and uid');
  const safe = (Array.isArray(scenarios) ? scenarios : [])
    .filter((s) => s && typeof s.id === 'string' && typeof s.label === 'string')
    .slice(0, COMMISSION_SCENARIO_CAP)
    .map(normalizeScenario);
  await setDoc(
    prefsDocRef(tenantId, uid),
    { commissionScenarios: safe, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Persist the agent's chosen "My target tier" for one campaign (Policy Ledger
 * L1 — docs/briefs/ledger-lens-build.md § L1 item 2). Stored under
 * `ledgerTargetTiers.{campaignId}` on the SAME `prefs/app` doc, deep-merged so a
 * write for one campaign preserves every other campaign's choice and every
 * sibling pref (pinnedNav / menuLayout / navOrder / settings / scenarios).
 *
 * The value is the tier's NAME (e.g. 'Champion') — the key the tier ladder and
 * `derivePolicyLens` already match tiers by. No rules change: the owner-only
 * `prefs/{prefId}` block permits any field on this doc.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {string} campaignId
 * @param {string} tierName
 * @returns {Promise<void>}
 */
export async function setLedgerTargetTier(tenantId, uid, campaignId, tierName) {
  if (!tenantId || !uid) throw new Error('setLedgerTargetTier requires tenantId and uid');
  if (!campaignId) throw new Error('setLedgerTargetTier requires a campaignId');
  if (typeof tierName !== 'string' || tierName === '') {
    throw new Error('setLedgerTargetTier requires a tier name');
  }
  await setDoc(
    prefsDocRef(tenantId, uid),
    { ledgerTargetTiers: { [campaignId]: tierName }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Max user-saved Policy Ledger views (L2 — docs/briefs/ledger-lens-build.md
 *  § L2 item 3). Mirrors COMMISSION_SCENARIO_CAP's idiom: keeps the single
 *  prefs doc small and the view-chips row scannable. */
export const LEDGER_SAVED_VIEW_CAP = 8;

/**
 * Normalize one saved ledger view before it is written. Filter-state Sets are
 * not Firestore-serializable, so each tag-section is stored as a sorted
 * ARRAY of strings (never a Set) — restored back to a Set by the reader
 * (`ledgerFilters` consumers), never stored as one. `apiMin`/`apiMax` are
 * coerced to numbers (CLAUDE.md: "Never store numeric values as strings in
 * Firestore"); dates are stored `YYYY-MM-DD` (already the wire format
 * `ledgerFilters.toStoredDate` produces — this only guards against a caller
 * passing a raw Set or a DD-MM-YYYY string through by mistake).
 */
function normalizeSavedView(v) {
  const f = v?.filters ?? {};
  const toArr = (val) => (val instanceof Set ? [...val] : Array.isArray(val) ? val : [])
    .filter((x) => typeof x === 'string')
    .sort();
  const toNum = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };
  const toIsoDate = (val) => (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val : null);
  return {
    id: v.id,
    label: v.label,
    savedAt: typeof v.savedAt === 'string' ? v.savedAt : new Date().toISOString(),
    sortKey: typeof v.sortKey === 'string' ? v.sortKey : null,
    filters: {
      countsGroup: toArr(f.countsGroup),
      status: toArr(f.status),
      source: toArr(f.source),
      who: toArr(f.who),
      product: toArr(f.product),
      frequency: toArr(f.frequency),
      dateType: f.dateType === 'submit' ? 'submit' : 'issue',
      dateFrom: toIsoDate(f.dateFrom),
      dateTo: toIsoDate(f.dateTo),
      apiMin: f.apiMin != null ? toNum(f.apiMin) : null,
      apiMax: f.apiMax != null ? toNum(f.apiMax) : null,
    },
  };
}

/**
 * Persist the agent's saved Policy Ledger views (L2 — docs/briefs/ledger-lens-build.md
 * § L2 item 3, "Rules needed"). SAME single `prefs/app` doc, merge-written as a
 * `ledgerSavedViews` array — never clobbers any sibling pref, no second read.
 *
 * No firestore.rules change: the owner-only `prefs/{prefId}` block (same one
 * `setCommissionScenarios` / `setLedgerTargetTier` already rely on) permits any
 * field on this doc for its own uid. Verified against `tests/rules/userPrefs.rules.test.mjs`
 * before this was written (Rule 11) — the rule is field-agnostic, so no new
 * rule and no new index is needed for this write.
 *
 * @param {string} tenantId
 * @param {string} uid
 * @param {Array<{id:string,label:string,savedAt:string,sortKey:string|null,filters:object}>} views
 * @returns {Promise<void>}
 */
export async function setLedgerSavedViews(tenantId, uid, views) {
  if (!tenantId || !uid) throw new Error('setLedgerSavedViews requires tenantId and uid');
  const safe = (Array.isArray(views) ? views : [])
    .filter((v) => v && typeof v.id === 'string' && typeof v.label === 'string')
    .slice(0, LEDGER_SAVED_VIEW_CAP)
    .map(normalizeSavedView);
  await setDoc(
    prefsDocRef(tenantId, uid),
    { ledgerSavedViews: safe, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
