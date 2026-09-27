import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, ChevronDown, ChevronRight, Loader2, AlertTriangle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';
import { useAuth } from '../../context/AuthContext';
import { getAwardsRuleset, setAwardsRuleset } from '../../services/awardsRulesetService';

// Field schema for the 12 scalar-only award groups (P-a).
const SCALAR_GROUPS = [
  {
    key: 'advisorMonth',
    label: 'Advisor of the Month',
    category: 'Agent Awards',
    fields: [
      { path: 'excludesBdoDso',    label: 'Excludes BDO/DSO',           type: 'bool'     },
      { path: 'persistGate',       label: 'Persistency Gate (%)',         type: 'percent'  },
      { path: 'api.threshold',     label: 'API Threshold (TTD)',          type: 'currency' },
      { path: 'api.inContention',  label: 'API In-Contention (TTD)',      type: 'currency' },
      { path: 'api.prize',         label: 'API Prize',                   type: 'text'     },
      { path: 'apps.threshold',    label: 'Apps Threshold',              type: 'count'    },
      { path: 'apps.inContention', label: 'Apps In-Contention',          type: 'count'    },
      { path: 'apps.prize',        label: 'Apps Prize',                  type: 'text'     },
    ],
  },
  {
    key: 'quarterlyAward',
    label: 'Quarterly Award',
    category: 'Agent Awards',
    fields: [
      { path: 'persistGate',       label: 'Persistency Gate (%)',         type: 'percent'  },
      { path: 'api.threshold',     label: 'API Threshold (TTD)',          type: 'currency' },
      { path: 'api.inContention',  label: 'API In-Contention (TTD)',      type: 'currency' },
      { path: 'api.prize',         label: 'API Prize',                   type: 'text'     },
      { path: 'apps.threshold',    label: 'Apps Threshold',              type: 'count'    },
      { path: 'apps.inContention', label: 'Apps In-Contention',          type: 'count'    },
      { path: 'apps.prize',        label: 'Apps Prize',                  type: 'text'     },
    ],
  },
  {
    key: 'persistencyAward',
    label: 'Annual Persistency Award',
    category: 'Agent Awards',
    fields: [
      { path: 'silver.apiThreshold',      label: 'Silver — API Threshold (TTD)',         type: 'currency', subGroup: 'Silver' },
      { path: 'silver.appsThreshold',     label: 'Silver — Apps Threshold',              type: 'count',    subGroup: 'Silver' },
      { path: 'silver.persistGate',       label: 'Silver — Persistency Gate (%)',         type: 'percent',  subGroup: 'Silver' },
      { path: 'silver.apiInContention',   label: 'Silver — API In-Contention (TTD)',      type: 'currency', subGroup: 'Silver' },
      { path: 'silver.appsInContention',  label: 'Silver — Apps In-Contention',          type: 'count',    subGroup: 'Silver' },
      { path: 'silver.prize',             label: 'Silver — Prize',                       type: 'text',     subGroup: 'Silver' },
      { path: 'gold.apiThreshold',        label: 'Gold — API Threshold (TTD)',           type: 'currency', subGroup: 'Gold'   },
      { path: 'gold.appsThreshold',       label: 'Gold — Apps Threshold',                type: 'count',    subGroup: 'Gold'   },
      { path: 'gold.persistGate',         label: 'Gold — Persistency Gate (%)',           type: 'percent',  subGroup: 'Gold'   },
      { path: 'gold.apiInContention',     label: 'Gold — API In-Contention (TTD)',        type: 'currency', subGroup: 'Gold'   },
      { path: 'gold.persistInContention', label: 'Gold — Persistency In-Contention (%)', type: 'percent',  subGroup: 'Gold'   },
      { path: 'gold.prize',               label: 'Gold — Prize',                         type: 'text',     subGroup: 'Gold'   },
    ],
  },
  {
    key: 'rookieAward',
    label: 'Rookie of the Year',
    category: 'Agent Awards',
    fields: [
      { path: 'maxMonthsInIndustry', label: 'Max Months in Industry',  type: 'count'    },
      { path: 'persistGate',         label: 'Persistency Gate (%)',     type: 'percent'  },
      { path: 'apiThreshold',        label: 'API Threshold (TTD)',      type: 'currency' },
      { path: 'appsThreshold',       label: 'Apps Threshold',           type: 'count'    },
      { path: 'apiInContention',     label: 'API In-Contention (TTD)',  type: 'currency' },
      { path: 'appsInContention',    label: 'Apps In-Contention',       type: 'count'    },
      { path: 'prize',               label: 'Prize',                    type: 'text'     },
    ],
  },
  {
    key: 'newBsAward',
    label: 'New Business Advisor Award',
    category: 'Agent Awards',
    fields: [
      { path: 'maxMonthsAtTatil', label: 'Max Months at Tatil',      type: 'count'    },
      { path: 'persistGate',      label: 'Persistency Gate (%)',       type: 'percent'  },
      { path: 'apiThreshold',     label: 'API Threshold (TTD)',        type: 'currency' },
      { path: 'appsThreshold',    label: 'Apps Threshold',             type: 'count'    },
      { path: 'apiInContention',  label: 'API In-Contention (TTD)',    type: 'currency' },
      { path: 'appsInContention', label: 'Apps In-Contention',         type: 'count'    },
      { path: 'prize',            label: 'Prize',                      type: 'text'     },
    ],
  },
  {
    key: 'centurionAward',
    label: 'Centurion Award',
    category: 'Agent Awards',
    fields: [
      { path: 'persistGate',      label: 'Persistency Gate (%)',  type: 'percent' },
      { path: 'appsThreshold',    label: 'Apps Threshold',        type: 'count'   },
      { path: 'appsInContention', label: 'Apps In-Contention',    type: 'count'   },
      { path: 'pppCap',           label: 'PPP Cap (%)',           type: 'percent' },
      { path: 'prize',            label: 'Prize',                 type: 'text'    },
    ],
  },
  {
    key: 'agentOfYearAward',
    label: 'Agent of the Year',
    category: 'Agent Awards',
    fields: [
      { path: 'excludesBdoDso',   label: 'Excludes BDO/DSO',         type: 'bool'     },
      { path: 'persistGate',      label: 'Persistency Gate (%)',       type: 'percent'  },
      { path: 'apiThreshold',     label: 'API Threshold (TTD)',        type: 'currency' },
      { path: 'appsThreshold',    label: 'Apps Threshold',             type: 'count'    },
      { path: 'apiInContention',  label: 'API In-Contention (TTD)',    type: 'currency' },
      { path: 'appsInContention', label: 'Apps In-Contention',         type: 'count'    },
      { path: 'prize',            label: 'Prize',                      type: 'text'     },
    ],
  },
  {
    key: 'mdrtAward',
    label: 'MDRT',
    category: 'Agent Awards',
    // apiThreshold/apiInContention are fixed by the MDRT conversion table
    // (mdrtAwardThresholds() / MDRT_THRESHOLDS_2026), not by this ruleset —
    // no longer exposed here to avoid an editable-but-ignored field (PR #984).
    note: 'API Threshold and In-Contention are set by the MDRT conversion table (TTD 688,800 for 2026) and are not editable here.',
    fields: [
      { path: 'prize', label: 'Prize', type: 'text' },
    ],
  },
  {
    key: 'managerProductionAward',
    label: 'Manager Production Award',
    category: 'Manager Awards',
    fields: [
      { path: 'avgApiThreshold',    label: 'Avg API Threshold (TTD)',      type: 'currency' },
      { path: 'avgApiInContention', label: 'Avg API In-Contention (TTD)',   type: 'currency' },
      { path: 'persistGate',        label: 'Persistency Gate (%)',          type: 'percent'  },
      { path: 'prize',              label: 'Prize',                         type: 'text'     },
    ],
  },
  {
    key: 'managerPersistencyAward',
    label: 'Manager Persistency Award',
    category: 'Manager Awards',
    fields: [
      { path: 'silver.persistGate',         label: 'Silver — Persistency Gate (%)',            type: 'percent',  subGroup: 'Silver' },
      { path: 'silver.avgApiInContention',  label: 'Silver — Avg API In-Contention (TTD)',     type: 'currency', subGroup: 'Silver' },
      { path: 'silver.persistInContention', label: 'Silver — Persistency In-Contention (%)',   type: 'percent',  subGroup: 'Silver' },
      { path: 'silver.prize',               label: 'Silver — Prize',                           type: 'text',     subGroup: 'Silver' },
      { path: 'gold.persistGate',           label: 'Gold — Persistency Gate (%)',              type: 'percent',  subGroup: 'Gold'   },
      { path: 'gold.avgApiInContention',    label: 'Gold — Avg API In-Contention (TTD)',       type: 'currency', subGroup: 'Gold'   },
      { path: 'gold.persistInContention',   label: 'Gold — Persistency In-Contention (%)',     type: 'percent',  subGroup: 'Gold'   },
      { path: 'gold.prize',                 label: 'Gold — Prize',                             type: 'text',     subGroup: 'Gold'   },
    ],
  },
  {
    key: 'unitOfYearAward',
    label: 'Unit of the Year',
    category: 'Manager Awards',
    fields: [
      { path: 'totalApiThreshold',    label: 'Total API Threshold (TTD)',     type: 'currency' },
      { path: 'avgApiThreshold',      label: 'Avg API Threshold (TTD)',       type: 'currency' },
      { path: 'agentCountMin',        label: 'Min Agent Count',               type: 'count'    },
      { path: 'newAdvisorsMin',       label: 'Min New Advisors',              type: 'count'    },
      { path: 'persistGate',          label: 'Persistency Gate (%)',           type: 'percent'  },
      { path: 'totalApiInContention', label: 'Total API In-Contention (TTD)', type: 'currency' },
      { path: 'prize',                label: 'Prize',                         type: 'text'     },
    ],
  },
  {
    key: 'agencyOfYearAward',
    label: 'Agency of the Year',
    category: 'Manager Awards',
    fields: [
      { path: 'totalApiThreshold',    label: 'Total API Threshold (TTD)',     type: 'currency' },
      { path: 'avgApiThreshold',      label: 'Avg API Threshold (TTD)',       type: 'currency' },
      { path: 'agentCountMin',        label: 'Min Agent Count',               type: 'count'    },
      { path: 'newAdvisorsMin',       label: 'Min New Advisors',              type: 'count'    },
      { path: 'persistGate',          label: 'Persistency Gate (%)',           type: 'percent'  },
      { path: 'totalApiInContention', label: 'Total API In-Contention (TTD)', type: 'currency' },
      { path: 'prize',                label: 'Prize',                         type: 'text'     },
    ],
  },
];

// Schema for the 4 array-driven groups (P-b). Each entry describes the array's
// element shape, field types, nullability, and how to read/write it in the payload.
const ARRAY_GROUP_SCHEMAS = [
  {
    key:      'clubAward',
    label:    'Club Award — Tiers',
    category: 'Agent Awards',
    getArray: (ruleset) => ruleset?.clubAward?.tiers ?? [],
    setArray: (payload, arr) => { payload.clubAward.tiers = arr; },
    makeRow:  () => ({ id: '', name: '', apiMin: '', apiMax: '', apiInContention: '', prize: '' }),
    fields: [
      { key: 'id',              label: 'ID',                            type: 'text',     nullable: false },
      { key: 'name',            label: 'Name',                          type: 'text',     nullable: false },
      { key: 'apiMin',          label: 'API Min (TTD)',                  type: 'currency', nullable: false },
      { key: 'apiMax',          label: 'API Max (TTD, optional)',        type: 'currency', nullable: true  },
      { key: 'apiInContention', label: 'API In-Contention (TTD)',        type: 'currency', nullable: false },
      { key: 'prize',           label: 'Prize',                         type: 'text',     nullable: false },
    ],
  },
  {
    key:      'managerMonthlyBonus',
    label:    'Agency Monthly Production Bonus — Tiers',
    category: 'Manager Awards',
    getArray: (ruleset) => ruleset?.managerMonthlyBonus?.tiers ?? [],
    setArray: (payload, arr) => { payload.managerMonthlyBonus.tiers = arr; },
    makeRow:  () => ({ minAvgApi: '', bonusPct: '' }),
    fields: [
      { key: 'minAvgApi', label: 'Min Avg API (TTD)', type: 'currency', nullable: false },
      { key: 'bonusPct',  label: 'Bonus %',           type: 'percent',  nullable: false },
    ],
  },
  {
    key:      'recruitingAwards',
    label:    'Recruiting Awards',
    category: 'Manager Awards',
    getArray: (ruleset) => ruleset?.recruitingAwards ?? [],
    setArray: (payload, arr) => { payload.recruitingAwards = arr; },
    makeRow:  () => ({ id: '', name: '', min: '', max: '', prize: '' }),
    fields: [
      { key: 'id',    label: 'ID',                    type: 'text',  nullable: false },
      { key: 'name',  label: 'Name',                  type: 'text',  nullable: false },
      { key: 'min',   label: 'Min',                   type: 'count', nullable: false },
      { key: 'max',   label: 'Max (optional)',         type: 'count', nullable: true  },
      { key: 'prize', label: 'Prize',                 type: 'text',  nullable: false },
    ],
  },
  {
    key:      'activityAwards',
    label:    'Activity Awards',
    category: 'Manager Awards',
    getArray: (ruleset) => ruleset?.activityAwards ?? [],
    setArray: (payload, arr) => { payload.activityAwards = arr; },
    makeRow:  () => ({ id: '', name: '', target: '', prize: '' }),
    fields: [
      { key: 'id',     label: 'ID',     type: 'text',  nullable: false },
      { key: 'name',   label: 'Name',   type: 'text',  nullable: false },
      { key: 'target', label: 'Target', type: 'count', nullable: false },
      { key: 'prize',  label: 'Prize',  type: 'text',  nullable: false },
    ],
  },
];

// ── Utilities ──────────────────────────────────────────────────────────────────

function getAt(obj, dotPath) {
  return dotPath.split('.').reduce((o, k) => o?.[k], obj);
}

function setAt(obj, dotPath, value) {
  const keys = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function initFormState(ruleset) {
  const state = {};
  for (const { key, fields } of SCALAR_GROUPS) {
    for (const { path, type } of fields) {
      const fullPath = `${key}.${path}`;
      const val = getAt(ruleset, fullPath);
      state[fullPath] = type === 'bool' ? !!val : String(val ?? '');
    }
  }
  return state;
}

// Converts a raw ruleset's array groups into string-keyed form-state maps so inputs
// can be controlled consistently. null numeric values (open-ended tier markers like
// apiMax / max) become '' for display; parseBack reverses this on save.
function initArrayState(ruleset) {
  const state = {};
  for (const schema of ARRAY_GROUP_SCHEMAS) {
    const rawArr = schema.getArray(ruleset);
    state[schema.key] = rawArr.map((el) => {
      const row = {};
      for (const f of schema.fields) {
        const v = el[f.key];
        row[f.key] = (v === null || v === undefined) ? '' : String(v);
      }
      return row;
    });
  }
  return state;
}

function buildPayload(loadedRuleset, formState, arrayState) {
  const payload = JSON.parse(JSON.stringify(loadedRuleset));

  // Scalars
  for (const { key, fields } of SCALAR_GROUPS) {
    for (const { path, type } of fields) {
      const fullPath = `${key}.${path}`;
      const val = formState[fullPath];
      if (type === 'bool') {
        setAt(payload, fullPath, !!val);
      } else if (type === 'text') {
        setAt(payload, fullPath, String(val ?? '').trim());
      } else {
        setAt(payload, fullPath, parseFloat(val));
      }
    }
  }

  // Arrays — inject edited rows, parsing strings back to typed values
  for (const schema of ARRAY_GROUP_SCHEMAS) {
    const rows = arrayState[schema.key] ?? [];
    const parsed = rows.map((row) => {
      const el = {};
      for (const f of schema.fields) {
        const raw = String(row[f.key] ?? '').trim();
        if (f.type === 'text') {
          el[f.key] = raw;
        } else if (f.nullable && raw === '') {
          el[f.key] = null;
        } else {
          el[f.key] = parseFloat(raw);
        }
      }
      return el;
    });
    schema.setArray(payload, parsed);
  }

  return payload;
}

// ── Field input row ────────────────────────────────────────────────────────────

function FieldRow({ id, label, type, value, error, onChange, onBlur }) {
  if (type === 'bool') {
    return (
      <div className="sm:col-span-2 flex items-center justify-between gap-4 h-11">
        <span className="text-sm text-ink">{label}</span>
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 accent-primary rounded"
        />
      </div>
    );
  }

  function strip(raw) {
    if (type === 'count') return raw.replace(/[^0-9]/g, '');
    return raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  }

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode={type === 'text' ? 'text' : type === 'count' ? 'numeric' : 'decimal'}
          value={value}
          onChange={(e) => onChange(type === 'text' ? e.target.value : strip(e.target.value))}
          onBlur={onBlur}
          maxLength={type === 'text' ? 100 : undefined}
          className={`flex-1 h-11 px-3 rounded-lg border ${error ? 'border-red-400 dark:border-red-600' : 'border-border'} bg-card text-ink text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
        />
        {type === 'percent' && (
          <span className="text-xs text-ink-muted shrink-0">%</span>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertTriangle size={11} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {boolean} [props.embedded]  When true, suppresses the outer `card mt-4`
 *   chrome AND the Trophy header block so the panel can be hosted inside the
 *   Company Config surface's gold "AWARD CATALOG" group card (Run 5, Item D:
 *   the awards exception). Default false → byte-identical prior behavior.
 */
export default function AwardsRulesetPanel({ embedded = false }) {
  const { tenantId, user } = useAuth();

  const [ruleset,          setRuleset]          = useState(null);
  const [formState,        setFormState]        = useState(null);
  const [initialFormState, setInitialFormState] = useState(null);
  const [arrayState,       setArrayState]       = useState(null);
  const [initialArrayState,setInitialArrayState]= useState(null);
  const [loading,          setLoading]          = useState(true);
  const [loadError,        setLoadError]        = useState(null);
  const [saving,           setSaving]           = useState(false);
  const [saveError,        setSaveError]        = useState(null);
  const [saveSuccess,      setSaveSuccess]      = useState(false);
  const [allTouched,       setAllTouched]       = useState(false);
  const [touched,          setTouched]          = useState(() => new Set());
  const [openSections,     setOpenSections]     = useState(() => new Set());

  const loadRuleset = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAwardsRuleset(tenantId, 2026);
      const init = initFormState(data);
      setRuleset(data);
      setFormState({ ...init });
      setInitialFormState({ ...init });
      setArrayState(initArrayState(data));
      setInitialArrayState(initArrayState(data));
    } catch (err) {
      setLoadError(err?.message ?? 'Failed to load awards ruleset.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadRuleset(); }, [loadRuleset]);

  function handleFieldChange(fullPath, val) {
    setFormState((prev) => ({ ...prev, [fullPath]: val }));
    setSaveSuccess(false);
  }

  function handleTouch(fullPath) {
    setTouched((prev) => {
      const next = new Set(prev);
      next.add(fullPath);
      return next;
    });
  }

  function handleArrayAdd(schemaKey) {
    const schema = ARRAY_GROUP_SCHEMAS.find((s) => s.key === schemaKey);
    setArrayState((prev) => ({ ...prev, [schemaKey]: [...prev[schemaKey], schema.makeRow()] }));
    setSaveSuccess(false);
  }

  function handleArrayRemove(schemaKey, rowIdx) {
    setArrayState((prev) => ({
      ...prev,
      [schemaKey]: prev[schemaKey].filter((_, i) => i !== rowIdx),
    }));
    setSaveSuccess(false);
  }

  function handleArrayFieldChange(schemaKey, rowIdx, fieldKey, val) {
    setArrayState((prev) => {
      const rows = [...prev[schemaKey]];
      rows[rowIdx] = { ...rows[rowIdx], [fieldKey]: val };
      return { ...prev, [schemaKey]: rows };
    });
    setSaveSuccess(false);
  }

  function toggleSection(key) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const validationErrors = useMemo(() => {
    if (!formState) return {};
    const errors = {};
    for (const { key, fields } of SCALAR_GROUPS) {
      for (const { path, type } of fields) {
        const fullPath = `${key}.${path}`;
        if (!allTouched && !touched.has(fullPath)) continue;
        if (type === 'bool') continue;
        const val = formState[fullPath];
        if (type === 'text') {
          if (!val || val.trim() === '') errors[fullPath] = 'Required.';
          continue;
        }
        if (!val && val !== 0) { errors[fullPath] = 'Required.'; continue; }
        const n = parseFloat(val);
        if (!Number.isFinite(n)) { errors[fullPath] = 'Must be a number.'; continue; }
        if (n < 0) errors[fullPath] = 'Must be non-negative.';
      }
    }
    return errors;
  }, [formState, touched, allTouched]);

  // Per-row, per-field errors for array groups — only shown after allTouched (Save click)
  const arrayValidationErrors = useMemo(() => {
    if (!arrayState || !allTouched) return {};
    const result = {};
    for (const schema of ARRAY_GROUP_SCHEMAS) {
      const rows = arrayState[schema.key] ?? [];
      const schemaErrs = {};
      rows.forEach((row, rowIdx) => {
        const rowErrs = {};
        for (const f of schema.fields) {
          const v = String(row[f.key] ?? '');
          let err = null;
          if (f.type === 'text') {
            if (!v || v.trim() === '') err = 'Required.';
          } else {
            const trimmed = v.trim();
            if (f.nullable && trimmed === '') {
              // empty nullable is valid (→ null in payload)
            } else if (!trimmed) {
              err = 'Required.';
            } else {
              const n = parseFloat(trimmed);
              if (!Number.isFinite(n)) err = 'Must be a number.';
              else if (n < 0) err = 'Must be non-negative.';
            }
          }
          if (err) rowErrs[f.key] = err;
        }
        if (Object.keys(rowErrs).length > 0) schemaErrs[rowIdx] = rowErrs;
      });
      if (Object.keys(schemaErrs).length > 0) result[schema.key] = schemaErrs;
    }
    return result;
  }, [arrayState, allTouched]);

  const hasErrors = useMemo(() => {
    if (!formState) return false;
    // Scalar checks
    for (const { key, fields } of SCALAR_GROUPS) {
      for (const { path, type } of fields) {
        if (type === 'bool') continue;
        const val = formState[`${key}.${path}`];
        if (type === 'text') { if (!val || val.trim() === '') return true; continue; }
        if (!val && val !== 0) return true;
        const n = parseFloat(val);
        if (!Number.isFinite(n) || n < 0) return true;
      }
    }
    // Array row checks
    for (const schema of ARRAY_GROUP_SCHEMAS) {
      const rows = arrayState?.[schema.key] ?? [];
      for (const row of rows) {
        for (const f of schema.fields) {
          const v = String(row[f.key] ?? '');
          if (f.type === 'text') {
            if (!v || v.trim() === '') return true;
          } else {
            const trimmed = v.trim();
            if (f.nullable && trimmed === '') continue;
            if (!trimmed) return true;
            const n = parseFloat(trimmed);
            if (!Number.isFinite(n) || n < 0) return true;
          }
        }
      }
    }
    return false;
  }, [formState, arrayState]);

  const isDirty = useMemo(() => {
    if (!formState || !initialFormState) return false;
    if (JSON.stringify(formState) !== JSON.stringify(initialFormState)) return true;
    if (!arrayState || !initialArrayState) return false;
    return JSON.stringify(arrayState) !== JSON.stringify(initialArrayState);
  }, [formState, initialFormState, arrayState, initialArrayState]);

  const canSave = !saving && !hasErrors && isDirty;

  async function handleSave() {
    setAllTouched(true);
    if (hasErrors) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const payload = buildPayload(ruleset, formState, arrayState);
      await setAwardsRuleset(tenantId, 2026, payload, user?.uid ?? null);
      setSaveSuccess(true);
      await loadRuleset();
    } catch (err) {
      const code = err?.code ?? '';
      let message;
      if (code === 'permission-denied') {
        message = "You don't have permission to update the awards ruleset.";
      } else if (['unavailable', 'deadline-exceeded', 'cancelled'].includes(code)) {
        message = "Couldn't reach the server. Check your connection and try again.";
      } else if (['aborted', 'failed-precondition'].includes(code)) {
        message = 'Someone else just updated this. Refresh to see the latest.';
      } else {
        message = err?.message ?? 'Save failed. Please try again.';
      }
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  function groupHasErrors(groupKey) {
    if (Object.keys(validationErrors).some((k) => k.startsWith(`${groupKey}.`))) return true;
    return !!arrayValidationErrors[groupKey] && Object.keys(arrayValidationErrors[groupKey]).length > 0;
  }

  return (
    <section
      aria-labelledby={embedded ? undefined : 'awards-ruleset-heading'}
      aria-label={embedded ? 'Awards ruleset — 2026' : undefined}
      className={embedded ? '' : 'card mt-4'}
    >
      {!embedded && (
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <Trophy size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 id="awards-ruleset-heading" className="text-lg font-bold text-ink">
              Awards Ruleset — 2026
            </h2>
            <p className="text-sm text-ink-muted mt-0.5">
              Configure award thresholds and criteria for agents and managers.
              Saving writes the complete ruleset (all 16 groups, scalars and arrays).
            </p>
          </div>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2 flex-wrap"
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span className="flex-1 min-w-[200px]">{loadError}</span>
          <button
            type="button"
            onClick={loadRuleset}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !loadError && (
        <PanelSkeleton variant="list" count={5} label="Loading ruleset…" />
      )}

      {!loading && !loadError && formState && arrayState && (
        <div className="space-y-2">
          {/* ── Scalar groups ── */}
          {SCALAR_GROUPS.map((group, idx) => {
            const prevCategory = idx > 0 ? SCALAR_GROUPS[idx - 1].category : null;
            const isOpen = openSections.has(group.key);
            const groupErrors = groupHasErrors(group.key);

            return (
              <React.Fragment key={group.key}>
                {group.category !== prevCategory && (
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted pt-3 pb-1">
                    {group.category}
                  </div>
                )}

                <div className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(group.key)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-3 py-3 px-4 bg-card-raised hover:bg-primary/5 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                  >
                    <span className="font-semibold text-sm text-ink">{group.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {groupErrors && (
                        <AlertTriangle size={14} className="text-red-500" aria-hidden="true" />
                      )}
                      {isOpen
                        ? <ChevronDown  size={16} className="text-ink-muted" aria-hidden="true" />
                        : <ChevronRight size={16} className="text-ink-muted" aria-hidden="true" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-3 border-t border-border">
                      {group.note && (
                        <p className="text-xs text-ink-muted mb-3">{group.note}</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                        {group.fields.map((field, fIdx) => {
                          const fullPath = `${group.key}.${field.path}`;
                          const fieldId  = `arf-${fullPath.replace(/\./g, '-')}`;
                          const prevSub  = fIdx > 0 ? group.fields[fIdx - 1].subGroup : null;
                          const showSubHeading = field.subGroup && field.subGroup !== prevSub;

                          return (
                            <React.Fragment key={field.path}>
                              {showSubHeading && (
                                <div className="sm:col-span-2 text-xs font-semibold text-primary uppercase tracking-wide pt-2">
                                  {field.subGroup}
                                </div>
                              )}
                              <FieldRow
                                id={fieldId}
                                label={field.label}
                                type={field.type}
                                value={formState[fullPath] ?? ''}
                                error={validationErrors[fullPath]}
                                onChange={(val) => handleFieldChange(fullPath, val)}
                                onBlur={() => handleTouch(fullPath)}
                              />
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          {/* ── Array groups (editable row editors) ── */}
          {ARRAY_GROUP_SCHEMAS.map((schema, idx) => {
            const prevCategory = idx > 0 ? ARRAY_GROUP_SCHEMAS[idx - 1].category : null;
            const isOpen   = openSections.has(schema.key);
            const rows     = arrayState[schema.key] ?? [];
            const schemaErrors = arrayValidationErrors[schema.key];
            const groupErrors  = !!schemaErrors && Object.keys(schemaErrors).length > 0;

            return (
              <React.Fragment key={schema.key}>
                {schema.category !== prevCategory && (
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted pt-3 pb-1">
                    {schema.category}
                  </div>
                )}

                <div className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(schema.key)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-3 py-3 px-4 bg-card-raised hover:bg-primary/5 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                  >
                    <span className="font-semibold text-sm text-ink">{schema.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-ink-muted">{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
                      {groupErrors && (
                        <AlertTriangle size={14} className="text-red-500" aria-hidden="true" />
                      )}
                      {isOpen
                        ? <ChevronDown  size={16} className="text-ink-muted" aria-hidden="true" />
                        : <ChevronRight size={16} className="text-ink-muted" aria-hidden="true" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-3 border-t border-border space-y-3">
                      {rows.map((row, rowIdx) => (
                        <div key={rowIdx} className="rounded-lg border border-border bg-card-raised p-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                            {schema.fields.map((f) => {
                              const fieldId = `arf-${schema.key}-${rowIdx}-${f.key}`;
                              const err = schemaErrors?.[rowIdx]?.[f.key];
                              return (
                                <FieldRow
                                  key={f.key}
                                  id={fieldId}
                                  label={f.label}
                                  type={f.type}
                                  value={row[f.key] ?? ''}
                                  error={err}
                                  onChange={(val) => handleArrayFieldChange(schema.key, rowIdx, f.key, val)}
                                  onBlur={() => {}}
                                />
                              );
                            })}
                          </div>
                          <div className="flex justify-end mt-3">
                            <button
                              type="button"
                              onClick={() => handleArrayRemove(schema.key, rowIdx)}
                              disabled={rows.length <= 1}
                              aria-label={`Remove row ${rowIdx + 1}`}
                              className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleArrayAdd(schema.key)}
                        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors min-h-11 px-2"
                      >
                        <Plus size={16} aria-hidden="true" />
                        Add row
                      </button>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          {/* ── Save bar ── */}
          <div className="pt-4 border-t border-border mt-2">
            {saveError && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>{saveError}</span>
              </div>
            )}
            {saveSuccess && (
              <div
                role="status"
                aria-live="polite"
                className="mb-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300 flex items-center gap-2"
              >
                <CheckCircle size={16} aria-hidden="true" />
                <span>Ruleset saved successfully.</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>Save ruleset</span>
              )}
            </button>
            {!isDirty && !saving && (
              <p className="mt-2 text-xs text-ink-muted">No changes to save.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
