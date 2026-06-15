import React, { useMemo, useState } from 'react';
import { Trophy, Pin, PinOff } from 'lucide-react';
import { computeAgentAwards } from '../../utils/awardsEngine';
import { formatCurrency } from '../../utils/formatters';

const PINS_KEY = 'agencytrack-award-pins';
const MAX_PINS = 3;

function readPins() {
  try { return JSON.parse(localStorage.getItem(PINS_KEY) || '[]'); }
  catch { return []; }
}

function writePins(pins) {
  localStorage.setItem(PINS_KEY, JSON.stringify(pins));
}

// Primary gap display: first unmet production criterion (not persistency)
function gapText(award) {
  const unmet = (award.criteria ?? []).filter((c) => !c.met && !/persistency/i.test(c.label));
  if (!unmet.length) {
    // All unmet criteria are persistency-only
    const pers = (award.criteria ?? []).find((c) => !c.met && /persistency/i.test(c.label));
    if (pers) return `${(pers.target - pers.current).toFixed(1)}% persistency needed`;
    return null;
  }
  const c = unmet[0];
  const gap = Math.max(0, c.target - c.current);
  if (gap === 0) return null;
  if (c.unit === 'TTD') return `${formatCurrency(gap)} more API needed`;
  if (c.unit === 'apps') return `${Math.ceil(gap)} more ${gap === 1 ? 'app' : 'apps'} needed`;
  return null;
}

function AwardCard({ award, isPinned, onTogglePin, canPin, badge }) {
  const gap = gapText(award);
  const pct = Math.min(100, Math.max(0, award.progressPercent));

  return (
    <div
      className="bg-card-raised rounded-xl p-4 flex flex-col gap-2"
      data-testid="awards-reach-card"
      data-award-id={award.id}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-ink truncate">{award.name}</span>
          {badge && (
            <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {badge}
            </span>
          )}
        </div>
        <button
          onClick={onTogglePin}
          disabled={!isPinned && !canPin}
          aria-label={isPinned ? `Unpin ${award.name}` : `Pin ${award.name} as aspiration`}
          className={[
            'p-1.5 rounded-lg transition-colors flex items-center justify-center',
            'min-w-[44px] min-h-[44px]',
            isPinned
              ? 'text-primary bg-primary/10'
              : canPin
              ? 'text-ink-muted hover:text-primary hover:bg-primary/10'
              : 'text-ink-muted/40 cursor-not-allowed',
          ].join(' ')}
          data-testid={`pin-btn-${award.id}`}
        >
          {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </button>
      </div>

      <div
        className="w-full bg-surface rounded-full h-1.5"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${award.name} progress`}
      >
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {gap && (
        <p className="text-xs text-ink-muted" data-testid={`gap-text-${award.id}`}>
          {gap}
        </p>
      )}
      {award.note && (
        <p className="text-xs text-ink-muted/70 italic">{award.note}</p>
      )}
    </div>
  );
}

export default function AwardsReachPanel({
  submissions,
  confirmedSettlements,
  agentProfile,
  currentDate,
}) {
  const [pins, setPins] = useState(readPins);

  const now = useMemo(
    () => (currentDate ? new Date(currentDate) : new Date()),
    [currentDate],
  );

  const awards = useMemo(
    () => computeAgentAwards(confirmedSettlements ?? [], submissions ?? [], agentProfile ?? {}, now),
    [confirmedSettlements, submissions, agentProfile, now],
  );

  // Nearest 2 unearned awards by highest progressPercent (i.e. closest to threshold)
  const nearest = useMemo(
    () =>
      Object.values(awards)
        .filter((a) => !a.eligible)
        .sort((a, b) => b.progressPercent - a.progressPercent)
        .slice(0, 2),
    [awards],
  );

  const pinnedAwards = useMemo(
    () => pins.map((id) => awards[id]).filter(Boolean),
    [awards, pins],
  );

  const hasNoProduction =
    (submissions ?? []).length === 0 && (confirmedSettlements ?? []).length === 0;

  function togglePin(awardId) {
    setPins((prev) => {
      const next = prev.includes(awardId)
        ? prev.filter((id) => id !== awardId)
        : prev.length < MAX_PINS
        ? [...prev, awardId]
        : prev;
      writePins(next);
      return next;
    });
  }

  if (hasNoProduction) {
    return (
      <div className="text-center py-6" data-testid="awards-reach-no-production">
        <Trophy className="w-8 h-8 text-ink-muted mx-auto mb-2" aria-hidden="true" />
        <p className="text-sm text-ink-muted">Submit your first report to see award reach.</p>
      </div>
    );
  }

  return (
    <div data-testid="awards-reach-panel">
      <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-1.5">
        <Trophy className="w-4 h-4 text-primary" aria-hidden="true" />
        Awards reach
      </h3>

      {nearest.length > 0 ? (
        <div className="flex flex-col gap-2 mb-4">
          {nearest.map((award, i) => (
            <AwardCard
              key={award.id}
              award={award}
              isPinned={pins.includes(award.id)}
              onTogglePin={() => togglePin(award.id)}
              canPin={pins.length < MAX_PINS}
              badge={i === 0 ? 'Nearest' : null}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-muted mb-4">
          All awards for this period have been earned — great work!
        </p>
      )}

      <div>
        <p className="text-xs font-medium text-ink-muted mb-2 uppercase tracking-wide">
          Pinned aspirations ({pins.length}/{MAX_PINS})
        </p>
        {pinnedAwards.length > 0 ? (
          <div className="flex flex-col gap-2">
            {pinnedAwards.map((award) => (
              <AwardCard
                key={award.id}
                award={award}
                isPinned
                onTogglePin={() => togglePin(award.id)}
                canPin
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-muted italic" data-testid="awards-reach-no-pins">
            Pin up to {MAX_PINS} awards as stretch goals using the pin button above.
          </p>
        )}
      </div>
    </div>
  );
}
