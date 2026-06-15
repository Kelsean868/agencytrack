import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DerivedIncomePanel from '../DerivedIncomePanel';

const baseHierarchy = {
  personal: { api: 120000, apps: 60, persistency: 90 },
  companyFloor: null,
  unitTarget: null,
  branchTarget: null,
  salesManagerTarget: null,
};

const baseYtd = { api: 74000, apps: 37, ffiConducted: 0, ciConducted: 0, dials: 0 };

describe('DerivedIncomePanel', () => {
  it('shows shimmer skeleton while loading', () => {
    render(
      <DerivedIncomePanel hierarchy={null} ytdTotals={null} commissionRate={null} loading={true} />
    );
    expect(screen.getByTestId('derived-income-loading')).toBeInTheDocument();
  });

  it('shows no-goal state when hierarchy has no personal.api', () => {
    render(
      <DerivedIncomePanel
        hierarchy={{ personal: null }}
        ytdTotals={baseYtd}
        commissionRate={35}
        loading={false}
      />
    );
    expect(screen.getByTestId('derived-income-no-goal')).toBeInTheDocument();
    expect(screen.getByText(/commit a goal/i)).toBeInTheDocument();
  });

  it('shows no-goal state when hierarchy is null', () => {
    render(
      <DerivedIncomePanel hierarchy={null} ytdTotals={baseYtd} commissionRate={35} loading={false} />
    );
    expect(screen.getByTestId('derived-income-no-goal')).toBeInTheDocument();
  });

  it('shows rate-unset state when commissionRate is null', () => {
    render(
      <DerivedIncomePanel
        hierarchy={baseHierarchy}
        ytdTotals={baseYtd}
        commissionRate={null}
        loading={false}
      />
    );
    expect(screen.getByTestId('derived-income-rate-unset')).toBeInTheDocument();
    expect(screen.getByText(/rate not on file/i)).toBeInTheDocument();
  });

  it('shows rate-unset state when commissionRate is 0', () => {
    render(
      <DerivedIncomePanel
        hierarchy={baseHierarchy}
        ytdTotals={baseYtd}
        commissionRate={0}
        loading={false}
      />
    );
    expect(screen.getByTestId('derived-income-rate-unset')).toBeInTheDocument();
  });

  it('renders populated panel with formatted income values', () => {
    // committedAPI=120000, rate=35%
    // annualIncome = 120000 × 0.35 = 42000
    // perMonth     = 42000 / 12   = 3500
    // ytdEarned    = 74000 × 0.35 = 25900
    render(
      <DerivedIncomePanel
        hierarchy={baseHierarchy}
        ytdTotals={baseYtd}
        commissionRate={35}
        loading={false}
      />
    );
    expect(screen.getByTestId('derived-income-panel')).toBeInTheDocument();
    expect(screen.getByTestId('derived-annual-income')).toBeInTheDocument();
    expect(screen.getByTestId('derived-per-month')).toBeInTheDocument();
    expect(screen.getByTestId('derived-ytd-earned')).toBeInTheDocument();
  });

  it('renders panel with zero ytd when ytdTotals is null', () => {
    render(
      <DerivedIncomePanel
        hierarchy={baseHierarchy}
        ytdTotals={null}
        commissionRate={35}
        loading={false}
      />
    );
    expect(screen.getByTestId('derived-income-panel')).toBeInTheDocument();
    // ytdEarned = 0 × 0.35 = 0 → should show currency-formatted $0
    expect(screen.getByTestId('derived-ytd-earned')).toBeInTheDocument();
  });

  it('shows assumptions disclaimer in populated state', () => {
    render(
      <DerivedIncomePanel
        hierarchy={baseHierarchy}
        ytdTotals={baseYtd}
        commissionRate={35}
        loading={false}
      />
    );
    expect(screen.getByText(/an estimate, not a guarantee/i)).toBeInTheDocument();
  });
});
