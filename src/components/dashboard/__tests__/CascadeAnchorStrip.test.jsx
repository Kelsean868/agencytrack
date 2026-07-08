// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CascadeAnchorStrip from '../CascadeAnchorStrip';

describe('CascadeAnchorStrip', () => {
  it('loading → skeleton only', () => {
    render(<CascadeAnchorStrip loading />);
    expect(screen.getByTestId('cascade-anchor-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('cascade-anchor-strip')).toBeNull();
  });

  it('renders the on-pace / attention split and scope chip', () => {
    render(
      <CascadeAnchorStrip
        scopeLabel="Branch"
        teamYTDAPI={8420000}
        teamAnnualGoal={12000000}
        goalSet
        companyFloorTotal={9600000}
        weeklyPulse={{ api: 142000, apps: 38, ffi: 47 }}
        onPaceCount={18}
        needAttentionCount={5}
        inScopeAgentCount={23}
      />
    );
    const strip = screen.getByTestId('cascade-anchor-strip');
    expect(strip).toBeInTheDocument();
    expect(screen.getByTestId('cascade-scope-chip')).toHaveTextContent('Branch');
    // on pace 18 / 23
    expect(screen.getByTestId('cascade-onpace')).toHaveTextContent('18');
    expect(screen.getByTestId('cascade-onpace')).toHaveTextContent('23');
    // need attention 5
    expect(screen.getByTestId('cascade-attention')).toHaveTextContent('5');
    // weekly pulse apps + ffi render
    expect(strip).toHaveTextContent('38');
    expect(strip).toHaveTextContent('47');
  });

  it('shows the company-floor estimate note when no goal is set', () => {
    render(
      <CascadeAnchorStrip
        scopeLabel="Unit"
        teamYTDAPI={100000}
        teamAnnualGoal={500000}
        goalSet={false}
        companyFloorTotal={400000}
        inScopeAgentCount={4}
      />
    );
    expect(screen.getByText(/company-floor estimate/i)).toBeInTheDocument();
  });
});
