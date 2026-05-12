// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoleDistributionCard from '../RoleDistributionCard';

const USERS = [
  { uid: 'a1', role: 'agent' },
  { uid: 'a2', role: 'agent' },
  { uid: 'a3', role: 'agent' },
  { uid: 'um1', role: 'unit_manager' },
  { uid: 'bm1', role: 'branch_manager' },
  { uid: 'sm1', role: 'sales_manager' },
  { uid: 'ta1', role: 'tenant_admin' },
];

describe('RoleDistributionCard — TA-CLEANUP', () => {
  it('renders no "Coming soon" text', () => {
    const { container } = render(<RoleDistributionCard users={USERS} loading={false} />);
    expect(container.textContent).not.toMatch(/coming soon/i);
  });

  it('does not render a "Manage roles & permissions" button', () => {
    render(<RoleDistributionCard users={USERS} loading={false} />);
    expect(screen.queryByRole('button', { name: /Manage roles/i })).toBeNull();
  });

  it('still renders the role bars and total count', () => {
    render(<RoleDistributionCard users={USERS} loading={false} />);
    expect(screen.getByText(/Users by role/i)).toBeInTheDocument();
    expect(screen.getByText(/Total: 7/)).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Unit Managers')).toBeInTheDocument();
    expect(screen.getByText('Branch Managers')).toBeInTheDocument();
    expect(screen.getByText('Sales Managers')).toBeInTheDocument();
    expect(screen.getByText('Tenant Admins')).toBeInTheDocument();
  });
});
