import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { extractFields, extractTotalProductionCredit } from '../utils/extractFields';
import { AgentReportDocument } from '../components/profile/AgentReportDocument';

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
}) {
  const doc = createElement(AgentReportDocument, {
    agentInfo,
    submissions,
    goals,
    weekRange,
    confirmedSettlements,
    agentProfile,
    persistency,
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

    // Average persistency for the year
    const persEntries = (persistencyMap?.[agent.id] ?? []);
    const persValues  = persEntries
      .map((e) => parseFloat(e.persistency) || 0)
      .filter((v) => v > 0);
    const persistencyAvg = persValues.length > 0
      ? Math.round(persValues.reduce((s, v) => s + v, 0) / persValues.length)
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
