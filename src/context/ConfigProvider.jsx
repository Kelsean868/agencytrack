/**
 * ConfigProvider — hydrates the tenant's config docs ONCE per tenantId and
 * exposes them (raw stored maps) to the config surface via `useConfig` /
 * `useConfigContext`.
 *
 * FAIL-CLOSED + NON-BLOCKING: each doc read fail-closes to `{}` (getConfigDoc
 * never throws), an individual failure never poisons the others, and children
 * ALWAYS render immediately — `loading` is exposed for surfaces that want to
 * show a hydrating state, but nothing is gated on it.
 *
 * FORWARD-ONLY: existing consumers (companyMinimums / awards / standards /
 * useFeatureFlag) keep their own read paths untouched. This provider is the
 * substrate the new Company Config surface reads from; it retrofits nothing.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { getConfigDoc } from '../services/configService';

// The config docs hydrated on mount. Kept here (not in configService) because it
// is a provider-scoped concern: the set of docs this context makes available.
// eslint-disable-next-line react-refresh/only-export-components
export const HYDRATED_DOC_IDS = ['settings', 'managerActivityStandards', 'companyMinimums'];

const ConfigContext = createContext(null);

export function ConfigProvider({ tenantId, children }) {
  const [docs, setDocs] = useState({});
  const [loading, setLoading] = useState(!!tenantId);

  const hydrate = useCallback(
    async (aliveRef) => {
      if (!tenantId) {
        if (!aliveRef || aliveRef.alive) {
          setDocs({});
          setLoading(false);
        }
        return;
      }
      if (!aliveRef || aliveRef.alive) setLoading(true);
      // Parallel, fail-closed per doc: getConfigDoc already resolves to {} on
      // error, and the .catch is a belt-and-suspenders guard so one rejected
      // read can never reject Promise.all.
      const results = await Promise.all(
        HYDRATED_DOC_IDS.map((id) => getConfigDoc(tenantId, id).catch(() => ({}))),
      );
      if (aliveRef && !aliveRef.alive) return;
      const next = {};
      HYDRATED_DOC_IDS.forEach((id, i) => {
        next[id] = results[i] ?? {};
      });
      setDocs(next);
      setLoading(false);
    },
    [tenantId],
  );

  useEffect(() => {
    const aliveRef = { alive: true };
    hydrate(aliveRef);
    return () => {
      aliveRef.alive = false;
    };
  }, [hydrate]);

  // refresh() re-fetches all docs so the surface re-reads committed state after
  // a save/reset. Not alive-guarded (caller-initiated, post-mount).
  const refresh = useCallback(() => hydrate(null), [hydrate]);

  const value = useMemo(() => ({ docs, loading, refresh }), [docs, loading, refresh]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/**
 * useConfigContext — raw context accessor for surfaces that need `docs` /
 * `refresh` / `loading`. Returns `null` when used outside a ConfigProvider
 * (fail-closed, never throws) so consumers can degrade gracefully.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useConfigContext() {
  return useContext(ConfigContext);
}
