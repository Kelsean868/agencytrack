// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GapAnalysisPanel from '../GapAnalysisPanel';

const baseHierarchy = {
  personal:     { api: 100000 },
  unitTarget:   { api: 120000 },
  branchTarget: { api: 150000 },
  companyFloor: { api: 50000 },
};

const baseYtd = { api: 25000, apps: 5 };

describe('GapAnalysisPanel', () => {
  it('renders loading skeleton when loading=true', () => {
    const { container } = render(
      <GapAnalysisPanel hierarchy={null} ytdTotals={null} loading={true} />
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders error state when error prop is set', () => {
    render(
      <GapAnalysisPanel hierarchy={null} ytdTotals={null} loading={false} error="Failed to load goals" />
    );
    expect(screen.getByText('Failed to load goals')).toBeInTheDocument();
  });

  it('renders "No targets" when hierarchy is null', () => {
    render(
      <GapAnalysisPanel hierarchy={null} ytdTotals={baseYtd} loading={false} />
    );
    expect(screen.getByText(/No targets have been set/i)).toBeInTheDocument();
  });

  it('renders layer labels for each goal tier when data is provided', () => {
    render(
      <GapAnalysisPanel hierarchy={baseHierarchy} ytdTotals={baseYtd} loading={false} />
    );
    // Labels may appear more than once (MetricSection × n metrics per layer)
    expect(screen.getAllByText('Personal Commitment').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unit Target').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Branch Target').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Company Floor').length).toBeGreaterThan(0);
  });

  it('uses custom title prop', () => {
    render(
      <GapAnalysisPanel hierarchy={null} ytdTotals={null} loading={false} title="My Goals" />
    );
    expect(screen.getByText('My Goals')).toBeInTheDocument();
  });

  it('shows Met badge when actual meets or exceeds a target', () => {
    render(
      <GapAnalysisPanel
        hierarchy={{ personal: { api: 20000 }, unitTarget: null, branchTarget: null, companyFloor: null }}
        ytdTotals={{ api: 25000, apps: 0 }}
        loading={false}
      />
    );
    expect(screen.getByText('Met')).toBeInTheDocument();
  });
});
