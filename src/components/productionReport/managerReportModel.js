// managerReportModel — pure normaliser for the Branch/Unit Performance Report
// PDFs (ManagerReportDocument.jsx). Split into its own module so the .jsx file
// exports ONLY React components (react-refresh boundary).
//
// The CALLING VIEW passes rows it has ALREADY derived through the shared
// lib/productionReport/computations utils. This builder does NO fetching and
// NO re-derivation — it only shapes the passed rows for layout.
export function buildManagerReportModel({
  scope = 'branch',
  orgLabel = 'Branch',
  managerName = null,
  period = 'ytd',
  periodLabel = 'Year to date',
  totals = {},
  units = [],
  roster = [],
  compliance = null,
  unitRank = null,
  unitCount = null,
  now = new Date(),
} = {}) {
  const safeRoster = (roster ?? []).map((r, i) => ({
    rank: r.rank ?? i + 1,
    name: r.name ?? r.agentName ?? '—',
    unit: r.unit ?? r.unitName ?? null,
    totalApi: Number(r.totalApi ?? r.value ?? r.totals?.totalApi ?? 0) || 0,
    totalApps: Number(r.totalApps ?? r.secondaryValue ?? r.totals?.totalApps ?? 0) || 0,
  }));
  const maxApi = safeRoster.reduce((mx, r) => Math.max(mx, r.totalApi), 0) || 1;
  const topPerformers = safeRoster.slice(0, 3);
  const ROSTER_CAP = 12;
  const visibleRoster = safeRoster.slice(0, ROSTER_CAP);
  const hiddenCount = Math.max(0, safeRoster.length - visibleRoster.length);

  const safeUnits = (units ?? []).map((u, i) => ({
    id: u.id ?? u.unitId ?? `unit-${i}`,
    name: u.name ?? 'Unit',
    avgApiPerAgent: Number(u.avgApiPerAgent ?? u.value ?? 0) || 0,
    agentCount: Number(u.agentCount ?? u.secondaryValue ?? 0) || 0,
    totalApi: Number(u.totalApi ?? 0) || 0,
  }));
  const unitTotalApiMax = safeUnits.reduce((mx, u) => Math.max(mx, u.avgApiPerAgent), 0) || 1;

  return {
    scope,
    orgLabel,
    managerName,
    period,
    periodLabel,
    year: now.getFullYear(),
    issuedDate: now.toLocaleDateString('en-TT', { year: 'numeric', month: 'long', day: 'numeric' }),
    totals: {
      totalApi: Number(totals.totalApi) || 0,
      totalApps: Number(totals.totalApps) || 0,
      agentCount: Number(totals.agentCount) || 0,
      unitCount: totals.unitCount != null ? Number(totals.unitCount) : (scope === 'branch' ? safeUnits.length : null),
      avgApiPerAgent: Number(totals.avgApiPerAgent) || 0,
    },
    units: safeUnits,
    unitTotalApiMax,
    roster: safeRoster,
    visibleRoster,
    hiddenCount,
    maxApi,
    topPerformers,
    compliance: compliance
      ? { submitted: Number(compliance.submitted) || 0, total: Number(compliance.total) || 0, percent: Number(compliance.percent) || 0 }
      : null,
    unitRank,
    unitCount,
  };
}
