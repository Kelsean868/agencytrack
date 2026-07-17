import { createElement } from 'react';
import { extractFields, extractTotalProductionCredit } from '../utils/extractFields';
import { aggregatePersistency } from '../lib/persistency/calculations';
// NOTE: @react-pdf/renderer and AgentReportDocument are dynamically imported
// inside generateAgentPDF (EFF-011) so the ~heavy PDF engine stays out of the
// entry chunk and loads only on first report export.

// ── generateAgentPDF ──────────────────────────────────────────────────────────
// Options:
//   agentInfo:            { displayName, email, role, careerLevel }
//   submissions:          raw submission docs (all agent submissions)
//   goals:                goals doc from Firestore
//   weekRange:            4 | 8 | 12 | 'year'
//   confirmedSettlements: array of settlement docs for the agent (current year)
//   agentProfile:         user profile doc (agentNumber, monthsInIndustry, etc.)
//   persistency:          map keyed by `${agentId}_${year}_${mm}` → persistency doc
export async function generateAgentPDF({
  agentInfo,
  submissions,
  goals,
  weekRange,
  confirmedSettlements,
  agentProfile,
  persistency,
  ruleset,
}) {
  // Load the PDF engine + document on demand (EFF-011). The handler is already
  // async, so the only user-visible effect is a one-time chunk fetch on the
  // first export of a session.
  const [{ pdf }, { AgentReportDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../components/profile/AgentReportDocument'),
  ]);

  const doc = createElement(AgentReportDocument, {
    agentInfo,
    submissions,
    goals,
    weekRange,
    confirmedSettlements,
    agentProfile,
    persistency,
    ruleset,
  });

  const blob = await pdf(doc).toBlob();
  const url  = URL.createObjectURL(blob);

  const safeName = (agentInfo?.displayName ?? agentInfo?.name ?? 'Agent').replace(/\s+/g, '_');
  const yr       = new Date().getFullYear();

  const a = document.createElement('a');
  a.href     = url;
  a.download = `AgencyTrack_Performance_${safeName}_${yr}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── generateBranchPlanPDF (Track K) ─────────────────────────────────────────
// Renders the Strategic Plan snapshot. `plan` is the useStrategicPlan model
// verbatim ({ meta, agents, production, periodMetrics, orgStructure, recruitment })
// — the SAME single math path as the dashboard + presentation mode; the document
// re-derives nothing. Engine + document are dynamically imported (EFF-011 pattern)
// so the heavy PDF chunk stays out of the entry bundle.
export async function generateBranchPlanPDF(plan) {
  const [{ pdf }, { BranchPlanDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../components/strategicPlan/BranchPlanDocument'),
  ]);

  const doc = createElement(BranchPlanDocument, { plan });
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);

  const safeBranch = (plan?.meta?.branchName ?? 'Branch').replace(/\s+/g, '_');
  const yr = plan?.meta?.period?.year ?? new Date().getFullYear();

  const a = document.createElement('a');
  a.href = url;
  a.download = `AgencyTrack_StrategicPlan_${safeBranch}_${yr}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── generateBranchPDF / generateUnitPDF ───────────────────────────────────────
// Manager (Branch / Unit) Performance Report PDFs. The refined replacement for
// the raw CSV (exportBranchCSV, kept intact below for its own export path).
//
// The CALLING VIEW passes rows it has ALREADY derived through the shared
// lib/productionReport/computations utils — this function does NO refetching and
// no re-derivation (ManagerReportDocument.buildManagerReportModel only
// normalises the passed rows for layout). @react-pdf engine + document are
// dynamically imported so the heavy PDF chunk stays out of the entry bundle.
async function generateManagerPDF(scope, input) {
  const [{ pdf }, mod] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../components/productionReport/ManagerReportDocument'),
  ]);
  const DocComponent = scope === 'unit' ? mod.UnitReportDocument : mod.BranchReportDocument;

  const doc = createElement(DocComponent, input);
  const blob = await pdf(doc).toBlob();
  const url  = URL.createObjectURL(blob);

  const today   = new Date().toISOString().slice(0, 10);
  const safeOrg = String(input?.orgLabel ?? scope).replace(/[^\w-]+/g, '_').replace(/_+/g, '_');
  const kind    = scope === 'unit' ? 'Unit' : 'Branch';

  const a = document.createElement('a');
  a.href     = url;
  a.download = `AgencyTrack_${kind}_Report_${safeOrg}_${today}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// input: { orgLabel, managerName, period, periodLabel, totals, units, roster, compliance }
export function generateBranchPDF(input) {
  return generateManagerPDF('branch', input);
}

// input: { orgLabel, managerName, period, periodLabel, totals, roster, compliance, unitRank, unitCount }
export function generateUnitPDF(input) {
  return generateManagerPDF('unit', input);
}

// ── exportBranchCSV ───────────────────────────────────────────────────────────
// users: array of user docs
// submissions: array of all YTD submission docs
// persistencyMap: object keyed by agentId → array of persistency docs for the year
export function exportBranchCSV(users, submissions, persistencyMap) {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const headers = [
    'Agent Name',
    'Unit',
    'Weeks Submitted',
    'YTD API',
    'YTD Apps',
    'YTD Dials',
    'YTD Tel Contacts',
    'YTD F2F Approaches',
    'YTD FFI',
    'YTD CI',
    'Avg API per App',
    'CI-to-App Rate (%)',
    'Persistency (%)',
    'Career Level',
    'Last Submission Date',
  ];

  const agents = (users ?? []).filter((u) => u.role === 'agent' || !u.role);

  const rows = agents.map((agent) => {
    const agentSubs = (submissions ?? []).filter(
      (s) =>
        (s.agentId === agent.id || s.userId === agent.id) &&
        s.status === 'submitted' &&
        (s.weekStarting ?? '').startsWith(String(year))
    );

    const fields = agentSubs.map((s) => extractFields(s));
    const weeksSubmitted = agentSubs.length;
    const ytdAPI  = agentSubs.reduce((sum, s) => sum + extractTotalProductionCredit(s), 0);
    const ytdApps = fields.reduce((sum, f) => sum + f.applicationsSold, 0);
    const ytdDials       = fields.reduce((sum, f) => sum + f.totalTelAttempts, 0);
    const ytdContacts    = fields.reduce((sum, f) => sum + f.telContacts, 0);
    const ytdF2F         = fields.reduce((sum, f) => sum + f.f2fAttempts, 0);
    const ytdFFI         = fields.reduce((sum, f) => sum + f.ffiConducted, 0);
    const ytdCI          = fields.reduce((sum, f) => sum + f.ciConducted, 0);
    const avgAPIperApp   = ytdApps > 0 ? Math.round(ytdAPI / ytdApps) : '';
    const ciToAppRate    = ytdCI > 0 ? Math.round((ytdApps / ytdCI) * 100) : '';

    // E3: YTD persistency aggregated via sum-then-divide (NEVER average individual
    // percentages). aggregatedPersistency is a 0–1 decimal — multiply by 100 for CSV.
    const persEntries = (persistencyMap?.[agent.id] ?? []);
    const persistencyAvg = persEntries.length > 0
      ? Math.round(aggregatePersistency(persEntries).aggregatedPersistency * 100)
      : '';

    const lastSub = agentSubs.sort((a, b) =>
      (b.weekStarting ?? '').localeCompare(a.weekStarting ?? '')
    )[0];
    const lastDate = lastSub?.weekStarting ?? '';

    return [
      agent.name ?? agent.displayName ?? agent.email ?? '',
      agent.unit ?? agent.unitName ?? '',
      weeksSubmitted,
      Math.round(ytdAPI),
      ytdApps,
      ytdDials,
      ytdContacts,
      ytdF2F,
      ytdFFI,
      ytdCI,
      avgAPIperApp,
      ciToAppRate,
      persistencyAvg,
      agent.levelTitle ?? agent.careerLevel ?? '',
      lastDate,
    ];
  });

  const escape = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];
  const csvContent = csvLines.join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `AgencyTrack_Branch_Report_${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
