// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BranchKPIStrip from '../BranchKPIStrip.jsx';

vi.mock('../KPICard', () => ({
  default: ({ label }) => <div data-testid="kpi-card">{label}</div>,
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
});

describe('BranchKPIStrip — with data', () => {
  it('renders all 4 KPICard instances', () => {
    render(<BranchKPIStrip kpiData={KPIS_4W} loading={false} />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(4);
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
