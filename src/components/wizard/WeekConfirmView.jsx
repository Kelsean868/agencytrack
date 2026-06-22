import React, { useState } from 'react';
import { Minus, Plus, Pencil, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

// ── Local atoms ────────────────────────────────────────────────────────────────

function IntStepper({ value, onChange, ariaLabel }) {
  const v = parseInt(value, 10) || 0;
  // FU-a: hold the raw string while the field is focused so partial entry
  // (empty field, mid-typing) isn't coerced to a number on every keystroke.
  // Commit the parsed int on blur/Enter. draft === null ⇒ show committed value.
  const [draft, setDraft] = useState(null);
  const display = draft !== null ? draft : (v === 0 ? '' : String(v));
  const base = () => (draft === null ? v : (parseInt(draft.replace(/[^0-9]/g, ''), 10) || 0));
  const commit = () => {
    if (draft === null) return;
    const cleaned = draft.replace(/[^0-9]/g, '');
    onChange(cleaned === '' ? 0 : parseInt(cleaned, 10));
    setDraft(null);
  };
  const bump = (delta) => {
    const next = Math.max(0, base() + delta);
    setDraft(null);
    onChange(next);
  };
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${ariaLabel} decrease`}
        onClick={() => bump(-1)}
        disabled={base() <= 0}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary disabled:opacity-40 transition-colors"
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={display}
        placeholder="0"
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-12 h-11 text-center rounded-lg border border-border bg-surface text-ink text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="button"
        aria-label={`${ariaLabel} increase`}
        onClick={() => bump(1)}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function DecimalStepper({ value, onChange, ariaLabel, step = 0.5 }) {
  const v = parseFloat(value) || 0;
  // FU-a: hold the raw string while focused so a partial decimal ("1." / "")
  // isn't snapped to a number mid-typing. Commit on blur/Enter.
  const [draft, setDraft] = useState(null);
  const display = draft !== null ? draft : (v === 0 ? '' : String(v));
  const base = () => {
    if (draft === null) return v;
    const n = parseFloat(draft.replace(/[^0-9.]/g, ''));
    return isNaN(n) || n < 0 ? 0 : n;
  };
  const commit = () => {
    if (draft === null) return;
    const n = parseFloat(draft.replace(/[^0-9.]/g, ''));
    onChange(isNaN(n) || n < 0 ? 0 : n);
    setDraft(null);
  };
  const bump = (delta) => {
    const next = Math.max(0, Math.round((base() + delta) * 10) / 10);
    setDraft(null);
    onChange(next);
  };
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${ariaLabel} decrease`}
        onClick={() => bump(-step)}
        disabled={base() <= 0}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary disabled:opacity-40 transition-colors"
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        placeholder="0"
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-14 h-11 text-center rounded-lg border border-border bg-surface text-ink text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="button"
        aria-label={`${ariaLabel} increase`}
        onClick={() => bump(step)}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function MoneyInput({ value, onChange, ariaLabel }) {
  const v = parseFloat(value) || 0;
  // FU-a: hold the raw string while focused so a partial amount ("1500." / "")
  // isn't coerced mid-typing. Commit the parsed float on blur/Enter.
  const [draft, setDraft] = useState(null);
  const display = draft !== null ? draft : (v === 0 ? '' : String(v));
  const commit = () => {
    if (draft === null) return;
    const cleaned = draft.replace(/[^0-9.]/g, '');
    onChange(cleaned === '' ? 0 : parseFloat(cleaned) || 0);
    setDraft(null);
  };
  return (
    <div className="flex h-11 rounded-lg border border-border overflow-hidden bg-surface">
      <span className="flex items-center px-2 text-[11px] font-semibold text-ink-muted bg-surface border-r border-border shrink-0">
        TTD
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        placeholder="0.00"
        aria-label={`${ariaLabel} (TTD)`}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-28 px-2 bg-transparent text-ink text-base text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}

// ── Edit row ──────────────────────────────────────────────────────────────────

function EditRow({ row, onEditField }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 min-h-[44px]">
      <span className="text-sm text-ink flex-1 min-w-0 truncate">
        {row.label}
        {row.unit && row.unit !== 'TTD' && (
          <span className="text-ink-muted ml-1 text-xs">({row.unit})</span>
        )}
      </span>
      {row.unit === 'TTD' ? (
        <MoneyInput
          value={row.value}
          ariaLabel={row.label}
          onChange={(v) => onEditField(row.key, v)}
        />
      ) : row.unit === 'h' ? (
        <DecimalStepper
          value={row.value}
          ariaLabel={row.label}
          step={0.5}
          onChange={(v) => onEditField(row.key, v)}
        />
      ) : (
        <IntStepper
          value={row.value}
          ariaLabel={row.label}
          onChange={(v) => onEditField(row.key, v)}
        />
      )}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SummaryChip({ row }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-xs text-ink-muted">{row.label}:</span>
      <span className="text-sm font-semibold text-ink">
        {row.unit === 'TTD'
          ? formatCurrency(row.value)
          : row.unit === 'h'
          ? `${row.value}h`
          : row.value}
      </span>
    </div>
  );
}

// FU-b: collapses the per-platform social rows under a single headline toggle.
function ExpandToggle({ sectionId, expanded, count, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      data-testid={`wcv-section-${sectionId}-expand`}
      className="flex items-center gap-1 py-2 min-h-[44px] text-xs font-semibold text-ink-muted hover:text-primary transition-colors"
    >
      {expanded
        ? <ChevronDown size={14} aria-hidden="true" />
        : <ChevronRight size={14} aria-hidden="true" />}
      Platform breakdown{count ? ` (${count})` : ''}
    </button>
  );
}

function SectionCard({ section, isEditing, onEdit, onDone, onEditField }) {
  const accent = section.accent ?? 'teal';
  const dotClass    = accent === 'gold' ? 'bg-warning' : 'bg-primary';
  const borderClass = accent === 'gold' ? 'border-warning/30' : 'border-primary/20';

  // FU-b: rows flagged `expandable` (the per-platform social breakdown) live
  // under a single "Platform breakdown" toggle so the headline stays the
  // aggregate. Non-flagged rows render inline as before.
  const mainRows       = section.rows.filter((r) => !r.expandable);
  const expandableRows = section.rows.filter((r) => r.expandable);
  const [expanded, setExpanded] = useState(false);

  const mainNonZero       = mainRows.filter((r) => Number(r.value) !== 0);
  const expandableNonZero = expandableRows.filter((r) => Number(r.value) !== 0);
  // Edit mode: always offer the toggle when there are platform rows. Collapsed:
  // only when a platform row actually carries a value (else nothing to reveal).
  const showExpandToggle  = expandableRows.length > 0 && (isEditing || expandableNonZero.length > 0);

  return (
    <div
      className={`rounded-xl bg-card border ${borderClass} p-4`}
      data-testid={`wcv-section-${section.id}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink truncate">{section.label}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs font-semibold text-primary"
            data-testid={`wcv-section-${section.id}-provenance`}
          >
            ✓ from daily ×{section.provenanceCount}
          </span>
          <button
            type="button"
            onClick={isEditing ? onDone : onEdit}
            aria-label={isEditing ? `Done editing ${section.label}` : `Edit ${section.label}`}
            aria-pressed={isEditing}
            data-testid={`wcv-section-${section.id}-edit`}
            className={`min-h-[44px] px-3 flex items-center gap-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              isEditing
                ? 'bg-primary/10 border-primary/50 text-primary'
                : 'bg-card-raised border-border text-ink-muted hover:text-primary hover:border-primary/40'
            }`}
          >
            {isEditing ? (
              <>
                <Check size={12} aria-hidden="true" />
                Done
              </>
            ) : (
              <>
                <Pencil size={12} aria-hidden="true" />
                Edit
              </>
            )}
          </button>
        </div>
      </div>

      {isEditing ? (
        /* Edit mode: stepper rows */
        <div
          className="flex flex-col divide-y divide-border/50"
          data-testid={`wcv-section-${section.id}-fields`}
        >
          {mainRows.map((row) => (
            <EditRow key={row.key} row={row} onEditField={onEditField} />
          ))}
          {showExpandToggle && (
            <ExpandToggle
              sectionId={section.id}
              expanded={expanded}
              count={expandableRows.length}
              onToggle={() => setExpanded((e) => !e)}
            />
          )}
          {showExpandToggle && expanded && expandableRows.map((row) => (
            <EditRow key={row.key} row={row} onEditField={onEditField} />
          ))}
        </div>
      ) : (
        /* Collapsed: non-zero summary */
        (mainNonZero.length > 0 || expandableNonZero.length > 0) ? (
          <div className="flex flex-col gap-2">
            {mainNonZero.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {mainNonZero.map((row) => (
                  <SummaryChip key={row.key} row={row} />
                ))}
              </div>
            )}
            {showExpandToggle && (
              <ExpandToggle
                sectionId={section.id}
                expanded={expanded}
                count={expandableNonZero.length}
                onToggle={() => setExpanded((e) => !e)}
              />
            )}
            {showExpandToggle && expanded && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {expandableNonZero.map((row) => (
                  <SummaryChip key={row.key} row={row} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-ink-muted italic">No activity logged</p>
        )
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Editable weekly-confirm screen for the Wizard v3 fast path.
 *
 * Prop contract (LOCKED — do not deviate):
 *   draft       — aggregated weekly draft (read-only source of truth)
 *   sections    — derived section array (use deriveSections(draft) as the default)
 *   onEditField — (key: string, nextValue: number) => void
 *   onConfirm   — () => void — advances out of Confirm into the wizard step flow
 *   variant     — 'desktop' | 'mobile'
 *
 * Mounted as the Wizard v3 fast-path entry (Phase 1). Ratings and next-week
 * goals are intentionally absent — they are later wizard steps reached via onConfirm.
 */
export default function WeekConfirmView({ draft: _draft, sections, onEditField, onConfirm, variant = 'desktop' }) {
  const [editingId, setEditingId] = useState(null);

  return (
    <div
      data-testid="week-confirm-view"
      data-variant={variant}
      className={`flex flex-col gap-4 py-4 ${variant === 'desktop' ? 'max-w-lg mx-auto px-4' : 'px-4'}`}
    >
      {sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          isEditing={editingId === section.id}
          onEdit={() => setEditingId(section.id)}
          onDone={() => setEditingId(null)}
          onEditField={onEditField}
        />
      ))}

      {onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          data-testid="week-confirm-next"
          className="w-full h-11 mt-1 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Looks good →
        </button>
      )}
    </div>
  );
}
