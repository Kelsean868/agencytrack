import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, ChevronDown, ChevronRight, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAwardsRuleset, setAwardsRuleset } from '../../services/awardsRulesetService';

// Field schema for the 12 scalar-only award groups (P-a).
// Array groups (clubAward.tiers, managerMonthlyBonus.tiers, recruitingAwards,
// activityAwards) are read-only here; their editors ship in P-b.
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
    fields: [
      { path: 'apiThreshold',    label: 'API Threshold (TTD)',     type: 'currency' },
      { path: 'apiInContention', label: 'API In-Contention (TTD)', type: 'currency' },
      { path: 'prize',           label: 'Prize',                   type: 'text'     },
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

// Rendered read-only in P-a; tier/array editors ship in P-b.
const ARRAY_GROUPS = [
  { key: 'clubAward',           label: 'Club Award — Tiers'                       },
  { key: 'managerMonthlyBonus', label: 'Agency Monthly Production Bonus — Tiers'  },
  { key: 'recruitingAwards',    label: 'Recruiting Awards'                        },
  { key: 'activityAwards',      label: 'Activity Awards'                          },
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

function buildPayload(loadedRuleset, formState) {
  const payload = JSON.parse(JSON.stringify(loadedRuleset));
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
  return payload;
}

function arrayGroupSummary(ruleset, key) {
  const group = ruleset?.[key];
  if (!group) return '—';
  if (Array.isArray(group)) return `${group.length} item${group.length !== 1 ? 's' : ''}`;
  const tiers = group.tiers;
  if (Array.isArray(tiers)) return `${tiers.length} tier${tiers.length !== 1 ? 's' : ''}`;
  return '—';
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

export default function AwardsRulesetPanel() {
  const { tenantId, user } = useAuth();

  const [ruleset,          setRuleset]          = useState(null);
  const [formState,        setFormState]        = useState(null);
  const [initialFormState, setInitialFormState] = useState(null);
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

  const hasErrors = useMemo(() => {
    if (!formState) return false;
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
    return false;
  }, [formState]);

  const isDirty = useMemo(() => {
    if (!formState || !initialFormState) return false;
    return JSON.stringify(formState) !== JSON.stringify(initialFormState);
  }, [formState, initialFormState]);

  const canSave = !saving && !hasErrors && isDirty;

  async function handleSave() {
    setAllTouched(true);
    if (hasErrors) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const payload = buildPayload(ruleset, formState);
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
    return Object.keys(validationErrors).some((k) => k.startsWith(`${groupKey}.`));
  }

  return (
    <section aria-labelledby="awards-ruleset-heading" className="card mt-4">
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
            Saving writes the complete ruleset — arrays (club tiers, recruiting, activity) are
            carried through unchanged and editable in a follow-up.
          </p>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2"
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {loading && !loadError && (
        <div className="flex items-center gap-2 py-6 text-ink-muted text-sm">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          <span>Loading ruleset…</span>
        </div>
      )}

      {!loading && !loadError && formState && (
        <div className="space-y-2">
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

          <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted pt-3 pb-1">
            Array-Driven Groups — Read-only in this release
          </div>

          {ARRAY_GROUPS.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-xl border border-dashed border-border px-4 py-3 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {arrayGroupSummary(ruleset, key)} · Tier/array editing coming in a follow-up
                </p>
              </div>
            </div>
          ))}

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
