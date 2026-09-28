/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import React, { useMemo, useState } from 'react';
import FrFocusView from '../../work/FrFocusView';
import FrPipelineView from '../../work/FrPipelineView';
import { FrNumbersHeaderView, FrLedgerHeaderView } from '../../work/FrWorkHeaderViews';
import { focusCalls, paperwork, funnel, board, numbersTiles } from '../../../../lib/fr/workModel';
import { reinstatementPlan } from '../../../../lib/fr/moneyModel';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../../utils/weeklyActivityFloors';
import { ACTIVITY_METADATA } from '../../../../constants/activityMetadata';

/**
 * FR-4 harness scenes (SAMPLE data through the real workModel). Variant B =
 * more logged today / this week, so counts count up and funnel bars glide.
 * Names are placeholders, never real clients. Phone numbers are 555 test numbers.
 */

const TODAY = '2026-09-20';
// Sample codes are DERIVED from ACTIVITY_METADATA (v3 rule 1; the
// activity-code twin guard forbids a literal code list outside the table):
// a call-attributed capacity code for blocks, then prospect-picker codes.
const CODES = Object.entries(ACTIVITY_METADATA);
const BLOCK_CODE = CODES.find(([, m]) => m.family === 'call' && m.callAttributed)[0];
const PROSPECT_CODES = CODES.filter(([, m]) => m.pickerGroup === 'prospect').map(([k]) => k);
const APPTS = [
  { id: 'a1', type: BLOCK_CODE, startTime: '08:30', durationMin: 90, status: 'scheduled' },
  { id: 'a2', type: PROSPECT_CODES[1], prospectId: 'p1', startTime: '10:00', status: 'kept' },
  { id: 'a3', type: PROSPECT_CODES[2], prospectId: 'p2', startTime: '11:30', status: 'scheduled' },
  { id: 'a4', type: PROSPECT_CODES[3], prospectId: 'p3', startTime: '14:00', status: 'scheduled' },
  { id: 'a5', type: BLOCK_CODE, startTime: '16:00', durationMin: 60, status: 'scheduled' },
];
const PROSPECTS = [
  { id: 'p1', clientName: '[Client A]', phone: '868-555-0101' },
  { id: 'p2', clientName: '[Client B]', phone: '868-555-0102' },
  { id: 'p3', clientName: '[Client C]' },
];
const pol = (n, status, api, extra = {}) => ({ id: n, policyNumber: n, status, proposedAPI: api, productLine: 'life', newBusinessType: 'nb_ordinary', ...extra });
const POLICIES = [
  pol('P-2001', 'written', 6000, { dateWritten: '2026-09-15', ownerName: '[Client D]' }),
  pol('P-2002', 'submitted', 12000, { dateSubmitted: '2026-08-28', ownerName: '[Client E]' }),
  pol('P-2003', 'rated', 9000, { dateSubmitted: '2026-08-10', ownerName: '[Client F]' }),
  pol('P-2004', 'postponed', 4800, { dateSubmitted: '2026-07-22', ownerName: '[Client G]' }),
  pol('P-2005', 'settled', 30000, { dateIssued: '2026-09-04', ownerName: '[Client H]' }),
  pol('P-2006', 'settled', 21600, { dateIssued: '2026-07-09', ownerName: '[Client I]' }),
  pol('P-0901', 'lapsed', 1182.36, { dateIssued: '2024-10-28', ownerName: '[Client J]' }),
  pol('P-0903', 'lapsed', 11996.64, { dateIssued: '2025-08-14', ownerName: '[Client K]' }),
  pol('P-1001', 'settled', 90000, { dateIssued: '2025-03-14' }),
];
const WEEK = {
  A: { callsMade: 38, telContacts: 22, appointmentsScheduled: 9, factFindsCompleted: 3, closingInterviewsKept: 3, applicationsSubmitted: 0, clientsSold: 0 },
  B: { callsMade: 58, telContacts: 34, appointmentsScheduled: 14, factFindsCompleted: 6, closingInterviewsKept: 5, applicationsSubmitted: 1, clientsSold: 1 },
};

function Frame({ children }) {
  return (
    <main className="mx-auto max-w-[1180px] px-4 py-6 md:px-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness</p>
      {children}
    </main>
  );
}

function FocusScene({ variant }) {
  const [mode, setMode] = useState('calls');
  const calls = useMemo(() => focusCalls({
    appointments: APPTS,
    prospects: PROSPECTS,
    dailyEntry: variant === 'B' ? { dials: 41, telContacts: 17 } : { dials: 12, telContacts: 5 },
  }), [variant]);
  const rows = useMemo(() => paperwork({ policies: POLICIES, todayTT: TODAY }), []);
  const plan = useMemo(() => reinstatementPlan({ policies: POLICIES, todayTT: TODAY }), []);
  const noop = () => {};
  return (
    <Frame>
      <FrFocusView mode={mode} onMode={setMode} calls={calls} paperwork={rows} plan={plan} onLogToday={noop} onOpenLedger={noop} onOpenPlanner={noop} />
    </Frame>
  );
}

function PipelineScene({ variant }) {
  const [view, setView] = useState('funnel');
  const [period, setPeriod] = useState('week');
  const stages = useMemo(() => funnel({ values: WEEK[variant] ?? WEEK.A, floors: { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS }, weeks: 1 }), [variant]);
  const cols = useMemo(() => board({ policies: POLICIES, todayTT: TODAY }), []);
  return (
    <Frame>
      <FrPipelineView view={view} onView={setView} period={period} onPeriod={setPeriod} funnel={stages} periodNote="This week so far, from your daily logs." board={cols} />
    </Frame>
  );
}

function HeadersScene({ variant }) {
  const sub = (weekStarting, n) => ({
    status: 'submitted', weekStarting, version: 2,
    telContacts: 20 + n, ffiConducted: 4, ciConducted: 2 + (n % 2), applicationsSold: 1, livesSold: 1, appointmentsSet: 8,
    referralCalls: 10, followUpCalls: 10, coldCalls: 10 + n, seminarTradeshowCalls: 10,
  });
  const weeks = variant === 'B' ? 20 : 8; // a delta big enough to be mid-count at 240ms
  const subs = useMemo(() => Array.from({ length: weeks }, (_, i) => sub(`2026-${String(7 + Math.floor(i / 4)).padStart(2, '0')}-${String(1 + (i % 4) * 7).padStart(2, '0')}`, i)), [weeks]);
  const plan = useMemo(() => reinstatementPlan({ policies: POLICIES, todayTT: TODAY }), []);
  const settled = variant === 'B' ? 111600 : 51600;
  const tiles = [
    { id: 'settled', label: 'Settled API 2026', value: settled, unit: 'ttd', note: '2 from head office · 0 self-confirmed' },
    { id: 'apps', label: 'Settled apps', value: variant === 'B' ? 3 : 2, unit: 'count', note: 'Count toward MDRT and awards' },
    { id: 'waiting', label: 'Submitted, not settled', value: 31800, unit: 'ttd', note: '4 apps waiting' },
  ];
  return (
    <Frame>
      <FrNumbersHeaderView tiles={numbersTiles({ submissions: subs, year: 2026 })} />
      <FrLedgerHeaderView tiles={tiles} plan={plan} onOpenWinback={() => {}} />
    </Frame>
  );
}

export const WORK_SCENES = [
  { id: 'focus', title: 'Work · Focus', slice: 'FR-4', viewport: 'desktop,phone', hasVariants: true, render: FocusScene },
  { id: 'pipeline', title: 'Work · Pipeline', slice: 'FR-4', viewport: 'desktop,tablet,phone', hasVariants: true, render: PipelineScene },
  { id: 'work-headers', title: 'Numbers + Ledger headers', slice: 'FR-4', viewport: 'desktop,phone', hasVariants: true, render: HeadersScene },
];
