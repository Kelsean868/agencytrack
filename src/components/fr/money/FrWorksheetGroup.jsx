import React from 'react';
import { Calculator, ChevronDown, Plus, RotateCcw, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { FOCUS } from './moneyParts';
import { FR_FREQUENCIES } from './moneyNeedsModel';

/**
 * FrWorksheetGroup — one Money needs expense group in the FR look (R2-9,
 * canvas D3M-MoneyNeeds "The worksheet" / M3-MoneyNeeds group pages).
 * PURE: props only. The container (FrMoneyNeedsGroup) owns the group's edit
 * and save state through useExpenseGroupEditor — the same hook the Nexus
 * accordion uses — and passes its handlers straight through, with the same
 * arguments the Nexus rows pass:
 *   onChange(id, 'label' | 'amount', value)        typing (saved on blur)
 *   onChange(id, 'frequency', value, true)         frequency (saved at once)
 *   onBlur()  onDelete(id)  onReset(id)  onAdd()  onOpenCalc(calcId)
 *
 * Accessible names match the Nexus rows ("Expense description", "Expense
 * amount", "Delete expense", "Open <line> calculator", "<line> amount",
 * "Reset <line> to calculator value") so one test vocabulary covers both.
 *
 * @param {{
 *   groupKey: string, label: string, colorIndex: number,   0..4 → chart-1..5 dot
 *   header: { filledLabel: string, subtotal: string },
 *   rows: object[],                                         moneyNeedsRow() output
 *   layout: 'table' | 'cards',                              ≥768 table, phone cards
 *   open?: boolean, onToggle?: () => void,                  collapsible when onToggle is given
 *   saving?: boolean, saveError?: string,
 *   onChange: Function, onBlur: Function, onDelete: Function, onReset: Function,
 *   onAdd: Function, onOpenCalc: Function,
 * }} props
 */

const DOT = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];
const INPUT = `${FOCUS} h-11 min-w-0 rounded-[10px] border border-border bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-muted`;
const ICON_BTN = `${FOCUS} inline-flex h-11 w-11 flex-none items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-fr-sunk hover:text-ink`;

function groupDot(colorIndex) {
  const cls = DOT[colorIndex];
  if (!cls) {
    if (import.meta.env.DEV) throw new Error(`FrWorksheetGroup: no dot colour for index ${colorIndex}`);
    return 'bg-fr-sunk';
  }
  return cls;
}

function FrequencyButtons({ row, onChange }) {
  return (
    <div role="group" aria-label={`${row.label || 'Expense'} frequency`} className="flex flex-none gap-0.5 rounded-[10px] bg-fr-sunk p-0.5">
      {FR_FREQUENCIES.map((f) => {
        const on = f.value === row.frequency;
        return (
          <button
            key={f.value}
            type="button"
            aria-pressed={on}
            aria-label={f.label}
            title={f.label}
            onClick={() => onChange(row.id, 'frequency', f.value, true)}
            className={`${FOCUS} inline-flex h-11 w-9 items-center justify-center rounded-lg font-mono text-[11px] font-semibold transition-colors ${
              on ? 'bg-fr-accent text-fr-on-accent' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {f.short}
          </button>
        );
      })}
    </div>
  );
}

function AmountInput({ row, onChange, onBlur, calcFed }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="flex-none text-[11px] font-semibold text-ink-muted" aria-hidden="true">TTD</span>
      <input
        type="number"
        inputMode="decimal"
        value={row.amount}
        onChange={(e) => onChange(row.id, 'amount', e.target.value)}
        onBlur={onBlur}
        placeholder="0"
        min={0}
        aria-label={calcFed ? `${row.label} amount` : 'Expense amount'}
        className={`${INPUT} w-full text-right tabular-nums`}
      />
    </span>
  );
}

function CalcChip({ row }) {
  return row.overridden ? (
    <span className="inline-flex flex-none items-center rounded-full bg-fr-gold-tint px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-gold-ink">Edited</span>
  ) : (
    <span className="inline-flex flex-none items-center rounded-full bg-fr-accent-tint px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-primary">Calculated</span>
  );
}

function BuildButton({ row, onOpenCalc }) {
  return (
    <button
      type="button"
      onClick={() => onOpenCalc(row.calcId)}
      aria-label={`Open ${row.label} calculator`}
      className={`${FOCUS} inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] bg-fr-accent px-3 text-[13px] font-bold text-fr-on-accent transition-opacity hover:opacity-90`}
    >
      <Calculator size={14} aria-hidden="true" />
      Build with calculator →
    </button>
  );
}

function CalcActions({ row, onOpenCalc, onReset }) {
  return (
    <span className="flex flex-none items-center justify-end gap-0.5">
      {row.filled ? (
        <button type="button" onClick={() => onOpenCalc(row.calcId)} aria-label={`Open ${row.label} calculator`} title="Recalculate" className={ICON_BTN}>
          <Calculator size={15} aria-hidden="true" />
        </button>
      ) : null}
      {row.overridden ? (
        <button type="button" onClick={() => onReset(row.id)} aria-label={`Reset ${row.label} to calculator value`} title="Reset" className={ICON_BTN}>
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

function DeleteButton({ row, onDelete }) {
  return (
    <button type="button" onClick={() => onDelete(row.id)} aria-label="Delete expense" title="Delete" className={ICON_BTN}>
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}

function DescriptionInput({ row, onChange, onBlur }) {
  return (
    <input
      type="text"
      value={row.label}
      onChange={(e) => onChange(row.id, 'label', e.target.value)}
      onBlur={onBlur}
      placeholder="Description"
      aria-label="Expense description"
      title={row.label || undefined}
      className={`${INPUT} w-full font-semibold`}
    />
  );
}

function TableRows({ rows, handlers }) {
  const { onChange, onBlur, onDelete, onReset, onOpenCalc } = handlers;
  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr className="text-left text-[11px] font-semibold text-ink-muted">
          <th scope="col" className="border-b border-border pb-1.5 pr-2 font-semibold">Line</th>
          <th scope="col" className="w-[132px] border-b border-border px-2 pb-1.5 text-right font-semibold">Amount</th>
          <th scope="col" className="w-[160px] border-b border-border px-2 pb-1.5 font-semibold">Frequency</th>
          <th scope="col" className="w-[104px] border-b border-border px-2 pb-1.5 text-right font-semibold">Yearly</th>
          <th scope="col" className="w-[96px] border-b border-border pb-1.5 pl-2"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="align-middle" data-testid={`fr-mn-row-${row.id}`}>
            <td className="border-b border-border py-1.5 pr-2">
              {row.calcFed ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate text-[13px] font-semibold text-ink" title={row.label}>{row.label}</span>
                </span>
              ) : (
                <DescriptionInput row={row} onChange={onChange} onBlur={onBlur} />
              )}
            </td>
            {row.calcFed && !row.filled ? (
              <td colSpan={2} className="border-b border-border px-2 py-1.5">
                <BuildButton row={row} onOpenCalc={onOpenCalc} />
              </td>
            ) : (
              <>
                <td className="border-b border-border px-2 py-1.5">
                  <AmountInput row={row} onChange={onChange} onBlur={onBlur} calcFed={row.calcFed} />
                </td>
                <td className="border-b border-border px-2 py-1.5">
                  {row.calcFed ? <CalcChip row={row} /> : <FrequencyButtons row={row} onChange={onChange} />}
                </td>
              </>
            )}
            <td className="whitespace-nowrap border-b border-border px-2 py-1.5 text-right text-[13px] font-semibold tabular-nums text-ink">
              {row.yearly}
            </td>
            <td className="border-b border-border py-1.5 pl-2">
              <span className="flex justify-end">
                {row.calcFed
                  ? <CalcActions row={row} onOpenCalc={onOpenCalc} onReset={onReset} />
                  : <DeleteButton row={row} onDelete={onDelete} />}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CardRows({ rows, handlers }) {
  const { onChange, onBlur, onDelete, onReset, onOpenCalc } = handlers;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-2 rounded-[14px] border border-border bg-surface p-3" data-testid={`fr-mn-row-${row.id}`}>
          <div className="flex min-w-0 items-center gap-2">
            {row.calcFed ? (
              <>
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink">{row.label}</span>
                <CalcChip row={row} />
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1"><DescriptionInput row={row} onChange={onChange} onBlur={onBlur} /></span>
                <DeleteButton row={row} onDelete={onDelete} />
              </>
            )}
          </div>
          {row.calcFed && !row.filled ? (
            <BuildButton row={row} onOpenCalc={onOpenCalc} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-[132px] flex-none"><AmountInput row={row} onChange={onChange} onBlur={onBlur} calcFed={row.calcFed} /></span>
              {row.calcFed ? (
                <CalcActions row={row} onOpenCalc={onOpenCalc} onReset={onReset} />
              ) : (
                <FrequencyButtons row={row} onChange={onChange} />
              )}
            </div>
          )}
          <span className="whitespace-nowrap text-[12px] tabular-nums text-ink-muted">= {row.yearly} / yr</span>
        </li>
      ))}
    </ul>
  );
}

export default function FrWorksheetGroup({
  groupKey, label, colorIndex, header, rows, layout,
  open = true, onToggle, saving = false, saveError = '',
  onChange, onBlur, onDelete, onReset, onAdd, onOpenCalc,
}) {
  const collapsible = typeof onToggle === 'function';
  const bodyId = `fr-mn-group-${groupKey}`;
  const showBody = !collapsible || open;
  const handlers = { onChange, onBlur, onDelete, onReset, onOpenCalc };

  const headInner = (
    <>
      <span className={`h-2.5 w-2.5 flex-none rounded-full ${groupDot(colorIndex)}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left text-[14px] font-bold text-ink" title={label}>{label}</span>
      {saving ? <Loader2 size={13} className="flex-none animate-spin text-ink-muted" aria-hidden="true" /> : null}
      <span className="flex-none whitespace-nowrap text-[12px] text-ink-muted">{header.filledLabel}</span>
      <span className="flex-none whitespace-nowrap text-[14px] font-bold tabular-nums text-ink">{header.subtotal}</span>
    </>
  );

  return (
    <div className="flex flex-col gap-2" data-testid={`fr-mn-group-${groupKey}`}>
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className={`${FOCUS} flex min-h-[44px] w-full items-center gap-2.5 rounded-[10px] text-left`}
        >
          {headInner}
          <ChevronDown size={16} aria-hidden="true" className={`flex-none text-ink-muted transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <h2 className="flex min-h-[44px] items-center gap-2.5">{headInner}</h2>
      )}
      {showBody ? (
        <div id={bodyId} className="flex flex-col gap-2">
          {saveError ? (
            <p role="alert" className="flex items-center gap-2 rounded-[10px] bg-fr-warm-tint px-3 py-2 text-[12px] font-semibold text-ink">
              <AlertCircle size={13} className="flex-none text-fr-warm" aria-hidden="true" />
              {saveError}
            </p>
          ) : null}
          {rows.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">No items yet. Add your first expense below.</p>
          ) : layout === 'table' ? (
            <TableRows rows={rows} handlers={handlers} />
          ) : (
            <CardRows rows={rows} handlers={handlers} />
          )}
          <button
            type="button"
            onClick={onAdd}
            disabled={saving}
            className={`${FOCUS} inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-[10px] px-2 text-[13px] font-bold text-primary transition-colors hover:bg-fr-accent-tint disabled:opacity-50`}
          >
            <Plus size={14} aria-hidden="true" />
            Add a line
          </button>
        </div>
      ) : null}
    </div>
  );
}
