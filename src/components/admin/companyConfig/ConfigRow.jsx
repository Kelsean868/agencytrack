import React from 'react';
import { Lock, Clock, RotateCcw } from 'lucide-react';
import { valuePreview } from './valuePreview';

/**
 * The five(+one)-state setting-row grammar (design handoff README §The
 * Setting-Row Grammar). Pure/presentational — this component does not read
 * Firestore, context, or services; the caller supplies `effectiveValue`,
 * `provenance`, and the control cluster as `children`, and receives intent
 * back via `onChange` is NOT called by ConfigRow itself (the control inside
 * `children` owns onChange directly) — `onUndo` / `onReset` are the only
 * callbacks ConfigRow invokes, from the affordances it renders itself.
 *
 * States (`state` prop): 'default' | 'custom' | 'draft' | 'reset' | 'platform' | 'soon'.
 * - default  — quiet, faint mono DEFAULT tag.
 * - custom   — teal dot + provenance line + "Reset to default (…)".
 * - draft    — teal dot + "Unsaved — applies to everyone on save" + Undo.
 * - reset    — "Will reset to default on save" + Undo (draft variant, no dot).
 * - platform — muted label/value, mono value, PLATFORM lock chip. No control rendered.
 * - soon     — real value shown, control wrapped at opacity-55/bg-surface-muted,
 *              warning HARDCODED · UNLOCKS {tier} chip.
 *
 * `unbacked` items (item.unbacked) render their platform-state value as an
 * em-dash — used for settings that are design-only, not wired to a real value
 * yet.
 *
 * @param {object} props
 * @param {object} props.item registry item ({ id, label, desc?, type, def, lock?, tier?, unbacked?, ... })
 * @param {'default'|'custom'|'draft'|'reset'|'platform'|'soon'} props.state
 * @param {*} [props.effectiveValue] current effective value (draft ?? committed ?? default) — used for the platform-state mono value display
 * @param {{whoName: string, date: string}} [props.provenance] shown for state === 'custom'
 * @param {boolean} [props.draft] true for both 'draft' and 'reset' states — gates the unsaved note + Undo link
 * @param {boolean} [props.disabled] purely advisory here (the control's own disabled state lives in `children`); soon-state always gets the visual opacity/bg-muted treatment regardless
 * @param {boolean} [props.flash] true for ~2s after a palette jump — applies a static teal-tint highlight that fades via `transition-colors` (no bespoke keyframe; the PARENT is responsible for clearing this prop after the highlight window)
 * @param {Function} [props.onChange] not invoked by ConfigRow — kept for API symmetry with the row's data contract; the control in `children` calls onChange itself
 * @param {Function} [props.onUndo] called from the Undo link (draft/reset states)
 * @param {Function} [props.onReset] called from the "Reset to default" link (custom state)
 * @param {React.ReactNode} [props.children] the control cluster (input/seg/toggle/table) — omitted entirely for state === 'platform'
 */
export default function ConfigRow({
  item,
  state,
  effectiveValue,
  provenance,
  draft = false,
  disabled = false, // eslint-disable-line no-unused-vars -- advisory; the actual control owns its own disabled state (see jsdoc)
  flash = false,
  onChange, // eslint-disable-line no-unused-vars -- not called here; see jsdoc
  onUndo,
  onReset,
  children,
}) {
  const grey = state === 'platform' || state === 'soon';
  const showDot = state === 'custom' || state === 'draft';
  const isPlatform = state === 'platform';
  const isSoon = state === 'soon';
  const defPreview = valuePreview(item, item?.def);

  return (
    <div
      data-sid={item.id}
      data-testid={`ccfg-row-${item.id}`}
      className={`flex flex-wrap items-start gap-x-4 gap-y-1.5 py-[13px] px-2 -mx-2 rounded-lg border-t border-border first:border-t-0 transition-colors duration-700 ease-out motion-reduce:transition-none ${
        flash ? 'bg-primary-tint' : ''
      }`}
    >
      <div className="flex-1 basis-[220px] min-w-[200px]">
        <div className="flex items-center gap-1.5">
          {showDot && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />}
          <span className={`text-[13.5px] font-semibold ${grey ? 'text-ink-muted' : 'text-ink'}`}>{item.label}</span>
        </div>

        {item.desc && (
          <p className="text-[11.5px] text-ink-muted mt-0.5 leading-snug max-w-[520px]">{item.desc}</p>
        )}

        {state === 'custom' && (
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {/* Changed-by line renders only when provenance is known. The Reset
                affordance renders for every custom row — legacy-backed settings
                (e.g. activity standards) carry no per-key editor name but must
                still be resettable (Run 5 wiring). */}
            {provenance && (
              <span className="text-[11px] text-ink-muted">
                Changed by <span className="font-semibold text-ink">{provenance.whoName}</span> · {provenance.date}
              </span>
            )}
            <button
              type="button"
              onClick={onReset}
              data-testid={`ccfg-row-${item.id}-reset`}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline focus-visible:outline-none"
            >
              <RotateCcw size={12} aria-hidden="true" />
              Reset to default{item?.def !== undefined ? ` (${defPreview})` : ''}
            </button>
          </div>
        )}

        {draft && (
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-primary">
              {state === 'reset' ? 'Will reset to default on save' : 'Unsaved — applies to everyone on save'}
            </span>
            <button
              type="button"
              onClick={onUndo}
              data-testid={`ccfg-row-${item.id}-undo`}
              className="text-[11px] font-bold text-ink-muted underline focus-visible:outline-none"
            >
              Undo
            </button>
          </div>
        )}

        {isPlatform && (
          <p className="text-[11px] text-ink-muted mt-1.5">
            Platform-managed for now — on the roadmap to open up like everything else.
          </p>
        )}
        {isSoon && (
          <p className="text-[11px] text-ink-muted mt-1.5">
            Ships read-only for now — editing lands with its unlock tier.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap justify-end shrink-0 max-w-full pt-0.5">
        {/* bare table items suppress the row-level DEFAULT tag — with the table
            wrapping below the label it floats mid-card and reads as if it
            belongs to one table row (Run 5 visual probe finding). */}
        {state === 'default' && !item?.bare && (
          <span
            data-testid={`ccfg-row-${item.id}-default-tag`}
            className="font-mono text-[9.5px] font-bold tracking-[.08em] text-ink-muted shrink-0"
          >
            DEFAULT
          </span>
        )}

        {isPlatform && (
          <span className="font-mono text-[12.5px] font-bold text-ink-muted">
            {/* README row grammar state 4: the REAL value renders in mono next to
                the PLATFORM chip (e.g. "SETTLED API ONLY"). valuePreview's lock
                short-circuit is palette-only copy — strip the lock for row display. */}
            {item?.unbacked
              ? '—'
              : item?.value ?? valuePreview({ ...item, lock: undefined }, effectiveValue)}
          </span>
        )}

        {!isPlatform && (
          <span className={isSoon ? 'inline-flex opacity-55 rounded-lg bg-surface-muted' : 'inline-flex'}>
            {children}
          </span>
        )}

        {isPlatform && (
          <span
            data-testid={`ccfg-row-${item.id}-platform-chip`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-muted border border-border font-mono text-[10px] font-bold uppercase tracking-wide text-ink-muted"
          >
            <Lock size={11} aria-hidden="true" /> PLATFORM
          </span>
        )}
        {isSoon && (
          <span
            data-testid={`ccfg-row-${item.id}-soon-chip`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-warning-tint border border-warning/25 font-mono text-[10px] font-bold uppercase tracking-wide text-warning-ink"
          >
            <Clock size={11} aria-hidden="true" /> HARDCODED · UNLOCKS {item?.tier || 'SOON'}
          </span>
        )}
      </div>
    </div>
  );
}
