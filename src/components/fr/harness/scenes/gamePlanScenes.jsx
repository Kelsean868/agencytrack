/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import ScenePage from '../ScenePage';
import React, { useMemo } from 'react';
import FrGamePlanView from '../../money/FrGamePlanView';
import FrMoneyHeaderView from '../../money/FrMoneyHeaderView';
import SuggestedWeekCard from '../../../dashboard/GamePlanV2/SuggestedWeekCard';
import useMinWidth from '../../../../hooks/useMinWidth';
import { gamePlanModel, FR_SUGGESTED_WEEK_SURFACE } from '../../money/gamePlanModel';
import { headerTiles } from '../../../../lib/fr/moneyModel';
import { getRecentSundays } from '../../../../utils/validators';

/**
 * R2-8 harness scenes: the FR Game plan (canvas D3M-GamePlan / M3-GamePlan).
 * The View gets a model built by the REAL gamePlanModel from SAMPLE hub
 * values; the suggested week is the REAL SuggestedWeekCard (it is pure — no
 * service) on its FR surface. The manager-suggestions card reads a service,
 * so it is a labelled placeholder here.
 *
 * Variant B re-splits the monthly plan and the year plan (same total, same
 * funded lines — a list gaining a row is not a glide), so the month columns
 * and the line bars glide.
 */

const LINES_A = { life: { enabled: true, targetAPI: 400000 }, ah: { enabled: true, targetAPI: 150000 }, general: { enabled: false, targetAPI: 50000 } };
const LINES_B = { life: { enabled: true, targetAPI: 330000 }, ah: { enabled: true, targetAPI: 220000 }, general: { enabled: false, targetAPI: 50000 } };
const TARGETS_A = [30000, 30000, 35000, 40000, 45000, 45000, 45000, 50000, 55000, 60000, 60000, 55000];
const TARGETS_B = [45000, 45000, 45000, 45000, 45000, 45000, 45000, 45000, 50000, 50000, 50000, 40000];
const ACTUALS = [0, 0, 0, 0, 0, 0, 33000, 75000, 37000, 0, 0, 0];

// Ten submitted SAMPLE weeks → the planner derives its ratios (≥ 8 weeks).
const SUBMISSIONS = Array.from({ length: 10 }, (_, i) => ({
  id: `s${i}`, status: 'submitted', weekStarting: `2026-0${7 + Math.floor(i / 5)}-0${1 + (i % 5)}`,
  ciConducted: 3, applicationsSold: 1, referralCalls: 20, coldCalls: 40,
}));
const FLOORS = { callsMade: 40, telContacts: 40, factFindsCompleted: 10, closingInterviewsKept: 10, applicationsSubmitted: 1 };
const COMMITTED_PLAN = {
  targets: { callsMade: 80, telContacts: 40, factFindsCompleted: 10, closingInterviewsKept: 12, applicationsSubmitted: 3 },
  provenance: { callsMade: 'derived', telContacts: 'floor', factFindsCompleted: 'floor', closingInterviewsKept: 'derived', applicationsSubmitted: 'agent' },
  anchorAPIAtCommit: 550000,
  committedAt: { toDate: () => new Date(2026, 8, 20, 9, 0, 0) },
};
const DAILY = [{ callsMade: 22, telContacts: 12, factFindsCompleted: 3, closingInterviewsKept: 4, applicationsSubmitted: 1 }];

function values(variant, committed) {
  const targets = variant === 'B' ? TARGETS_B : TARGETS_A;
  return {
    year: 2026,
    afterTaxNeed: 191460,
    renewalsCover: 25280,
    grossNeed: 225280,
    commissionNeed: 200000,
    moneyNeedsFilled: true,
    loopEnabled: true,
    yearPlanFilled: true,
    yearPlanTotalAPI: 550000,
    yearPlanLines: variant === 'B' ? LINES_B : LINES_A,
    lineKeys: ['life', 'ah', 'general'],
    monthlyPlanFilled: true,
    monthlyPlanTotal: 550000,
    monthlyTargets: targets,
    monthlyActuals: ACTUALS,
    currentMonthIndex: 8,
    monthlyYtdDelta: ACTUALS.slice(0, 9).reduce((s, v) => s + v, 0) - targets.slice(0, 9).reduce((s, v) => s + v, 0),
    committed,
    committedAt: committed ? new Date(Date.UTC(2026, 8, 1, 16, 0, 0)) : null,
    committedAnnualAPI: 550000,
    stepsBuilt: committed ? 3 : 2,
    totalSteps: 3,
    planBuiltPct: committed ? 100 : 67,
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

function SuggestionsPlaceholder() {
  return (
    <div className="flex min-h-[96px] items-center justify-center rounded-[18px] border border-dashed border-border bg-card p-4 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">[existing manager-suggestions card — quiet when empty]</p>
    </div>
  );
}

function GamePlanScene({ variant, committed = false }) {
  const wide = useMinWidth(768);
  const model = useMemo(() => gamePlanModel(values(variant, committed)), [variant, committed]);
  const weekStart = useMemo(() => getRecentSundays(1)[0], []);
  const noop = () => {};
  const week = (
    <SuggestedWeekCard
      committedAnnualAPI={550000}
      avgPolicyAPI={15000}
      prospectRatio={3}
      submissions={SUBMISSIONS}
      floors={FLOORS}
      onBuildPlan={noop}
      weekLabel="Wk 39"
      committedPlan={committed ? COMMITTED_PLAN : null}
      onCommit={async () => {}}
      onDeletePlan={noop}
      weekStart={weekStart}
      dailyDocs={committed ? DAILY : []}
      surfaceClassName={FR_SUGGESTED_WEEK_SURFACE}
    />
  );
  const tiles = headerTiles('game-plan', { committedAnnualAPI: 550000, avgPolicyAPI: 15000, weeklyApiFloor: 10000 });
  return (
    <Frame>
      <FrMoneyHeaderView tab="game-plan" tiles={tiles} />
      <FrGamePlanView
        model={model}
        wide={wide}
        onOpenMoneyNeeds={noop}
        onOpenMonthlyPlan={noop}
        onOpenReviewCommit={noop}
        slots={{ suggestedWeek: week, suggestions: <SuggestionsPlaceholder /> }}
      />
    </Frame>
  );
}

function CommittedScene({ variant }) {
  return <GamePlanScene variant={variant} committed />;
}

export const GAME_PLAN_SCENES = [
  { id: 'money-gameplan', title: 'Money · Game plan (in progress)', slice: 'R2-8', viewport: 'desktop,tablet,phone', hasVariants: true, pager: true, render: GamePlanScene },
  { id: 'money-gameplan-committed', title: 'Money · Game plan (committed)', slice: 'R2-8', viewport: 'desktop,tablet,phone', hasVariants: true, pager: true, render: CommittedScene },
];
