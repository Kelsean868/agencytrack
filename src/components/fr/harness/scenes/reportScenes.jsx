/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import ScenePage from '../ScenePage';
import React from 'react';
import HistoryTab from '../../../submissions/HistoryTab';
import AgentReportView from '../../../profile/AgentReportView';
import { ymdUTC } from '../../../../utils/dateInputs';

/**
 * fr-fit-any-width W-4 — two Numbers screens the W-3 real-app sweep flagged
 * that had no harness scene: History (month axis wider than its card; 4-up
 * money tiles crushed on a phone) and the Performance report (TTD tiles
 * crushed at 1024 beside the 360px column). Both are pure views fed SAMPLE
 * weekly reports here. Awards, the Production report and Week fetch their own
 * data, so they stay covered by the real-app sweep (fr-width-real-app.mjs).
 */
// HistoryTab shows the CURRENT year, so the sample weeks are built in it:
// from the first Sunday of this year (fixed 2026 data would go empty in 2027).
const YEAR = new Date().getFullYear();
const JAN1 = Date.UTC(YEAR, 0, 1);
const SUNDAY_ONE = JAN1 + ((7 - new Date(JAN1).getUTCDay()) % 7) * 86_400_000;
const DAY = 86_400_000;
const SUBMISSIONS = Array.from({ length: 39 }, (_, i) => {
  const weekStarting = ymdUTC(new Date(SUNDAY_ONE + i * 7 * DAY));
  const api = [3000, 13000, 14000, 12000, 22000, 0, 8400, 4800, 15200][i % 9];
  return {
    id: `w${i}`,
    weekStarting,
    status: i % 13 === 7 ? 'draft' : 'submitted',
    apiSold: api,
    applicationsSold: api ? 1 + (i % 3) : 0,
    ciConducted: 2 + (i % 4),
    ffiConducted: 3 + (i % 3),
    coldCalls: 40 + (i % 7) * 5,
    telContacts: 12 + (i % 5),
    appointmentsSet: 4 + (i % 3),
  };
});
const NOW = new Date(Date.UTC(YEAR, 8, 30, 12)); // 30 Sep of the sample year

function HistoryScene() {
  return (
    <ScenePage className="mx-auto max-w-[1180px] px-4 py-6 md:px-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness</p>
      <HistoryTab submissions={SUBMISSIONS} loading={false} onDownload={() => {}} generating={false} weeklyTarget={4800} />
    </ScenePage>
  );
}

function PerformanceScene() {
  return (
    <ScenePage className="mx-auto max-w-[1180px] px-4 py-6 md:px-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness</p>
      <AgentReportView
        layout="wide"
        submissions={SUBMISSIONS}
        agentProfile={{ displayName: '[Agent]' }}
        displayName="[Agent]"
        roleLabel="Agent"
        onDownloadPDF={() => {}}
        now={NOW}
      />
    </ScenePage>
  );
}

export const REPORT_SCENES = [
  { id: 'numbers-history', title: 'Numbers · History', slice: 'W-4', viewport: 'desktop,tablet,phone', render: HistoryScene },
  { id: 'numbers-performance', title: 'Numbers · Performance report', slice: 'W-4', viewport: 'desktop,tablet,phone', render: PerformanceScene },
];
