import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockMarkSeen: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../../../services/planSuggestionsService', () => ({
  listPlanSuggestions: (...a) => hoisted.mockList(...a),
  markSuggestionSeen: (...a) => hoisted.mockMarkSeen(...a),
}));

import PlanSuggestionsCard from '../PlanSuggestionsCard';

const ts = (d) => ({ toDate: () => d });
// Local-component dates (avoid UTC string-parse drift in DD-MM-YYYY assertions).
const localDate = (y, m, d) => new Date(y, m - 1, d);

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockMarkSeen.mockImplementation(() => Promise.resolve(true));
});

describe('PlanSuggestionsCard — quiet states', () => {
  it('renders nothing while loading (list unresolved)', () => {
    hoisted.mockList.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<PlanSuggestionsCard tenantId="tid" agentId="agent-a" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when there are no suggestions (no nagging zero-state)', async () => {
    hoisted.mockList.mockResolvedValue({ items: [] });
    const { container } = render(<PlanSuggestionsCard tenantId="tid" agentId="agent-a" />);
    await waitFor(() => expect(hoisted.mockList).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing without tenantId/agentId', () => {
    const { container } = render(<PlanSuggestionsCard tenantId="" agentId="" />);
    expect(container.firstChild).toBeNull();
    expect(hoisted.mockList).not.toHaveBeenCalled();
  });
});

describe('PlanSuggestionsCard — render + emphasis', () => {
  const items = [
    { id: 's1', note: 'Lift Life to 65%', status: 'open', raisedByName: 'Uma UM', raisedByRole: 'unit_manager', createdAt: ts(localDate(2026, 7, 3)) },
    { id: 's2', note: 'Nice work last month', status: 'seen', raisedByName: 'Bea BM', raisedByRole: 'branch_manager', createdAt: ts(localDate(2026, 6, 1)) },
  ];

  it('shows notes newest-first-as-provided with unread emphasis + count', async () => {
    hoisted.mockList.mockResolvedValue({ items });
    render(<PlanSuggestionsCard tenantId="tid" agentId="agent-a" />);

    const card = await screen.findByTestId('plan-suggestions-card');
    expect(card).toBeInTheDocument();
    expect(screen.getByText('Lift Life to 65%')).toBeInTheDocument();
    expect(screen.getByText('Nice work last month')).toBeInTheDocument();

    // one unread ('open') → emphasized
    const rows = screen.getAllByTestId('plan-suggestion-item');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-unread', 'true');
    expect(rows[1]).toHaveAttribute('data-unread', 'false');
    expect(screen.getByTestId('plan-suggestions-unread-count')).toHaveTextContent('1 new');
    expect(screen.getByTestId('plan-suggestion-unread-dot')).toBeInTheDocument();

    // role + DD-MM-YYYY footer
    expect(screen.getByText(/Uma UM · Unit Manager · 03-07-2026/)).toBeInTheDocument();
  });

  it('acks (marks seen) each unread suggestion on view — once', async () => {
    hoisted.mockList.mockResolvedValue({ items });
    render(<PlanSuggestionsCard tenantId="tid" agentId="agent-a" />);
    await screen.findByTestId('plan-suggestions-card');

    await waitFor(() => expect(hoisted.mockMarkSeen).toHaveBeenCalledTimes(1));
    expect(hoisted.mockMarkSeen).toHaveBeenCalledWith({ tenantId: 'tid', agentId: 'agent-a', suggestionId: 's1' });
    // the already-seen s2 is not re-acked
    expect(hoisted.mockMarkSeen).not.toHaveBeenCalledWith(expect.objectContaining({ suggestionId: 's2' }));
  });

  it('carries the Clarity mask attribute on the card container', async () => {
    hoisted.mockList.mockResolvedValue({ items });
    render(<PlanSuggestionsCard tenantId="tid" agentId="agent-a" />);
    const card = await screen.findByTestId('plan-suggestions-card');
    expect(card).toHaveAttribute('data-clarity-mask', 'True');
  });
});

// Rule 23 — demonstrate the mask guard genuinely DENIES (red) once. The guard is
// the MASK_ATTR_REGEX in clarity-mask-guard.test.js; replicate it here and show
// it rejects a masked-false / absent form while accepting the real attribute.
describe('PlanSuggestionsCard — mask guard red demonstration (Rule 23)', () => {
  const MASK_ATTR_REGEX = /<[^>]*\bdata-clarity-mask\s*=\s*(?:["']True["']|["']true["']|\{\s*true\s*\})[^>]*>/;

  it('the guard regex accepts the real attribute and rejects false/absent', () => {
    expect(MASK_ATTR_REGEX.test('<div data-clarity-mask="True">')).toBe(true);
    expect(MASK_ATTR_REGEX.test('<div data-clarity-mask="false">')).toBe(false); // guard RED
    expect(MASK_ATTR_REGEX.test('<div className="rounded-2xl">')).toBe(false);   // guard RED
  });
});
