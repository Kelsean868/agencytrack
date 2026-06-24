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

describe('MoneyNeedsAllocator — commission-first input model', () => {
  it('number field is commission; seeded from the worksheet target (life 35000)', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    expect(screen.getByTestId('alloc-line-commission-input-life').value).toBe('35000');
  });

  it('type commission → API derives (commission ÷ rate) and the slider label updates', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    const commField = screen.getByTestId('alloc-line-commission-input-life');
    fireEvent.change(commField, { target: { value: '70000' } });
    // 70000 ÷ 0.35 = 200000 API
    expect(within(screen.getByTestId('alloc-line-api-label-life')).getByText(/TTD 200,000/)).toBeTruthy();
    // commission headline reflects the typed value
    expect(within(screen.getByTestId('alloc-line-life')).getByText(/TTD 70,000/)).toBeTruthy();
  });

  it('commission field clamps to [0, required]', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    const commField = screen.getByTestId('alloc-line-commission-input-life');
    fireEvent.change(commField, { target: { value: '999999' } }); // > required 100000
    expect(commField.value).toBe('100000');
  });

  it('drag slider (API) → commission derives (api × rate)', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    const slider = screen.getByTestId('alloc-line-slider-life');
    fireEvent.change(slider, { target: { value: '150000' } }); // API
    // 150000 × 0.35 = 52500 commission
    expect(screen.getByTestId('alloc-line-commission-input-life').value).toBe('52500');
    expect(within(screen.getByTestId('alloc-line-api-label-life')).getByText(/TTD 150,000/)).toBeTruthy();
  });

  it('rate field shows percent (×100), parses ÷100, stores the decimal', async () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    const rateField = screen.getByTestId('alloc-line-rate-life');
    expect(rateField.value).toBe('35'); // 0.35 shown as 35
    fireEvent.change(rateField, { target: { value: '50' } }); // 50% → 0.5
    fireEvent.blur(rateField);
    await waitFor(() => expect(mockSaveAllocation).toHaveBeenCalled());
    expect(mockSaveAllocation.mock.calls.at(-1)[3].lines.life.rate).toBe(0.5);
  });

  it('rate change KEEPS commission fixed and re-derives API', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    // seeded life commission 35000 @ 35% → API 100000
    fireEvent.change(screen.getByTestId('alloc-line-rate-life'), { target: { value: '50' } }); // → 0.5
    // commission unchanged, API re-derived 35000/0.5 = 70000
    expect(screen.getByTestId('alloc-line-commission-input-life').value).toBe('35000');
    expect(within(screen.getByTestId('alloc-line-api-label-life')).getByText(/TTD 70,000/)).toBeTruthy();
  });
});

describe('MoneyNeedsAllocator — per-product drill (Life)', () => {
  it('breaks Life into products (commission-first), derives line commission Σ + weighted rate + per-product API; renames', async () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet()} />);
    fireEvent.click(screen.getByTestId('alloc-drill-toggle-life'));
    const drawer = await screen.findByTestId('alloc-drill-life');
    // seeded 4 products
    expect(within(drawer).getAllByTestId(/alloc-product-life-\d/)).toHaveLength(4);

    // Enter commission per product (+ rate %); product API derives. Others → 0.
    fireEvent.change(screen.getByTestId('alloc-product-commission-life-0'), { target: { value: '21000' } });
    fireEvent.change(screen.getByTestId('alloc-product-rate-life-0'), { target: { value: '35' } }); // 35% → 0.35
    fireEvent.change(screen.getByTestId('alloc-product-commission-life-1'), { target: { value: '8000' } });
    fireEvent.change(screen.getByTestId('alloc-product-rate-life-1'), { target: { value: '20' } }); // 20% → 0.20
    fireEvent.change(screen.getByTestId('alloc-product-commission-life-2'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('alloc-product-commission-life-3'), { target: { value: '0' } });

    // Line commission = 21000 + 8000 = 29000 (Σ product commissions)
    await waitFor(() => expect(
      within(screen.getByTestId('alloc-line-life')).getByText(/TTD 29,000/),
    ).toBeTruthy());
    // Weighted rate read-only = 29000 / 100000 = 29.0% (lineAPI = 60000 + 40000)
    expect(within(screen.getByTestId('alloc-line-life')).getByText(/29\.0%/)).toBeTruthy();
    // Product 0 derived API = 21000 / 0.35 = 60000
    expect(within(screen.getByTestId('alloc-product-api-life-0')).getByText(/TTD 60,000/)).toBeTruthy();

    // Rename product 0
    fireEvent.change(screen.getByTestId('alloc-product-name-life-0'), { target: { value: 'Endowment' } });
    expect(screen.getByTestId('alloc-product-name-life-0').value).toBe('Endowment');
  });

  it('a persisted-drilled line shows its drawer on load (no toggle needed)', () => {
    const ws = makeWorksheet({
      allocation: {
        licenseClass: 'composite',
        lines: {
          life: { commission: 17500, rate: 0.35, drilled: true, products: [{ name: 'Whole Life', commission: 17500, rate: 0.35 }] },
          ah: { commission: 0, rate: 0.25 },
          general: { commission: 0, rate: 0.10, drilled: false, products: [] },
        },
      },
    });
    render(<MoneyNeedsAllocator worksheet={ws} />);
    // Drawer is present immediately — proves drawer gates on isDrilled, not UI state.
    expect(screen.getByTestId('alloc-drill-life')).toBeTruthy();
    expect(screen.getByTestId('alloc-product-name-life-0').value).toBe('Whole Life');
    // Derived product API = 17500 / 0.35 = 50000
    expect(within(screen.getByTestId('alloc-product-api-life-0')).getByText(/TTD 50,000/)).toBeTruthy();
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
    // commission canonical (seeded life target 35000), API derived (35000 ÷ 0.35)
    expect(stored.allocation.lines.life.commission).toBe(35000);
    expect(stored.allocation.lines.life.api).toBeCloseTo(100000);
    expect(stored.allocation.licenseClass).toBe('composite');

    const ack = await screen.findByTestId('alloc-ack-modal');
    fireEvent.click(within(ack).getByTestId('alloc-ack-continue'));
    expect(onOpenTab).toHaveBeenCalledWith('game-plan');
  });
});

describe('MoneyNeedsAllocator — AllocationSummaryCard', () => {
  // Fixture: a drilled Life line (2 products) so we can assert product subtotal rows.
  function makeDrilledWorksheet() {
    return makeWorksheet({
      allocation: {
        licenseClass: 'composite',
        lines: {
          life: {
            commission: 29000, rate: 0.35, drilled: true,
            products: [
              { name: 'Whole Life', commission: 21000, rate: 0.35 }, // api 60000
              { name: 'Term',       commission: 8000,  rate: 0.20 }, // api 40000
            ],
          },
          ah:      { commission: 10000, rate: 0.25, drilled: false },
          general: { commission: 0,     rate: 0.10, drilled: false, products: [] },
        },
      },
    });
  }

  it('renders summary card with line row + product subtotals + totals for a drilled fixture', () => {
    render(<MoneyNeedsAllocator worksheet={makeDrilledWorksheet()} />);
    const card = screen.getByTestId('alloc-summary-card');
    expect(card).toBeTruthy();

    // Life line row (drilled): should show commission 29000
    const lifeLine = within(card).getByTestId('summary-line-life');
    expect(within(lifeLine).getByText(/TTD 29,000/)).toBeTruthy();
    expect(within(lifeLine).getByText(/Life/)).toBeTruthy();

    // Per-product subtotal rows
    const p0 = within(card).getByTestId('summary-product-life-0');
    expect(within(p0).getByText('Whole Life')).toBeTruthy();
    expect(within(p0).getByText(/TTD 21,000/)).toBeTruthy();

    const p1 = within(card).getByTestId('summary-product-life-1');
    expect(within(p1).getByText('Term')).toBeTruthy();
    expect(within(p1).getByText(/TTD 8,000/)).toBeTruthy();

    // A&H line (collapsed, no product rows for ah)
    const ahLine = within(card).getByTestId('summary-line-ah');
    expect(within(ahLine).getByText(/A&H/)).toBeTruthy();
    expect(within(ahLine).getByText(/TTD 10,000/)).toBeTruthy();
    expect(within(card).queryByTestId('summary-product-ah-0')).toBeNull();

    // Grand total row
    const total = within(card).getByTestId('summary-total');
    expect(within(total).getByText(/TTD 39,000/)).toBeTruthy(); // 29000+10000
  });

  it('shows empty state when nothing is allocated yet', () => {
    render(<MoneyNeedsAllocator worksheet={makeWorksheet({ firstYearCommissionsTargets: {} })} />);
    const card = screen.getByTestId('alloc-summary-card');
    expect(card.textContent).toMatch(/Allocate above/i);
  });

  it('ack modal (no regression) still shows the line-level subset from buildAllocationSummary', async () => {
    render(<MoneyNeedsAllocator worksheet={makeDrilledWorksheet()} onOpenTab={vi.fn()} />);
    fireEvent.click(screen.getByTestId('alloc-send-btn'));
    const ack = await screen.findByTestId('alloc-ack-modal');
    // Ack renders Life + A&H (both have commission > 0); General (0) is filtered out.
    expect(within(ack).getByText('Life')).toBeTruthy();
    expect(within(ack).getByText('A&H')).toBeTruthy();
    expect(within(ack).queryByText('General')).toBeNull();
    // No product rows in ack (it renders line-level subset only).
    expect(within(ack).queryByTestId('summary-product-life-0')).toBeNull();
  });
});
