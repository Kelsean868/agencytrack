import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RecommendLockDrawer from '../RecommendLockDrawer';

const DEFAULT_PROPS = {
  open: true,
  onClose: vi.fn(),
  agentName: 'Alice Agent',
  initial: {},
  annualAPIFloor: 200000,
  minimums: { annualApps: 42, persistency: 90 },
  onSave: vi.fn().mockResolvedValue(undefined),
  saving: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  DEFAULT_PROPS.onSave = vi.fn().mockResolvedValue(undefined);
  DEFAULT_PROPS.onClose = vi.fn();
});

describe('RecommendLockDrawer — visibility', () => {
  it('renders when open=true', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('renders nothing when open=false', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the agent name in the header', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    expect(screen.getByText('Alice Agent')).toBeDefined();
  });
});

describe('RecommendLockDrawer — recommend mode (default)', () => {
  it('defaults to Recommend mode when initial.targetLocked is absent', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    // Recommend button should be visually active (gold tones); Lock should be inactive.
    // We assert by checking the suggestion banner text.
    expect(screen.getByText(/a suggestion, not their commitment/i)).toBeDefined();
  });

  it('shows the gold suggestion banner in recommend mode', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    // 'Suggested target' is the bold label inside the banner; the save button
    // contains 'Save suggested target' (different full text) so exact match is unambiguous.
    expect(screen.getByText('Suggested target')).toBeDefined();
  });

  it('calls onSave with targetLocked=false when saved in recommend mode', async () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText(/save suggested target/i));
    await waitFor(() => {
      expect(DEFAULT_PROPS.onSave).toHaveBeenCalledWith(
        expect.any(Object),
        false,
      );
    });
  });
});

describe('RecommendLockDrawer — lock mode', () => {
  it('defaults to Lock mode when initial.targetLocked=true', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} initial={{ targetLocked: true }} />);
    expect(screen.getByText(/binding floor/i)).toBeDefined();
  });

  it('switches to lock mode when Lock button is clicked', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /^lock$/i }));
    expect(screen.getByText(/binding floor/i)).toBeDefined();
  });

  it('calls onSave with targetLocked=true when saved in lock mode', async () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} initial={{ targetLocked: true }} />);
    fireEvent.click(screen.getByText(/save locked target/i));
    await waitFor(() => {
      expect(DEFAULT_PROPS.onSave).toHaveBeenCalledWith(
        expect.any(Object),
        true,
      );
    });
  });
});

describe('RecommendLockDrawer — toggle', () => {
  it('switches from recommend to lock via toggle', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    expect(screen.getByText(/a suggestion, not their commitment/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^lock$/i }));
    expect(screen.getByText(/binding floor/i)).toBeDefined();
  });

  it('switches from lock to recommend via toggle', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} initial={{ targetLocked: true }} />);
    expect(screen.getByText(/binding floor/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^recommend$/i }));
    expect(screen.getByText(/a suggestion, not their commitment/i)).toBeDefined();
  });
});

describe('RecommendLockDrawer — close', () => {
  it('calls onClose when Cancel is clicked', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(DEFAULT_PROPS.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(DEFAULT_PROPS.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    // The scrim has aria-hidden, so click by querying the backdrop div.
    const dialog = screen.getByRole('dialog');
    // The first child of the dialog container is the scrim.
    fireEvent.click(dialog.firstChild);
    expect(DEFAULT_PROPS.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RecommendLockDrawer — error display', () => {
  it('shows error message when onSave rejects', async () => {
    DEFAULT_PROPS.onSave = vi.fn().mockRejectedValue(new Error('Firestore permission denied'));
    render(<RecommendLockDrawer {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText(/save suggested target/i));
    await waitFor(() => {
      expect(screen.getByText(/Firestore permission denied/i)).toBeDefined();
    });
  });
});
