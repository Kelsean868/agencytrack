import { useMemo, useState, useEffect } from 'react';
import { CheckCircle, XCircle, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { computeAgentAwards, computeRatioTrends, computeAtRiskStatus, getPeriodCtx, nextTierDistance, isPersistencyOnlyBlock } from '../../utils/awardsEngine';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { getOwnPolicies, settlementShapeFromPolicies } from '../../services/policiesService';

const CATEGORY_TABS = [
  { id: 'monthly',   label: 'Monthly'   },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'annual',    label: 'Annual'    },
  { id: 'club',      label: 'Club'      },
];

function DataSourceBadge({ source }) {
  if (source === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
        Confirmed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/10 text-warning">
      Estimated
    </span>
  );
}

function GapBadge({ gap, target, label }) {
  if (gap === null || gap === undefined || gap <= 0) return null;
  const isClose = target > 0 && gap <= target * 0.2;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
      isClose ? 'bg-warning/15 text-warning' : 'bg-border/60 text-ink-muted'
    }`}>
      {label}
    </span>
  );
}

const PACE_CONFIG = {
  achieved:  { label: 'Achieved',  cls: 'bg-success/15 text-success'   },
  on_track:  { label: 'On Track',  cls: 'bg-primary/10 text-primary'   },
  at_risk:   { label: 'At Risk',   cls: 'bg-warning/15 text-warning'   },
  far_off:   { label: 'Far Off',   cls: 'bg-border/60 text-ink-muted'  },
};

function PacePill({ status }) {
  const cfg = PACE_CONFIG[status] ?? PACE_CONFIG.far_off;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function AwardState({ eligible, inContention }) {
  if (eligible) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/15 text-success">
        <CheckCircle size={10} /> Qualified
      </span>
    );
  }
  if (inContention) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/15 text-warning">
        In Contention
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-border/60 text-ink-muted">
      Not Yet Eligible
    </span>
  );
}

function formatCriterionValue(c) {
  if (c.unit === 'TTD') return formatCurrency(c.current);
  if (c.unit === '%') return `${Number(c.current).toFixed(1)}%`;
  return String(c.current);
}

function formatCriterionTarget(c) {
  if (c.unit === 'TTD') return formatCurrency(c.target);
  if (c.unit === '%') return `${c.target}%`;
  return String(c.target);
}

function AwardCard({ award, paceStatus, tierGap, persistencyBlock }) {
  const isGreyed = !award.eligible && !award.inContention;

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${
      isGreyed ? 'border-border bg-border/10' : award.eligible ? 'border-success/30 bg-success/5' : 'border-primary/20 bg-surface'
    }`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink leading-snug">{award.name}</p>
          <p className="text-xs text-ink-muted mt-0.5">{award.prize}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <AwardState eligible={award.eligible} inContention={award.inContention} />
          <DataSourceBadge source={award.dataSource} />
        </div>
      </div>

      {/* Leg 2 — pace pill */}
      {paceStatus && <PacePill status={paceStatus} />}

      {/* Progress bar (primary criterion only) */}
      <div>
        <div className="flex justify-between text-[10px] text-ink-muted mb-1">
          <span>{award.criteria[0]?.label}</span>
          <span>{Math.round(award.progressPercent)}%</span>
        </div>
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              award.eligible ? 'bg-success' : award.inContention ? 'bg-primary' : 'bg-border/80'
            }`}
            style={{ width: `${award.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Criteria checklist + leg 1 gap badges (non-club) */}
      <div className="flex flex-col gap-1.5">
        {award.criteria.map((c) => {
          const gap = !c.met && award.category !== 'club' ? c.target - c.current : null;
          const gapLabel = c.unit === 'TTD'
            ? `${formatCurrency(Math.round(gap))} to go`
            : c.unit === '%'
              ? `${Number(gap).toFixed(1)}% to go`
              : `${Math.round(gap)} to go`;
          return (
            <div key={c.label} className="flex items-center gap-2 text-xs">
              {c.met
                ? <CheckCircle size={13} className="text-success shrink-0" />
                : <XCircle    size={13} className="text-danger/60 shrink-0" />
              }
              <span className={`flex-1 ${c.met ? 'text-ink' : 'text-ink-muted'}`}>
                {c.label}:&nbsp;
                <span className="font-semibold">{formatCriterionValue(c)}</span>
                <span className="text-ink-muted"> / {formatCriterionTarget(c)}</span>
              </span>
              {gap !== null && gap > 0 && (
                <GapBadge gap={gap} target={c.target} label={gapLabel} />
              )}
            </div>
          );
        })}
      </div>

      {/* Leg 1 — club tier gap badge */}
      {tierGap && !award.eligible && (
        <div className="flex items-center gap-2">
          <GapBadge
            gap={tierGap.distance}
            target={tierGap.nextTier.apiMin}
            label={`${formatCurrency(Math.round(tierGap.distance))} to ${tierGap.nextTier.name}`}
          />
        </div>
      )}

      {/* Leg 3 — persistency-only block banner */}
      {persistencyBlock && (() => {
        const pc = award.criteria.find((c) => /persistency/i.test(c.label));
        return pc ? (
          <div className="flex items-start gap-1.5 p-2 rounded-lg bg-warning/8 border border-warning/20">
            <Info size={11} className="text-warning mt-0.5 shrink-0" />
            <p className="text-[10px] text-warning leading-snug">
              Production targets met — only persistency ({Number(pc.current).toFixed(1)}% of {pc.target}% required) stands between you and this award.
            </p>
          </div>
        ) : null;
      })()}

      {/* Note */}
      {award.note && (
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-warning/8 border border-warning/20">
          <Info size={11} className="text-warning mt-0.5 shrink-0" />
          <p className="text-[10px] text-warning leading-snug">{award.note}</p>
        </div>
      )}
    </div>
  );
}

function TrendIcon({ trend }) {
  if (trend === 'up')   return <TrendingUp   size={14} className="text-success" />;
  if (trend === 'down') return <TrendingDown size={14} className="text-danger"  />;
  return <Minus size={14} className="text-ink-muted" />;
}

function RatioCard({ label, value4w, value12w, trend, format }) {
  const fmt = (v) => {
    if (format === 'currency') return formatCurrency(v);
    if (format === 'percent') return `${v}%`;
    return String(v);
  };

  return (
    <div className="card flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-ink leading-none">{fmt(value4w)}</p>
        <TrendIcon trend={trend} />
      </div>
      <p className="text-[10px] text-ink-muted">12w avg: <span className="font-medium text-ink">{fmt(value12w)}</span></p>
      <p className="text-[10px] text-ink-muted/60 italic">Based on last 12 submitted weeks</p>
    </div>
  );
}

export default function AgentAwardsPanel({ submissions, confirmedSettlements, agentProfile, currentDate, ruleset }) {
  const [activeCategory, setActiveCategory] = useState('monthly');
  const { tenantId } = useAuth();
  const [ledgerPolicies, setLedgerPolicies] = useState(null);
  const usesPolicyLedger = Boolean(agentProfile?.usesPolicyLedger);

  useEffect(() => {
    if (!usesPolicyLedger || !tenantId || !agentProfile?.uid) return;
    getOwnPolicies(tenantId, agentProfile.uid)
      .then(setLedgerPolicies)
      .catch(() => setLedgerPolicies([]));
  }, [usesPolicyLedger, tenantId, agentProfile?.uid]);

  const activeConfirmedData = useMemo(() => {
    if (!usesPolicyLedger) return confirmedSettlements ?? [];
    if (ledgerPolicies === null) return [];
    const ledgerShape = settlementShapeFromPolicies(ledgerPolicies);
    const persistByPeriod = {};
    for (const s of (confirmedSettlements ?? [])) {
      if (s.periodKey && s.persistency) persistByPeriod[s.periodKey] = s.persistency;
    }
    return ledgerShape.map((row) => ({ ...row, persistency: persistByPeriod[row.periodKey] ?? 0 }));
  }, [usesPolicyLedger, ledgerPolicies, confirmedSettlements]);

  const now = useMemo(() => currentDate ?? new Date(), [currentDate]);

  const computation = useMemo(() => {
    try {
      const rawAwards = computeAgentAwards(activeConfirmedData, submissions, agentProfile, now, ruleset);
      const awards = {};
      for (const [id, award] of Object.entries(rawAwards)) {
        const paceStatus = computeAtRiskStatus(award, getPeriodCtx(award.category, now));
        const persistencyBlock = isPersistencyOnlyBlock(award);
        let tierGap = null;
        if (award.category === 'club' && !award.eligible) {
          const annualApi = award.criteria[0]?.current ?? 0;
          tierGap = nextTierDistance(annualApi, ruleset.clubAward.tiers);
        }
        awards[id] = { ...award, paceStatus, persistencyBlock, tierGap };
      }
      return {
        awards,
        ratioTrends: computeRatioTrends(submissions),
        error: null,
      };
    } catch (e) {
      console.error(e);
      return { awards: {}, ratioTrends: null, error: 'Failed to compute awards.' };
    }
  }, [activeConfirmedData, submissions, agentProfile, now, ruleset]);

  const { awards, ratioTrends, error } = computation;

  const categoryAwards = useMemo(() => {
    const all = Object.values(awards).filter((a) => a.category === activeCategory);
    const qualified    = all.filter((a) => a.eligible);
    const inContention = all.filter((a) => !a.eligible && a.inContention);
    const notYet       = all.filter((a) => !a.eligible && !a.inContention);
    return [...qualified, ...inContention, ...notYet];
  }, [awards, activeCategory]);

  if (!submissions?.length) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">Start submitting weekly reports to see your awards progress.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Category tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border overflow-x-auto">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveCategory(t.id)}
            className={`flex-1 min-w-max h-11 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap px-3 ${
              activeCategory === t.id
                ? 'bg-card text-primary shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Award cards */}
      {categoryAwards.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm text-ink-muted">No awards in this category.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {categoryAwards.map((award) => (
            <AwardCard
              key={award.id}
              award={award}
              paceStatus={award.paceStatus}
              tierGap={award.tierGap}
              persistencyBlock={award.persistencyBlock}
            />
          ))}
        </div>
      )}

      {/* Ratio Trends section */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Activity Ratio Trends</h2>
        <div className="grid grid-cols-2 gap-3">
          <RatioCard
            label="CI to Sale"
            value4w={ratioTrends.ciToSaleRatio.trailing4w}
            value12w={ratioTrends.ciToSaleRatio.trailing12w}
            trend={ratioTrends.ciToSaleRatio.trend}
          />
          <RatioCard
            label="Dials to CI"
            value4w={ratioTrends.dialsToCIRatio.trailing4w}
            value12w={ratioTrends.dialsToCIRatio.trailing12w}
            trend={ratioTrends.dialsToCIRatio.trend}
          />
          <RatioCard
            label="Avg Policy Size"
            value4w={ratioTrends.avgPolicySize.trailing4w}
            value12w={ratioTrends.avgPolicySize.trailing12w}
            trend={ratioTrends.avgPolicySize.trend}
            format="currency"
          />
          <RatioCard
            label="FFI to Dial"
            value4w={ratioTrends.ffiToDialRatio.trailing4w}
            value12w={ratioTrends.ffiToDialRatio.trailing12w}
            trend={ratioTrends.ffiToDialRatio.trend}
          />
        </div>
      </div>
    </div>
  );
}
