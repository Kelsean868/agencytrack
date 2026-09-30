import { formatCurrency } from '../../../../utils/formatters';
import { roundTo10, roundToWhole } from '../../../../utils/goalDecomposition';

/**
 * decompositionStages — the seven figures of the Goal Decomposition ladder, as
 * ANNUAL values, plus their display rule (R2-7). Moved verbatim out of
 * GoalDecompositionTab's DecompositionLadder so the Nexus ladder and the FR
 * decomposition table print the same strings from one place.
 *
 * Note the "Income goal" stage shows `inputs.incomeGoal` (what the agent set),
 * exactly as the ladder always has; the pre-tax gross-up only feeds the
 * 1st-year commission stage.
 *
 * @param {{ computed: object, inputs: object, preTaxAlreadyApplied: boolean }} args
 * @returns {Array<{ key: string, label: string, kind: 'money'|'count', annual: number }>}
 */
export function ladderFigures({ computed, inputs, preTaxAlreadyApplied }) {
  const preTaxIncome = preTaxAlreadyApplied
    ? inputs.incomeGoal
    : (inputs.taxRate < 100 ? inputs.incomeGoal / (1 - inputs.taxRate / 100) : 0);
  const firstYearCommRequired = Math.max(0, preTaxIncome - (inputs.renewalIncome || 0));
  return [
    { key: 'income',    label: 'Income goal',         kind: 'money', annual: inputs.incomeGoal },
    { key: 'firstYear', label: '1st-year commission', kind: 'money', annual: firstYearCommRequired },
    { key: 'api',       label: 'API to write',        kind: 'money', annual: computed.apiToWrite },
    { key: 'apps',      label: 'Apps',                kind: 'count', annual: computed.applications },
    { key: 'ci',        label: 'Closing interviews',  kind: 'count', annual: computed.ci },
    { key: 'calls',     label: 'Prospecting calls',   kind: 'count', annual: computed.dials },
    { key: 'prospects', label: 'Prospects',           kind: 'count', annual: computed.prospects },
  ];
}

/** One ladder figure for a view cadence: money to the nearest TTD 10, counts as "~N". */
export function formatLadderFigure(figure, divisor) {
  if (figure.kind === 'money') return formatCurrency(roundTo10(figure.annual / divisor));
  if (figure.kind === 'count') return `~${roundToWhole(figure.annual / divisor).toLocaleString()}`;
  throw new Error(`formatLadderFigure: unknown kind "${figure.kind}"`);
}
