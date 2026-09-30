/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import ScenePage from '../ScenePage';
import React, { useState } from 'react';
import FrCareerView from '../../you/FrCareerView';
import useMinWidth from '../../../../hooks/useMinWidth';
import { currentLevel, quarterlyAPISeries } from '../../../../lib/career/careerModel';
import {
  ladderCoins, defaultSelectedLevel, levelPanel, levelRings, biggestGap, paceModel,
} from '../../../../lib/fr/careerViewModel';

/**
 * R2-10 harness scenes: the FR Career screen (canvas D3-Career / M3-Career).
 * SAMPLE stats run through the REAL careerModel / careerViewModel; the View
 * is pure, so the commitment hook is stood in for by plain values. Variant B
 * is the same agent later in the year (more API, apps and persistency), so
 * the rings, bars and columns glide. Figures are SAMPLE.
 */
const Y = new Date().getFullYear();
const STATS = {
  A: { ytdAPI: 214000, ytdApps: 26, avgPersistency: 88.5, yearsOfService: 3.4, trailing2YrAPI: 312400, weeklyPace: 5600 },
  B: { ytdAPI: 268000, ytdApps: 38, avgPersistency: 89.2, yearsOfService: 3.4, trailing2YrAPI: 338000, weeklyPace: 6100 },
};
function subs(scale) {
  return Array.from({ length: 24 }, (_, i) => ({
    status: 'submitted',
    weekStarting: `${Y - 1 + Math.floor(i / 12)}-${String(1 + (i % 12)).padStart(2, '0')}-07`,
    apiSold: Math.round((18000 + (i % 5) * 6500 + i * 900) * scale),
  }));
}
const SUBS = { A: subs(1), B: subs(1.3) };

function CareerScene({ variant = 'A', editing = false, commitState = 'ready' }) {
  const wide = useMinWidth(768);
  const desktop = useMinWidth(1280);
  const layout = !wide ? 'phone' : desktop ? 'desktop' : 'tablet';
  const stats = STATS[variant];
  const level = currentLevel(stats);
  const [picked, setPicked] = useState(null);
  const selected = picked ?? defaultSelectedLevel(level.level);
  const nextLevel = level.level < 7 ? level.level + 1 : null;
  const rings = nextLevel ? levelRings(nextLevel, stats) : [];
  const noop = () => {};
  const k = (v) => `TTD ${Math.round(v / 1000)}K`;
  const rows = [
    { key: 'api', label: 'Annual API', actual: stats.ytdAPI, mine: 350000, manager: 400000, floor: 250000, fmt: k },
    { key: 'apps', label: 'Annual applications', actual: stats.ytdApps, mine: 36, manager: 0, floor: 40, fmt: (v) => String(Math.round(v)) },
    { key: 'persistency', label: 'Persistency', actual: stats.avgPersistency, mine: 90, manager: 90, floor: 90, fmt: (v) => `${v.toFixed(2)}%` },
  ].map((r) => ({ ...r, belowFloor: r.mine < r.floor, aria: `${r.label} sample` }));
  return (
    <ScenePage className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 p-4 sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">R2-10 · Career · SAMPLE</p>
      <FrCareerView
        layout={layout}
        header={{ level: level.level, title: level.title, years: stats.yearsOfService }}
        coins={ladderCoins(level.level)}
        selected={selected}
        onSelect={setPicked}
        panel={levelPanel(selected, level.level, stats)}
        next={nextLevel ? { top: false, level: nextLevel, title: levelPanel(nextLevel, level.level, stats).title, rings, cleared: rings.filter((r) => r.cleared).length } : { top: true }}
        pace={paceModel(level.level, stats)}
        gap={nextLevel ? biggestGap(nextLevel, stats, new Date(Y, 8, 30)) : null}
        onPlan={noop}
        series={quarterlyAPISeries(SUBS[variant])}
        commitment={{
          year: Y, rows, loaded: commitState !== 'loading', loadFailed: commitState === 'error', retry: noop,
          editing, setEditing: noop, saving: false, saveError: '', setSaveError: noop,
          draft: { personalAnnualAPI: 350000, personalAnnualApps: 36, personalAnnualPersistency: 90 }, setDraft: noop,
          handleSave: noop, doSave: noop, showNudge: false, setShowNudge: noop, pendingDraft: null, setPendingDraft: noop, moneyNeedsRequired: 0,
        }}
        trophies={{ loading: false, error: false, onRetry: noop, earned: 9, total: 32 }}
        onOpenTrophies={noop}
      />
    </ScenePage>
  );
}
function CareerStatesScene() {
  return (
    <div className="flex flex-col">
      <CareerScene editing />
      <CareerScene commitState="loading" />
      <CareerScene commitState="error" />
    </div>
  );
}

export const CAREER_SCENES = [
  { id: 'career', title: 'You · Career', slice: 'R2-10', viewport: 'desktop,tablet,phone', hasVariants: true, render: CareerScene },
  { id: 'career-states', title: 'You · Career (edit · loading · error)', slice: 'R2-10', viewport: 'desktop,phone', render: CareerStatesScene },
];
