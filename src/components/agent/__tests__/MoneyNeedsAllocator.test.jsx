// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────
let mockUser = { uid: 'agent1', licenseProfile: 'composite' };
const mockTenantId = 'test-tenant';
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, tenantId: mockTenantId }),
}));

const mockSaveAllocation = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../services/moneyNeedsService', async (importActual) => {
  const actual = await importActual();
  return { ...actual, saveAllocation: (...a) => mockSaveAllocation(...a) };
});

const mockUpdateUserProfile = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../services/userService', () => ({
  updateUserProfile: (...a) => mockUpdateUserProfile(...a),
}));

vi.mock('../../../services/awardsRulesetService', async (importActual) => {
  const actual = await importActual();
  const { DEFAULT_RULESET_2026 } = await import('../../../config/awardsRuleset/2026');
  return { ...actual, getMergedAwardsRuleset: vi.fn().mockResolvedValue(DEFAULT_RULESET_2026) };
});

import MoneyNeedsAllocator from '../MoneyNeedsAllocator';

// ── Fixtures ──────────────────────────────────────────────────────────────────
function makeWorksheet(overrides = {}) {
  return {
    year: 2026,
    totalAnnualPreTax: 100000,
    estimatedRenewalIncome: { total: 0 },
    firstYearCommissionsTargets: { life: 35000, ah: 10000, property: 10000, motor: 10000 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { uid: 'agent1', licenseProfile: 'composite' };
  localStorage.clear();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('MoneyNeedsAllocator — license gating', () => {
  it('composite renders Life, A&H, General lines', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    expect(screen.getByTestId('alloc-line-life')).toBeTruthy();
    expect(screen.getByTestId('alloc-line-ah')).toBeTruthy();
    expect(screen.getByTestId('alloc-line-general')).toBeTruthy();
  });

  it('life_only omits General (A&H always present)', () => {
    mockUser = { uid: 'agent1', licenseProfile: 'life_only' };
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    expect(screen.getByTestId('alloc-line-life')).toBeTruthy();
    expect(screen.getByTestId('alloc-line-ah')).toBeTruthy();
    expect(screen.queryByTestId('alloc-line-general')).toBeNull();
  });

  it('general_only omits Life (A&H always present)', () => {
    mockUser = { uid: 'agent1', licenseProfile: 'general_only' };
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    expect(screen.queryByTestId('alloc-line-life')).toBeNull();
    expect(screen.getByTestId('alloc-line-ah')).toBeTruthy();
    expect(screen.getByTestId('alloc-line-general')).toBeTruthy();
  });

  it('first-run license picker shows when unset, and selection persists', async () => {
    mockUser = { uid: 'agent1', licenseProfile: undefined };
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    expect(screen.getByTestId('alloc-license-picker')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Composite/i }));
    await waitFor(() => expect(mockUpdateUserProfile).toHaveBeenCalledWith(
      mockTenantId, 'agent1', { licenseProfile: 'composite' },
    ));
    await screen.findByTestId('merged-allocator');
  });
});

describe('MoneyNeedsAllocator — the seam + meter', () => {
  it('the seam restates the required commission (100000 pretax, no renewal)', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    const seam = screen.getByTestId('alloc-seam');
    expect(within(seam).getByText(/TTD 100,000/)).toBeTruthy();
  });

  it('no-commission-need state when required <= 0', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet({ totalAnnualPreTax: 0 })} />);
    expect(screen.getByTestId('alloc-no-need')).toBeTruthy();
    expect(screen.queryByTestId('merged-allocator')).toBeNull();
  });
});

describe('MoneyNeedsAllocator — collapsed commission = API × rate', () => {
  it('editing the API field updates the derived commission', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    const apiField = screen.getByTestId('alloc-line-api-life');
    fireEvent.change(apiField, { target: { value: '200000' } });
    // 200000 × 0.35 = 70000
    expect(within(screen.getByTestId('alloc-line-life')).getByText(/TTD 70,000/)).toBeTruthy();
  });

  it('editing the rate updates the derived commission and persists on blur', async () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    const rateField = screen.getByTestId('alloc-line-rate-life');
    // seeded life api = 100000; rate 0.5 → 50000
    fireEvent.change(rateField, { target: { value: '0.5' } });
    fireEvent.blur(rateField);
    expect(within(screen.getByTestId('alloc-line-life')).getByText(/TTD 50,000/)).toBeTruthy();
    await waitFor(() => expect(mockSaveAllocation).toHaveBeenCalled());
    const savedAlloc = mockSaveAllocation.mock.calls.at(-1)[3];
    expect(savedAlloc.lines.life.rate).toBe(0.5);
  });

  it('slider and field are two-way bound (slider drives the field)', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    const slider = screen.getByTestId('alloc-line-slider-life');
    fireEvent.change(slider, { target: { value: '150000' } });
    expect(screen.getByTestId('alloc-line-api-life').value).toBe('150000');
  });
});

describe('MoneyNeedsAllocator — per-product drill (Life)', () => {
  it('breaks Life into products, derives Σ(api×rate) and a weighted rate, renames', async () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    fireEvent.click(screen.getByTestId('alloc-drill-toggle-life'));
    const drawer = await screen.findByTestId('alloc-drill-life');
    // seeded 4 products, auto-balanced to sum the line total (100000)
    expect(within(drawer).getAllByTestId(/alloc-product-life-\d/)).toHaveLength(4);

    // Set two distinct product APIs + rates, others to 0 → commission = Σ.
    fireEvent.change(screen.getByTestId('alloc-product-api-life-0'), { target: { value: '60000' } });
    fireEvent.change(screen.getByTestId('alloc-product-rate-life-0'), { target: { value: '0.35' } });
    fireEvent.change(screen.getByTestId('alloc-product-api-life-1'), { target: { value: '40000' } });
    fireEvent.change(screen.getByTestId('alloc-product-rate-life-1'), { target: { value: '0.20' } });
    fireEvent.change(screen.getByTestId('alloc-product-api-life-2'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('alloc-product-api-life-3'), { target: { value: '0' } });

    // Line commission = 60000*0.35 + 40000*0.20 = 29000
    await waitFor(() => expect(
      within(screen.getByTestId('alloc-line-life')).getByText(/TTD 29,000/),
    ).toBeTruthy());
    // Weighted rate read-only = 29000 / 100000 = 29.0%
    expect(within(screen.getByTestId('alloc-line-life')).getByText(/29\.0%/)).toBeTruthy();

    // Rename product 0
    fireEvent.change(screen.getByTestId('alloc-product-name-life-0'), { target: { value: 'Endowment' } });
    expect(screen.getByTestId('alloc-product-name-life-0').value).toBe('Endowment');
  });

  it('a persisted-drilled line shows its drawer on load (no toggle needed)', () => {
    const ws = makeWorksheet({
      allocation: {
        licenseClass: 'composite',
        lines: {
          life: { api: 50000, rate: 0.35, drilled: true, products: [{ name: 'Whole Life', api: 50000, rate: 0.35 }] },
          ah: { api: 0, rate: 0.25 },
          general: { api: 0, rate: 0.10, drilled: false, products: [] },
        },
      },
    });
    render(<MoneyNeedsAllocator worksheet={ws} />);
    // Drawer is present immediately — proves drawer gates on isDrilled, not UI state.
    expect(screen.getByTestId('alloc-drill-life')).toBeTruthy();
    expect(screen.getByTestId('alloc-product-name-life-0').value).toBe('Whole Life');
  });

  it('caps products at 4 (no Add button when full)', async () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    fireEvent.click(screen.getByTestId('alloc-drill-toggle-life'));
    await screen.findByTestId('alloc-drill-life');
    expect(screen.queryByTestId('alloc-add-product-life')).toBeNull(); // seeded 4 already
    expect(screen.getByText(/Max 4 products/i)).toBeTruthy();
  });
});

describe('MoneyNeedsAllocator — award strip (Life only)', () => {
  it('renders the award projection strip with the Life-only note', async () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    // life seeded 100000 → strip renders
    expect(await screen.findByTestId('award-projection-strip')).toBeTruthy();
    expect(screen.getByText(/Life-line target only/i)).toBeTruthy();
  });
});

describe('MoneyNeedsAllocator — Send → Game Plan', () => {
  it('writes the extended playground payload and continues to game-plan', async () => {
    const onOpenTab = vi.fn();
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} onOpenTab={onOpenTab} />);
    fireEvent.click(screen.getByTestId('alloc-send-btn'));

    const stored = JSON.parse(localStorage.getItem('agencytrack-playground-income-goal'));
    expect(stored.value).toBe(100000);              // #738 contract preserved
    expect(stored.preTaxAlreadyApplied).toBe(true); // #738 contract preserved
    expect(stored.allocation).toBeDefined();        // extension
    expect(stored.allocation.lines.life.api).toBe(100000);
    expect(stored.allocation.licenseClass).toBe('composite');

    const ack = await screen.findByTestId('alloc-ack-modal');
    fireEvent.click(within(ack).getByTestId('alloc-ack-continue'));
    expect(onOpenTab).toHaveBeenCalledWith('game-plan');
  });
});
