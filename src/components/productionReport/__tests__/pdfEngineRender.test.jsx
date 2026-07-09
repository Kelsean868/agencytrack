// @vitest-environment node
//
// Real-engine render guard for the 2.5 PDF documents. The value-level model
// tests prove the numbers; THIS file proves the document trees actually render
// through @react-pdf's layout engine (a bad style prop, undefined child, or
// unsupported CSS feature only surfaces here — jsdom never exercises the
// engine). Runs in node (react-pdf needs no DOM; built-in Helvetica).
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { BranchReportDocument, UnitReportDocument } from '../ManagerReportDocument';
import { AgentReportDocument } from '../../profile/AgentReportDocument';

const BRANCH_INPUT = {
  scope: 'branch',
  orgLabel: 'South Branch',
  managerName: 'Trevor',
  period: 'ytd',
  periodLabel: 'Year to date',
  totals: { totalApi: 100000, totalApps: 20, agentCount: 5, unitCount: 2, avgApiPerAgent: 20000 },
  units: [
    { id: 'u1', name: 'S·01', value: 30000, secondaryValue: 3 },
    { id: 'u2', name: 'S·02', value: 10000, secondaryValue: 2 },
  ],
  roster: [
    { rank: 1, agentName: 'Alice', unitName: 'S·01', totals: { totalApi: 50000, totalApps: 10 } },
    { rank: 2, agentName: 'Bob', totals: { totalApi: 30000, totalApps: 6 } },
    { rank: 3, agentName: 'Cara', totals: { totalApi: 20000, totalApps: 4 } },
  ],
  compliance: { submitted: 4, total: 5, percent: 80 },
};

describe('PDF documents render through the real @react-pdf engine', () => {
  it('BranchReportDocument renders to a non-trivial PDF buffer', async () => {
    const buf = await renderToBuffer(<BranchReportDocument {...BRANCH_INPUT} />);
    expect(buf.length).toBeGreaterThan(1000);
    // %PDF header proves a real document, not an error artifact
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('UnitReportDocument renders to a non-trivial PDF buffer', async () => {
    const buf = await renderToBuffer(
      <UnitReportDocument
        {...BRANCH_INPUT}
        scope="unit"
        orgLabel="S·01"
        units={[]}
        totals={{ totalApi: 30000, totalApps: 6, agentCount: 3, avgApiPerAgent: 10000 }}
      />,
    );
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('AgentReportDocument renders with minimal empty-safe props', async () => {
    const buf = await renderToBuffer(
      <AgentReportDocument
        agentInfo={{ displayName: 'Test Agent', email: 'a@b.tt', role: 'agent', careerLevel: 'Agent' }}
        submissions={[]}
        goals={[]}
        weekRange={null}
        confirmedSettlements={[]}
        agentProfile={{}}
        persistency={[]}
        ruleset={undefined}
      />,
    );
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);
});
