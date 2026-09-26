// @vitest-environment jsdom
//
// TopBar search trigger (Fable Tier 1 · 1.1): the centre search field is a
// button that opens the command palette (was a no-op placeholder input before).

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../ui/NotificationBell', () => ({ default: () => null }));
vi.mock('../../ui/SyncIndicator', () => ({ default: () => null }));

import TopBar from '../TopBar';

afterEach(() => cleanup());

describe('TopBar — command palette trigger', () => {
  it('renders the search as a button with the palette label and a ⌘K hint', () => {
    render(<TopBar title="Dashboard" onOpenSearch={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /search screens and actions/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('⌘K');
  });

  it('calls onOpenSearch when clicked', () => {
    const onOpenSearch = vi.fn();
    render(<TopBar title="Dashboard" onOpenSearch={onOpenSearch} />);
    fireEvent.click(screen.getByRole('button', { name: /search screens and actions/i }));
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });
});

describe('TopBar — mobile command-palette trigger (Fable Tier 1 · 1.1b)', () => {
  it('renders a mobile search icon button with its own aria-label', () => {
    render(<TopBar title="Dashboard" onOpenSearch={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /search — open command palette/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('topbar-mobile-search');
  });

  it('calls the same onOpenSearch handler as the desktop pill when clicked', () => {
    const onOpenSearch = vi.fn();
    render(<TopBar title="Dashboard" onOpenSearch={onOpenSearch} />);
    fireEvent.click(screen.getByRole('button', { name: /search — open command palette/i }));
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it('the desktop search pill is still present alongside the mobile trigger', () => {
    render(<TopBar title="Dashboard" onOpenSearch={vi.fn()} />);
    expect(screen.getByRole('button', { name: /search screens and actions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search — open command palette/i })).toBeInTheDocument();
  });
});

describe('TopBar — Home variant (Home redesign R1)', () => {
  it('adds the home modifier, the avatar slot and the one-line mono date', () => {
    const { container } = render(
      <TopBar
        title="Home"
        onOpenSearch={vi.fn()}
        variant="home"
        avatar={<span data-testid="avatar">KM</span>}
        mobileCrumb="SAT 26 SEP · WEEK 39"
      />,
    );
    expect(container.querySelector('header')).toHaveClass('topbar', 'topbar--home');
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.getByText('SAT 26 SEP · WEEK 39')).toHaveClass('topbar-mobile-crumb');
    expect(screen.getByRole('button', { name: /toggle dark mode/i })).toHaveClass('topbar-theme-toggle');
  });

  it('other screens keep the plain topbar with no avatar or mobile date', () => {
    const { container } = render(<TopBar title="Ledger" onOpenSearch={vi.fn()} mobileCrumb="X" avatar={<span data-testid="avatar" />} />);
    expect(container.querySelector('header')).not.toHaveClass('topbar--home');
    expect(screen.queryByTestId('avatar')).not.toBeInTheDocument();
    expect(screen.queryByText('X')).not.toBeInTheDocument();
  });
});
