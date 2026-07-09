import React, { useMemo } from 'react';
import {
  computeStandings,
  getDaysRemaining,
  PERSISTENCY_GATE_BANDS,
  GATE_BAND_RANGE_LABELS,
} from '../../../utils/campaignEngine';
import { ttdK } from '../../../lib/kiosk/kioskFormat';
import Avatar from '../Avatar';
import KioskMedal from '../KioskMedal';

/**
 * CampaignLeaderboardPanel — kiosk standings for one active, kiosk-flagged
 * campaign (3.6; the consumer of item 2.9's `kiosk` flag). Re-skins 2.9's
 * `computeStandings` for the theatrical stage: 3-up podium (metric + projected
 * prize), a ranks-4–7 tail, a prize headline, and the persistency-gate legend.
 *
 * DISPLAY ONLY — projected payouts are what an advisor WOULD win at their
 * current standing, never a committed release. Persistency is not fetched on
 * the wall (read-light): projections show the pre-gate gross and the gate strip
 * is the informational payout-scale legend.
 *
 * Props:
 *   campaign        — the campaign doc (kiosk === true, active)
 *   allSubmissions  — branch YTD submissions (already loaded by the shell)
 *   allUsers        — branch users (may be [] under SEC-012 → names → "Agent")
 */

const PLACE_LABEL = { 1: '1st place', 2: '2nd place', 3: '3rd place' };

function metricText(campaign, standing) {
  if (campaign?.standingsMetric === 'applicationsSold') return `${standing.appsTotal}`;
  return ttdK(standing.apiTotal);
}

function prizeFor(campaign, standing) {
  if (campaign?.structure === 'placement') {
    if (!standing.place) return null;
    return {
      label: PLACE_LABEL[standing.rank] ?? `#${standing.rank}`,
      cash: standing.projectedCash,
    };
  }
  if (!standing.tier) return null;
  const t = standing.tier;
  return {
    label: t.name || (t.level ? `Level ${t.level}` : 'Tier'),
    cash: standing.projectedCash,
  };
}

function PodiumCard({ campaign, standing, center }) {
  const meta = { 1: 'kiosk-halo-gold', 2: 'kiosk-halo-silver', 3: 'kiosk-halo-bronze' };
  const prize = prizeFor(campaign, standing);
  const apiClass = standing.rank === 1 ? 'text-presentation-gold' : 'text-presentation-accent';
  return (
    <div
      className={`kiosk-glass${center ? '-raised' : ''} rounded-2xl relative overflow-hidden flex flex-col items-center text-center ${
        center ? 'px-5 pt-5 pb-6' : 'px-4 pt-4 pb-5'
      }`}
      data-testid={`campaign-podium-rank-${standing.rank}`}
    >
      <KioskMedal rank={standing.rank} size={center ? 60 : 48} glow={standing.rank === 1} />
      <div className={`relative mt-3 flex items-center justify-center ${center ? 'h-[68px] w-[68px]' : 'h-14 w-14'}`}>
        <div className={`kiosk-halo kiosk-halo-breathe ${meta[standing.rank] ?? meta[3]} inset-[-14%]`} />
        <div className="relative">
          <Avatar agent={{ uid: standing.agentId, name: standing.name, photoURL: standing.photoURL }} size={center ? 'tv' : 'lg'} />
        </div>
      </div>
      <p className={`mt-3 font-display font-bold text-presentation-text tracking-tight truncate max-w-full ${center ? 'text-2xl' : 'text-xl'}`}>
        {standing.name}
      </p>
      {standing.unit && (
        <p className="mt-1 text-[0.64rem] font-mono uppercase tracking-[0.1em] text-presentation-muted">{standing.unit}</p>
      )}
      <p className={`mt-2.5 font-display font-bold tracking-tight leading-none ${apiClass} ${center ? 'text-3xl' : 'text-2xl'}`}>
        {metricText(campaign, standing)}
      </p>
      {prize && (
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-presentation-gold/15">
          <span className="text-presentation-gold text-sm" aria-hidden="true">★</span>
          <span className="text-xs font-mono font-bold text-presentation-gold">
            {prize.label} · {ttdK(prize.cash)}
          </span>
        </div>
      )}
    </div>
  );
}

function TailRow({ campaign, standing, maxMetric }) {
  const value = campaign?.standingsMetric === 'applicationsSold' ? standing.appsTotal : standing.apiTotal;
  const pct = maxMetric > 0 ? Math.min(100, Math.round((value / maxMetric) * 100)) : 0;
  const prize = prizeFor(campaign, standing);
  return (
    <div className="kiosk-glass rounded-xl flex items-center gap-4 px-4 py-2" data-testid={`campaign-tail-rank-${standing.rank}`}>
      <span className="w-7 text-right font-display font-bold text-presentation-muted text-lg">{standing.rank}</span>
      <Avatar agent={{ uid: standing.agentId, name: standing.name, photoURL: standing.photoURL }} size="md" />
      <span className="w-44 shrink-0 min-w-0 truncate font-semibold text-presentation-text">{standing.name}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--kiosk-surface-raised)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: prize ? 'var(--kiosk-gold)' : 'var(--kiosk-teal)' }}
        />
      </div>
      <span className="w-24 text-right font-display font-bold text-presentation-text">{metricText(campaign, standing)}</span>
      <span className={`w-20 text-right text-xs font-mono font-bold ${prize ? 'text-presentation-gold' : 'text-presentation-muted'}`}>
        {prize ? ttdK(prize.cash) : '—'}
      </span>
    </div>
  );
}

function GateLegend() {
  return (
    <div className="flex gap-2">
      {PERSISTENCY_GATE_BANDS.map((b, i) => (
        <div key={b.min} className="flex-1 rounded-lg px-2.5 py-2 bg-presentation-gold/10 border border-presentation-border">
          <div className="text-[0.6rem] font-mono font-bold text-presentation-muted">{GATE_BAND_RANGE_LABELS[i]}</div>
          <div className="text-sm font-display font-bold text-presentation-text">{b.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function CampaignLeaderboardPanel({ campaign, allSubmissions = [], allUsers = [] }) {
  const standings = useMemo(() => {
    if (!campaign) return [];
    const start = typeof campaign.startDate === 'string' ? campaign.startDate.slice(0, 10) : '0000-00-00';
    const end = typeof campaign.endDate === 'string' ? campaign.endDate.slice(0, 10) : '9999-12-31';
    const windowed = (allSubmissions || []).filter((s) => {
      const ws = s.weekStarting;
      return typeof ws === 'string' && ws >= start && ws <= end;
    });

    // Participants: branch agents from user docs, unioned with any agentId that
    // appears in the windowed submissions (so standings work even when the
    // users list is denied under SEC-012 — name then degrades to "Agent").
    const byId = {};
    for (const u of allUsers || []) {
      if (u.role && u.role !== 'agent') continue;
      byId[u.id] = {
        id: u.id,
        name: u.name || u.displayName || 'Agent',
        unit: u.unitId ? `Unit ${String(u.unitId).slice(-4)}` : null,
        photoURL: u.photoURL ?? null,
      };
    }
    for (const s of windowed) {
      const aid = s.agentId ?? s.userId ?? '';
      if (!aid || byId[aid]) continue;
      byId[aid] = { id: aid, name: 'Agent', unit: null, photoURL: null };
    }
    const participants = Object.values(byId);
    const rows = computeStandings(campaign, windowed, participants, {});
    // Carry photoURL through for the avatar (computeStandings drops it).
    return rows.map((r) => ({ ...r, photoURL: byId[r.agentId]?.photoURL ?? null }));
  }, [campaign, allSubmissions, allUsers]);

  const podium = standings.slice(0, 3);
  const tail = standings.slice(3, 7);
  const podiumOrder = [podium[1], podium[0], podium[2]];
  const metricKey = campaign?.standingsMetric === 'applicationsSold' ? 'appsTotal' : 'apiTotal';
  const maxMetric = standings[0]?.[metricKey] ?? 0;
  const daysLeft = getDaysRemaining(typeof campaign?.endDate === 'string' ? campaign.endDate.slice(0, 10) : null);
  const gateEnabled = campaign?.persistencyGateEnabled !== false;

  const kind = campaign?.scope?.type;
  const kindLabel = kind === 'branch' ? '★ Branch campaign' : kind === 'unit' ? '★ Unit campaign' : '★ Campaign';

  // Prize headline
  const topTier = Array.isArray(campaign?.tiers) && campaign.tiers.length
    ? [...campaign.tiers].sort((a, b) => (Number(b.cash) || 0) - (Number(a.cash) || 0))[0]
    : null;
  const placements = Array.isArray(campaign?.placements) ? campaign.placements : [];

  return (
    <div className="w-full h-full flex flex-col px-14 pt-11 pb-9">
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-[0.22em] text-presentation-gold">{kindLabel}</p>
          <h1 className="mt-2 text-4xl font-display font-bold text-presentation-text tracking-tight truncate max-w-[42rem]">
            {campaign?.name ?? 'Campaign'}
          </h1>
        </div>
        {daysLeft != null && daysLeft >= 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-presentation-hot/15 border border-presentation-hot/40">
            <span className="w-2 h-2 rounded-full bg-presentation-hot motion-reduce:animate-none animate-kiosk-pulse-dot" />
            <span className="text-sm font-mono font-bold tracking-[0.12em] text-presentation-text">
              {daysLeft} DAYS LEFT
            </span>
          </div>
        )}
      </div>

      {standings.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-3xl text-presentation-muted">No standings yet</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[1.55fr_1fr] gap-6 min-h-0">
          <div className="flex flex-col gap-4 min-h-0">
            <div className="grid grid-cols-[1fr_1.15fr_1fr] gap-3 items-end">
              {podiumOrder.map((s, i) =>
                s ? (
                  <PodiumCard key={s.agentId} campaign={campaign} standing={s} center={i === 1} />
                ) : (
                  <div key={`empty-${i}`} aria-hidden="true" />
                )
              )}
            </div>
            {tail.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {tail.map((s) => (
                  <TailRow key={s.agentId} campaign={campaign} standing={s} maxMetric={maxMetric} />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 min-h-0">
            <div className="kiosk-glass rounded-2xl px-5 py-5">
              <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-presentation-gold">★ The prize</p>
              {campaign?.structure === 'placement' ? (
                <div className="flex gap-2.5 mt-3">
                  {placements.slice(0, 3).map((p) => (
                    <div key={p.rank} className="flex-1 text-center rounded-xl px-2 py-3 bg-presentation-gold/5 border border-presentation-border">
                      <div className="text-xs font-mono font-bold text-presentation-gold">
                        {p.rank === 1 ? '1ST' : p.rank === 2 ? '2ND' : `${p.rank}TH`}
                      </div>
                      <div className="mt-1 text-lg font-display font-bold text-presentation-text">{ttdK(p.prize)}</div>
                    </div>
                  ))}
                </div>
              ) : topTier ? (
                <>
                  <div className="mt-2.5 text-3xl font-display font-bold text-presentation-gold tracking-tight leading-none">
                    Up to {ttdK(topTier.cash)}
                  </div>
                  <p className="mt-2 text-sm text-presentation-muted leading-relaxed">
                    {Array.isArray(campaign?.tiers) && campaign.tiers.length > 1
                      ? `${campaign.tiers.length} tiers — reach a level, win its cash.`
                      : 'Settle the target and the prize is yours.'}
                  </p>
                </>
              ) : (
                <p className="mt-2.5 text-lg text-presentation-muted">{campaign?.prize || 'See your manager for details.'}</p>
              )}
            </div>

            {gateEnabled && (
              <div className="kiosk-glass rounded-2xl px-5 py-5">
                <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-presentation-gold">★ Persistency gate</p>
                <p className="mt-2 mb-3 text-xs text-presentation-muted leading-relaxed">
                  Every payout scales by quality. Projections shown are before the gate.
                </p>
                <GateLegend />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
