// @vitest-environment jsdom
//
// Regression: focus-return after the Plan Catalog modal closes (Tier-0 dialog-
// a11y browser-smoke finding).
//
// The plan-catalog tile's onClose runs loadConfig(), a background refresh that
// flips `loading` true again. The tile used to render `disabled={loading}`, so
// during that refresh it was disabled — and PlanCatalogModal's useFocusTrap
// restore fired `.focus()` on a disabled element, a silent no-op. Focus never
// returned to the tile.
//
// This test drives the real open→close cycle with the REAL PlanCatalogModal
// (and its real useFocusTrap), holding the post-close refresh pending so
// `loading` stays true across the assertion. It fails if the tile is disabled
// during the refresh — i.e. it guards the `disabled={loading && !planCatalog}`
// fix in CompanyConfigPanel.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuthMock:       vi.fn(),
  getCompanyMinimums: vi.fn(),
  getPolicyPlans:    vi.fn(),
  // Test-controlled: when true, getPolicyPlans returns a pending promise so the
  // post-close background refresh keeps CompanyConfigPanel's `loading` true.
  blockRefresh: { value: false },
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuthMock }));
vi.mock('../../../services/goalsService', () => ({ getCompanyMinimums: hoisted.getCompanyMinimums }));
vi.mock('../../../services/planCatalogService', () => ({
  getPolicyPlans: hoisted.getPolicyPlans,
  addPlan: vi.fn(), updatePlan: vi.fn(), deactivatePlan: vi.fn(),
  promotePendingPlan: vi.fn(), dismissPendingPlan: vi.fn(),
}));
// EditConfigModal is unrelated to this flow — keep it inert.
vi.mock('../EditConfigModal', () => ({ default: () => null }));

import CompanyConfigPanel from '../CompanyConfigPanel';

const CATALOG = { plans: [{ id: 'p1', name: 'Whole Life', isActive: true }], pendingReview: [] };

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.blockRefresh.value = false;
  hoisted.useAuthMock.mockReturnValue({ tenantId: 'tenant1', user: { uid: 'admin-uid' } });
  hoisted.getCompanyMinimums.mockResolvedValue({ annualAPI: 120000, persistency: 85, workingDaysPerWeek: 5 });
  // Resolve immediately unless the test has armed the refresh block.
  hoisted.getPolicyPlans.mockImplementation(() =>
    hoisted.blockRefresh.value
      ? new Promise(() => {})       // stays pending → loading stays true
      : Promise.resolve(CATALOG)
  );
});

describe('CompanyConfigPanel — focus-return after Plan Catalog closes', () => {
  it('returns focus to the plan-catalog tile even while the post-close refresh keeps loading true', async () => {
    render(<CompanyConfigPanel />);

    // Initial load resolves; the tile becomes interactive.
    const tile = await screen.findByTestId('plan-catalog-tile');
    await waitFor(() => expect(tile).not.toBeDisabled());

    // Open the real PlanCatalogModal (moves focus inside via its useFocusTrap).
    tile.focus();
    fireEvent.click(tile);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    // Arm the refresh block so the loadConfig() that fires on close stays
    // pending — `loading` stays true, reproducing the disabled-tile window.
    hoisted.blockRefresh.value = true;

    // Close via Escape (useFocusTrap.onEscape → onClose → setPlanCatalogOpen(false)
    // + loadConfig()).
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Focus must return to the tile — which is only possible if it is NOT
    // disabled during the in-flight refresh.
    const tileAfter = screen.getByTestId('plan-catalog-tile');
    await waitFor(() => expect(document.activeElement).toBe(tileAfter));
    expect(tileAfter).not.toBeDisabled();
  });
});
