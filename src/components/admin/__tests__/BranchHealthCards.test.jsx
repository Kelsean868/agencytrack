// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BranchHealthCards from '../BranchHealthCards';

const USERS = [
  { uid: 'a1', role: 'agent', branchId: 'port_of_spain' },
  { uid: 'a2', role: 'agent', branchId: 'port_of_spain' },
  { uid: 'a3', role: 'agent', branchId: 'san_fernando' },
  { uid: 'bm1', role: 'branch_manager', branchId: 'port_of_spain' },
];

describe('BranchHealthCards — TA-CLEANUP', () => {
  it('renders no "Coming soon" text', () => {
    const { container } = render(<BranchHealthCards users={USERS} loading={false} />);
    expect(container.textContent).not.toMatch(/coming soon/i);
  });

  it('does not render "% to YTD goal" or "Last sync" placeholders', () => {
    const { container } = render(<BranchHealthCards users={USERS} loading={false} />);
    expect(container.textContent).not.toMatch(/% to YTD goal/i);
    expect(container.textContent).not.toMatch(/Last sync/i);
  });

  it('renders simplified subhead "Branches & agent assignment"', () => {
    render(<BranchHealthCards users={USERS} loading={false} />);
    expect(screen.getByText(/Branches & agent assignment/i)).toBeInTheDocument();
  });

  it('still renders branch names and agent count badges', () => {
    render(<BranchHealthCards users={USERS} loading={false} />);
    expect(screen.getByText(/Port Of Spain/i)).toBeInTheDocument();
    expect(screen.getByText(/San Fernando/i)).toBeInTheDocument();
    expect(screen.getByText('2 agents')).toBeInTheDocument();
    expect(screen.getByText('1 agent')).toBeInTheDocument();
  });
});
