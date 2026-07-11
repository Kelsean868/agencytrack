/**
 * useConfig(path, codeDefault) — read a single tenant-config value from the
 * hydrated ConfigProvider docs, falling back to the CODE default whenever the
 * value is absent (diff-only storage: absent key = code default).
 *
 * `path` is `'docId.rest.of.path'` — the first segment selects one of the
 * hydrated docs (see HYDRATED_DOC_IDS), the remainder walks into its stored map.
 * Returns the RAW stored value at that path (envelope-mode consumers unwrap
 * `.value` themselves). `undefined` / absent / any resolution error →
 * `codeDefault`. Used OUTSIDE a ConfigProvider → `codeDefault` (fail-closed).
 *
 * FORWARD-ONLY: this is the read path for the new Company Config surface only;
 * it does not replace any existing consumer's read path.
 */
import { useConfigContext } from '../context/ConfigProvider';

function resolvePath(docs, path) {
  if (!path || typeof path !== 'string') return undefined;
  const parts = path.split('.');
  let cur = docs;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

export function useConfig(path, codeDefault) {
  const ctx = useConfigContext();
  if (!ctx || !ctx.docs) return codeDefault;
  try {
    const val = resolvePath(ctx.docs, path);
    return val === undefined ? codeDefault : val;
  } catch {
    return codeDefault;
  }
}

// Re-exported so a surface can import both the value hook and the context
// accessor (docs / refresh) from one module.
export { useConfigContext } from '../context/ConfigProvider';
