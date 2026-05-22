// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── Service mocks ─────────────────────────────────────────────────────────────

const mockGetOverride   = vi.fn();
const mockSetOverride   = vi.fn();
const mockClearOverride = vi.fn();

vi.mock('../../../services/managerStandardOverrideService', () => ({
  getManagerActivityStandardOverride: (...args) => mockGetOverride(...args),
  setManagerActivityStandardOverride: (...args) => mockSetOverride(...args),
  clearManagerActivityStandardOverride: (...args) => mockClearOverride(...args),
}));

vi.mock('../../../services/managerActivityStandardsService', () => ({
  NUMERIC_STANDARDS: ['jfwCount', 'oneOnOnesConducted', 'namesSourced',
                      'interviewsConducted', 'recruitsInFirstWeeks', 'trainingSessions'],
  BOOLEAN_STANDARDS: ['unitMeetingHeld', 'dashboardReviewDone'],
}));

import ManagerOverrideModal from '../ManagerOverrideModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  tenantId:    'test-tenant',
  managerId:   'mgr1',
  managerName: 'Alice Manager',
  currentUid:  'bm1',
  onClose:     vi.fn(),
  onSaved:     vi.fn(),
};

function renderModal(props = {}) {
  return render(<ManagerOverrideModal {...DEFAULT_PROPS} {...props} />);
}

/** Flush promise chains from useEffect (3 microtask ticks covers .then().catch().finally()). */
const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOverride.mockResolvedValue({});
  mockSetOverride.mockResolvedValue(undefined);
  mockClearOverride.mockResolvedValue(undefined);
});

// ── Loading state ─────────────────────────────────────────────────────────────

describe('ManagerOverrideModal — loading', () => {
  it('shows loading spinner before override doc resolves', () => {
    mockGetOverride.mockImplementation(() => new Promise(() => {})); // never resolves
    renderModal();
    expect(screen.getByLabelText(/loading current overrides/i)).toBeInTheDocument();
  });

  it('shows form after loading resolves', async () => {
    renderModal();
    await flush();
    expect(screen.getByLabelText(/joint field work \(jfw\) override/i)).toBeInTheDocument();
  });
});

// ── Heading ───────────────────────────────────────────────────────────────────

describe('ManagerOverrideModal — heading', () => {
  it('shows manager name in the heading', async () => {
    renderModal();
    await flush();
    expect(screen.getByRole('heading', { name: /custom standards for alice manager/i }))
      .toBeInTheDocument();
  });
});

// ── Form population ───────────────────────────────────────────────────────────

describe('ManagerOverrideModal — form population', () => {
  it('leaves numeric fields empty when override doc has no values', async () => {
    renderModal();
    await flush();
    expect(screen.getByLabelText(/joint field work \(jfw\) override/i)).toHaveValue('');
  });

  it('populates numeric fields from existing override doc', async () => {
    mockGetOverride.mockResolvedValue({ jfwCount: 5, oneOnOnesConducted: 8 });
    renderModal();
    await flush();
    expect(screen.getByLabelText(/joint field work \(jfw\) override/i)).toHaveValue('5');
    expect(screen.getByLabelText(/one-on-one pipeline reviews override/i)).toHaveValue('8');
  });

  it('sets boolean toggle when override doc has true value', async () => {
    mockGetOverride.mockResolvedValue({ unitMeetingHeld: true });
    renderModal();
    await flush();
    expect(
      screen.getByRole('checkbox', { name: /unit \/ branch meeting held override/i })
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('leaves boolean toggle unchecked for false or absent value', async () => {
    renderModal();
    await flush();
    expect(
      screen.getByRole('checkbox', { name: /unit \/ branch meeting held override/i })
    ).toHaveAttribute('aria-checked', 'false');
  });
});

// ── Save ──────────────────────────────────────────────────────────────────────

describe('ManagerOverrideModal — save', () => {
  it('calls setManagerActivityStandardOverride with correct tenantId, managerId, uid', async () => {
    renderModal();
    await flush();

    fireEvent.change(
      screen.getByLabelText(/joint field work \(jfw\) override/i),
      { target: { value: '4' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /save custom standards/i }));
    await flush();

    expect(mockSetOverride).toHaveBeenCalledWith(
      'test-tenant',
      'mgr1',
      expect.objectContaining({ jfwCount: 4 }),
      'bm1',
    );
  });

  it('calls onSaved and onClose after successful save', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    renderModal({ onClose, onSaved });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /save custom standards/i }));
    await flush();

    expect(onSaved).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('omits blank numeric fields from the payload (falls back to org default)', async () => {
    renderModal();
    await flush();

    // Change jfwCount only; leave all others blank
    fireEvent.change(
      screen.getByLabelText(/joint field work \(jfw\) override/i),
      { target: { value: '3' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /save custom standards/i }));
    await flush();

    const [, , payload] = mockSetOverride.mock.calls[0];
    expect(payload.jfwCount).toBe(3);
    expect(payload.oneOnOnesConducted).toBeUndefined();
  });

  it('shows permission-denied error message on PERMISSION_DENIED', async () => {
    mockSetOverride.mockRejectedValue({ code: 'permission-denied' });
    renderModal();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /save custom standards/i }));
    await flush();

    expect(screen.getByRole('alert')).toHaveTextContent(/don't have permission/i);
  });

  it('shows connectivity error message on network failure', async () => {
    mockSetOverride.mockRejectedValue({ code: 'unavailable' });
    renderModal();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /save custom standards/i }));
    await flush();

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't reach the server/i);
  });

  it('shows generic error message for unknown errors', async () => {
    mockSetOverride.mockRejectedValue({ message: 'Something broke' });
    renderModal();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /save custom standards/i }));
    await flush();

    expect(screen.getByRole('alert')).toHaveTextContent(/something broke/i);
  });
});

// ── Clear ─────────────────────────────────────────────────────────────────────

describe('ManagerOverrideModal — clear', () => {
  it('calls clearManagerActivityStandardOverride with correct tenantId and managerId', async () => {
    renderModal();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /clear all overrides/i }));
    await flush();

    expect(mockClearOverride).toHaveBeenCalledWith('test-tenant', 'mgr1');
  });

  it('calls onSaved and onClose after successful clear', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    renderModal({ onClose, onSaved });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /clear all overrides/i }));
    await flush();

    expect(onSaved).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── Dismiss ───────────────────────────────────────────────────────────────────

describe('ManagerOverrideModal — dismiss', () => {
  it('calls onClose when Cancel button is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the X close button is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await flush();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
