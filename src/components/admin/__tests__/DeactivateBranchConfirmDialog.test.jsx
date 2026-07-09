// Dialog a11y contract (§4 dialog sweep) + basic behavior for the branch
// deactivate/reactivate confirmation dialog. Component was previously bare
// markup with no role/aria-modal/trap/Escape/return and a 32px close button.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import DeactivateBranchConfirmDialog from '../DeactivateBranchConfirmDialog';

const ACTIVE_BRANCH = { id: 'b1', name: 'South Branch', isActive: true };
const INACTIVE_BRANCH = { id: 'b2', name: 'North Branch', isActive: false };

describe('DeactivateBranchConfirmDialog — deactivate view', () => {
  it('renders the deactivate copy with the branch name', () => {
    render(
      <DeactivateBranchConfirmDialog branch={ACTIVE_BRANCH} onConfirm={() => {}} onCancel={() => {}} loading={false} />
    );
    expect(screen.getByText('Deactivate branch?')).toBeInTheDocument();
    expect(screen.getByText('South Branch')).toBeInTheDocument();
  });

  it('calls onConfirm(false) when Deactivate is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DeactivateBranchConfirmDialog branch={ACTIVE_BRANCH} onConfirm={onConfirm} onCancel={() => {}} loading={false} />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Deactivate$/ }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <DeactivateBranchConfirmDialog branch={ACTIVE_BRANCH} onConfirm={() => {}} onCancel={onCancel} loading={false} />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('DeactivateBranchConfirmDialog — reactivate view', () => {
  it('renders the reactivate copy when branch.isActive === false', () => {
    render(
      <DeactivateBranchConfirmDialog branch={INACTIVE_BRANCH} onConfirm={() => {}} onCancel={() => {}} loading={false} />
    );
    expect(screen.getByText('Reactivate branch?')).toBeInTheDocument();
    expect(screen.getByText('North Branch')).toBeInTheDocument();
  });

  it('calls onConfirm(true) when Reactivate is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DeactivateBranchConfirmDialog branch={INACTIVE_BRANCH} onConfirm={onConfirm} onCancel={() => {}} loading={false} />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Reactivate$/ }));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });
});

// ── Dialog a11y contract (§4 dialog sweep) ───────────────────────────────────

describe('DeactivateBranchConfirmDialog — dialog a11y', () => {
  it('exposes role=dialog + aria-modal=true + aria-labelledby', () => {
    render(
      <DeactivateBranchConfirmDialog branch={ACTIVE_BRANCH} onConfirm={() => {}} onCancel={() => {}} loading={false} />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'deactivate-branch-dialog-heading');
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(
      <DeactivateBranchConfirmDialog branch={ACTIVE_BRANCH} onConfirm={() => {}} onCancel={onCancel} loading={false} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('close button meets the 44px touch-target floor', () => {
    render(
      <DeactivateBranchConfirmDialog branch={ACTIVE_BRANCH} onConfirm={() => {}} onCancel={() => {}} loading={false} />
    );
    expect(screen.getByLabelText('Close').className).toMatch(/\bw-11\b/);
    expect(screen.getByLabelText('Close').className).toMatch(/\bh-11\b/);
  });

  it('Tab from the last focusable element cycles back to the first (focus trap)', () => {
    render(
      <DeactivateBranchConfirmDialog branch={ACTIVE_BRANCH} onConfirm={() => {}} onCancel={() => {}} loading={false} />
    );
    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll(
        'button:not([disabled]):not([aria-hidden="true"]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('restores focus to the invoking element when the dialog unmounts', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <DeactivateBranchConfirmDialog branch={ACTIVE_BRANCH} onConfirm={() => {}} onCancel={() => {}} loading={false} />
    );
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
