import { useMemo, useState, useEffect } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import { computeManagerAwards } from '../../utils/awardsEngine';
import { getSettlementsForUnit } from '../../services/settlementService';
import { formatCurrency } from '../../utils/formatters';

function DataSourceBadge({ source }) {
  const confirmed = source === 'confirmed';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
      confirmed ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
    }`}>
      {confirmed ? 'Confirmed' : 'Estimated'}
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
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-border/60 text-ink-muted">
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

function AwardCard({ award }) {
  const isGreyed = !award.eligible && !award.inContention;
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${
      isGreyed ? 'border-border bg-border/10' : award.eligible ? 'border-success/30 bg-success/5' : 'border-primary/20 bg-surface'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">{award.name}</p>
          <p className="text-xs text-ink-muted mt-0.5">{award.prize}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <AwardState eligible={award.eligible} inContention={award.inContention} />
          {award.dataSource && <DataSourceBadge source={award.dataSource} />}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-ink-muted mb-1">
          <span>{award.criteria[0]?.label}</span>
          <span>{Math.round(award.progressPercent ?? 0)}%</span>
        </div>
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              award.eligible ? 'bg-success' : award.inContention ? 'bg-primary' : 'bg-border/80'
            }`}
            style={{ width: `${award.progressPercent ?? 0}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {(award.criteria ?? []).map((c) => (
          <div key={c.label} className="flex items-center gap-2 text-xs">
            {c.met
              ? <CheckCircle size={13} className="text-success shrink-0" />
              : <XCircle    size={13} className="text-danger/60 shrink-0" />
            }
            <span className={c.met ? 'text-ink' : 'text-ink-muted'}>
              {c.label}:&nbsp;
              <span className="font-semibold">{formatCriterionValue(c)}</span>
              <span className="text-ink-muted"> / {formatCriterionTarget(c)}</span>
            </span>
          </div>
        ))}
      </div>

      {award.note && (
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-warning/8 border border-warning/20">
          <Info size={11} className="text-warning mt-0.5 shrink-0" />
          <p className="text-[10px] text-warning leading-snug">{award.note}</p>
        </div>
      )}
    </div>
  );
}

function MonthlyBonusCard({ bonus }) {
  return (
    <div className="card mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-0.5">Monthly Bonus</p>
          <p className="text-lg font-bold text-ink">{bonus.name}</p>
        </div>
        {bonus.bonusPct > 0 && (
          <span className="inline-flex px-3 py-1 rounded-full text-sm font-bold bg-success/15 text-success">
            {bonus.bonusPct}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted mb-0.5">Avg API / Advisor</p>
          <p className="text-base font-bold text-ink">{formatCurrency(bonus.avgMonthlyAPI)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted mb-0.5">Bonus Earned</p>
          <p className="text-base font-bold text-success">{formatCurrency(bonus.bonusAmount)}</p>
        </div>
      </div>

      {bonus.nextTier && (
        <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-primary">
            Next tier: <span className="font-semibold">{bonus.nextTier.pct}%</span> at{' '}
            <span className="font-semibold">{formatCurrency(bonus.nextTier.threshold)}</span> avg API/advisor.{' '}
            <span className="font-semibold">{formatCurrency(bonus.nextTier.threshold - bonus.avgMonthlyAPI)}</span> to go.
          </p>
        </div>
      )}

      {bonus.note && (
        <p className="text-[10px] text-ink-muted/70 italic mt-2">{bonus.note}</p>
      )}
    </div>
  );
}

const ANNUAL_TABS = [
  { id: 'annual',   label: 'Annual'    },
  { id: 'activity', label: 'Activity'  },
  { id: 'recruit',  label: 'Recruiting' },
];

export default function ManagerAwardsPanel({ agentIds, currentDate, role, tenantId }) {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [activeTab, setActiveTab]     = useState('annual');

  const year = (currentDate ?? new Date()).getFullYear();

  useEffect(() => {
    if (!agentIds?.length) { setLoading(false); return; }
    setLoading(true);
    getSettlementsForUnit(tenantId, agentIds, year)
      .then(setSettlements)
      .catch((e) => { console.error(e); setError('Failed to load settlement data.'); })
      .finally(() => setLoading(false));
  }, [tenantId, agentIds, year]);

  const awards = useMemo(
    () => computeManagerAwards(settlements, agentIds, {}, { newAdvisors: 0 }, currentDate ?? new Date(), role),
    [settlements, agentIds, currentDate, role]
  );

  const { bonus, annualAwards, activityAwards, recruitAwards } = useMemo(() => {
    const all = Object.values(awards);
    return {
      bonus:          awards.agency_monthly_bonus,
      annualAwards:   all.filter((a) => a.category === 'annual' && !['activity_bronze','activity_silver','activity_gold','highest_activity','recruiting_bronze','recruiting_silver','recruiting_gold'].includes(a.id)),
      activityAwards: all.filter((a) => ['activity_bronze','activity_silver','activity_gold','highest_activity'].includes(a.id)),
      recruitAwards:  all.filter((a) => ['recruiting_bronze','recruiting_silver','recruiting_gold'].includes(a.id)),
    };
  }, [awards]);

  function sortAwards(list) {
    return [...list].sort((a, b) => {
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      if (a.inContention && !b.inContention) return -1;
      if (!a.inContention && b.inContention) return 1;
      return 0;
    });
  }

  const activeAwards = useMemo(() => {
    if (activeTab === 'annual')   return sortAwards(annualAwards);
    if (activeTab === 'activity') return sortAwards(activityAwards);
    if (activeTab === 'recruit')  return sortAwards(recruitAwards);
    return [];
  }, [activeTab, annualAwards, activityAwards, recruitAwards]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-border/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>;
  }

  if (!agentIds?.length) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">No agents in your unit yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Monthly bonus card */}
      {bonus && <MonthlyBonusCard bonus={bonus} />}

      {/* Annual award tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border overflow-x-auto mb-1">
        {ANNUAL_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-max h-11 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap px-3 ${
              activeTab === t.id ? 'bg-[var(--color-surface)] text-primary shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeAwards.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm text-ink-muted">No awards in this category.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activeAwards.map((award) => <AwardCard key={award.id} award={award} />)}
        </div>
      )}
    </div>
  );
}
