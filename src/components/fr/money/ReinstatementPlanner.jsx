import React, { useId, useState } from 'react';
import { ChartCard, GateBars, Bullet } from '../charts';
import { CARD, EYEBROW, FOCUS, FrCheckbox, WarnIcon, Why } from './moneyParts';
import { monthLabel, wholeTTDUp, selectionSummary, SOON_MONTHS } from '../../../lib/fr/moneyModel';

/**
 * ReinstatementPlanner — READ-ONLY planner over the lapsed policies that
 * still count against persistency (inside the 24-month window): the gap to
 * the gate, two presets and a free tick-list (FR-3; Kyron ruling 28-09-2026).
 *
 *   · Presets "Fewest calls" and "Least money", always both.
 *   · A lapse that stops counting within SOON_MONTHS of the planned month is
 *     flagged "Stops counting after <Mon YYYY>", in its row and in the
 *     summary line of any preset that includes it.
 *   · The agent can tick any mix; the running total is shown against the gap
 *     with the projected persistency.
 *
 * Ticking is a what-if: local UI state, never saved. Marking a policy
 * reinstated is FR-6, not here, so there is no control that pretends to.
 *
 * Pure: `plan` is reinstatementPlan() output (src/lib/fr/moneyModel.js).
 */

// Month count in words for copy ("two months"); SOON_MONTHS drives it, so the footnote never goes stale.
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
function monthsPhrase(n) {
  const word = NUMBER_WORDS[n] ?? String(n);
  return `${word} ${n === 1 ? 'month' : 'months'}`;
}

const money = (n) => `TTD ${Number(n || 0).toLocaleString('en-TT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ddmmyyyy(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '—';
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "1 stops counting after Oct 2026" / "2 stop counting by Nov 2026". */
function agingLine(agingOut) {
  if (!agingOut?.length) return null;
  const last = agingOut.map((l) => l.countsThrough).sort().pop();
  return agingOut.length === 1
    ? `1 stops counting after ${monthLabel(agingOut[0].countsThrough)}`
    : `${agingOut.length} stop counting by ${monthLabel(last)}`;
}

function sameSet(a, numbers) {
  if (!a) return false;
  const want = a.items.map((l) => l.policyNumber).sort();
  const have = [...numbers].sort();
  return want.length === have.length && want.every((n, i) => n === have[i]);
}

function PresetButton({ id, label, preset, selected, onPick, threshold }) {
  const aging = agingLine(preset.agingOut);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onPick(preset)}
      data-testid={`planner-preset-${id}`}
      className={`${FOCUS} flex min-h-[44px] min-w-0 flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors ${selected ? 'border-fr-accent bg-fr-accent-tint' : 'border-border bg-fr-sunk hover:border-ink-dim'}`}
    >
      <span className={EYEBROW}>{label}{preset.exact ? '' : ' (best found)'}</span>
      <span className="text-[14px] font-semibold text-ink">
        {plural(preset.items.length, 'policy', 'policies')} · {money(preset.total)} → {preset.afterPct.toFixed(1)}%
        {preset.afterPct >= threshold ? ' · clears the gate' : ''}
      </span>
      {/* Always one line, so the button's height does not jump when the data
          changes (v3 rule 7): the warning, or an explicit "none". */}
      {aging ? (
        <span className="flex items-start gap-1.5 text-[12px] font-semibold text-fr-warm"><WarnIcon className="mt-px" />{aging}</span>
      ) : (
        <span className="text-[12px] text-ink-muted">None stops counting within {SOON_MONTHS} months</span>
      )}
      <span className="min-w-0 text-[12px] text-ink-muted">{preset.items.map((l) => l.clientName ?? l.policyNumber).join(' + ')}</span>
    </button>
  );
}

function RunningTotal({ plan, sum }) {
  const need = plan.need;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-4" aria-live="polite" data-testid="planner-running-total">
      <Bullet
        value={sum.total}
        target={need > 0 ? need : undefined}
        label={`Ticked: ${plural(sum.count, 'policy', 'policies')}`}
        valueText={money(sum.total)}
        targetText={need > 0 ? `Gap ${money(need)}` : undefined}
        tone={sum.clears ? 'accent' : 'warm'}
        height={10}
      />
      <p className="text-[13px] text-ink">
        {sum.count === 0
          ? 'Tick policies, or pick a preset, to see where they take you.'
          : sum.clears
            ? `Clears the ${plan.threshold}% gate → ${sum.afterPct.toFixed(1)}%`
            : `${money(sum.remaining)} still to go → ${sum.afterPct.toFixed(1)}%`}
      </p>
      {agingLine(sum.agingOut) ? (
        <p className="flex items-start gap-1.5 text-[12px] font-semibold text-fr-warm"><WarnIcon className="mt-px" />{agingLine(sum.agingOut)}</p>
      ) : null}
    </div>
  );
}

export default function ReinstatementPlanner({ plan }) {
  const idBase = useId();
  const [picked, setPicked] = useState(() => new Set());
  if (!plan) {
    return (
      <section className={`${CARD} p-5`} aria-label="Win back lapsed policies" data-testid="reinstatement-planner">
        <h3 className="font-display text-[18px] font-bold text-ink">Win back lapsed policies</h3>
        <p className="mt-2 text-[13px] text-ink-muted">No persistency figure yet. It needs settled policies in your ledger.</p>
      </section>
    );
  }
  const sum = selectionSummary(plan, [...picked]);
  const toggle = (num) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(num)) next.delete(num); else next.add(num);
    return next;
  });
  const pick = (preset) => setPicked(new Set(preset.items.map((l) => l.policyNumber)));
  const title = plan.meets
    ? `${plan.currentPct.toFixed(1)}% — at or above the ${plan.threshold}% gate`
    : `TTD ${wholeTTDUp(plan.need)} reinstated clears the ${plan.threshold}% gate`;
  const { presets } = plan;

  return (
    <section className={`${CARD} flex flex-col gap-4 p-5`} aria-label="Win back lapsed policies" data-testid="reinstatement-planner">
      <header className="flex flex-col gap-1">
        <h3 className="font-display text-[18px] font-bold leading-tight text-ink">{title}</h3>
        <p className="text-[13px] text-ink-muted">
          {monthLabel(plan.monthKey)}{plan.isGateMonth ? ' (campaign gate month)' : ''} · {plan.currentPct.toFixed(1)}% now · 24-month model
          {plan.annuityRuleLabel ? ` · ${plan.annuityRuleLabel}` : ''}
        </p>
      </header>

      {!plan.meets && presets ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2" role="group" aria-label="Presets">
          <PresetButton id="fewest" label="Fewest calls" preset={presets.fewestCalls} selected={sameSet(presets.fewestCalls, picked)} onPick={pick} threshold={plan.threshold} />
          <PresetButton id="money" label="Least money" preset={presets.leastMoney} selected={sameSet(presets.leastMoney, picked)} onPick={pick} threshold={plan.threshold} />
        </div>
      ) : null}
      {!plan.meets && plan.outOfReach ? (
        <p className="flex items-start gap-1.5 text-[13px] font-semibold text-fr-warm" data-testid="planner-out-of-reach">
          <WarnIcon className="mt-0.5" />
          Reinstating every lapse below still falls short. New settled business is needed as well.
        </p>
      ) : null}

      {plan.lapses.length ? (
        <>
          <RunningTotal plan={plan} sum={sum} />
          <fieldset className="min-w-0">
            <legend className="mb-2 text-[13px] font-semibold text-ink">Lapsed policies that still count, soonest to stop counting first</legend>
            <ul className="flex flex-col divide-y divide-border">
              {plan.lapses.map((l) => {
                const id = `${idBase}-${l.policyNumber}`;
                return (
                  <li key={l.policyNumber} data-testid={`planner-row-${l.policyNumber}`}>
                    <label htmlFor={id} className="relative flex min-h-[44px] cursor-pointer items-start gap-3 py-2.5 pl-3">
                      <FrCheckbox id={id} checked={picked.has(l.policyNumber)} onChange={() => toggle(l.policyNumber)} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex min-w-0 items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate font-semibold text-ink" title={l.clientName ?? l.policyNumber}>{l.clientName ?? l.policyNumber}</span>
                          <span className="flex-none whitespace-nowrap tabular-nums text-ink">{money(l.api)}</span>
                        </span>
                        <span className="text-[12px] text-ink-muted">
                          {l.clientName ? `${l.policyNumber} · ` : ''}Issued {ddmmyyyy(l.dateIssued)}
                        </span>
                        {l.agesOutSoon ? (
                          <span className="flex items-start gap-1.5 text-[12px] font-semibold text-fr-warm"><WarnIcon className="mt-px" />Stops counting after {monthLabel(l.countsThrough)}</span>
                        ) : (
                          <span className="text-[12px] text-ink-muted">Counts through {monthLabel(l.countsThrough)}</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </>
      ) : (
        <p className="text-[13px] text-ink-muted">No lapsed policies count against you in this window.</p>
      )}
      {plan.unitemised > 0 ? (
        <p className="text-[12px] text-ink-muted" data-testid="planner-unitemised">
          {money(plan.unitemised)} of counted lapses has no policy number on file, so it cannot be listed.
        </p>
      ) : null}

      <Why>
        Persistency = Net Settled ÷ Net Gross Settled. Here: {money(plan.netSettled)} ÷ {money(plan.grossSettled)} = {plan.currentPct.toFixed(1)}%.
        {' '}A reinstated lapse adds its API back to Net Settled, so {plan.threshold}% needs {plan.meets ? 'nothing more' : `${money(plan.need)} reinstated`}.
        {' '}Only lapses still inside the 24-month window are listed; older ones no longer count and cannot help. A policy flagged “Stops counting after” leaves the window within {monthsPhrase(SOON_MONTHS)}, so reinstating it helps only until then.
        {' '}Ticking here is a what-if and is not saved.
      </Why>
      {plan.stale ? (
        <p className="flex items-start gap-1.5 text-[12px] font-semibold text-fr-warm"><WarnIcon className="mt-px" />Estimate is getting stale; import a fresh export.</p>
      ) : null}
    </section>
  );
}

/**
 * PersistencyHistory — the monthly persistency bars from the gate (GateBars).
 * `series` is persistencySeries() output.
 */
export function PersistencyHistory({ series, threshold = 90 }) {
  const data = series?.data ?? [];
  const last = data[data.length - 1];
  const below = data.filter((d) => d.value < threshold).length;
  const title = !data.length
    ? 'No monthly persistency yet'
    : below === 0
      ? `Every month shown is at or above ${threshold}%`
      : `${below} of ${data.length} months below ${threshold}%`;
  return (
    <ChartCard
      title={title}
      subtitle={`Persistency by month${last?.projected ? '; the dashed bar is this month’s estimate' : ''}`}
      table={data.length ? {
        caption: 'Persistency by month',
        columns: [
          { key: 'month', label: 'Month' },
          { key: 'value', label: 'Persistency', align: 'right' },
          { key: 'kind', label: 'Figure' },
        ],
        rows: data.map((d) => ({ key: d.key, month: monthLabel(d.key), value: `${d.value.toFixed(1)}%`, kind: d.projected ? 'Estimate' : 'Saved' })),
      } : undefined}
    >
      {data.length ? <GateBars data={data} gate={threshold} /> : <p className="py-6 text-[13px] text-ink-muted">No data yet</p>}
      {series?.hasTwelveMonthModel ? (
        <p className="mt-3 text-[12px] text-ink-muted">Months before September 2026 use the 12-month model; from September 2026, the 24-month model.</p>
      ) : null}
    </ChartCard>
  );
}

