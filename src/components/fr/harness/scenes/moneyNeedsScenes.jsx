/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import ScenePage from '../ScenePage';
import React, { useMemo, useState } from 'react';
import FrMoneyNeedsView from '../../money/FrMoneyNeedsView';
import FrWorksheetGroup from '../../money/FrWorksheetGroup';
import FrMoneyHeaderView from '../../money/FrMoneyHeaderView';
import useMinWidth from '../../../../hooks/useMinWidth';
import { formatCurrency } from '../../../../utils/formatters';
import { compositionSegments } from '../../../../lib/moneyNeedsComposition';
import { EXPENSE_GROUPS, payeBuildUp } from '../../../agent/moneyNeedsShared';
import {
  moneyNeedsLadder, moneyNeedsDonut, moneyNeedsSubCalcs, moneyNeedsRow, moneyNeedsGroupHeader, groupShort,
} from '../../money/moneyNeedsModel';
import { headerTiles } from '../../../../lib/fr/moneyModel';

/**
 * R2-9 harness scenes: the FR Money needs worksheet (canvas D3M-MoneyNeeds /
 * M3-MoneyNeeds). The View and the group views get their strings from the
 * REAL moneyNeedsModel over a SAMPLE worksheet. Everything that reads a
 * service in the app (the commission targets panel / merged allocator, the
 * share toggle's write, the PAYE refresh) is a labelled placeholder here, and
 * the SAMPLE yearly figures and rollup are precomputed sample data (the app
 * gets them from annualizeAmount and the saved rollup).
 *
 * Variant B raises two lines and re-balances the rollup, so the donut arcs
 * glide and the figures change.
 */

const MULT = { A: 1, S: 2, Q: 4, M: 12 };
const L = (id, label, amount, frequency, extra = {}) => ({ id, label, amount, frequency, ...extra });

function sampleWorksheet(variant, firstRun) {
  const z = (n) => (firstRun ? 0 : n);
  const rent = variant === 'B' ? 66000 : 54000;
  const food = variant === 'B' ? 1800 : 2400;
  const groups = {
    fixedExpenses: [
      L('seed-fe-0', 'Rent or mortgage payments', z(rent), 'A'),
      L('seed-fe-1', 'Utilities – gas, heat, light, telephone, water', z(850), 'M'),
      L('seed-fe-2', 'Disability income insurance', 0, 'M'),
      L('seed-fe-5', 'Property taxes', 0, 'A'),
    ],
    livingExpenses: [
      L('seed-le-0', 'Food', z(food), 'M'),
      L('seed-le-1', 'Clothing', z(600), 'M'),
      L('seed-le-4', 'Car expenses, nonbusiness', z(2398), 'A', { calcKey: 'carExpenses.personal' }),
      L('seed-le-5', 'Medical – doctor, dentist, drugs', z(400), 'M'),
    ],
    businessExpenses: [
      L('seed-be-0', 'Sales promotion, advertising, direct mail, tuition', z(300), 'M'),
      L('seed-be-4', 'Business car expenses', z(4802), 'A', { calcKey: 'carExpenses.business' }),
      L('seed-be-7', 'Professional/industry expenses', z(3500), 'A', { calcKey: 'insuranceIndustry' }),
    ],
    savingsAccumulation: [
      L('seed-sa-0', 'Life insurance', z(350), 'M'),
      L('seed-sa-2', 'Debt reduction (non-mortgage)', z(1200), 'A', { calcKey: 'loansDebt', isOverridden: !firstRun }),
    ],
    miscellaneous: [
      L('seed-mi-0', 'Donations – religious, charitable, etc.', z(200), 'M'),
      L('custom-1', 'Gym membership', z(350), 'M', { isCustom: true }),
    ],
  };
  const expenseGroups = Object.fromEntries(Object.entries(groups).map(([k, items]) => [k, {
    lineItems: items,
    groupAnnualTotal: items.reduce((s, i) => s + i.amount * MULT[i.frequency], 0),
  }]));
  const after = Object.values(expenseGroups).reduce((s, g) => s + g.groupAnnualTotal, 0);
  // SAMPLE rollup (the app reads the saved grossFromNet result).
  const pre = after <= 90000 ? after : 90000 + (after - 90000) / 0.75;
  return {
    totalAnnualAfterTax: after,
    totalAnnualPreTax: Math.round(pre * 100) / 100,
    estimatedRenewalIncome: { total: firstRun ? 0 : 10000 },
    expenseGroups,
    subCalculators: {
      insuranceIndustry: { lineItems: [L('ii-0', 'Life License Renewal', z(500), 'A'), L('ii-1', 'CPD classes', z(3000), 'A'), L('ii-2', 'MDRT Convention', 0, 'A')], annualTotal: z(3500) },
      carExpenses: { lineItems: [L('ce-0', 'Gas/Petrol/Electric', z(600), 'M'), L('ce-1', 'Insurance', 0, 'A')], annualTotalPersonal: z(2398), annualTotalBusiness: z(4802) },
      loansDebt: { lineItems: [L('ld-1', 'Car Loan', z(150), 'M'), L('ld-3', 'Sou-sou', 0, 'M')], annualTotal: z(1800) },
    },
  };
}

function Frame({ children }) {
  return (
    <ScenePage className="mx-auto max-w-[1180px] px-4 py-6 md:px-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness</p>
      {children}
    </ScenePage>
  );
}

function Placeholder({ label }) {
  return (
    <div className="flex min-h-[96px] items-center justify-center rounded-[18px] border border-dashed border-border bg-card p-4 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">{label}</p>
    </div>
  );
}

function MoneyNeedsScene({ variant, firstRun = false }) {
  const wide = useMinWidth(768);
  const desktop = useMinWidth(1280);
  const layout = !wide ? 'phone' : desktop ? 'desktop' : 'tablet';
  const [openGroup, setOpenGroup] = useState('fixedExpenses');
  const ws = useMemo(() => sampleWorksheet(variant, firstRun), [variant, firstRun]);
  const noop = () => {};

  const model = useMemo(() => {
    const all = Object.values(ws.expenseGroups).flatMap((g) => g.lineItems);
    return {
      year: 2026,
      years: [2025, 2026, 2027],
      tally: `${all.filter((i) => i.amount > 0).length} of ${all.length} filled`,
      worksheetTotal: formatCurrency(ws.totalAnnualAfterTax),
      ladder: moneyNeedsLadder(payeBuildUp(ws)),
      donut: moneyNeedsDonut(compositionSegments(ws.expenseGroups, EXPENSE_GROUPS)),
      subCalcs: moneyNeedsSubCalcs(ws.subCalculators, { personalPct: 33.3, businessPct: 66.7 }),
    };
  }, [ws]);

  const groups = EXPENSE_GROUPS.map(({ key, label }, i) => {
    const items = ws.expenseGroups[key].lineItems;
    return {
      key,
      label,
      short: groupShort(key, label),
      node: (
        <FrWorksheetGroup
          groupKey={key}
          label={label}
          colorIndex={i}
          header={moneyNeedsGroupHeader({
            filledCount: items.filter((it) => it.amount > 0).length,
            count: items.length,
            total: ws.expenseGroups[key].groupAnnualTotal,
          })}
          rows={items.map((it) => moneyNeedsRow(it, it.amount * MULT[it.frequency]))}
          layout={layout === 'phone' ? 'cards' : 'table'}
          open={openGroup === key}
          onToggle={layout === 'phone' ? undefined : () => setOpenGroup((o) => (o === key ? null : key))}
          onChange={noop}
          onBlur={noop}
          onDelete={noop}
          onReset={noop}
          onAdd={noop}
          onOpenCalc={noop}
        />
      ),
    };
  });

  const tiles = headerTiles('money-needs', {
    rollup: firstRun ? null : {
      totalAnnualAfterTax: ws.totalAnnualAfterTax,
      totalAnnualPreTax: ws.totalAnnualPreTax,
      computedPAYE: ws.totalAnnualPreTax - ws.totalAnnualAfterTax,
    },
  });
  return (
    <Frame>
      <FrMoneyHeaderView tab="money-needs" tiles={tiles} />
      <FrMoneyNeedsView
        layout={layout}
        model={model}
        groups={groups}
        slots={{
          visibility: <Placeholder label="[existing share-with-managers toggle]" />,
          allocation: <Placeholder label="[existing commission targets · Send to Playground]" />,
        }}
        onYearChange={noop}
        onOpenCalc={noop}
        onOpenGamePlan={noop}
      />
    </Frame>
  );
}

function FirstRunScene({ variant }) {
  return <MoneyNeedsScene variant={variant} firstRun />;
}

export const MONEY_NEEDS_SCENES = [
  { id: 'money-needs', title: 'Money · Money needs (filled)', slice: 'R2-9', viewport: 'desktop,tablet,phone', hasVariants: true, pager: true, render: MoneyNeedsScene },
  { id: 'money-needs-first-run', title: 'Money · Money needs (first run)', slice: 'R2-9', viewport: 'desktop,tablet,phone', hasVariants: false, pager: true, render: FirstRunScene },
];
