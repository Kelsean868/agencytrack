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

  it('0.1b — renders a PanelSkeleton (aria-busy) instead of "Loading branches…" text while loading', () => {
    const { container } = render(<BranchHealthCards users={[]} branches={[]} loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryByText(/Loading branches…/i)).toBeNull();
  });
});

describe('BranchHealthCards — branch-name resolution', () => {
  // Case (a): branchId resolves via branches/ doc → use the doc's name.
  it('renders the branch.name from branches/ when a doc exists for the id', () => {
    const users = [
      { uid: 'a1', role: 'agent', branchId: 'ljbBHP1g7lbZXvHlpcDn' },
      { uid: 'a2', role: 'agent', branchId: 'ljbBHP1g7lbZXvHlpcDn' },
    ];
    const branches = [
      { id: 'ljbBHP1g7lbZXvHlpcDn', name: 'Cyril Murray Branch', isActive: true },
    ];
    render(<BranchHealthCards users={users} branches={branches} loading={false} />);
    expect(screen.getByText('Cyril Murray Branch')).toBeInTheDocument();
    expect(screen.queryByText(/Ljbbhp1g7lbzxvhlpcdn/i)).toBeNull();
  });

  it('prefers branch.name over the slug humanise fallback even when the id is slug-shaped', () => {
    const users = [{ uid: 'a1', role: 'agent', branchId: 'tatil_south' }];
    const branches = [{ id: 'tatil_south', name: 'Tatil South Office', isActive: true }];
    render(<BranchHealthCards users={users} branches={branches} loading={false} />);
    expect(screen.getByText('Tatil South Office')).toBeInTheDocument();
    expect(screen.queryByText(/^Tatil South$/)).toBeNull();
  });

  // Case (b): slug-shaped id with no matching branches/ doc → humanise.
  it('humanises a slug-shaped id when no branches/ doc exists for it', () => {
    const users = [
      { uid: 'a1', role: 'agent', branchId: 'tatil_south' },
      { uid: 'a2', role: 'agent', branchId: 'tatil_south' },
    ];
    render(<BranchHealthCards users={users} branches={[]} loading={false} />);
    expect(screen.getByText('Tatil South')).toBeInTheDocument();
  });

  // Case (c): Firestore auto-id (mixed case) with no matching branches/ doc
  // → "Unnamed branch". This is the bug class the fix closes.
  it('renders "Unnamed branch" for an auto-id with no matching branches/ doc', () => {
    const users = [
      { uid: 'a1', role: 'agent', branchId: 'ljbBHP1g7lbZXvHlpcDn' },
    ];
    render(<BranchHealthCards users={users} branches={[]} loading={false} />);
    expect(screen.getByText('Unnamed branch')).toBeInTheDocument();
    // The raw id must not leak through, in any case variant.
    expect(screen.queryByText(/Ljbbhp1g7lbzxvhlpcdn/i)).toBeNull();
    expect(screen.queryByText('ljbBHP1g7lbZXvHlpcDn')).toBeNull();
  });

  it('renders "Unnamed branch" when the matching branches/ doc has an empty name field', () => {
    const users = [{ uid: 'a1', role: 'agent', branchId: 'ljbBHP1g7lbZXvHlpcDn' }];
    const branches = [{ id: 'ljbBHP1g7lbZXvHlpcDn', name: '   ', isActive: true }];
    render(<BranchHealthCards users={users} branches={branches} loading={false} />);
    expect(screen.getByText('Unnamed branch')).toBeInTheDocument();
  });

  it('handles a mixed set of legacy slug + new auto-id branches together', () => {
    // Reproduces the exact production state surfaced in Phase 1.
    const users = [
      { uid: 'a1', role: 'agent', branchId: 'tatil_south' },
      { uid: 'a2', role: 'agent', branchId: 'tatil_south' },
      { uid: 'a3', role: 'agent', branchId: 'tatil_south' },
      { uid: 'a4', role: 'agent', branchId: 'tatil_south' },
      { uid: 'a5', role: 'agent', branchId: 'tatil_south' },
      { uid: 'a6', role: 'agent', branchId: 'tatil_south' },
      { uid: 'a7', role: 'agent', branchId: 'ljbBHP1g7lbZXvHlpcDn' },
      { uid: 'a8', role: 'agent', branchId: 'ljbBHP1g7lbZXvHlpcDn' },
      { uid: 'a9', role: 'agent', branchId: 'ljbBHP1g7lbZXvHlpcDn' },
    ];
    const branches = [
      { id: 'ljbBHP1g7lbZXvHlpcDn', name: 'Cyril Murray Branch', isActive: true },
    ];
    render(<BranchHealthCards users={users} branches={branches} loading={false} />);
    expect(screen.getByText('Tatil South')).toBeInTheDocument();
    expect(screen.getByText('Cyril Murray Branch')).toBeInTheDocument();
    expect(screen.getByText('6 agents')).toBeInTheDocument();
    expect(screen.getByText('3 agents')).toBeInTheDocument();
    expect(screen.queryByText(/Ljbbhp1g7lbzxvhlpcdn/i)).toBeNull();
  });

  it('renders "Unassigned" when users have no branchId', () => {
    const users = [{ uid: 'a1', role: 'agent' }];
    render(<BranchHealthCards users={users} branches={[]} loading={false} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('works when no `branches` prop is provided (back-compat)', () => {
    render(<BranchHealthCards users={USERS} loading={false} />);
    // Falls through to humanise — same as the original test suite.
    expect(screen.getByText(/Port Of Spain/i)).toBeInTheDocument();
    expect(screen.getByText(/San Fernando/i)).toBeInTheDocument();
  });
});
