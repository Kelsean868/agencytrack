import { useMemo } from 'react';
import { computeCampaignProgress, getDaysRemaining } from '../../utils/campaignEngine';
import { formatCurrency, formatDateFriendly } from '../../utils/formatters';

function DaysPill({ days }) {
  if (days > 7)  return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">{days} days left</span>;
  if (days >= 1) return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/15 text-warning">{days} day{days !== 1 ? 's' : ''} left</span>;
  if (days === 0) return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-danger/15 text-danger">Last day!</span>;
  return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-border/60 text-ink-muted">Ended</span>;
}

function MetricBar({ label, metric, current, threshold, pct, achieved }) {
  const isAPI = metric === 'apiSold';
  const currentFmt = isAPI ? formatCurrency(Math.round(current)) : String(Math.round(current));
  const threshFmt  = isAPI ? formatCurrency(Math.round(threshold)) : String(Math.round(threshold));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink">{currentFmt} / {threshFmt}</span>
          {achieved && (
            <span className="text-[10px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-full">✓ Achieved</span>
          )}
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-border/60 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${achieved ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RankLine({ rank, totalParticipants }) {
  if (rank === null) return <p className="text-xs text-ink-muted">No rankings yet</p>;
  if (rank === 1)   return <p className="text-xs font-semibold text-primary">🥇 You&apos;re leading!</p>;
  if (rank === 2)   return <p className="text-xs font-semibold text-ink">🥈 2nd place</p>;
  if (rank === 3)   return <p className="text-xs font-semibold text-ink">🥉 3rd place</p>;
  const suffix = rank === 11 || rank === 12 || rank === 13 ? 'th' : rank % 10 === 1 ? 'st' : rank % 10 === 2 ? 'nd' : rank % 10 === 3 ? 'rd' : 'th';
  return <p className="text-xs text-ink-muted">{rank}{suffix} of {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}</p>;
}

export default function CampaignCard({ campaign, submissions, agentId }) {
  const { metrics, allAchieved, rank, totalParticipants } = useMemo(
    () => computeCampaignProgress(campaign, submissions, agentId),
    [campaign, submissions, agentId]
  );

  const days = getDaysRemaining(campaign.endDate);

  return (
    <div className="rounded-xl bg-[var(--color-surface)] border-l-4 border-primary border border-primary/20 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-0.5">Active Campaign</p>
          <h3 className="font-display font-bold text-ink text-base leading-tight truncate">{campaign.name}</h3>
          {campaign.description && (
            <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{campaign.description}</p>
          )}
        </div>
        {days !== null && <DaysPill days={days} />}
      </div>

      {/* Prize + dates */}
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-ink">🏆 {campaign.prize}</p>
        <p className="text-xs text-ink-muted">
          {formatDateFriendly(campaign.startDate)} → {formatDateFriendly(campaign.endDate)}
        </p>
      </div>

      {/* Progress bars */}
      {metrics.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {metrics.map((m) => (
            <MetricBar key={m.metric} {...m} />
          ))}
        </div>
      )}

      {/* All-achieved banner */}
      {allAchieved && (
        <div className="rounded-lg bg-success/10 border border-success/20 px-3 py-2 text-xs font-semibold text-success text-center">
          🎉 All targets achieved!
        </div>
      )}

      {/* Rank footer */}
      <div className="border-t border-border pt-2">
        <RankLine rank={rank} totalParticipants={totalParticipants} />
      </div>
    </div>
  );
}
