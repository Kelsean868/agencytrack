// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ tenantId: 'tatil', user: { uid: 'admin1' } })),
}));

const hoisted = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock('../../../services/awardsRulesetService', () => ({
  getAwardsRuleset: (...args) => hoisted.mockGet(...args),
  setAwardsRuleset: (...args) => hoisted.mockSet(...args),
}));

import AwardsRulesetPanel from '../AwardsRulesetPanel';
import { DEFAULT_RULESET_2026 } from '../../../config/awardsRuleset/2026';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockGet.mockResolvedValue(JSON.parse(JSON.stringify(DEFAULT_RULESET_2026)));
  hoisted.mockSet.mockResolvedValue(undefined);
});

async function renderPanel() {
  const result = render(<AwardsRulesetPanel />);
  await waitFor(() => {
    expect(result.container.querySelector('.animate-spin')).toBeNull();
  });
  return result;
}

// Open an accordion by clicking the button whose text includes `label`.
function openSection(label) {
  const btn = screen.getByRole('button', { name: new RegExp(label, 'i') });
  fireEvent.click(btn);
}

describe('AwardsRulesetPanel — array row editors', () => {
  it('add row increments the row count for activityAwards', async () => {
    await renderPanel();

    openSection('Activity Awards');

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /remove row/i })).toHaveLength(4);
    });

    fireEvent.click(screen.getByRole('button', { name: /add row/i }));

    expect(screen.getAllByRole('button', { name: /remove row/i })).toHaveLength(5);
  });

  it('remove row decrements and is disabled when only 1 row remains', async () => {
    await renderPanel();

    openSection('Agency Monthly Production Bonus');

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /remove row/i })).toHaveLength(3);
    });

    // 3 → 2
    fireEvent.click(screen.getAllByRole('button', { name: /remove row/i })[0]);
    expect(screen.getAllByRole('button', { name: /remove row/i })).toHaveLength(2);

    // 2 → 1
    fireEvent.click(screen.getAllByRole('button', { name: /remove row/i })[0]);
    expect(screen.getAllByRole('button', { name: /remove row/i })).toHaveLength(1);

    // at length 1 the button must be disabled
    expect(screen.getByRole('button', { name: /remove row/i })).toBeDisabled();
  });

  it('editing a row field produces the correct payload on save', async () => {
    await renderPanel();

    openSection('Activity Awards');

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /remove row/i })).toHaveLength(4);
    });

    // Change target of row 0 from 40 to 45
    const targetInput = document.getElementById('arf-activityAwards-0-target');
    fireEvent.change(targetInput, { target: { value: '45' } });

    fireEvent.click(screen.getByRole('button', { name: /^save ruleset$/i }));

    await waitFor(() => {
      expect(hoisted.mockSet).toHaveBeenCalledOnce();
    });

    const [, , payload] = hoisted.mockSet.mock.calls[0];
    expect(payload.activityAwards[0].target).toBe(45);
  });

  it('Save button enables after removing a valid row (isDirty fires on array mutation)', async () => {
    await renderPanel();

    // Initially no dirty state — Save is disabled
    expect(screen.getByRole('button', { name: /^save ruleset$/i })).toBeDisabled();

    openSection('Agency Monthly Production Bonus');

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /remove row/i })).toHaveLength(3);
    });

    // Remove a row (3 → 2, remaining rows have valid values from default ruleset)
    fireEvent.click(screen.getAllByRole('button', { name: /remove row/i })[0]);

    expect(screen.getByRole('button', { name: /^save ruleset$/i })).not.toBeDisabled();
  });

  it('isDirty resets after save and reload', async () => {
    await renderPanel();

    openSection('Agency Monthly Production Bonus');

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /remove row/i })).toHaveLength(3);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /remove row/i })[0]);
    expect(screen.getByRole('button', { name: /^save ruleset$/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /^save ruleset$/i }));

    // getAwardsRuleset is called again on reload after save
    await waitFor(() => {
      expect(hoisted.mockGet).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByRole('button', { name: /^save ruleset$/i })).toBeDisabled();
  });

  it('combined scalar + array save writes the complete 16-group ruleset', async () => {
    await renderPanel();

    // Edit a scalar: open advisorMonth and change persistGate
    openSection('Advisor of the Month');
    const persistInput = document.getElementById('arf-advisorMonth-persistGate');
    fireEvent.change(persistInput, { target: { value: '91' } });

    // Edit an array: open activityAwards and remove the last row (4 → 3)
    openSection('Activity Awards');

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /remove row/i })).toHaveLength(4);
    });

    const removeButtons = screen.getAllByRole('button', { name: /remove row/i });
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    fireEvent.click(screen.getByRole('button', { name: /^save ruleset$/i }));

    await waitFor(() => {
      expect(hoisted.mockSet).toHaveBeenCalledOnce();
    });

    const [, , payload] = hoisted.mockSet.mock.calls[0];

    // Scalar edit persisted
    expect(payload.advisorMonth.persistGate).toBe(91);
    // Array edit persisted
    expect(payload.activityAwards).toHaveLength(3);
    // All 16 groups present (completeness invariant)
    for (const key of Object.keys(DEFAULT_RULESET_2026)) {
      expect(payload).toHaveProperty(key);
    }
  });
});

describe('AwardsRulesetPanel — §1 states contract (error / retry)', () => {
  it('renders a persistent inline error card with a wired Retry when the load fails', async () => {
    hoisted.mockGet.mockRejectedValueOnce(new Error('boom-ruleset'));
    render(<AwardsRulesetPanel />);

    await waitFor(() => expect(screen.getByText('boom-ruleset')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toBeInTheDocument();

    hoisted.mockGet.mockResolvedValueOnce(JSON.parse(JSON.stringify(DEFAULT_RULESET_2026)));
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.queryByText('boom-ruleset')).toBeNull());
    expect(hoisted.mockGet).toHaveBeenCalledTimes(2);
  });
});
