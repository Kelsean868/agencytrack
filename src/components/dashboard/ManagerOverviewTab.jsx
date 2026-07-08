import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBranchOverview } from '../../hooks/useBranchOverview';
import CascadeAnchorStrip from './CascadeAnchorStrip';
import ExceptionLeadPanel from './ExceptionLeadPanel';
import BranchKPIStrip from './BranchKPIStrip';
import BranchActivityFeed from './BranchActivityFeed';
import TeamMedalsPanel from './TeamMedalsPanel';
import AgentDrillDrawer from '../manager/AgentDrillDrawer';

// Scope label for the cascade strip / drill context — the manager's own scope.
const SCOPE_LABEL = {
  unit_manager: 'Unit',
  branch_manager: 'Branch',
};
function scopeLabelFor(role) {
  return SCOPE_LABEL[role] ?? 'Team';
}

// Weeks remaining in the calendar year (matches ManagerHeroSection).
function weeksLeftInYear() {
  return Math.max(
    0,
    Math.round(
      (new Date(new Date().getFullYear(), 11, 31).getTime() - Date.now()) /
        (7 * 24 * 60 * 60 * 1000)
    )
  );
}

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
    // Fable 1.5 — exception-first lead + cascade strip (defaulted so a mock hook
    // return without these fields — e.g. the wizard-gate test — still renders).
    exceptions = [],
    needAttentionCount = 0,
    onPaceCount = 0,
    companyFloorTotal = 0,
    weeklyPulse = { api: 0, apps: 0, ffi: 0 },
    submissionsByAgent = {},
  } = useBranchOverview(role, userProfile, tenantId);

  // Coaching drill drawer — opened by an exception row (or, later, a roster row).
  const [drillAgent, setDrillAgent] = useState(null);

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

  const scopeLabel = scopeLabelFor(role);

  return (
    <div>
      {/* Cascade anchor — "your reality first" */}
      <CascadeAnchorStrip
        scopeLabel={scopeLabel}
        teamYTDAPI={teamYTDAPI}
        teamAnnualGoal={teamAnnualGoal}
        goalSet={goalSet}
        companyFloorTotal={companyFloorTotal}
        weeklyPulse={weeklyPulse}
        onPaceCount={onPaceCount}
        needAttentionCount={needAttentionCount}
        inScopeAgentCount={inScopeAgentCount}
        weeksLeft={weeksLeftInYear()}
        loading={loading}
      />

      {/* Exception-first lead */}
      <ExceptionLeadPanel
        exceptions={exceptions}
        loading={loading}
        error={error}
        onRetry={reload}
        onDrill={(e) => setDrillAgent(e)}
      />

      {/* General stats — KPI strip + recognition/recent, below the lead */}
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

      {drillAgent && (
        <AgentDrillDrawer
          key={drillAgent.agentId}
          agent={drillAgent}
          submissions={submissionsByAgent[drillAgent.agentId] ?? []}
          tenantId={tenantId}
          onClose={() => setDrillAgent(null)}
        />
      )}
    </div>
  );
}
