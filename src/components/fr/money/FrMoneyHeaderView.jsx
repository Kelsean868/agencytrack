import React from 'react';
import { ChartCard, Line } from '../charts';
import { TileGrid } from './moneyParts';
import ReinstatementPlanner, { PersistencyHistory } from './ReinstatementPlanner';
import { wholeTTD } from '../../../lib/fr/moneyModel';

/**
 * FrMoneyHeaderView — the FR glanceable header above one Money tab's existing
 * calculator (FR-3, FR-D5 "wrap, don't rewrite"). PURE: props only.
 *
 * Tiles for every tab; Goals adds the pace chart; Persistency adds the
 * month-by-month bars from the gate and the read-only reinstatement planner
 * (the two new visuals the canvas adds). The calculator itself renders below,
 * unchanged, so every input, output and action it has today stays.
 *
 * @param {{ tab: string, tiles: object[], loading?: boolean,
 *           pace?: object|null, series?: object|null, plan?: object|null }} props
 */
const TITLES = {
  goals: 'Goals and MDRT',
  'game-plan': 'Game plan',
  'money-needs': 'Money needs',
  commission: 'Commission',
  persistency: 'Persistency',
  financing: 'Financing',
};

export default function FrMoneyHeaderView({ tab, tiles, loading = false, pace = null, series = null, plan = null, reinstateActions = null }) {
  const title = TITLES[tab];
  if (!title) {
    if (import.meta.env.DEV) throw new Error(`FrMoneyHeaderView: unknown tab "${tab}"`);
    return null;
  }
  return (
    <div className="mb-5 flex flex-col gap-4 lg:gap-5" data-testid={`fr-money-header-${tab}`}>
      <TileGrid tiles={tiles} loading={loading} label={`${title} at a glance`} />
      {tab === 'goals' && pace ? (
        <ChartCard
          title={pace.title}
          subtitle={`Settled API, running total by issue month, against an even pace to ${pace.goalLabel}`}
          table={{
            caption: 'Settled API running total by month against an even pace',
            columns: [
              { key: 'month', label: 'Month' },
              { key: 'settled', label: 'Settled (running total)', align: 'right' },
              { key: 'pace', label: 'Even pace', align: 'right' },
            ],
            rows: pace.labels.map((m, i) => ({
              key: m,
              month: m,
              settled: pace.series[0].values[i] == null ? '—' : `TTD ${wholeTTD(pace.series[0].values[i])}`,
              pace: `TTD ${wholeTTD(pace.series[1].values[i])}`,
            })),
          }}
        >
          <Line series={pace.series} labels={pace.labels} format={(v) => `TTD ${wholeTTD(v)}`} height={180} />
        </ChartCard>
      ) : null}
      {tab === 'persistency' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 lg:col-span-5"><PersistencyHistory series={series} threshold={plan?.threshold ?? 90} /></div>
          <div className="min-w-0 lg:col-span-7"><ReinstatementPlanner plan={plan} actions={reinstateActions} /></div>
        </div>
      ) : null}
      <p className="text-[12px] text-ink-muted">The full {title.toLowerCase()} calculator is below.</p>
    </div>
  );
}
