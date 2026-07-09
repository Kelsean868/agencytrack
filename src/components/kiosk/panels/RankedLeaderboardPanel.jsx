import React, { useMemo } from 'react';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
  rankAgentsByApi,
} from '../../../lib/productionReport/computations';
import { ttdK } from '../../../lib/kiosk/kioskFormat';
import { useCountUp } from '../../../hooks/useCountUp';
import Avatar from '../Avatar';
import KioskMedal from '../KioskMedal';

/**
 * RankedLeaderboardPanel — the unified kiosk leaderboard centerpiece (3.6).
 *
 * Replaces the two flat API|Apps lists with a broadcast hero: a 3-up podium
 * (elevated champion center, medal coins, breathing halos, Champion/Runner-up/
 * Third labels), a WK/MTD/QTD/YTD chip selector marking the active view, and a
 * compact ranks-4–8 tail with API bars. One template renders all four period
 * panels. Ranked by settled API (primary production metric).
 *
 * Props:
 *   period      — 'week' | 'mtd' | 'quarter' | 'ytd' (productionReport keys)
 *   allSubmissions, allUsers
 */

const CHIPS = [
  { key: 'week',    label: 'WK' },
  { key: 'mtd',     label: 'MTD' },
  { key: 'quarter', label: 'QTD' },
  { key: 'ytd',     label: 'YTD' },
];

const TITLES = {
  week:    'This Week.',
  mtd:     'Month to Date.',
  quarter: 'Quarter to Date.',
  ytd:     'YTD Leaderboard.',
};

const RANK_META = {
  1: { label: 'Champion',    halo: 'kiosk-halo-gold',   api: 'text-presentation-gold' },
  2: { label: 'Runner-up',   halo: 'kiosk-halo-silver', api: 'text-presentation-accent' },
  3: { label: 'Third place', halo: 'kiosk-halo-bronze', api: 'text-presentation-accent' },
};

function AnimatedApi({ value }) {
  const display = useCountUp(value, { duration: 900 });
  return (
    <span className="motion-reduce:animate-none animate-count-up">{ttdK(display)}</span>
  );
}

function PodiumCard({ agent, center }) {
  const meta = RANK_META[agent.rank] ?? RANK_META[3];
  const avatarSize = center ? 'xl' : 'tv';
  return (
    <div
      className={`kiosk-glass${center ? '-raised' : ''} rounded-2xl relative overflow-hidden flex flex-col items-center text-center ${
        center ? 'px-5 pt-5 pb-6' : 'px-4 pt-4 pb-5'
      } motion-reduce:animate-none animate-count-up`}
      data-testid={`podium-card-rank-${agent.rank}`}
    >
      <div className="flex items-center gap-2">
        <KioskMedal rank={agent.rank} size={center ? 40 : 32} glow={agent.rank === 1} />
        <span
          className={`text-[0.68rem] font-mono font-bold uppercase tracking-[0.18em] ${meta.api}`}
        >
          {meta.label}
        </span>
      </div>

      <div className={`relative mt-3 flex items-center justify-center ${center ? 'h-24 w-24' : 'h-20 w-20'}`}>
        <div className={`kiosk-halo kiosk-halo-breathe ${meta.halo} inset-[-14%]`} />
        <div className="relative">
          <Avatar agent={{ uid: agent.agentId, name: agent.agentName, photoURL: agent.photoURL }} size={avatarSize} />
        </div>
      </div>

      <p
        className={`mt-3 font-display font-bold text-presentation-text tracking-tight truncate max-w-full ${
          center ? 'text-2xl' : 'text-xl'
        }`}
      >
        {agent.agentName}
      </p>
      {agent.unitLabel && (
        <p className="mt-1 text-[0.66rem] font-mono uppercase tracking-[0.12em] text-presentation-muted">
          {agent.unitLabel}
        </p>
      )}

      <p className={`mt-3 font-display font-bold tracking-tight leading-none ${meta.api} ${center ? 'text-4xl' : 'text-3xl'}`}>
        <AnimatedApi value={agent.totals.totalApi} />
      </p>
      <p className="mt-1 text-[0.66rem] font-mono uppercase tracking-[0.1em] text-presentation-muted">
        {agent.totals.totalApps} apps
      </p>
    </div>
  );
}

function TailRow({ agent, maxApi }) {
  const pct = maxApi > 0 ? Math.min(100, Math.round((agent.totals.totalApi / maxApi) * 100)) : 0;
  return (
    <div className="kiosk-glass rounded-xl flex items-center gap-4 px-4 py-2" data-testid={`tail-row-rank-${agent.rank}`}>
      <span className="w-8 text-right font-display font-bold text-presentation-muted text-lg">#{agent.rank}</span>
      <Avatar agent={{ uid: agent.agentId, name: agent.agentName, photoURL: agent.photoURL }} size="md" />
      <span className="flex-1 min-w-0 truncate font-semibold text-presentation-text text-lg">{agent.agentName}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--kiosk-surface-raised)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--kiosk-teal)' }} />
      </div>
      <span className="w-28 text-right font-display font-bold text-presentation-text text-lg">{ttdK(agent.totals.totalApi)}</span>
    </div>
  );
}

export default function RankedLeaderboardPanel({ period = 'ytd', allSubmissions = [], allUsers = [] }) {
  const ranked = useMemo(() => {
    const filtered = filterSubmissionsByPeriod(allSubmissions, period);
    const byAgent = {};
    for (const sub of filtered) {
      const aid = sub.agentId ?? sub.userId ?? '';
      if (!aid) continue;
      (byAgent[aid] ??= []).push(sub);
    }
    const arr = Object.entries(byAgent).map(([agentId, subs]) => {
      const user = allUsers.find((u) => u.id === agentId) ?? {};
      return {
        agentId,
        agentName: user.name || user.displayName || 'Agent',
        photoURL: user.photoURL ?? null,
        unitId: user.unitId ?? '',
        unitLabel: user.unitId ? `Unit ${String(user.unitId).slice(-4)}` : '',
        totals: computeAgentTotals(subs),
      };
    });
    return rankAgentsByApi(arr);
  }, [allSubmissions, allUsers, period]);

  const podium = ranked.slice(0, 3);
  const tail = ranked.slice(3, 8);
  const maxApi = ranked[0]?.totals.totalApi ?? 0;
  // Visual order: runner-up · champion · third — champion elevated center.
  const podiumOrder = [podium[1], podium[0], podium[2]];

  return (
    <div className="w-full h-full flex flex-col px-14 pt-12 pb-10">
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-[0.22em] text-presentation-gold">
            ★ Top of the board
          </p>
          <h1 className="mt-2 text-5xl font-display font-bold text-presentation-text tracking-tight">
            {TITLES[period] ?? TITLES.ytd}
          </h1>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Leaderboard period">
          {CHIPS.map((c) => {
            const active = c.key === period;
            return (
              <span
                key={c.key}
                data-testid={`period-chip-${c.label}`}
                data-active={active ? 'true' : 'false'}
                aria-current={active ? 'true' : undefined}
                className={`px-3.5 py-2 rounded-full text-xs font-mono font-bold tracking-[0.16em] ${
                  active
                    ? 'bg-presentation-accent text-presentation'
                    : 'text-presentation-muted border border-presentation-border'
                }`}
              >
                {c.label}
              </span>
            );
          })}
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-3xl text-presentation-muted">No production for this period yet</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 gap-4">
          <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-3.5 items-end">
            {podiumOrder.map((agent, i) =>
              agent ? (
                <PodiumCard key={agent.agentId} agent={agent} center={i === 1} />
              ) : (
                <div key={`empty-${i}`} aria-hidden="true" />
              )
            )}
          </div>
          {tail.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {tail.map((agent) => (
                <TailRow key={agent.agentId} agent={agent} maxApi={maxApi} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
