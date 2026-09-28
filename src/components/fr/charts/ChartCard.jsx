import React, { useId, useState } from 'react';
import DataTable from './DataTable';

/**
 * ChartCard — the frame every FR chart sits in.
 *
 * Spec: DESKTOP3.md "Glanceable rules" 2 + 3 — the title is the takeaway
 * sentence, the subtitle says what is plotted, and a small "Table" toggle
 * top-right swaps the chart for a plain table of the same values.
 * MOTION3.md rule 5 — the swap cross-fades (alternating fr-fade-a / fr-fade-b
 * on a wrapper keyed by a counter, so the keyframe replays each time).
 *
 * The toggle keeps its visible name ("Table") and reports state through
 * aria-pressed, so a screen reader hears "Table, toggle button, pressed".
 *
 * @param {object} props
 * @param {React.ReactNode} props.title     takeaway sentence (h3)
 * @param {React.ReactNode} [props.subtitle] what is plotted
 * @param {{columns: object[], rows: object[], caption?: string}} [props.table] enables the toggle
 * @param {React.ReactNode} [props.actions] extra controls, left of the toggle
 * @param {React.ReactNode} props.children  the chart
 * @param {string} [props.className]
 */
export default function ChartCard({ title, subtitle, table, actions, children, className = '' }) {
  const [showTable, setShowTable] = useState(false);
  const [swaps, setSwaps] = useState(0);
  const bodyId = useId();

  const toggle = () => {
    setShowTable((v) => !v);
    setSwaps((n) => n + 1);
  };

  // No fade on first mount — the chart's own entrance motion plays then.
  const fadeClass = swaps === 0 ? '' : swaps % 2 === 1 ? 'fr-fade-a' : 'fr-fade-b';
  const tableOn = Boolean(table) && showTable;

  return (
    <section className={`rounded-[18px] border border-border bg-card p-5 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[17px] font-bold leading-snug text-ink">{title}</h3>
          {subtitle ? <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p> : null}
        </div>
        {actions || table ? (
          <div className="flex flex-none flex-wrap items-center gap-2">
            {actions}
            {table ? (
              <button
                type="button"
                aria-pressed={showTable}
                aria-controls={bodyId}
                onClick={toggle}
                className={`inline-flex min-h-[44px] items-center rounded-[10px] px-3 text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  showTable ? 'bg-fr-accent-tint text-primary' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Table
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      <div id={bodyId}>
        <div key={swaps} className={fadeClass}>
          {tableOn ? <DataTable {...table} /> : children}
        </div>
      </div>
    </section>
  );
}
