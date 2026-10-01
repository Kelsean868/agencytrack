import React from 'react';
import { Trophy, ClipboardList, Zap } from 'lucide-react';
import { formatCurrency, formatDateFriendly } from '../../utils/formatters';

export function ChampionCard({ Icon, label, champion, medalClass, format }) {
  const isEmpty = !champion;
  const coinClass = isEmpty ? 'medal-locked' : `${medalClass} glow`;
  return (
    <div
      data-testid="champion-card"
      className="flex flex-col items-center gap-2 rounded-xl bg-card border border-primary/20 p-3 text-center"
    >
      <div className={`badge-medal ${coinClass}`} aria-hidden="true">
        <Icon className="medal-ico" size={26} strokeWidth={2} aria-hidden="true" />
      </div>
      {isEmpty ? (
        <p className="text-xs text-ink-muted italic">No data yet</p>
      ) : (
        <>
          <p className="text-sm font-bold text-ink truncate w-full">{champion.agentName}</p>
          <p className="text-xs text-ink-muted">{format(champion.value)}</p>
        </>
      )}
      <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
        {label}
      </p>
    </div>
  );
}

// `activityUnit` — what Top Activity's value is. 'count' (default): the legacy
// Leaderboard's client-side FFI + CI + apps count (utils/weeklyChampions.js).
// 'points': the weeklyChampions doc, which stores points since FR Leaderboard
// L-1 (brief D9); the Production Leaderboard passes this.
const ACTIVITY_FORMAT = {
  count: (v) => String(v),
  points: (v) => `${Number(v).toLocaleString('en-TT')} ${Number(v) === 1 ? 'point' : 'points'}`,
};

export default function WeeklyChampionsBanner({ champions, loading, activityUnit = 'count' }) {
  const formatActivity = ACTIVITY_FORMAT[activityUnit];
  if (!formatActivity) throw new Error(`WeeklyChampionsBanner: unknown activityUnit "${activityUnit}"`);
  if (loading) {
    return (
      <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 mb-4">
        <div className="h-3 w-36 rounded bg-primary/20 animate-pulse mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 rounded-xl border border-primary/20 bg-card p-3"
            >
              <div className="w-[52px] h-[52px] rounded-full bg-primary/15 animate-pulse" />
              <div className="h-3 w-20 rounded bg-primary/15 animate-pulse" />
              <div className="h-3 w-14 rounded bg-primary/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!champions) return null;

  const { topAPI, topApps, topActivity, weekStarting } = champions;
  const weekLabel = weekStarting ? formatDateFriendly(weekStarting) : '';

  const cards = [
    { Icon: Trophy,        label: 'Top API',      champion: topAPI,      medalClass: 'medal-1', format: (v) => formatCurrency(Math.round(v)) },
    { Icon: ClipboardList, label: 'Top Apps',     champion: topApps,     medalClass: 'medal-2', format: (v) => String(v) },
    { Icon: Zap,           label: 'Top Activity', champion: topActivity, medalClass: 'medal-3', format: formatActivity },
  ];

  const hasAnyData = topAPI || topApps || topActivity;

  return (
    <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 mb-4">
      <p className="text-xs font-bold uppercase tracking-wide text-primary mb-0.5">
        Last Week's Champions
      </p>
      <p className="text-[10px] text-ink-muted mb-3">
        {hasAnyData ? `Week of ${weekLabel}` : 'No submissions recorded last week'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((card) => (
          <ChampionCard
            key={card.label}
            Icon={card.Icon}
            label={card.label}
            champion={card.champion}
            medalClass={card.medalClass}
            format={card.format}
          />
        ))}
      </div>
    </div>
  );
}
