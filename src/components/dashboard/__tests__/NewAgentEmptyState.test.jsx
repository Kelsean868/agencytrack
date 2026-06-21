import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NewAgentEmptyState from '../NewAgentEmptyState';

describe('NewAgentEmptyState', () => {
  it('renders a personalized heading with the first name', () => {
    render(<NewAgentEmptyState firstName="Kyron" committedGoal={null} onStart={() => {}} />);
    expect(screen.getByRole('heading', { name: /welcome, kyron — your account's ready\./i })).toBeInTheDocument();
  });

  it('falls back to a name-less heading when firstName is empty', () => {
    render(<NewAgentEmptyState firstName="" committedGoal={null} onStart={() => {}} />);
    expect(screen.getByRole('heading', { name: /^welcome — your account's ready\.$/i })).toBeInTheDocument();
  });

  it('shows the goal-set subtext (TTD-formatted) when a goal exists', () => {
    render(<NewAgentEmptyState firstName="Kyron" committedGoal={200000} onStart={() => {}} />);
    expect(screen.getByText(/Your TTD 200,000 goal is set\. Log your first week to start tracking\./i)).toBeInTheDocument();
  });

  it('shows the default subtext when no goal is set (null)', () => {
    render(<NewAgentEmptyState firstName="Kyron" committedGoal={null} onStart={() => {}} />);
    expect(screen.getByText(/Submit your first weekly report to start tracking your goal progress\./i)).toBeInTheDocument();
  });

  it('treats a zero goal as no goal (default subtext)', () => {
    render(<NewAgentEmptyState firstName="Kyron" committedGoal={0} onStart={() => {}} />);
    expect(screen.getByText(/Submit your first weekly report/i)).toBeInTheDocument();
  });

  it('renders the 3-step path preview', () => {
    render(<NewAgentEmptyState firstName="Kyron" committedGoal={null} onStart={() => {}} />);
    expect(screen.getByText('Submit a weekly report')).toBeInTheDocument();
    expect(screen.getByText('See your goal progress')).toBeInTheDocument();
    expect(screen.getByText('Climb the leaderboard')).toBeInTheDocument();
  });

  it('CTA calls onStart (opens the wizard)', () => {
    const onStart = vi.fn();
    render(<NewAgentEmptyState firstName="Kyron" committedGoal={null} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /submit your first report/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
