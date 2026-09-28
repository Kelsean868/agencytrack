import React, { useMemo, useState } from 'react';
import { getTodayTT } from '../../../utils/dateInputs';
import { weeklyFloors, thisWeekActuals } from '../../dashboard/HomeV2/homeDerivations';
import { funnel, yearActuals, board } from '../../../lib/fr/workModel';
import FrPipelineView from './FrPipelineView';

/**
 * FrPipeline — CONTAINER for FR "Pipeline" (FR-4, route `pipeline`). No reads
 * of its own: this week's actuals are the Standard drawer's (thisWeekActuals
 * over the week's daily entries / report), the year's are this year's
 * submitted reports, the board is own (filtered) policies. No writes.
 */
export default function FrPipeline({ allSubmissions, currentWeekSub, weekDailyDocs, resolvedMinimums, policies }) {
  const [view, setView] = useState('funnel');
  const [period, setPeriod] = useState('week');
  const todayTT = getTodayTT();
  const year = Number(todayTT.slice(0, 4));
  const floors = useMemo(() => weeklyFloors(resolvedMinimums), [resolvedMinimums]);

  const { stages, note } = useMemo(() => {
    if (period === 'year') {
      const y = yearActuals(allSubmissions, year);
      return {
        stages: funnel({ values: y.values, floors, weeks: Math.max(1, y.weeks) }),
        note: y.weeks
          ? `${year}, from ${y.weeks} submitted weekly ${y.weeks === 1 ? 'report' : 'reports'}; minimums are the weekly minimum × ${y.weeks}.`
          : `${year}: no weekly report submitted yet.`,
      };
    }
    const a = thisWeekActuals({ currentWeekSub, dailyDocs: weekDailyDocs });
    return {
      stages: funnel({ values: a?.values ?? {}, floors, weeks: 1 }),
      note: a?.source === 'final' ? 'This week, from your submitted weekly report.' : 'This week so far, from your daily logs. A dash means not captured yet.',
    };
  }, [period, allSubmissions, year, floors, currentWeekSub, weekDailyDocs]);

  const cols = useMemo(() => (Array.isArray(policies) ? board({ policies, todayTT }) : null), [policies, todayTT]);

  return (
    <FrPipelineView
      view={view}
      onView={setView}
      period={period}
      onPeriod={setPeriod}
      funnel={stages}
      periodNote={note}
      board={cols}
    />
  );
}
