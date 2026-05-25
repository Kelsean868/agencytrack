// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  useNotifications: vi.fn(),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotifications: hoisted.useNotifications,
}));

import NotificationDrawer from '../NotificationDrawer';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useNotifications.mockReturnValue({
    notifications:  [],
    unreadCount:    0,
    markRead:       vi.fn(),
    markAllRead:    vi.fn(),
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNotification(overrides = {}) {
  return {
    id:        'n1',
    type:      'submission_reminder',
    title:     'Test Notification',
    body:      'Test body',
    read:      false,
    createdAt: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationDrawer — policy_discrepancy type', () => {
  it('policy_discrepancy notification renders with warning styling, not the Bell fallback', () => {
    hoisted.useNotifications.mockReturnValue({
      notifications: [
        makeNotification({
          id:    'n-disc',
          type:  'policy_discrepancy',
          title: 'Policy Confirmation Discrepancy',
          body:  'Your policy was confirmed with a discrepancy.',
          read:  false,
        }),
      ],
      unreadCount: 1,
      markRead:    vi.fn(),
      markAllRead: vi.fn(),
    });

    render(<NotificationDrawer open={true} onClose={() => {}} />);

    expect(screen.getByText('Policy Confirmation Discrepancy')).toBeInTheDocument();

    // The icon wrapper for unread policy_discrepancy uses the warning palette,
    // not the primary palette that the Bell fallback would produce.
    const iconWrapper = screen.getByText('Policy Confirmation Discrepancy')
      .closest('button')
      ?.querySelector('div[class*="bg-warning"]');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('unrecognised type falls back to Bell / primary palette (regression guard)', () => {
    hoisted.useNotifications.mockReturnValue({
      notifications: [
        makeNotification({
          id:   'n-unknown',
          type: 'unknown_type',
          title: 'Unknown',
          read:  false,
        }),
      ],
      unreadCount: 1,
      markRead:    vi.fn(),
      markAllRead: vi.fn(),
    });

    render(<NotificationDrawer open={true} onClose={() => {}} />);

    // Falls back to submission_reminder → primary palette, not warning.
    const iconWrapper = screen.getByText('Unknown')
      .closest('button')
      ?.querySelector('div[class*="bg-primary"]');
    expect(iconWrapper).toBeInTheDocument();
  });
});
