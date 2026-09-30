import React, { useMemo, useState } from 'react';
import useMinWidth from '../../../hooks/useMinWidth';
import { useAuth } from '../../../context/AuthContext';
import useCareerCommitment from '../../profile/useCareerCommitment';
import useMyLeaderboardEntry from '../compete/useMyLeaderboardEntry';
import { trophyRoom } from '../../../lib/fr/competeModel';
import { careerStats, currentLevel, quarterlyAPISeries } from '../../../lib/career/careerModel';
import {
  ladderCoins, defaultSelectedLevel, levelPanel, levelRings, biggestGap, paceModel,
} from '../../../lib/fr/careerViewModel';
import { formatPersistencyPct } from '../../../lib/persistency/persistencyRounding';
import FrCareerView from './FrCareerView';

/**
 * FrCareer — the FR Career container (R2-10). The level, the estimate and the
 * stats come from src/lib/career/careerModel.js (the Nexus portal's own
 * logic); the annual commitment runs useCareerCommitment (the Nexus
 * GoalsSection's read / edit / save / nudge path); the trophies card reads the
 * same engine doc as R2-5's card. No new reads, no writes of its own.
 * Layout by width: phone < 768 ≤ tablet < 1280 ≤ desktop.
 *
 * @param {{ submissions: object[], user: object, persistencyData: object[],
 *           onOpenTrophies: Function, onPlan: Function }} props
 */
const CAREER_YEAR = new Date().getFullYear();

const fmtTtdK = (v) => `TTD ${Math.round((v || 0) / 1000).toLocaleString('en-TT')}K`;
const fmtCount = (v) => String(Math.round(v || 0));
const fmtPct = (v) => (v == null ? '—' : formatPersistencyPct(v));

export default function FrCareer({ submissions, user, persistencyData, onOpenTrophies, onPlan }) {
  const wide = useMinWidth(768);
  const desktop = useMinWidth(1280);
  const layout = !wide ? 'phone' : desktop ? 'desktop' : 'tablet';
  const { user: authUser, tenantId } = useAuth();

  const stats = useMemo(
    () => careerStats(submissions, persistencyData, user, CAREER_YEAR),
    [submissions, persistencyData, user],
  );
  const level = useMemo(() => currentLevel(stats), [stats]);
  const [picked, setPicked] = useState(null);
  const selected = picked ?? defaultSelectedLevel(level.level);

  const nextLevel = level.level < 7 ? level.level + 1 : null;
  const rings = nextLevel ? levelRings(nextLevel, stats) : [];
  const next = nextLevel
    ? { top: false, level: nextLevel, title: levelPanel(nextLevel, level.level, stats).title, rings, cleared: rings.filter((r) => r.cleared).length }
    : { top: true };

  const commitment = useCareerCommitment(CAREER_YEAR);
  const { mine, mgr, mins, resolvedAnnualAPIFloor } = commitment;
  const rows = [
    { key: 'api', label: 'Annual API', actual: stats.ytdAPI, mine: mine.api, manager: mgr.api, floor: resolvedAnnualAPIFloor, fmt: fmtTtdK },
    { key: 'apps', label: 'Annual applications', actual: stats.ytdApps, mine: mine.apps, manager: mgr.apps, floor: mins.annualApps, fmt: fmtCount },
    { key: 'persistency', label: 'Persistency', actual: stats.avgPersistency, mine: mine.persistency, manager: mgr.persistency, floor: mins.persistency, fmt: fmtPct },
  ].map((r) => ({
    ...r,
    belowFloor: Boolean(r.mine) && Boolean(r.floor) && r.mine < r.floor,
    aria: `${r.label}: ${r.fmt(r.actual ?? 0)} this year; your commitment ${r.mine ? r.fmt(r.mine) : 'not set'}; floor ${r.fmt(r.floor ?? 0)}${r.manager ? `; manager target ${r.fmt(r.manager)}` : ''}`,
  }));

  const trophiesRead = useMyLeaderboardEntry(tenantId, authUser?.uid);
  const room = useMemo(
    () => (trophiesRead.loading || trophiesRead.error ? null : trophyRoom(trophiesRead.entry)),
    [trophiesRead.loading, trophiesRead.error, trophiesRead.entry],
  );

  return (
    <FrCareerView
      layout={layout}
      header={{ level: level.level, title: level.title, years: stats.yearsOfService }}
      coins={ladderCoins(level.level)}
      selected={selected}
      onSelect={setPicked}
      panel={levelPanel(selected, level.level, stats)}
      next={next}
      pace={paceModel(level.level, stats)}
      gap={nextLevel ? biggestGap(nextLevel, stats) : null}
      onPlan={onPlan}
      series={quarterlyAPISeries(submissions)}
      commitment={{ ...commitment, year: CAREER_YEAR, rows }}
      trophies={{
        loading: trophiesRead.loading,
        error: Boolean(trophiesRead.error),
        onRetry: trophiesRead.retry,
        earned: room?.earnedCount ?? 0,
        total: room?.total ?? 0,
      }}
      onOpenTrophies={onOpenTrophies}
    />
  );
}
