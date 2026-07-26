// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BranchKPIStrip from '../BranchKPIStrip.jsx';

vi.mock('../KPICard', () => ({
  default: ({ label, values, isPercent }) => (
    <div
      data-testid="kpi-card"
      data-values={JSON.stringify(values)}
      data-percent={String(!!isPercent)}
    >{label}</div>
  ),
}));

const KPIS_4W = {
  compliance: [80, 85, 90, 88],
  api: [40000, 42000, 45000, 44000],
  apps: [8, 9, 10, 9],
  ffi: [12, 14, 13, 15],
};

describe('BranchKPIStrip — loading', () => {
  it('renders skeleton pulses when loading=true', () => {
    const { container } = render(<BranchKPIStrip kpiData={{}} loading />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThan(0);
    expect(screen.queryByTestId('kpi-card')).toBeNull();
  });

  it('renders 5 skeleton tiles (4 weekly KPIs + Active Agents)', () => {
    const { container } = render(<BranchKPIStrip kpiData={{}} loading />);
    const pulses = container.querySelectorAll('.h-\\[140px\\].animate-pulse');
    expect(pulses.length).toBe(5);
  });
});

describe('BranchKPIStrip — with data', () => {
  it('renders all 5 KPICard instances (4 weekly + Active Agents)', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} activeAgentCount={12} />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(5);
  });

  it('renders Compliance Rate label', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} />);
    expect(screen.getByText('Compliance Rate')).toBeInTheDocument();
  });

  it('renders Weekly API label', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} />);
    expect(screen.getByText('Weekly API')).toBeInTheDocument();
  });

  it('renders Weekly Apps label', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} />);
    expect(screen.getByText('Weekly Apps')).toBeInTheDocument();
  });

  it('renders Weekly FFI label', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} />);
    expect(screen.getByText('Weekly FFI')).toBeInTheDocument();
  });

  it('passes isPercent only to the Compliance Rate card (so it renders "%", others do not)', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} activeAgentCount={12} />);
    expect(screen.getByText('Compliance Rate').getAttribute('data-percent')).toBe('true');
    expect(screen.getByText('Weekly API').getAttribute('data-percent')).toBe('false');
    expect(screen.getByText('Weekly Apps').getAttribute('data-percent')).toBe('false');
    expect(screen.getByText('Weekly FFI').getAttribute('data-percent')).toBe('false');
    expect(screen.getByText('Active Agents').getAttribute('data-percent')).toBe('false');
  });

  it('renders week count in strip heading', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} />);
    expect(screen.getByText(/4 Weeks/i)).toBeInTheDocument();
  });

  it('renders W/W trend pills when >= 2 weeks of data', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} />);
    // Compliance: 88 vs 90 → down ▼; API: 44000 vs 45000 → down ▼
    const body = document.body.textContent;
    expect(body).toContain('▼');
  });

  it('does not render pill strip with only 1 week of data', () => {
    const oneWeek = { compliance: [80], api: [40000], apps: [8], ffi: [12] };
    render(<BranchKPIStrip kpiData={oneWeek} loading={false} />);
    expect(document.body.textContent).not.toContain('▲');
    expect(document.body.textContent).not.toContain('▼');
  });
});

describe('BranchKPIStrip — Active Agents card', () => {
  it('renders Active Agents label', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} activeAgentCount={12} />);
    expect(screen.getByText('Active Agents')).toBeInTheDocument();
  });

  it('passes the active agent count through as a single-element values array', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} activeAgentCount={12} />);
    const card = screen.getByText('Active Agents');
    expect(card.getAttribute('data-values')).toBe(JSON.stringify([12]));
  });

  it('passes an empty values array when activeAgentCount is absent (no fabricated count)', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} />);
    const card = screen.getByText('Active Agents');
    expect(card.getAttribute('data-values')).toBe(JSON.stringify([]));
  });

  it('is excluded from the W/W trend pill row (no historical headcount series exists)', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} activeAgentCount={12} />);
    // 4 weekly-trend pills (Compliance/API/Apps/FFI) only — Active Agents never
    // gets a pill since there is no per-week count to compare against.
    expect(screen.queryByText(/Active Agents ▲|Active Agents ▼|Active Agents —/)).toBeNull();
  });
});
