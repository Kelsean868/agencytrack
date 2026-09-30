import React, { useMemo } from 'react';
import useMinWidth from '../../../hooks/useMinWidth';
import { countFilledLineItems, CAR_PERSONAL_PCT, CAR_BUSINESS_PCT } from '../../../services/moneyNeedsService';
import { compositionSegments } from '../../../lib/moneyNeedsComposition';
import { formatCurrency } from '../../../utils/formatters';
import { EXPENSE_GROUPS, payeBuildUp } from '../../agent/moneyNeedsShared';
import FrMoneyNeedsView from './FrMoneyNeedsView';
import FrMoneyNeedsGroup from './FrMoneyNeedsGroup';
import { moneyNeedsLadder, moneyNeedsDonut, moneyNeedsSubCalcs, groupShort } from './moneyNeedsModel';

/**
 * FrMoneyNeeds — the FR layout switch for the Money needs worksheet (R2-9).
 * Rendered by MoneyNeedsPanel in place of its Nexus worksheet block, only
 * under the FR look. It receives the panel's loaded worksheet and handlers;
 * every figure comes from the functions the Nexus panel already uses
 * (countFilledLineItems, payeBuildUp, compositionSegments, the stored
 * sub-calculator totals), formatted by moneyNeedsModel. It picks ONE layout by
 * width: phone < 768 ≤ tablet < 1280 ≤ desktop (inspector column).
 *
 * @param {{ worksheet: object, year: number, years: number[], onYearChange: Function,
 *           onGroupSaved: Function, onOpenCalc: Function, openGroup: string|null,
 *           onToggleGroup: (key: string) => void, onOpenGamePlan?: Function,
 *           slots?: object }} props
 */
export default function FrMoneyNeeds({
  worksheet, year, years, onYearChange, onGroupSaved, onOpenCalc, openGroup, onToggleGroup, onOpenGamePlan, slots,
}) {
  const wide = useMinWidth(768);
  const desktop = useMinWidth(1280);
  const layout = !wide ? 'phone' : desktop ? 'desktop' : 'tablet';

  const model = useMemo(() => {
    const { filled, total } = countFilledLineItems(worksheet.expenseGroups);
    return {
      year,
      years,
      tally: `${filled} of ${total} filled`,
      worksheetTotal: formatCurrency(worksheet.totalAnnualAfterTax ?? 0),
      ladder: moneyNeedsLadder(payeBuildUp(worksheet)),
      donut: moneyNeedsDonut(compositionSegments(worksheet.expenseGroups, EXPENSE_GROUPS)),
      subCalcs: moneyNeedsSubCalcs(worksheet.subCalculators, { personalPct: CAR_PERSONAL_PCT, businessPct: CAR_BUSINESS_PCT }),
    };
  }, [worksheet, year, years]);

  const groups = EXPENSE_GROUPS.map(({ key, label }, i) => ({
    key,
    label,
    short: groupShort(key, label),
      node: (
        <FrMoneyNeedsGroup
          groupKey={key}
          label={label}
          colorIndex={i}
          group={worksheet.expenseGroups?.[key]}
          worksheetDoc={worksheet}
          onGroupSaved={onGroupSaved}
          onOpenCalc={onOpenCalc}
          layout={layout === 'phone' ? 'cards' : 'table'}
          open={openGroup === key}
          onToggle={layout === 'phone' ? undefined : () => onToggleGroup(key)}
        />
      ),
  }));

  return (
    <FrMoneyNeedsView
      layout={layout}
      model={model}
      groups={groups}
      slots={slots}
      onYearChange={onYearChange}
      onOpenCalc={onOpenCalc}
      onOpenGamePlan={onOpenGamePlan}
    />
  );
}
