import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import {
  PERSISTENCY_GATE_BANDS,
  GATE_BAND_RANGE_LABELS,
  gateBandFor,
} from '../../utils/campaignEngine';
import { formatCurrency } from '../../utils/formatters';

// Campaigns v2 — DISPLAY-ONLY standings surfaces.
//
// Renders ranked standings, the prize-tier ladder, the placement podium, the
// persistency-gate bands, and PROJECTED payouts. Every payout shown is a
// projection at the advisor's current standing — never a committed amount.
// There is no close / confirm / release flow here by design.

// ── Tone → static class map (gold-rule compliant) ─────────────────────────────
// Small/normal gold TEXT uses text-gold-ink (AA-safe); text-gold is decoration.
const GATE_TONE = {
  success: { chip: 'bg-success/10 text-success-ink', active: 'bg-success text-white', pill: 'bg-success/15 text-success-ink' },
  gold:    { chip: 'bg-gold/10 text-gold-ink',       active: 'bg-gold text-white',    pill: 'bg-gold/15 text-gold-ink' },
  warning: { chip: 'bg-warning/10 text-warning-ink', active: 'bg-warning text-white', pill: 'bg-warning/15 text-warning-ink' },
  danger:  { chip: 'bg-surface-muted text-danger-ink', active: 'bg-danger text-white', pill: 'bg-danger/15 text-danger-ink' },
};

function initialsOf(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Initials({ name, gold = false, size = 30 }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full font-display font-bold shrink-0 ${
        gold ? 'bg-gold/15 text-gold-ink' : 'bg-primary/10 text-primary'
      }`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initialsOf(name)}
    </span>
  );
}

// ── Persistency gate strip — the signature multiplier visual ──────────────────
export function PersistencyGateStrip({ bands = PERSISTENCY_GATE_BANDS, currentPct = null }) {
  const activeBand = gateBandFor(currentPct);
  return (
    <div className="flex items-stretch gap-1.5" role="group" aria-label="Persistency gate bands">
      {bands.map((b, i) => {
        const tone = GATE_TONE[b.tone] ?? GATE_TONE.warning;
        const isActive = activeBand === b;
        return (
          <div
            key={b.min}
            className={`relative flex-1 rounded-lg px-2 py-1.5 border border-transparent ${
              isActive ? tone.active : tone.chip
            }`}
          >
            <div className={`text-[9px] font-mono font-bold tracking-wide ${isActive ? 'text-white' : ''}`}>
              {GATE_BAND_RANGE_LABELS[i] ?? `≥${b.min}%`}
            </div>
            <div className={`font-display font-bold text-sm leading-tight mt-0.5 ${isActive ? 'text-white' : ''}`}>
              {b.label}
            </div>
            <div className={`text-[8px] mt-0.5 ${isActive ? 'text-white/85' : 'text-ink-muted'}`}>
              {b.payout === 0 ? 'no payout' : 'of prize'}
            </div>
            {isActive && (
              <span className="absolute -top-1.5 right-1.5 text-[8px] font-mono font-bold text-white bg-primary px-1 rounded-full border border-surface">
                YOU
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Persistency + gate pill (a standings cell / chip) ─────────────────────────
export function GatePill({ persPct, band }) {
  if (persPct == null) {
    return <span className="text-[10px] font-mono text-ink-muted italic">no data</span>;
  }
  const tone = GATE_TONE[band?.tone ?? 'warning'] ?? GATE_TONE.warning;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs font-mono font-bold text-ink tabular-nums">{persPct}%</span>
      <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded-full ${tone.pill}`}>
        {band?.label ?? '—'}
      </span>
    </span>
  );
}

// ── Prize tier ladder (qualify structure) ─────────────────────────────────────
export function TierLadder({ campaign, standings }) {
  const tiers = useMemo(
    () => [...(campaign.tiers ?? [])].sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0)),
    [campaign.tiers],
  );
  const multi = tiers.length > 1;

  return (
    <div className="flex flex-col gap-1.5">
      {tiers.map((tr) => {
        const reached = standings.filter((s) => s.qualified && s.tier && s.tier.level === tr.level);
        const on = reached.length > 0;
        return (
          <div
            key={tr.level}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border ${
              on ? 'bg-gold/10 border-gold/40' : 'bg-surface-raised border-border'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-display font-extrabold text-xs ${
                on ? 'bg-gold text-white' : 'bg-surface-muted text-ink-muted'
              }`}
            >
              {multi ? `L${tr.level}` : '✓'}
            </div>
            <div className="w-32 shrink-0 min-w-0">
              <div className="text-sm font-bold text-ink truncate">{tr.name}</div>
              <div className="text-[10.5px] font-mono text-ink-muted">
                {Number(tr.api) > 0 ? `${formatCurrency(tr.api)} · ${tr.apps} apps` : `${tr.apps} apps`}
              </div>
            </div>
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              {reached.length > 0 ? (
                reached.slice(0, 6).map((r, i) => (
                  <span key={r.agentId} style={{ marginLeft: i ? -8 : 0 }} className="rounded-full ring-2 ring-gold/20">
                    <Initials name={r.name} gold size={24} />
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-ink-muted italic">none yet</span>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="font-display font-bold text-sm text-gold-ink">{formatCurrency(tr.cash)}</div>
              <div className="text-[10px] font-mono text-ink-muted">
                {Number(tr.voucher) > 0 ? `+ ${formatCurrency(tr.voucher)} voucher` : tr.perk || 'cash prize'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Placement podium (placement structure) ────────────────────────────────────
export function PlacementPodium({ campaign, standings }) {
  const ranked = standings; // already ranked by computeStandings
  const order = [ranked[1], ranked[0], ranked[2]]; // 2 · 1 · 3 podium order
  const heights = { 1: 96, 2: 72, 3: 56 };
  const placements = campaign.placements ?? [];

  if (!ranked[0]) {
    return (
      <p className="text-xs text-ink-muted italic py-2">
        No standings yet — the podium appears once advisors log production this period.
      </p>
    );
  }

  return (
    <div className="flex items-end justify-center gap-3.5 pt-2">
      {order.map((s) => {
        if (!s) return null;
        const place = placements.find((p) => Number(p.rank) === s.rank);
        const isFirst = s.rank === 1;
        const prize = place ? Math.round((parseFloat(place.prize) || 0) * s.multiplier) : 0;
        return (
          <div key={s.rank} className="flex flex-col items-center gap-2 w-28">
            <Initials name={s.name} gold size={isFirst ? 50 : 40} />
            <div className="text-center">
              <div className={`font-bold text-ink ${isFirst ? 'text-sm' : 'text-xs'}`}>{s.name}</div>
              <div className="text-[11px] font-mono text-ink-muted tabular-nums">
                {campaign.standingsMetric === 'applicationsSold' ? `${s.appsTotal} apps` : formatCurrency(s.apiTotal)}
              </div>
            </div>
            <div
              className={`w-full rounded-t-[10px] border border-gold/40 border-b-0 flex flex-col items-center justify-center gap-0.5 ${
                isFirst ? 'bg-gold' : 'bg-gold/10'
              }`}
              style={{ height: heights[s.rank] }}
            >
              <div className={`font-display font-extrabold ${isFirst ? 'text-white text-2xl' : 'text-gold-ink text-xl'}`}>
                {s.rank}
              </div>
              <div className={`text-[11px] font-mono font-bold ${isFirst ? 'text-white' : 'text-gold-ink'}`}>
                {place ? formatCurrency(prize) : '—'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Standings table (ranked · gate · tier · projected payout) ─────────────────
export function StandingsTable({ campaign, standings }) {
  const isQualify = (campaign.structure ?? 'qualify') !== 'placement';
  const isApps = campaign.standingsMetric === 'applicationsSold';
  const metricHeader = isApps ? 'APPS' : 'CAMPAIGN API';

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="sticky top-0 z-10 bg-surface-raised border-b border-border">
              <th className="w-8 text-left px-3 py-2 font-mono font-bold text-[9px] tracking-wide text-ink-muted">#</th>
              <th className="text-left px-2 py-2 font-mono font-bold text-[9px] tracking-wide text-ink-muted">ADVISOR</th>
              <th className="w-24 text-right px-2 py-2 font-mono font-bold text-[9px] tracking-wide text-ink-muted">{metricHeader}</th>
              <th className="w-24 text-center px-2 py-2 font-mono font-bold text-[9px] tracking-wide text-ink-muted">PERSISTENCY</th>
              {isQualify && (
                <th className="w-24 text-center px-2 py-2 font-mono font-bold text-[9px] tracking-wide text-ink-muted">TIER</th>
              )}
              <th className="w-28 text-right px-3 py-2 font-mono font-bold text-[9px] tracking-wide text-gold-ink">PROJECTED</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const payout = s.projectedCash + (s.projectedVoucher || 0);
              const dq = s.disqualified;
              return (
                <tr
                  key={s.agentId}
                  className={`border-b border-border/50 last:border-0 ${i % 2 ? 'bg-surface-raised/40' : ''} ${
                    dq ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span className={`font-display font-bold text-[13px] tabular-nums ${s.rank <= 3 ? 'text-gold-ink' : 'text-ink-muted'}`}>
                      {s.rank}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Initials name={s.name} gold={s.qualified} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-ink truncate" title={s.name}>{s.name}</div>
                        {s.unit && <div className="text-[10px] font-mono text-ink-muted">{s.unit}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono font-bold text-[13px] text-ink tabular-nums">
                    {isApps ? s.appsTotal : formatCurrency(s.apiTotal)}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <GatePill persPct={s.persPct} band={s.band} />
                  </td>
                  {isQualify && (
                    <td className="px-2 py-2.5 text-center">
                      {s.tier ? (
                        <span className={`text-[11px] font-mono font-bold ${s.qualified ? 'text-gold-ink' : 'text-ink-muted'}`}>
                          {s.tier.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-muted italic">below L1</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right">
                    {dq ? (
                      <span className="text-[10.5px] font-mono font-bold text-danger-ink">DISQUALIFIED</span>
                    ) : s.qualified ? (
                      <span className="font-display font-bold text-[13.5px] text-gold-ink tabular-nums">{formatCurrency(payout)}</span>
                    ) : (
                      <span className="text-[11px] font-mono text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 py-2 bg-surface-raised border-t border-border">
        <span className="text-[10px] font-mono text-ink-muted">
          {standings.length} advisor{standings.length !== 1 ? 's' : ''} · sorted by {isApps ? 'apps' : 'API'}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gold-ink">
          <Trophy size={11} className="text-gold" aria-hidden="true" /> projected payout
        </span>
      </div>
    </div>
  );
}

// ── Composed standings block — ladder/podium + gate + table ───────────────────
// The one entry point CampaignPanel uses for a tiered campaign's expanded row.
export function CampaignStandingsBlock({ campaign, standings, hasPersistency }) {
  const isPlacement = campaign.structure === 'placement';
  const gateEnabled = campaign.persistencyGateEnabled !== false;

  return (
    <div className="flex flex-col gap-4">
      {/* Prize structure */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gold-ink mb-2">
          {isPlacement ? 'Podium · top three win' : 'Prize ladder · qualify to win'}
        </p>
        {isPlacement
          ? <PlacementPodium campaign={campaign} standings={standings} />
          : <TierLadder campaign={campaign} standings={standings} />}
      </div>

      {/* Persistency gate */}
      {gateEnabled && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gold-ink mb-1">Persistency gate</p>
          <p className="text-[11px] text-ink-muted mb-2 leading-relaxed">
            Every projected payout is scaled by the advisor&apos;s average persistency for the period. Below 80% disqualifies.
            {!hasPersistency && ' No persistency records on file yet — payouts show ungated until entered.'}
          </p>
          <PersistencyGateStrip />
        </div>
      )}

      {/* Live standings */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-2">Live standings</p>
        <StandingsTable campaign={campaign} standings={standings} />
      </div>
    </div>
  );
}
