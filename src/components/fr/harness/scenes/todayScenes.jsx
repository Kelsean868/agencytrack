/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import ScenePage from '../ScenePage';
import React, { useMemo } from 'react';
import FrTodayView from '../../today/FrTodayView';
import useMinWidth from '../../../../hooks/useMinWidth';
import { buildTodayModel } from '../../../../lib/fr/todayModel';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../../utils/weeklyActivityFloors';
import { elapsedWorkingDays } from '../../../../utils/planVariance';
import {
  buildDoNextItems, firstBehindStandardRow,
} from '../../../dashboard/HomeV2/homeDerivations';
import LedgerReconciliationNote from '../../../dashboard/HomeV2/LedgerReconciliationNote';
import NeedsActionBanner from '../../../dashboard/HomeV2/NeedsActionBanner';

/**
 * FR-2 harness scene: the Today screen (FrTodayView) with SAMPLE inputs run
 * through the real buildTodayModel — the canvas figures (settled 87,146 / 5
 * apps; 36,000 / 1 app submitted, not settled; MDRT 688,800; persistency
 * 86.63 %, this month's estimate) and week-40 activity against the company weekly minimums.
 * Variant B = more activity this week + a 48,000 policy settled in May (large
 * enough that the hero bar moves ~15px on a phone — a 12,000 change moved it
 * under 4px, inside the probe's rounding band). Lists keep their length
 * between A and B so the glide probe measures geometry, not layout shifts.
 *
 * Slots that read Firebase (campaign card, points, recent, delivery) are
 * placeholders; the ledger note and the daily nudge are the real, pure
 * components so their FR restyle is checked by axe.
 */

const TODAY = '2026-10-01'; // Thursday of week 40 (4 working days in)
const WEEK_START = '2026-09-27';

const SAMPLE = {
  A: {
    settled: { api: 87146.28, apps: 5, count: 5, fromHeadOffice: 3, selfConfirmed: 2 },
    pending: { api: 36000, apps: 1, count: 1 },
    months: [['2026-02', 6000], ['2026-04', 7200], ['2026-07', 21600], ['2026-08', 22346.28], ['2026-09', 30000]],
    persistency: { pct: 86.63, monthKey: '2026-10', kind: 'estimate' },
    week: { callsMade: null, telContacts: 22, appointmentsScheduled: 9, interviewsKept: 6, factFindsCompleted: 3, closingInterviewsKept: 3, applicationsSubmitted: 0, clientsSold: 0, referralsNewLeads: 41 },
    confirm: 2,
    reinstate: 7100,
  },
  B: {
    settled: { api: 135146.28, apps: 6, count: 6, fromHeadOffice: 3, selfConfirmed: 3 },
    pending: { api: 36000, apps: 1, count: 1 },
    months: [['2026-02', 6000], ['2026-04', 7200], ['2026-05', 48000], ['2026-07', 21600], ['2026-08', 22346.28], ['2026-09', 30000]],
    persistency: { pct: 88.21, monthKey: '2026-10', kind: 'estimate' },
    week: { callsMade: null, telContacts: 31, appointmentsScheduled: 13, interviewsKept: 9, factFindsCompleted: 5, closingInterviewsKept: 4, applicationsSubmitted: 1, clientsSold: 1, referralsNewLeads: 58 },
    confirm: 1,
    reinstate: 4300,
  },
};

function sampleModel(variant) {
  const s = SAMPLE[variant] ?? SAMPLE.A;
  const production = {
    year: 2026,
    settled: s.settled,
    submitted: { api: 123146.28, apps: 6, count: 6, datedByIssue: true, weekApi: 0 },
    pending: s.pending,
    weekly: { ytdApi: 123146.28, weekApi: 0 },
    mismatch: { ytd: 0, week: 0 },
  };
  const floors = { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS };
  const actuals = { source: 'daily', values: s.week };
  const behind = firstBehindStandardRow({ floors, actuals, elapsed: elapsedWorkingDays(WEEK_START, TODAY) });
  const doNextItems = buildDoNextItems({
    awaitingConfirmCount: s.confirm,
    gateMonth: { meetsThreshold: false, threshold: 90, gap: { reinstateNeeded: s.reinstate } },
    behind,
  });
  return {
    production,
    model: buildTodayModel({
      production,
      floors,
      actuals,
      weekStart: WEEK_START,
      doNextItems,
      currentWeekSub: null,
      persistencyNow: s.persistency,
      settledByMonth: s.months.map(([month, api]) => ({ month, api })),
      todayTT: TODAY,
      hourTT: 9,
      displayName: 'Kyron Marchan',
    }),
  };
}

function Placeholder({ label, className = 'min-h-[120px]' }) {
  return (
    <div className={`flex items-center justify-center rounded-[18px] border border-dashed border-border bg-card p-4 text-center ${className}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">[{label}]</p>
    </div>
  );
}

function TodayScene({ variant }) {
  const { model, production } = useMemo(() => sampleModel(variant), [variant]);
  const wide = useMinWidth(768); // same switch as the FrToday container
  const noop = () => {};
  const slots = {
    banner: null,
    nudge: <NeedsActionBanner onLog={noop} />,
    reconciliation: <LedgerReconciliationNote production={production} onOpenLedgerCreate={noop} />,
    campaign: <Placeholder label="existing campaign card (compact)" className="min-h-[180px]" />,
    points: <Placeholder label="existing My Points card" />,
    recent: <Placeholder label="existing Recent list" className="min-h-[200px]" />,
    delivery: <Placeholder label="existing Policies to deliver" className="min-h-[140px]" />,
  };
  return (
    <ScenePage className="mx-auto max-w-[1180px] px-4 py-6 md:px-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness</p>
      <FrTodayView model={model} wide={wide} onRetry={noop} onNavigate={noop} onAction={noop} slots={slots} />
    </ScenePage>
  );
}

export const TODAY_SCENES = [
  { id: 'today', title: 'Today (agent home)', slice: 'FR-2', viewport: 'desktop,tablet,phone', hasVariants: true, render: TodayScene },
];
