import React, { useEffect, useMemo, useState } from 'react';
import { Presentation, FileDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listBranches } from '../../services/branchService';
import { generateBranchPlanPDF } from '../../services/exportService';
import { useStrategicPlan } from '../../hooks/useStrategicPlan';
import { defaultPeriod } from '../../lib/strategicPlan/periodModel';
import StrategicPlanCover from './StrategicPlanCover';
import AgentPerformanceTracker from './AgentPerformanceTracker';
import ProductionSummary from './ProductionSummary';
import PeriodMetrics from './PeriodMetrics';
import OrgStructure from './OrgStructure';
import RecruitmentPipeline from './RecruitmentPipeline';
import StrategicPlanMode from './StrategicPlanMode';

const CROSS_BRANCH_ROLES = new Set(['sales_manager', 'tenant_admin', 'platform_admin']);

const SECTION_NAV = [
  { id: 'agents', label: 'Agents' },
  { id: 'production', label: 'Production' },
  { id: 'period-metrics', label: 'Period' },
  { id: 'org', label: 'Org' },
  { id: 'recruitment', label: 'Recruitment' },
];

// Track K — Strategic Plan · dashboard shell. Scope selector (role-driven),
// period selector (year + quarter/half toggle), section nav, Present, Export PDF.
// All sections stacked and read from the single useStrategicPlan model.
export default function StrategicPlanDashboard() {
  const { role, branchId, tenantId } = useAuth();
  const isCrossBranch = CROSS_BRANCH_ROLES.has(role);

  const [branches, setBranches] = useState([]);
  const [branchesLoaded, setBranchesLoaded] = useState(!isCrossBranch);
  const [selectedBranchId, setSelectedBranchId] = useState(isCrossBranch ? null : branchId);
  const [period, setPeriod] = useState(defaultPeriod());
  const [presenting, setPresenting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isCrossBranch || !tenantId) return;
    let active = true;
    listBranches(tenantId)
      .then((list) => {
        if (!active) return;
        const activeBranches = list.filter((b) => b.isActive !== false);
        setBranches(activeBranches);
        setSelectedBranchId((cur) => cur ?? activeBranches[0]?.id ?? null);
      })
      .catch(() => { if (active) setBranches([]); })
      .finally(() => { if (active) setBranchesLoaded(true); });
    return () => { active = false; };
  }, [isCrossBranch, tenantId]);

  const plan = useStrategicPlan(selectedBranchId, period);

  // Phase 1: current plan year only. Historical/future years need a year-scoped
  // submissions fetch (getAllYTDSubmissions is hardcoded to the current year) — a
  // Phase 2 concern; offering past years here would mix current-year submissions
  // with past-year quotas/policies.
  const years = useMemo(() => [new Date().getFullYear()], []);

  async function handleExport() {
    if (exporting || plan.loading) return;
    setExporting(true);
    try {
      await generateBranchPlanPDF(plan);
    } catch (e) {
      console.error('[StrategicPlan] PDF export failed', e);
    } finally {
      setExporting(false);
    }
  }

  if (presenting) {
    return <StrategicPlanMode plan={plan} onClose={() => setPresenting(false)} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-16" data-testid="strategic-plan-dashboard">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {isCrossBranch && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted">Branch</span>
            <select
              value={selectedBranchId ?? ''}
              onChange={(e) => setSelectedBranchId(e.target.value || null)}
              className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-ink"
              data-testid="sp-branch-select"
            >
              {branches.length === 0 && <option value="">No branches</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name ?? b.id}</option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Year</span>
          <select
            value={period.year}
            onChange={(e) => setPeriod((p) => ({ ...p, year: Number(e.target.value) }))}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-ink"
            data-testid="sp-year-select"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>

        {/* Granularity toggle */}
        <div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Period granularity">
          {['quarter', 'half'].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setPeriod((p) => ({ ...p, granularity: g }))}
              aria-pressed={period.granularity === g}
              data-testid={`sp-granularity-${g}`}
              className={`min-h-[44px] px-4 text-sm font-medium ${
                period.granularity === g ? 'bg-primary text-white dark:bg-primary-dark' : 'bg-card text-ink-muted'
              }`}
            >
              {g === 'quarter' ? 'Quarterly' : 'Half-year'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPresenting(true)}
            disabled={plan.loading || plan.empty}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-primary-dark"
            data-testid="sp-present-btn"
          >
            <Presentation size={16} aria-hidden="true" /> Present
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={plan.loading || plan.empty || exporting}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-ink disabled:opacity-50"
            data-testid="sp-export-btn"
          >
            <FileDown size={16} aria-hidden="true" /> {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Section nav */}
      <nav className="flex flex-wrap gap-2" aria-label="Plan sections">
        {SECTION_NAV.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-3 text-xs font-medium text-ink-muted hover:text-ink"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {isCrossBranch && branchesLoaded && !selectedBranchId ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-ink-muted" data-testid="sp-no-branch">
          No active branches to plan. Create a branch first.
        </div>
      ) : plan.error ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center" role="alert">
          <p className="text-sm font-medium text-danger-ink">Couldn’t load the strategic plan.</p>
          <button type="button" onClick={plan.reload} className="mt-2 min-h-[44px] text-sm text-primary underline">Retry</button>
        </div>
      ) : (
        <>
          <StrategicPlanCover plan={plan} />
          <AgentPerformanceTracker agents={plan.agents} loading={plan.loading} error={plan.agents.error} onRetry={plan.reload} />
          <ProductionSummary production={plan.production} loading={plan.loading} error={plan.production?.error} onRetry={plan.reload} />
          <PeriodMetrics periodMetrics={plan.periodMetrics} loading={plan.loading} error={plan.periodMetrics?.error} onRetry={plan.reload} />
          <OrgStructure orgStructure={plan.orgStructure} loading={plan.loading} error={plan.orgStructure?.error} onRetry={plan.reload} />
          <RecruitmentPipeline recruitment={plan.recruitment} loading={plan.loading} error={plan.recruitment?.error} onRetry={plan.reload} />
        </>
      )}
    </div>
  );
}
