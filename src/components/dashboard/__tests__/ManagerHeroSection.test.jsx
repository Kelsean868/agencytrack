// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ManagerHeroSection from '../ManagerHeroSection.jsx';

vi.mock('../GoalDonut', () => ({
  default: ({ percent }) => <div data-testid="goal-donut" data-percent={percent} />,
}));

describe('ManagerHeroSection — loading', () => {
  it('renders a pulse skeleton when loading=true', () => {
    const { container } = render(
      <ManagerHeroSection loading teamYTDAPI={0} teamAnnualGoal={0} goalSet={false} inScopeAgentCount={0} />
    );
    expect(container.firstChild).toHaveClass('animate-pulse');
    expect(screen.queryByTestId('goal-donut')).toBeNull();
  });
});

describe('ManagerHeroSection — with goal', () => {
  it('renders team YTD currency value', () => {
    render(
      <ManagerHeroSection
        teamYTDAPI={120000}
        teamAnnualGoal={200000}
        goalSet
        inScopeAgentCount={5}
        loading={false}
      />
    );
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
  });

  it('renders annual goal amount', () => {
    render(
      <ManagerHeroSection
        teamYTDAPI={120000}
        teamAnnualGoal={200000}
        goalSet
        inScopeAgentCount={5}
        loading={false}
      />
    );
    expect(screen.getByText(/200,000/)).toBeInTheDocument();
  });

  it('renders advisor count', () => {
    render(
      <ManagerHeroSection
        teamYTDAPI={0}
        teamAnnualGoal={200000}
        goalSet
        inScopeAgentCount={3}
        loading={false}
      />
    );
    expect(screen.getByText(/3 advisors/)).toBeInTheDocument();
  });

  it('renders singular "advisor" for count=1', () => {
    render(
      <ManagerHeroSection
        teamYTDAPI={0}
        teamAnnualGoal={200000}
        goalSet
        inScopeAgentCount={1}
        loading={false}
      />
    );
    expect(screen.getByText(/1 advisor[^s]/)).toBeInTheDocument();
  });

  it('renders GoalDonut with computed percent', () => {
    render(
      <ManagerHeroSection
        teamYTDAPI={50000}
        teamAnnualGoal={200000}
        goalSet
        inScopeAgentCount={4}
        loading={false}
      />
    );
    const donut = screen.getByTestId('goal-donut');
    expect(donut).toBeInTheDocument();
    expect(donut.dataset.percent).toBe('25');
  });

  it('does not show company floor label when goalSet=true', () => {
    render(
      <ManagerHeroSection
        teamYTDAPI={0}
        teamAnnualGoal={200000}
        goalSet
        inScopeAgentCount={5}
        loading={false}
      />
    );
    expect(screen.queryByText(/company floor/i)).toBeNull();
  });
});

describe('ManagerHeroSection — company floor estimate', () => {
  it('shows company floor label when goalSet=false and goal > 0', () => {
    render(
      <ManagerHeroSection
        teamYTDAPI={0}
        teamAnnualGoal={200000}
        goalSet={false}
        inScopeAgentCount={5}
        loading={false}
      />
    );
    expect(screen.getByText(/company floor estimate/i)).toBeInTheDocument();
  });
});

describe('ManagerHeroSection — no goal', () => {
  it('shows "No annual goal set" when teamAnnualGoal=0', () => {
    render(
      <ManagerHeroSection
        teamYTDAPI={0}
        teamAnnualGoal={0}
        goalSet={false}
        inScopeAgentCount={2}
        loading={false}
      />
    );
    expect(screen.getByText(/no annual goal set/i)).toBeInTheDocument();
  });

  it('renders GoalDonut with percent=0 when no goal', () => {
    render(
      <ManagerHeroSection
        teamYTDAPI={50000}
        teamAnnualGoal={0}
        goalSet={false}
        inScopeAgentCount={2}
        loading={false}
      />
    );
    const donut = screen.getByTestId('goal-donut');
    expect(donut.dataset.percent).toBe('0');
  });
});
