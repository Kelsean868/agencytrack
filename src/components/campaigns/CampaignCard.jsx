import { useMemo } from 'react';
import { Gift, CheckCircle2 } from 'lucide-react';
import {
  computeCampaignProgress,
  getDaysRemaining,
  isTieredCampaign,
  accommodationLabel,
  normalizeGate,
  persistencyPctForGate,
  gateBandFor,
} from '../../utils/campaignEngine';
import { derivePolicyLens } from '../../lib/policyCampaignLens';
import { formatCurrency, formatDateFriendly } from '../../utils/formatters';
import { formatPersistencyPct } from '../../lib/persistency/persistencyRounding';

function DaysPill({ days }) {
  if (days > 7)  return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">{days} days left</span>;
  if (days >= 1) return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/15 text-warning-ink">{days} day{days !== 1 ? 's' : ''} left</span>;
  if (days === 0) return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-danger/15 text-danger-ink">Last day!</span>;
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
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-success-ink bg-success/10 px-1.5 py-0.5 rounded-full">
              <CheckCircle2 size={10} /> Achieved
            </span>
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

// ── The retreat readout (C2) ───────────────────────────────────
//
// The retreat is a first-class readout, not a pill. It says three things at
// once: the cash the advisor is on for, the room they are on for, and what it
// takes to reach the next room.
//
// The gate is stated in the same breath, because Rule 5 removes the ROOM as
// well as the cash. Below the threshold the card reads "Disqualified — cash and
// retreat", never a reduced figure: half a room does not exist.
function RetreatReadout({ campaign, lens, persistencyRecords }) {
  const { tierReached, tierNext, atTop } = lens;
  const apiTotal = lens.api.current;
  const appsTotal = lens.apps.current;

  const gate = normalizeGate(campaign);
  const gateEnabled = campaign?.persistencyGateEnabled !== false;
  // Reads the records the dashboard has ALREADY loaded — no new fetch. Returns
  // null when the basis has no record yet (on a finalMonth campaign that is
  // every month before the final one), and null renders "not yet known" rather
  // than a disqualification.
  const persPct = useMemo(
    () => (gateEnabled ? persistencyPctForGate(persistencyRecords, campaign) : null),
    [gateEnabled, persistencyRecords, campaign],
  );
  const band = gateEnabled ? gateBandFor(persPct, gate) : null;
  const disqualified = !!band && band.payout === 0;

  const reachedRoom = accommodationLabel(tierReached?.accommodation);
  const nextRoom = accommodationLabel(tierNext?.accommodation);
  const apiToGo = tierNext ? Math.max(0, (Number(tierNext.api) || 0) - apiTotal) : 0;
  const appsToGo = tierNext ? Math.max(0, (Number(tierNext.apps) || 0) - appsTotal) : 0;

  // Name whichever of the two is actually short. On this campaign every level
  // needs 35 applications, and applications — not API — are the binding
  // constraint on live data, so a line that only ever mentions money would
  // point the advisor at the wrong number.
  const gaps = [];
  if (apiToGo > 0) gaps.push(`${formatCurrency(Math.round(apiToGo))} more API`);
  if (appsToGo > 0) gaps.push(`${appsToGo} more app${appsToGo === 1 ? '' : 's'}`);

  return (
    <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5 flex flex-col gap-1.5" data-testid="campaign-retreat-readout">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gold-ink">Retreat</p>

      {disqualified ? (
        <p className="text-sm font-semibold text-danger-ink" data-testid="retreat-disqualified">
          Disqualified — cash and retreat.
          <span className="block text-xs font-normal text-ink-muted mt-0.5">
            Persistency {formatPersistencyPct(persPct)} is below the {gate.threshold}% the campaign requires. The room is
            not reduced, it is removed.
          </span>
        </p>
      ) : (
        <>
          <p className="text-sm text-ink" data-testid="retreat-standing">
            {tierReached ? (
              <>
                You are on for <strong className="font-semibold">{formatCurrency(Number(tierReached.cash) || 0)}</strong>
                {reachedRoom ? <> and a <strong className="font-semibold">{reachedRoom}</strong> room.</> : <>, no room at this level.</>}
              </>
            ) : (
              <>Not yet on for cash or a room.</>
            )}
          </p>

          {tierNext ? (
            <p className="text-xs text-ink-muted" data-testid="retreat-next">
              {gaps.length > 0 ? `${gaps.join(' and ')} moves you to ` : 'You have reached '}
              <strong className="font-semibold text-ink">{tierNext.name}</strong>
              {nextRoom ? <> — a <strong className="font-semibold text-ink">{nextRoom}</strong> room</> : null}
              {Number(tierNext.cash) > 0 ? <> and {formatCurrency(Number(tierNext.cash))}</> : null}.
            </p>
          ) : atTop ? (
            <p className="text-xs text-ink-muted" data-testid="retreat-next">
              This is the top level — there is nothing above it.
            </p>
          ) : null}
        </>
      )}

      {gateEnabled && !disqualified && (
        <p className="text-[11px] text-ink-muted" data-testid="retreat-gate">
          {persPct == null
            ? `Both the cash and the room still depend on persistency reaching ${gate.threshold}%${gate.basis === 'finalMonth' ? ' at the campaign’s final month' : ' across the campaign'}. Not yet known.`
            : `Persistency ${formatPersistencyPct(persPct)} clears the ${gate.threshold}% the campaign requires.`}
        </p>
      )}

      <ClawbackLines lens={lens} clawbackUntil={campaign?.clawbackUntil ?? null} />
    </div>
  );
}

// ─── Rule 9 on screen · claw-back (C4, R7.3) ─────────────────────────────────
//
// Both lists are empty on today's live data, and the card SAYS SO rather than
// rendering nothing. An absent section reads as "not implemented", which is a
// different claim from "nothing to report" — and this is the one section an
// advisor will look for in March.
function ClawbackLines({ lens, clawbackUntil }) {
  const risk = lens?.clawbackRisk ?? [];
  const unassessable = lens?.clawbackUnassessable ?? [];
  if (!clawbackUntil) return null;

  return (
    <div className="flex flex-col gap-1" data-testid="campaign-clawback">
      {risk.length > 0 && (
        <p className="text-xs font-semibold text-warning-ink" data-testid="clawback-risk">
          {risk.length} {risk.length === 1 ? 'policy has' : 'policies have'} lapsed in the claw-back
          window — Sales Admin will recalculate your level.
        </p>
      )}
      {unassessable.length > 0 && (
        <p className="text-xs text-ink-muted" data-testid="clawback-unassessable">
          {unassessable.length} counted {unassessable.length === 1 ? 'policy has' : 'policies have'} exited
          with no exit date recorded — cannot assess, check with Sales Administration.
        </p>
      )}
      {risk.length === 0 && unassessable.length === 0 && (
        <p className="text-[11px] text-ink-muted" data-testid="clawback-none">
          No counted policy has lapsed in the claw-back window (to {clawbackUntil}).
        </p>
      )}
    </div>
  );
}

// ─── The general rules that change what an advisor can expect (C4 item 4) ────
//
// Items 1, 3 and 6 from page 8, plus Rule 11's footer. Everything this app
// shows is an INDICATION, never an adjudication — the same honesty contract the
// TTAIFA work established. The footer is not decoration: it is the sentence
// that makes every number above it a projection rather than a promise.
function CampaignRules() {
  return (
    <details className="rounded-lg border border-border bg-surface-muted px-3 py-2" data-testid="campaign-rules">
      <summary className="text-[11px] font-semibold text-ink cursor-pointer">
        Campaign rules that affect you
      </summary>
      <ul className="mt-1.5 flex flex-col gap-1 text-[11px] text-ink-muted list-disc pl-4">
        <li>You must still be contracted to Tatil Life when the retreat is held. No retreat payment forms part of a separation package.</li>
        <li>If you qualify but cannot attend, you receive the cash only — the trip cannot be transferred or substituted.</li>
        <li>Production credit cannot be transferred between agents.</li>
      </ul>
      <p className="mt-2 text-[11px] font-semibold text-ink-muted">
        Where there is any ambiguity, the decision of the Executive Business Development is final.
      </p>
    </details>
  );
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">1</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-400 text-white text-[10px] font-bold">2</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-700 text-white text-[10px] font-bold">3</span>;
  return null;
}

function RankLine({ rank, totalParticipants }) {
  if (rank === null) return <p className="text-xs text-ink-muted">No rankings yet</p>;
  if (rank === 1)   return <p className="text-xs font-semibold text-primary flex items-center gap-1"><RankBadge rank={1} /> You&apos;re leading!</p>;
  if (rank === 2)   return <p className="text-xs font-semibold text-ink flex items-center gap-1"><RankBadge rank={2} /> 2nd place</p>;
  if (rank === 3)   return <p className="text-xs font-semibold text-ink flex items-center gap-1"><RankBadge rank={3} /> 3rd place</p>;
  const suffix = rank === 11 || rank === 12 || rank === 13 ? 'th' : rank % 10 === 1 ? 'st' : rank % 10 === 2 ? 'nd' : rank % 10 === 3 ? 'rd' : 'th';
  return <p className="text-xs text-ink-muted">{rank}{suffix} of {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}</p>;
}

export default function CampaignCard({ campaign, submissions, agentId, persistency = [], policies = [] }) {
  const { metrics, allAchieved, rank, totalParticipants } = useMemo(
    () => computeCampaignProgress(campaign, submissions, agentId),
    [campaign, submissions, agentId]
  );

  // THE RETREAT READOUT IS DERIVED FROM THE POLICY LEDGER, NOT FROM WEEKLY
  // SUBMISSIONS — and it is the SAME call CampaignLensPanel makes, not merely
  // the same helper.
  //
  // This surface first totalled `submissions`. On live data that reads 0 API /
  // 0 apps for an advisor whose ledger holds TTD 73,946.28 across 3 counted
  // policies, because his campaign production was imported from OIPA and never
  // passed through a weekly report. Both surfaces then rendered a
  // distance-to-Champion statement from different numbers, which is precisely
  // the failure brief item 7 exists to prevent: an advisor told two things.
  //
  // `derivePolicyLens` also applies Rule 7's production-credit table and the
  // C-D10 settlement window, so a Platinum Edge policy counts as an application
  // with no API here exactly as it does in the ledger panel. A submissions total
  // could not express that at all.
  const lens = useMemo(
    () => derivePolicyLens(policies, campaign, {}),
    [policies, campaign],
  );

  const days = getDaysRemaining(campaign.endDate);
  const tiered = isTieredCampaign(campaign) && campaign.structure === 'qualify';

  return (
    <div className="rounded-xl bg-card border-l-4 border-primary border border-primary/20 p-4 flex flex-col gap-3">
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
        <p className="text-sm font-semibold text-ink flex items-center gap-1.5"><Gift size={14} className="text-primary shrink-0" />{campaign.prize}</p>
        <p className="text-xs text-ink-muted">
          {formatDateFriendly(campaign.startDate)} → {formatDateFriendly(campaign.endDate)}
        </p>
      </div>

      {/* Retreat readout — cash, room, and the distance to the next room */}
      {tiered && lens && (
        <RetreatReadout
          campaign={campaign}
          lens={lens}
          persistencyRecords={persistency}
        />
      )}

      {tiered && <CampaignRules />}

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
        <div className="rounded-lg bg-success/10 border border-success/20 px-3 py-2 text-xs font-semibold text-success-ink flex items-center justify-center gap-1.5">
          <CheckCircle2 size={14} /> All targets achieved!
        </div>
      )}

      {/* Rank footer */}
      <div className="border-t border-border pt-2">
        <RankLine rank={rank} totalParticipants={totalParticipants} />
      </div>
    </div>
  );
}
