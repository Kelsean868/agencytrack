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
      <div className="card flex items-start gap-3 text-danger-ink">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">Could not load overview</p>
          <p className="text-xs text-ink-muted mt-0.5">{error}</p>
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

      <button className="btn-primary w-full" onClick={onSubmitReport}>
        Submit Weekly Report
      </button>
    </div>
  );
}
