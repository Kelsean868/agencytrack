import React, { useState } from 'react';
import { Minus, Plus, Pencil, Check } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

// ── Local atoms ────────────────────────────────────────────────────────────────

function IntStepper({ value, onChange, ariaLabel }) {
  const v = parseInt(value, 10) || 0;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${ariaLabel} decrease`}
        onClick={() => v > 0 && onChange(v - 1)}
        disabled={v <= 0}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary disabled:opacity-40 transition-colors"
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={v === 0 ? '' : v}
        placeholder="0"
        aria-label={ariaLabel}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9]/g, '');
          onChange(cleaned === '' ? 0 : parseInt(cleaned, 10));
        }}
        className="w-12 h-11 text-center rounded-lg border border-border bg-surface text-ink text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="button"
        aria-label={`${ariaLabel} increase`}
        onClick={() => onChange(v + 1)}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function DecimalStepper({ value, onChange, ariaLabel, step = 0.5 }) {
  const v = parseFloat(value) || 0;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${ariaLabel} decrease`}
        onClick={() => v >= step && onChange(Math.round((v - step) * 10) / 10)}
        disabled={v <= 0}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary disabled:opacity-40 transition-colors"
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={v === 0 ? '' : v}
        placeholder="0"
        aria-label={ariaLabel}
        onChange={(e) => {
          const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''));
          onChange(isNaN(n) || n < 0 ? 0 : n);
        }}
        className="w-14 h-11 text-center rounded-lg border border-border bg-surface text-ink text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="button"
        aria-label={`${ariaLabel} increase`}
        onClick={() => onChange(Math.round((v + step) * 10) / 10)}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function MoneyInput({ value, onChange, ariaLabel }) {
  const v = parseFloat(value) || 0;
  return (
    <div className="flex h-11 rounded-lg border border-border overflow-hidden bg-surface">
      <span className="flex items-center px-2 text-[11px] font-semibold text-ink-muted bg-surface border-r border-border shrink-0">
        TTD
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={v === 0 ? '' : v}
        placeholder="0.00"
        aria-label={`${ariaLabel} (TTD)`}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, '');
          onChange(cleaned === '' ? 0 : parseFloat(cleaned) || 0);
        }}
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

function SectionCard({ section, isEditing, onEdit, onDone, onEditField }) {
  const accent = section.accent ?? 'teal';
  const dotClass    = accent === 'gold' ? 'bg-warning' : 'bg-primary';
  const borderClass = accent === 'gold' ? 'border-warning/30' : 'border-primary/20';
  const nonZeroRows = section.rows.filter((r) => Number(r.value) !== 0);

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
            className="min-h-[44px] px-3 flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-card-raised border border-border text-ink-muted hover:text-primary hover:border-primary/40 transition-colors"
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
          {section.rows.map((row) => (
            <EditRow key={row.key} row={row} onEditField={onEditField} />
          ))}
        </div>
      ) : (
        /* Collapsed: non-zero summary */
        nonZeroRows.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {nonZeroRows.map((row) => (
              <div key={row.key} className="flex items-baseline gap-1">
                <span className="text-xs text-ink-muted">{row.label}:</span>
                <span className="text-sm font-semibold text-ink">
                  {row.unit === 'TTD'
                    ? formatCurrency(row.value)
                    : row.unit === 'h'
                    ? `${row.value}h`
                    : row.value}
                </span>
              </div>
            ))}
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
 *   variant     — 'desktop' | 'mobile'
 *
 * NOT wired into the wizard yet. The shell (Q4) and fast-path wiring PR route it.
 * Ratings and next-week goals are intentionally absent — they are later wizard steps.
 */
export default function WeekConfirmView({ draft: _draft, sections, onEditField, variant = 'desktop' }) {
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
    </div>
  );
}
