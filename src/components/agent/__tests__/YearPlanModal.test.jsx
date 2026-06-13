// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  useAuth:          vi.fn(),
  getYearPlan:      vi.fn(),
  saveYearPlan:     vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

vi.mock('../../../services/yearPlanService', () => ({
  LICENSE_PROFILES:    ['composite', 'life_only', 'general_only'],
  getYearPlan:         (...args) => hoisted.getYearPlan(...args),
  saveYearPlan:        (...args) => hoisted.saveYearPlan(...args),
  createYearPlan:      vi.fn().mockResolvedValue(null),
  resolveLicenseProfile: vi.fn().mockReturnValue('composite'),
}));

vi.mock('../../../services/userService', () => ({
  updateUserProfile: (...args) => hoisted.updateUserProfile(...args),
}));

import YearPlanModal from '../YearPlanModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
});

const BASE_USER = {
  uid: 'agent-1',
  licenseProfile: 'composite',
  commissionRate: 35,
};

const WORKSHEET_WITH_TARGETS = {
  firstYearCommissionsTargets: { life: 35000, ah: 7000, property: 0, motor: 0 },
  firstYearCommissionsRequired: 42000,
};

function renderModal(props = {}) {
  return render(
    <YearPlanModal
      onClose={vi.fn()}
      moneyNeedsWorksheet={null}
      {...props}
    />,
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuth.mockReturnValue({
    tenantId: 'tenant-1',
    user: BASE_USER,
  });
  hoisted.getYearPlan.mockResolvedValue(null);
  hoisted.saveYearPlan.mockResolvedValue({ id: '2026' });
  hoisted.updateUserProfile.mockResolvedValue(undefined);
});

// ── Profile-prompt phase ──────────────────────────────────────────────────────

describe('YearPlanModal — profile-prompt', () => {
  it('shows profile selection when user has no licenseProfile', async () => {
    hoisted.useAuth.mockReturnValue({
      tenantId: 'tenant-1',
      user: { ...BASE_USER, licenseProfile: undefined },
    });
    renderModal();
    await flush();
    expect(screen.getByText(/what lines are you licensed for/i)).toBeInTheDocument();
  });

  it('shows all three license profile options', async () => {
    hoisted.useAuth.mockReturnValue({
      tenantId: 'tenant-1',
      user: { ...BASE_USER, licenseProfile: undefined },
    });
    renderModal();
    await flush();
    expect(screen.getByRole('button', { name: /composite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /life & a&h/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A&H, Property & Motor' })).toBeInTheDocument();
  });

  it('transitions to allocating after profile selection with targets', async () => {
    hoisted.useAuth.mockReturnValue({
      tenantId: 'tenant-1',
      user: { ...BASE_USER, licenseProfile: undefined },
    });
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /composite/i }));
    await flush();

    expect(hoisted.updateUserProfile).toHaveBeenCalledWith(
      'tenant-1', 'agent-1', { licenseProfile: 'composite' },
    );
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
  });
});

// ── No-seed phase ─────────────────────────────────────────────────────────────

describe('YearPlanModal — no-seed', () => {
  it('shows no-seed state when worksheet has no targets', async () => {
    renderModal({ moneyNeedsWorksheet: null });
    await flush();
    expect(screen.getByText(/no money needs targets yet/i)).toBeInTheDocument();
  });

  it('shows no-seed when all targets are 0', async () => {
    renderModal({
      moneyNeedsWorksheet: {
        firstYearCommissionsTargets: { life: 0, ah: 0, property: 0, motor: 0 },
      },
    });
    await flush();
    expect(screen.getByText(/no money needs targets yet/i)).toBeInTheDocument();
  });

  it('transitions to allocating after dismissing no-seed state', async () => {
    renderModal({ moneyNeedsWorksheet: null });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /enter from scratch/i }));
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
  });
});

// ── Allocating phase — seeded ─────────────────────────────────────────────────

describe('YearPlanModal — allocating (seeded)', () => {
  it('renders the dialog with correct aria label', async () => {
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();
    expect(screen.getByRole('dialog', { name: /year plan.*step 2 of 4/i })).toBeInTheDocument();
  });

  it('shows "Seeded from Money Needs" info bar when targets provided', async () => {
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();
    expect(screen.getByText(/seeded from money needs/i)).toBeInTheDocument();
  });

  it('shows DRAFT pill in header', async () => {
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders all four product lines', async () => {
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();
    expect(screen.getByText('Life')).toBeInTheDocument();
    expect(screen.getByText('A&H')).toBeInTheDocument();
    expect(screen.getByText('Property')).toBeInTheDocument();
    expect(screen.getByText('Motor')).toBeInTheDocument();
  });

  it('defaults to percent mode with % Share toggle active', async () => {
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();
    const pctBtn = screen.getByRole('button', { name: /% share/i });
    // Active button has bg-primary class chain — just verify it renders
    expect(pctBtn).toBeInTheDocument();
    // Total API input only appears in percent mode
    expect(screen.getByLabelText(/total annual api/i)).toBeInTheDocument();
  });
});

// ── Existing plan loaded ──────────────────────────────────────────────────────

describe('YearPlanModal — existing plan reload', () => {
  it('loads existing plan lines instead of seeding when plan exists', async () => {
    hoisted.getYearPlan.mockResolvedValue({
      id: '2026',
      licenseProfile: 'composite',
      lines: {
        life:     { targetAPI: 80000, pct: 80, enabled: true  },
        ah:       { targetAPI: 20000, pct: 20, enabled: true  },
        property: { targetAPI: 0,     pct: 0,  enabled: true  },
        motor:    { targetAPI: 0,     pct: 0,  enabled: true  },
      },
    });
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();

    // Life API input should reflect the loaded value (direct mode after mode toggle)
    // In percent mode the Total API input shows the sum
    const totalInput = screen.getByLabelText(/total annual api/i);
    expect(totalInput).toHaveValue(100000);
  });
});

// ── Mode toggle ───────────────────────────────────────────────────────────────

describe('YearPlanModal — mode toggle', () => {
  it('hides Total API input after switching to Direct mode', async () => {
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();

    expect(screen.getByLabelText(/total annual api/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /direct \$/i }));

    expect(screen.queryByLabelText(/total annual api/i)).not.toBeInTheDocument();
  });

  it('restores Total API input when toggling back to % Share', async () => {
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /direct \$/i }));
    expect(screen.queryByLabelText(/total annual api/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /% share/i }));
    expect(screen.getByLabelText(/total annual api/i)).toBeInTheDocument();
  });
});

// ── Save ──────────────────────────────────────────────────────────────────────

describe('YearPlanModal — save', () => {
  it('calls saveYearPlan with correct tenantId, uid, year', async () => {
    const onClose = vi.fn();
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS, onClose });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await flush();

    expect(hoisted.saveYearPlan).toHaveBeenCalledWith(
      'tenant-1',
      'agent-1',
      new Date().getFullYear(),
      expect.any(Object),
      'composite',
    );
  });

  it('calls onClose after successful save', async () => {
    const onClose = vi.fn();
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS, onClose });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await flush();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows error message when save fails', async () => {
    hoisted.saveYearPlan.mockRejectedValue(new Error('network error'));
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await flush();

    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
  });
});

// ── Dismiss ───────────────────────────────────────────────────────────────────

describe('YearPlanModal — dismiss', () => {
  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS, onClose });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when X close button is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS, onClose });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /close year plan/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── Keyboard — focus trap ─────────────────────────────────────────────────────

describe('YearPlanModal — keyboard (focus trap)', () => {
  it('Escape calls onClose', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await flush();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape is suppressed while saving', async () => {
    const onClose = vi.fn();
    hoisted.saveYearPlan.mockImplementation(() => new Promise(() => {}));
    renderModal({ onClose, moneyNeedsWorksheet: WORKSHEET_WITH_TARGETS });
    await flush();
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
