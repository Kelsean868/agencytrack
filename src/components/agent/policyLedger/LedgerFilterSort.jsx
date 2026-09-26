/**
 * LedgerFilterSort — L2 (docs/briefs/ledger-lens-build.md § L2). Mobile filter
 * & sort SHEET (D2 mockup) + desktop filter RAIL (D3 mockup), active-filter
 * chips row, view chips row + "Save as a view". Filter/sort logic itself lives
 * in `src/lib/ledgerFilters.js` (pure) — this file is presentational plumbing
 * over that single source, so the sheet, the rail, the chips and the counts
 * can never disagree.
 *
 * Rows-wrap non-negotiable (v3 #7): every chip row is `flex-wrap` with a row
 * gap. Shrink-victim non-negotiable (v3 #8): chip labels wrap/ellipsis before
 * a count badge is crushed — counts are `flex: 0 0 auto` via `shrink-0`.
 */
import React, { useId, useMemo, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  buildFilterSections,
  emptyFilterState,
  hasActiveFilters,
  optionCounts,
  SORTS,
  toDisplayDate,
  toStoredDate,
} from '../../../lib/ledgerFilters';
import { useLedgerSavedViews } from '../../../hooks/useLedgerSavedViews';

function chipBtnClass(on) {
  return `min-h-9 shrink-0 rounded-full border px-3 text-[13px] font-semibold transition-colors ${
    on ? 'border-primary bg-primary-tint text-primary' : 'border-border bg-card text-ink hover:border-primary/40'
  }`;
}

function TagOption({ section, option, active, onToggle, count }) {
  const on = active.has(option.value);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onToggle(section.key, option.value)}
      className={chipBtnClass(on)}
      data-testid={`ledger-filter-opt-${section.key}-${option.value}`}
    >
      {option.label}{count != null && <span className="ml-1 shrink-0 text-ink-muted">{count}</span>}
    </button>
  );
}

/** The shared fieldset body — used inside both the mobile sheet and the desktop rail. */
function FilterFields({ sections, rows, state, onToggle, onDateType, onDateFrom, onDateTo, onApiMin, onApiMax }) {
  return (
    <div className="flex flex-col gap-3">
      {sections.map((section) => (
        <fieldset key={section.key} className="flex flex-col gap-1.5 border-0 border-t border-border/60 p-0 pt-3 first:border-t-0 first:pt-0">
          <legend className="mb-1 w-full px-0 text-[13px] font-bold text-ink">{section.label}</legend>
          {section.options.length === 0 ? (
            <p className="text-xs text-ink-muted">Nothing here yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {section.options.map((opt) => (
                <TagOption
                  key={opt.value}
                  section={section}
                  option={opt}
                  active={state[section.key]}
                  onToggle={onToggle}
                  count={optionCounts(rows, state, sections, section.key)[opt.value]}
                />
              ))}
            </div>
          )}
        </fieldset>
      ))}

      <fieldset className="flex flex-col gap-1.5 border-0 border-t border-border/60 p-0 pt-3">
        <legend className="mb-1 w-full px-0 text-[13px] font-bold text-ink">Date</legend>
        <div className="flex flex-wrap gap-1.5">
          {[{ v: 'issue', l: 'Issue date' }, { v: 'submit', l: 'Submit date' }].map((d) => (
            <button
              key={d.v}
              type="button"
              aria-pressed={state.dateType === d.v}
              onClick={() => onDateType(d.v)}
              className={chipBtnClass(state.dateType === d.v)}
              data-testid={`ledger-filter-datetype-${d.v}`}
            >
              {d.l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-ink-muted">From</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="01-07-2026"
              defaultValue={toDisplayDate(state.dateFrom)}
              onBlur={(e) => onDateFrom(toStoredDate(e.target.value))}
              className="h-11 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-ink"
              data-testid="ledger-filter-date-from"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-ink-muted">To</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="31-12-2026"
              defaultValue={toDisplayDate(state.dateTo)}
              onBlur={(e) => onDateTo(toStoredDate(e.target.value))}
              className="h-11 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-ink"
              data-testid="ledger-filter-date-to"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5 border-0 border-t border-border/60 p-0 pt-3">
        <legend className="mb-1 w-full px-0 text-[13px] font-bold text-ink">API (TTD)</legend>
        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-ink-muted">Min</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              defaultValue={state.apiMin ?? ''}
              onBlur={(e) => onApiMin(e.target.value === '' ? null : parseFloat(e.target.value))}
              className="h-11 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-ink"
              data-testid="ledger-filter-api-min"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-ink-muted">Max</span>
            <input
              type="number"
              min="0"
              placeholder="Any"
              defaultValue={state.apiMax ?? ''}
              onBlur={(e) => onApiMax(e.target.value === '' ? null : parseFloat(e.target.value))}
              className="h-11 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-ink"
              data-testid="ledger-filter-api-max"
            />
          </label>
        </div>
      </fieldset>
    </div>
  );
}

/**
 * A CUSTOM-drawn radio dot, not the native `<input type="radio">` appearance.
 *
 * v3 non-negotiable #6: "fix the ink, not the fill" — but a native radio's
 * unchecked ring/fill is drawn by the browser's OWN light-scheme form-control
 * theme when the page never sets `color-scheme`, which this app's global CSS
 * does not. Measured, not assumed (orchestrator design review, PR 982): in
 * `.dark`, `accent-primary` alone left every one of the five radios — checked
 * AND unchecked alike — rendering as a solid white disc, indistinguishable
 * from each other. There is no "ink" on a native control to retarget without
 * either a global `color-scheme` change (out of this PR's narrow scope) or
 * per-input inline styles (forbidden — CLAUDE.md UI rules). A custom visual
 * sibling, built from the SAME token classes every other chip on this surface
 * already uses (`border-border` / `bg-primary`), sidesteps the native
 * light-only default in both themes at once. The real `<input>` stays for
 * semantics/keyboard/focus (`sr-only`, `peer`) — nothing about the radio
 * GROUP's behaviour changes, only how the unselected/selected state is drawn.
 */
function RadioDot({ checked }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        checked ? 'border-primary bg-primary' : 'border-border bg-card'
      } peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-1`}
    >
      {checked && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
    </span>
  );
}

function SortFields({ sortKey, onSort }) {
  const labelId = useId();
  return (
    <fieldset className="flex flex-col gap-1 border-0 p-0">
      <legend id={labelId} className="mb-1 w-full px-0 text-[13px] font-bold text-ink">Sort by</legend>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col">
        {SORTS.map((s) => {
          const checked = sortKey === s.key;
          return (
            <label key={s.key} className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-ink">
              <input
                type="radio"
                name="ledger-sort"
                checked={checked}
                onChange={() => onSort(s.key)}
                className="peer sr-only"
              />
              <RadioDot checked={checked} />
              <span className={checked ? 'font-bold' : ''}>{s.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function LedgerFilterSort({
  rows,
  filters,
  onFiltersChange,
  sortKey,
  onSortChange,
  hasCampaign,
  campaignLabel,
  actions,
  children,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const sections = useMemo(() => buildFilterSections(rows), [rows]);
  const { views, saveView, deleteView } = useLedgerSavedViews();
  const [activeViewId, setActiveViewId] = useState('__all__');

  function toggleTag(sectionKey, value) {
    onFiltersChange((prev) => {
      const next = new Set(prev[sectionKey]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [sectionKey]: next };
    });
    setActiveViewId(null);
  }

  function clearAll() {
    onFiltersChange(() => emptyFilterState());
    setActiveViewId('__all__');
  }

  function applyBuiltIn(view) {
    onFiltersChange(() => ({
      ...emptyFilterState(),
      countsGroup: new Set(view.filters.countsGroup ?? []),
    }));
    setActiveViewId(view.id);
  }

  function applySavedView(view) {
    const f = view.filters;
    onFiltersChange(() => ({
      countsGroup: new Set(f.countsGroup ?? []),
      status: new Set(f.status ?? []),
      source: new Set(f.source ?? []),
      who: new Set(f.who ?? []),
      product: new Set(f.product ?? []),
      frequency: new Set(f.frequency ?? []),
      dateType: f.dateType ?? 'issue',
      dateFrom: f.dateFrom ?? null,
      dateTo: f.dateTo ?? null,
      apiMin: f.apiMin ?? null,
      apiMax: f.apiMax ?? null,
    }));
    if (view.sortKey) onSortChange(view.sortKey);
    setActiveViewId(view.id);
  }

  function handleSaveView() {
    const label = window.prompt('Name this view');
    if (!label) return;
    const id = `v_${Date.now()}`;
    saveView({ id, label, savedAt: new Date().toISOString(), sortKey, filters: { ...filters } });
    setActiveViewId(id);
  }

  const builtins = [{ id: '__all__', label: 'All policies', filters: emptyFilterState(), builtin: true }];
  if (hasCampaign) {
    builtins.push({
      id: '__campaign__',
      label: campaignLabel ? `★ ${campaignLabel}` : '★ Campaign',
      filters: { ...emptyFilterState(), countsGroup: new Set(['counting', 'pending']) },
      builtin: true,
    });
  }

  // Chips describing every currently-active filter (for the "active" row).
  const activeChips = [];
  for (const section of sections) {
    for (const v of filters[section.key] ?? []) {
      const opt = section.options.find((o) => o.value === v);
      activeChips.push({ key: `${section.key}:${v}`, label: opt?.label ?? v, onRemove: () => toggleTag(section.key, v) });
    }
  }
  if (filters.dateFrom || filters.dateTo) {
    activeChips.push({
      key: 'date',
      label: `${filters.dateType === 'submit' ? 'Submitted' : 'Issued'} ${filters.dateFrom ? toDisplayDate(filters.dateFrom) : '…'} – ${filters.dateTo ? toDisplayDate(filters.dateTo) : '…'}`,
      onRemove: () => onFiltersChange((p) => ({ ...p, dateFrom: null, dateTo: null })),
    });
  }
  if (filters.apiMin != null || filters.apiMax != null) {
    activeChips.push({
      key: 'api',
      label: `API ${filters.apiMin ?? 0}–${filters.apiMax ?? 'any'}`,
      onRemove: () => onFiltersChange((p) => ({ ...p, apiMin: null, apiMax: null })),
    });
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid="ledger-filter-sort">
      {/* View chips row (+ Export, aligned the same row as D3's page-header
          placement approximates at this component's scope) */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <nav aria-label="Saved views" className="flex flex-wrap items-center gap-1.5" data-testid="ledger-view-chips">
          {[...builtins, ...views].map((v) => (
            <button
              key={v.id}
              type="button"
              aria-current={activeViewId === v.id ? 'page' : undefined}
              onClick={() => (v.builtin ? applyBuiltIn(v) : applySavedView(v))}
              className={chipBtnClass(activeViewId === v.id)}
              data-testid={`ledger-view-${v.id}`}
            >
              {v.label}
            </button>
          ))}
          <button type="button" onClick={handleSaveView} className="min-h-9 shrink-0 rounded-full border border-dashed border-border px-3 text-[13px] font-semibold text-ink-muted hover:text-ink" data-testid="ledger-save-view">
            + Save view
          </button>
        </nav>
        {actions}
      </div>

      {/* Active filter chips row */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="ledger-active-chips">
          {activeChips.map((c) => (
            <span key={c.key} className="flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-xs font-semibold text-ink">
              {c.label}
              <button type="button" onClick={c.onRemove} aria-label={`Remove ${c.label} filter`} className="text-ink-muted hover:text-ink">
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          <button type="button" onClick={clearAll} className="text-xs font-bold text-primary" data-testid="ledger-clear-all">Clear</button>
        </div>
      )}

      {/* Mobile trigger -> sheet */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-ink"
          data-testid="ledger-filter-sheet-trigger"
        >
          <SlidersHorizontal size={16} aria-hidden="true" /> Filter &amp; sort
        </button>
        {sheetOpen && (
          <div className="fixed inset-0 z-30 flex items-end bg-ink/45" role="presentation">
            <div role="dialog" aria-modal="true" aria-label="Filter and sort" className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-card">
              <div className="flex items-center gap-2 px-2 pb-2 pt-3">
                <h2 className="flex-1 pl-3 text-xl font-bold text-ink">Filter &amp; sort</h2>
                <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close" className="flex h-11 w-11 items-center justify-center text-ink">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-3">
                <SortFields sortKey={sortKey} onSort={onSortChange} />
                <div className="mt-1">
                  <FilterFields
                    sections={sections}
                    rows={rows}
                    state={filters}
                    onToggle={toggleTag}
                    onDateType={(v) => onFiltersChange((p) => ({ ...p, dateType: v }))}
                    onDateFrom={(v) => onFiltersChange((p) => ({ ...p, dateFrom: v }))}
                    onDateTo={(v) => onFiltersChange((p) => ({ ...p, dateTo: v }))}
                    onApiMin={(v) => onFiltersChange((p) => ({ ...p, apiMin: v }))}
                    onApiMax={(v) => onFiltersChange((p) => ({ ...p, apiMax: v }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2.5 border-t border-border px-5 py-4">
                <button type="button" onClick={handleSaveView} className="min-h-8 text-left text-sm font-bold text-primary">Save as a view…</button>
                <div className="flex gap-2.5">
                  <button type="button" onClick={clearAll} className="h-12 flex-none rounded-xl border border-border px-4 text-sm font-bold text-ink">Clear all</button>
                  <button type="button" onClick={() => setSheetOpen(false)} className="h-12 flex-1 rounded-xl bg-primary dark:bg-primary-dark text-sm font-bold text-white">
                    Show {rows.length} polic{rows.length === 1 ? 'y' : 'ies'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reachable escape hatch for deleting a saved view (no mockup control for
          this — kept minimal: a small list under the chips, desktop + mobile). */}
      {views.length > 0 && (
        <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer select-none">Manage saved views</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {views.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2">
                <span>{v.label}</span>
                <button type="button" onClick={() => deleteView(v.id)} className="font-semibold text-danger-ink" data-testid={`ledger-delete-view-${v.id}`}>Delete</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* D3: the filter rail sits in a LEFT COLUMN beside the table, not
          stacked above it — `children` (the table/groups/footer) renders in
          the same flex row as the rail so both share one layout, with the
          rail `hidden` (not present in the flow) below `lg`. */}
      <div className="flex items-start gap-5">
        <aside aria-label="Filters" className="hidden w-[230px] shrink-0 rounded-[18px] border border-border bg-card px-4 py-3 lg:block" data-testid="ledger-filter-rail">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-ink">Filters</span>
            {hasActiveFilters(filters) && <button type="button" onClick={clearAll} className="text-xs font-bold text-primary">Clear</button>}
          </div>
          <div className="mb-3">
            <SortFields sortKey={sortKey} onSort={onSortChange} />
          </div>
          <FilterFields
            sections={sections}
            rows={rows}
            state={filters}
            onToggle={toggleTag}
            onDateType={(v) => onFiltersChange((p) => ({ ...p, dateType: v }))}
            onDateFrom={(v) => onFiltersChange((p) => ({ ...p, dateFrom: v }))}
            onDateTo={(v) => onFiltersChange((p) => ({ ...p, dateTo: v }))}
            onApiMin={(v) => onFiltersChange((p) => ({ ...p, apiMin: v }))}
            onApiMax={(v) => onFiltersChange((p) => ({ ...p, apiMax: v }))}
          />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {children}
        </div>
      </div>
    </div>
  );
}
