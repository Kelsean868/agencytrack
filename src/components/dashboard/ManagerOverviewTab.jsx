import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBranchOverview } from '../../hooks/useBranchOverview';
import ManagerHeroSection from './ManagerHeroSection';
import BranchKPIStrip from './BranchKPIStrip';
import BranchActivityFeed from './BranchActivityFeed';
import TeamMedalsPanel from './TeamMedalsPanel';

export default function ManagerOverviewTab({ role, userProfile, tenantId, onSubmitReport }) {
  const {
    loading,
    error,
    reload,
    teamYTDAPI,
    teamAnnualGoal,
    goalSet,
    inScopeAgentCount,
    kpiData,
    activityEvents,
    badgeCounts,
  } = useBranchOverview(role, userProfile, tenantId);

  if (error) {
    return (
      <div role="alert" className="card flex items-start gap-3 text-danger-ink">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Could not load overview</p>
          <p className="text-xs text-ink-muted mt-0.5">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-2 min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ManagerHeroSection
        teamYTDAPI={teamYTDAPI}
        teamAnnualGoal={teamAnnualGoal}
        goalSet={goalSet}
        inScopeAgentCount={inScopeAgentCount}
        loading={loading}
      />

      <BranchKPIStrip kpiData={kpiData} loading={loading} />

      <div className="g4-mix mb-6">
        <BranchActivityFeed events={activityEvents} loading={loading} />
        <TeamMedalsPanel badgeCounts={badgeCounts} loading={loading} />
      </div>

      {onSubmitReport && (
        <button className="btn-primary w-full" onClick={onSubmitReport}>
          Submit Weekly Report
        </button>
      )}
    </div>
  );
}
