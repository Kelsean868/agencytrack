// useCompanyConfigState — the Company Config surface state machine (Run 5,
// Items 2A + 4). Recreates the SEMANTICS of the design reference state machine
// (docs/design-system/screens-v2/design_handoff_company_config/cc-proto-main.jsx:
// effective / rowState / setDraftValue-with-auto-clear / undo / reset-staging /
// saveAll / commitFlag) against this codebase's ConfigProvider + configService
// stack — NOT a copy of the prototype's localStorage plumbing.
//
// DEVIATIONS from cc-proto-main (documented in the build report):
//  • No effective-dating this run — dated items are read-only; there is no
//    `eff` in the draft, no `setDraftEff`, no correction flow (schema-reserved).
//  • Committed state is not a local `committed` map — it is the live tenant
//    config docs from ConfigProvider (`docs`), re-read via `refresh()` after
//    every write (diff-only: absent key = code default).
//  • saveAll partitions by storage mode; only PLAIN (activity standards) is
//    editable this run, so only savePlainValues / resetPlainValues are called.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConfigContext } from '../../../context/ConfigProvider';
import {
  savePlainValues,
  resetPlainValues,
  setFeatureFlagOn,
  setFeatureFlagOff,
  ALLOWED_FLAG_KEYS,
} from '../../../services/configService';
import { getTenantUserCount } from '../../../services/managerService';
import { ITEMS_BY_ID } from '../../../config/companyConfigRegistry';

// The three manager-standard role keys the activity items map to (kept local so
// this hook has no dependency direction into the standards service).
const STANDARDS_ROLE_KEYS = ['unit_manager', 'branch_manager', 'sales_manager'];
const STANDARDS_META_KEYS = new Set(['updatedBy', 'updatedAt']);

/** Structural deep-equal for the draft auto-clear (arrays / plain objects / scalars). */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

/** Format a Firestore Timestamp / Date into the surface's "12 Jun 2026" idiom. */
export function formatAuditDate(at) {
  let d = null;
  if (at && typeof at.toDate === 'function') d = at.toDate();
  else if (at instanceof Date) d = at;
  else if (typeof at === 'number') d = new Date(at);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Role-map of ONLY the stored standard keys for a role (drops updatedBy/updatedAt). */
function storedRoleMap(masDoc, role) {
  const raw = masDoc?.[role];
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!STANDARDS_META_KEYS.has(k)) out[k] = v;
  }
  return out;
}

/**
 * useCompanyConfigState — the surface's single source of draft/derivation truth.
 *
 * @param {object} args
 * @param {string} args.tenantId
 * @param {{uid: string, name: string}} args.actor
 * @param {string} [args.company]  display name for save/flag toasts + rail footer
 * @param {(message: string) => void} [args.notify]  toast sink (success variant)
 */
export default function useCompanyConfigState({ tenantId, actor, company = 'your company', notify }) {
  const ctx = useConfigContext();
  // Memoized off ctx identity so the many derivation callbacks below don't
  // re-create on every render (ConfigProvider's value is stable unless docs change).
  const docs = useMemo(() => ctx?.docs ?? {}, [ctx]);
  const refresh = useMemo(() => ctx?.refresh ?? (() => {}), [ctx]);

  const [draft, setDraft] = useState({}); // { [itemId]: { value?, reset?: true } }
  const [userCount, setUserCount] = useState(null); // null → fail-soft (omit number)
  const [saving, setSaving] = useState(false);

  // Real tenant user count for the toasts. Fail-soft: any error → null.
  useEffect(() => {
    let alive = true;
    if (!tenantId) { setUserCount(null); return () => { alive = false; }; }
    getTenantUserCount(tenantId)
      .then((n) => { if (alive) setUserCount(Number.isFinite(n) ? n : null); })
      .catch(() => { if (alive) setUserCount(null); });
    return () => { alive = false; };
  }, [tenantId]);

  // ── committed (stored) reads ───────────────────────────────────────────────
  const baseValue = useCallback((id) => {
    const item = ITEMS_BY_ID[id];
    if (!item) return undefined;
    const mode = item.storage?.mode;
    if (mode === 'flag') {
      const key = item.storage.keyPath.split('.').pop();
      return docs.settings?.featureFlags?.[key] === true;
    }
    if (mode === 'plain') {
      // Activity standards: the "value" is the stored role sub-map.
      return storedRoleMap(docs.managerActivityStandards, item.storage.keyPath);
    }
    // No storage this run (targets, locked, unbacked) → code default.
    return item.def;
  }, [docs]);

  const effective = useCallback((id) => {
    const d = draft[id];
    if (d) return d.reset ? ITEMS_BY_ID[id]?.def : d.value;
    return baseValue(id);
  }, [draft, baseValue]);

  // 'platform' | 'soon' | 'draft' | 'reset' | 'custom' | 'default' — lock wins.
  const rowState = useCallback((id) => {
    const item = ITEMS_BY_ID[id];
    if (!item) return 'default';
    if (item.lock) return item.lock; // 'platform' | 'soon'
    const d = draft[id];
    if (d) return d.reset ? 'reset' : 'draft';
    const mode = item.storage?.mode;
    if (mode === 'plain') {
      // custom if ANY standard key is present in that role's stored map.
      return Object.keys(baseValue(id) || {}).length > 0 ? 'custom' : 'default';
    }
    if (mode === 'flag') {
      const key = item.storage.keyPath.split('.').pop();
      return docs.settings?.featureFlags?.[key] === true ? 'custom' : 'default';
    }
    return 'default';
  }, [draft, baseValue, docs]);

  // ── draft mutations (auto-clear on equal, per cc-proto-main) ────────────────
  const setDraftValue = useCallback((id, value) => {
    setDraft((dr) => {
      if (deepEqual(value, baseValue(id))) {
        if (!(id in dr)) return dr;
        const next = { ...dr };
        delete next[id];
        return next;
      }
      return { ...dr, [id]: { value } };
    });
  }, [baseValue]);

  const undoDraft = useCallback((id) => {
    setDraft((dr) => {
      if (!(id in dr)) return dr;
      const next = { ...dr };
      delete next[id];
      return next;
    });
  }, []);

  const stageReset = useCallback((id) => {
    setDraft((dr) => ({ ...dr, [id]: { reset: true } }));
  }, []);

  const discardAll = useCallback(() => setDraft({}), []);

  const draftCount = Object.keys(draft).length;

  // ── userCount phrasing (fail-soft) ─────────────────────────────────────────
  const userPhrase = useMemo(
    () => (userCount != null ? `${userCount} users at ${company}` : `everyone at ${company}`),
    [userCount, company],
  );

  // ── saveAll: partition drafts by storage mode → plain only this run ─────────
  const saveAll = useCallback(async () => {
    const entries = Object.entries(draft);
    const n = entries.length;
    if (!n || saving) return;

    const plainUpdates = {}; // dotPath → value
    const plainResets = [];  // dotPath[]
    const plainFrom = {};    // dotPath → prior value (audit `from`)

    for (const [id, d] of entries) {
      const item = ITEMS_BY_ID[id];
      if (item?.storage?.mode !== 'plain') continue; // only activity is editable this run
      const role = item.storage.keyPath;
      const base = baseValue(id) || {};
      if (d.reset) {
        for (const key of Object.keys(base)) {
          const dp = `${role}.${key}`;
          plainResets.push(dp);
          plainFrom[dp] = base[key];
        }
        continue;
      }
      const nextMap = d.value || {};
      const keys = new Set([...Object.keys(base), ...Object.keys(nextMap)]);
      for (const key of keys) {
        const dp = `${role}.${key}`;
        const bv = base[key];
        const dv = nextMap[key];
        if (dv === undefined || dv === null || dv === '') {
          if (bv !== undefined) { plainResets.push(dp); plainFrom[dp] = bv; }
        } else if (!deepEqual(dv, bv)) {
          plainUpdates[dp] = dv;
          plainFrom[dp] = bv;
        }
      }
    }

    setSaving(true);
    try {
      const meta = { fromValues: plainFrom, sectionLabel: 'Activity Standards' };
      if (Object.keys(plainUpdates).length > 0) {
        await savePlainValues(tenantId, 'managerActivityStandards', plainUpdates, actor, meta);
      }
      if (plainResets.length > 0) {
        await resetPlainValues(tenantId, 'managerActivityStandards', plainResets, actor, plainFrom, {
          sectionLabel: 'Activity Standards',
        });
      }
      await refresh();
      setDraft({});
      notify?.(`Saved ${n} change${n === 1 ? '' : 's'} — applied to ${userPhrase}`);
    } finally {
      setSaving(false);
    }
  }, [draft, saving, baseValue, tenantId, actor, refresh, notify, userPhrase]);

  // ── commitFlag: immediate (no draft), per cc-proto-main ─────────────────────
  const flagOn = useCallback(
    (flagKey) => docs.settings?.featureFlags?.[flagKey] === true,
    [docs],
  );

  const flagProvenance = useCallback((flagKey) => {
    const meta = docs.settings?.featureFlagsMeta?.[flagKey];
    if (!meta) return undefined;
    return { whoName: meta.whoName ?? '—', date: formatAuditDate(meta.date) };
  }, [docs]);

  const commitFlag = useCallback(async (flag, on) => {
    if (!ALLOWED_FLAG_KEYS.includes(flag.key)) return;
    if (on) await setFeatureFlagOn(tenantId, flag.key, actor);
    else await setFeatureFlagOff(tenantId, flag.key, actor);
    await refresh();
    if (on) {
      notify?.(userCount != null
        ? `${flag.name} is ON for all ${userCount} users`
        : `${flag.name} is ON for everyone`);
    } else {
      notify?.(`${flag.name} turned off`);
    }
  }, [tenantId, actor, refresh, notify, userCount]);

  // ── customized sections (rail teal dot: committed override OR draft) ─────────
  const customizedSections = useMemo(() => {
    const s = new Set();
    STANDARDS_ROLE_KEYS.forEach((role) => {
      if (Object.keys(storedRoleMap(docs.managerActivityStandards, role)).length > 0) s.add('activity');
    });
    const flags = docs.settings?.featureFlags || {};
    if (ALLOWED_FLAG_KEYS.some((k) => flags[k] === true)) s.add('flags');
    const cm = docs.companyMinimums || {};
    if (Object.keys(cm).some((k) => !STANDARDS_META_KEYS.has(k))) s.add('targets');
    Object.keys(draft).forEach((id) => { const it = ITEMS_BY_ID[id]; if (it) s.add(it.section); });
    return s;
  }, [docs, draft]);

  return {
    docs,
    draft,
    draftCount,
    saving,
    userCount,
    baseValue,
    effective,
    rowState,
    setDraftValue,
    undoDraft,
    stageReset,
    discardAll,
    saveAll,
    commitFlag,
    flagOn,
    flagProvenance,
    customizedSections,
  };
}
