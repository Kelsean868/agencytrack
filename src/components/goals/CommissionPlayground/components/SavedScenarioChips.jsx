import React, { useState } from 'react';
import { Bookmark, X, Plus, Loader2 } from 'lucide-react';
import { COMMISSION_SCENARIO_CAP } from '../../../../services/userPrefsService';

/**
 * SavedScenarioChips — Tier 3b R-06: saved Commission-Playground scenarios.
 *
 * A scenario is the current decomposition input set + cadence, saved under a
 * name so the agent can flip between "what if" versions without re-typing ten
 * fields. Chips APPLY on tap; the × removes one.
 *
 * AGENT-PRIVATE by construction: the parent persists through
 * `userPrefsService.setCommissionScenarios` → `users/{uid}/prefs/app`, whose
 * rules arm is `request.auth.uid == uid` for read AND write with no manager arm.
 * No shared/manager visibility exists to build or leak (R-06's constraint).
 *
 * Four states: empty (invitation) · saving (spinner on the save control) ·
 * list · at-cap (save disabled with the reason). The parent owns all writes.
 */
export default function SavedScenarioChips({
  scenarios = [], onApply, onSave, onDelete, saving = false, activeId = null,
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const atCap = scenarios.length >= COMMISSION_SCENARIO_CAP;

  const submit = () => {
    const label = name.trim();
    if (!label || saving || atCap) return;
    onSave?.(label);
    setName('');
    setNaming(false);
  };

  return (
    <div data-testid="scenario-chips" className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Bookmark size={13} className="text-ink-muted" aria-hidden="true" />
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
          Saved scenarios
        </span>
        <span className="text-[11px] text-ink-muted font-mono">
          {scenarios.length}/{COMMISSION_SCENARIO_CAP}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {scenarios.length === 0 && !naming && (
          <p data-testid="scenario-chips-empty" className="text-xs text-ink-muted italic">
            Save the current numbers as a scenario to compare “what ifs” later.
          </p>
        )}

        {scenarios.map((s) => (
          <span
            key={s.id}
            className={`inline-flex items-center rounded-full border overflow-hidden ${
              activeId === s.id ? 'border-primary bg-primary/10' : 'border-border bg-card-raised'
            }`}
          >
            <button
              type="button"
              onClick={() => onApply?.(s)}
              data-testid={`scenario-apply-${s.id}`}
              title="Apply this scenario"
              className="min-h-[44px] pl-3 pr-2 text-xs font-semibold text-ink-muted hover:text-primary transition-colors max-w-[12rem] truncate"
            >
              {s.label}
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(s.id)}
              data-testid={`scenario-delete-${s.id}`}
              aria-label={`Delete scenario ${s.label}`}
              className="min-h-[44px] px-2 flex items-center justify-center text-ink-muted hover:text-danger-ink border-l border-border transition-colors"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}

        {naming ? (
          <span className="inline-flex items-center gap-1.5">
            <label htmlFor="scenario-name" className="sr-only">Scenario name</label>
            <input
              id="scenario-name"
              data-testid="scenario-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setNaming(false); setName(''); } }}
              maxLength={40}
              placeholder="e.g. Stretch goal"
              className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!name.trim() || saving}
              data-testid="scenario-save-confirm"
              className="min-h-[44px] px-3 rounded-lg bg-primary dark:bg-primary-dark text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : 'Save'}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            disabled={atCap || saving}
            data-testid="scenario-save-open"
            title={atCap ? `Limit is ${COMMISSION_SCENARIO_CAP} — delete one first` : 'Save the current numbers'}
            className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full border border-dashed border-border text-xs font-semibold text-ink-muted hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            <Plus size={13} aria-hidden="true" />
            {atCap ? `Limit ${COMMISSION_SCENARIO_CAP}` : 'Save current'}
          </button>
        )}
      </div>
    </div>
  );
}
