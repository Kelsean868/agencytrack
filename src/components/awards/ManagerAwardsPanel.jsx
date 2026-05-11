import React, { useMemo, useState, useEffect } from 'react';
import { computeManagerAwards } from '../../utils/awardsEngine';
import { getSettlementsForUnit } from '../../services/settlementService';
import { formatCurrency } from '../../utils/formatters';
import TabPills from '../ui/TabPills';
import GoalDonut from '../dashboard/GoalDonut';
import AwardMedalCard from './AwardMedalCard';

// Bonus tier hero — replaces the old MonthlyBonusCard with a role-hero strip.
// Headline value = bonusAmount (TTD earned). Bar fill = avgMonthlyAPI / nextTier.threshold.
function MonthlyBonusHero({ bonus }) {
  const hasNextTier = bonus.nextTier != null;
  const fillPercent = hasNextTier
    ? Math.min(100, Math.round((bonus.avgMonthlyAPI / bonus.nextTier.threshold) * 100))
    : 100;

  return (
    <div className="role-hero mb-6">
      <div className="goal-slide" style={{ alignItems: 'center' }}>
        <div className="goal-content">
          <div className="goal-period">Monthly Production Bonus</div>
          <div className="goal-value">{formatCurrency(bonus.bonusAmount)}</div>
          <div className="goal-target">
            {bonus.bonusPct > 0
              ? `Tier ${bonus.bonusPct}% unlocked`
              : 'No tier unlocked yet'}
          </div>

          <div className="goal-bar-wrap">
            <div className="bar bar-thick">
              <div className="bar-fill" style={{ width: `${fillPercent}%` }} />
            </div>
          </div>

          <div className="goal-status" style={{ marginTop: 10 }}>
            {hasNextTier ? (
              <span>
                Currently {formatCurrency(bonus.avgMonthlyAPI)} avg/advisor
                {' · '}Tier {bonus.nextTier.pct}% at {formatCurrency(bonus.nextTier.threshold)}
              </span>
            ) : (
              <span>Top tier achieved</span>
            )}
          </div>

          {bonus.note && (
            <p className="text-[11px] mt-2" style={{ opacity: 0.75 }}>{bonus.note}</p>
          )}
        </div>

        <div className="goal-donut-wrap">
          <GoalDonut percent={fillPercent} period="next bonus tier" />
        </div>
      </div>
    </div>
  );
}

const ANNUAL_TABS = [
  { id: 'annual',   label: 'Annual'    },
  { id: 'activity', label: 'Activity'  },
  { id: 'recruit',  label: 'Recruiting' },
];

const ACTIVITY_IDS = ['activity_bronze','activity_silver','activity_gold','highest_activity'];
const RECRUIT_IDS  = ['recruiting_bronze','recruiting_silver','recruiting_gold'];

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
      annualAwards:   all.filter((a) => a.category === 'annual' && !ACTIVITY_IDS.includes(a.id) && !RECRUIT_IDS.includes(a.id)),
      activityAwards: all.filter((a) => ACTIVITY_IDS.includes(a.id)),
      recruitAwards:  all.filter((a) => RECRUIT_IDS.includes(a.id)),
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
      {bonus && <MonthlyBonusHero bonus={bonus} />}

      <TabPills tabs={ANNUAL_TABS} activeId={activeTab} onChange={setActiveTab} className="overflow-x-auto mb-1" />

      {activeAwards.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm text-ink-muted">No awards in this category.</p>
        </div>
      ) : (
        <div className="badge-grid">
          {activeAwards.map((award) => <AwardMedalCard key={award.id} award={award} />)}
        </div>
      )}
    </div>
  );
}
