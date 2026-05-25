// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useNotifications: vi.fn(),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotifications: hoisted.useNotifications,
}));

vi.mock('../NotificationDrawer', () => ({
  default: ({ open }) => open ? <div data-testid="drawer-open" /> : null,
}));

import NotificationBell from '../NotificationBell';

beforeEach(() => {
  vi.resetAllMocks();
  hoisted.useNotifications.mockReturnValue({ unreadCount: 0 });
});

describe('NotificationBell', () => {
  it('renders a button with aria-label "Notifications" when unreadCount is 0', () => {
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('aria-label includes unread count when unreadCount > 0', () => {
    hoisted.useNotifications.mockReturnValue({ unreadCount: 3 });
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: /3 unread/ })).toBeInTheDocument();
  });

  it('no badge shown when unreadCount is 0', () => {
    render(<NotificationBell />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('badge shows count when unreadCount > 0', () => {
    hoisted.useNotifications.mockReturnValue({ unreadCount: 5 });
    render(<NotificationBell />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('badge shows "99+" when unreadCount > 99', () => {
    hoisted.useNotifications.mockReturnValue({ unreadCount: 150 });
    render(<NotificationBell />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('clicking the bell opens the drawer', () => {
    render(<NotificationBell />);
    expect(screen.queryByTestId('drawer-open')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('drawer-open')).toBeInTheDocument();
  });

  it('clicking the bell a second time closes the drawer', () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('drawer-open')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByTestId('drawer-open')).not.toBeInTheDocument();
  });
});
