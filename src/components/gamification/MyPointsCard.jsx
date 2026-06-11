import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Info, Flame, X, Trophy } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import StatusPill from '../ui/StatusPill';
import {
  POINTS_WEIGHTS,
  LEVEL_THRESHOLDS,
  BADGE_DEFINITIONS,
  UNSCORED_FIELDS,
} from '../../lib/gamificationConfig';

const LEVEL_VARIANT = {
  Rookie: 'muted', Associate: 'primary', Pro: 'warning', Elite: 'success', Legend: 'danger',
};

// Display-map: every POINTS_WEIGHTS key → { label, group, note? }
// group: 'Prospect & connect' | 'Advance' | 'Close' | 'Deliver & service'
// SYNC GUARD: MyPointsCard.display-map.test.js asserts every POINTS_WEIGHTS key is present here.
// Adding a weight without a display-map entry WILL fail CI.
// eslint-disable-next-line react-refresh/only-export-components
export const DISPLAY_MAP = {
  dials:                     { label: 'Phone dials',                group: 'Prospect & connect' },
  prospectingLettersSent:    { label: 'Letter / email sent',        group: 'Prospect & connect', note: 'up to 20/week' },
  referralsObtained:         { label: 'New referral',               group: 'Prospect & connect' },
  otherNewNames:             { label: 'Other new name',             group: 'Prospect & connect' },
  seminarsConducted:         { label: 'Seminar conducted',          group: 'Prospect & connect' },
  tradeshowsAttended:        { label: 'Tradeshow attended',         group: 'Prospect & connect' },
  f2fAttempts:               { label: 'Face-to-face attempt',       group: 'Prospect & connect' },
  appointmentsSet:           { label: 'Appointment set',            group: 'Advance'            },
  ffiConducted:              { label: 'Fact-finding interview',     group: 'Advance'            },
  ciConducted:               { label: 'Closing interview',          group: 'Advance'            },
  applicationsSold:          { label: 'Application sold',           group: 'Close'              },
  apiPerThousand:            { label: 'API written',                group: 'Close',              note: 'per TTD 1,000' },
  serviceCalls:              { label: 'Service call',               group: 'Deliver & service'  },
  policiesDelivered:         { label: 'Policy delivered',           group: 'Deliver & service'  },
  premiumCollectionMeetings: { label: 'Premium collection meeting', group: 'Deliver & service'  },
  annualReviews:             { label: 'Annual review',              group: 'Deliver & service'  },
  orphanReviews:             { label: 'Orphan review',              group: 'Deliver & service'  },
  orphansAdopted:            { label: 'Orphan adopted',             group: 'Deliver & service'  },
  reinstatementsSubmitted:   { label: 'Reinstated application',     group: 'Deliver & service'  },
  reinstatedApiPerThousand:  { label: 'Reinstated API',             group: 'Deliver & service',  note: 'per TTD 1,000' },
  policyChanges:             { label: 'Policy change',              group: 'Deliver & service'  },
};

const GROUPS = ['Prospect & connect', 'Advance', 'Close', 'Deliver & service'];

const EXIT_FIELDS = UNSCORED_FIELDS
  .filter((f) => f.reason?.includes('not incentivised'))
  .map((f) => (f.key === 'withdrawalsLoans' ? 'withdrawals/loans' : f.key));

function PointsInfoPanel({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="points-panel-heading"
        className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-lg border border-border max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 shrink-0 border-b border-border">
          <div>
            <h2 id="points-panel-heading" className="text-lg font-bold text-ink">How points work</h2>
            {/* NOTE: copy below describes the cumulative model — revisit this sentence if the
                reset-model decision flips from cumulative to rolling. The one spot to update. */}
            <p className="text-sm text-ink-muted mt-0.5">Points build up over time toward levels. Submit every week to earn and level up.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors shrink-0 ml-4"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-6 flex flex-col gap-6">

          {/* Earning points */}
          <section aria-labelledby="points-earning-heading">
            <h3 id="points-earning-heading" className="text-sm font-semibold text-ink mb-3">Earning points</h3>
            <div className="flex flex-col gap-4">
              {GROUPS.map((group) => {
                const rows = Object.entries(DISPLAY_MAP).filter(([, v]) => v.group === group);
                return (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">{group}</p>
                    <div className="rounded-xl border border-border overflow-hidden">
                      {rows.map(([key, meta], i) => (
                        <div
                          key={key}
                          className={`flex items-center justify-between px-3 py-2.5 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}
                        >
                          <div>
                            <span className="text-sm text-ink">{meta.label}</span>
                            {meta.note && (
                              <span className="text-xs text-ink-muted ml-1.5">({meta.note})</span>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-primary ml-4 shrink-0">
                            +{POINTS_WEIGHTS[key]} pt{POINTS_WEIGHTS[key] !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {EXIT_FIELDS.length > 0 && (
              <p className="text-xs text-ink-muted mt-3">
                Not scored: {EXIT_FIELDS.join(', ')} — servicing exits are not incentivised.
              </p>
            )}
          </section>

          {/* Levels */}
          <section aria-labelledby="points-levels-heading">
            <h3 id="points-levels-heading" className="text-sm font-semibold text-ink mb-3">Levels</h3>
            <div className="rounded-xl border border-border overflow-hidden">
              {LEVEL_THRESHOLDS.map((l, i) => (
                <div
                  key={l.level}
                  className={`flex items-center justify-between px-3 py-2.5 ${i < LEVEL_THRESHOLDS.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <StatusPill variant={LEVEL_VARIANT[l.title] ?? 'muted'} label={l.title} />
                  <span className="text-sm text-ink-muted">{l.threshold.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
          </section>

          {/* Badges */}
          <section aria-labelledby="points-badges-heading">
            <h3 id="points-badges-heading" className="text-sm font-semibold text-ink mb-3">Badges</h3>
            <div className="flex flex-col gap-2">
              {BADGE_DEFINITIONS.map((b) => (
                <div key={b.key} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                  <Trophy size={14} className="text-warning-ink mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{b.label}</p>
                    <p className="text-xs text-ink-muted">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

export default function MyPointsCard() {
  const { user, tenantId } = useAuth();
  const [entry, setEntry]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!tenantId || !user?.uid) {
      setEntry(null);
      setLoading(true);
      return;
    }
    setEntry(null);
    setLoading(true);
    const ref = doc(db, `tenants/${tenantId}/leaderboard/${user.uid}`);
    const unsub = onSnapshot(ref, (snap) => {
      setEntry(snap.exists() ? snap.data() : null);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [tenantId, user?.uid]);

  const handleInfoClick = () => setPanelOpen(true);
  const handleClose     = () => setPanelOpen(false);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">
        <div className="h-3 w-20 rounded bg-border/40 animate-pulse mb-3" />
        <div className="h-8 w-28 rounded bg-border/40 animate-pulse mb-2" />
        <div className="h-3 w-36 rounded bg-border/40 animate-pulse" />
      </div>
    );
  }

  const points     = entry?.points ?? 0;
  const levelTitle = entry?.levelTitle ?? 'Rookie';
  const streak     = entry?.weeklyStreak ?? 0;
  const badgeKeys  = Array.isArray(entry?.badges) ? entry.badges : [];
  const earnedDefs = BADGE_DEFINITIONS.filter((b) => badgeKeys.includes(b.key));

  // Empty state — no leaderboard doc yet
  if (!entry) {
    return (
      <>
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">My Points</p>
            <button
              onClick={handleInfoClick}
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors"
              aria-label="How points work"
            >
              <Info size={16} />
            </button>
          </div>
          <p className="text-sm text-ink-muted">Start logging activity to earn points and level up.</p>
        </div>
        {panelOpen && <PointsInfoPanel onClose={handleClose} />}
      </>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border shadow-sm p-4">

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">My Points</p>
          <button
            onClick={handleInfoClick}
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors"
            aria-label="How points work"
          >
            <Info size={16} />
          </button>
        </div>

        {/* Points + level row */}
        <div className="flex items-center gap-3 mb-3">
          <p className="text-3xl font-bold text-ink tabular-nums">{points.toLocaleString()}</p>
          <div className="flex flex-col gap-1.5">
            <StatusPill variant={LEVEL_VARIANT[levelTitle] ?? 'muted'} label={levelTitle} />
            {streak >= 4 && (
              <span className="flex items-center gap-1 text-xs text-ink-muted">
                <Flame size={12} className="text-warning-ink" aria-hidden="true" />
                {streak}-week streak
              </span>
            )}
          </div>
        </div>

        {/* Earned badges */}
        {earnedDefs.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {earnedDefs.map((b) => (
              <span
                key={b.key}
                title={b.description}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning/10 text-warning-ink border border-warning/20"
              >
                <Trophy size={10} aria-hidden="true" />
                {b.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-muted">No badges yet — keep submitting!</p>
        )}
      </div>

      {panelOpen && <PointsInfoPanel onClose={handleClose} />}
    </>
  );
}
