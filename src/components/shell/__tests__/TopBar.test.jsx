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
