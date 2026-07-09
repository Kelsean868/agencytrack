// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  mockMove:     vi.fn().mockResolvedValue(undefined),
  mockTouch:    vi.fn().mockResolvedValue(undefined),
  mockReassign: vi.fn().mockResolvedValue(undefined),
  mockArchive:  vi.fn().mockResolvedValue(undefined),
  mockUpdate:   vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/recruitingService', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    moveCandidateStage: (...a) => hoisted.mockMove(...a),
    logTouch:           (...a) => hoisted.mockTouch(...a),
    reassignCandidate:  (...a) => hoisted.mockReassign(...a),
    archiveCandidate:   (...a) => hoisted.mockArchive(...a),
    updateCandidate:    (...a) => hoisted.mockUpdate(...a),
  };
});

import RecDrillDrawer from '../RecDrillDrawer';

const TENANT = 'test-tenant';
const NOW = Date.now();
const baseCandidate = {
  id: 'c1', name: 'Divya Ramkissoon', stage: 'interview', status: 'active',
  ownerUid: 'bm1', ownerName: 'Branch Mgr', referrerName: 'Riaz Khan',
  source: 'LinkedIn', note: 'Second interview Thursday.', stageChangedAt: NOW - 4 * 86_400_000,
};
const owners = [{ uid: 'bm1', name: 'Branch Mgr' }, { uid: 'um2', name: 'Unit Two' }];

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

function renderDrawer(props = {}) {
  const onClose = vi.fn();
  const onMutated = vi.fn().mockResolvedValue(undefined);
  render(
    <RecDrillDrawer
      candidate={baseCandidate}
      tenantId={TENANT}
      canReassign={false}
      owners={owners}
      onClose={onClose}
      onMutated={onMutated}
      {...props}
    />,
  );
  return { onClose, onMutated };
}

beforeEach(() => vi.clearAllMocks());

describe('§4 dialog contract', () => {
  it('renders a labelled modal dialog with a 44px close button', () => {
    renderDrawer();
    const dialog = screen.getByTestId('rec-drill-drawer');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'rec-drill-title');
    const close = screen.getByRole('button', { name: /close candidate view/i });
    expect(close.className).toMatch(/min-h-\[44px\]/);
  });

  it('Escape closes the drawer', () => {
    const { onClose } = renderDrawer();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('stage moves', () => {
  it('Advance calls moveCandidateStage with the next stage and refetches', async () => {
    const { onMutated } = renderDrawer();
    fireEvent.click(screen.getByTestId('rec-advance-btn'));
    await flush();
    expect(hoisted.mockMove).toHaveBeenCalledWith(TENANT, 'c1', 'assessment');
    expect(onMutated).toHaveBeenCalled();
  });

  it('the stage picker can regress via moveCandidateStage', async () => {
    renderDrawer();
    fireEvent.change(screen.getByLabelText(/move to stage/i), { target: { value: 'contacted' } });
    await flush();
    expect(hoisted.mockMove).toHaveBeenCalledWith(TENANT, 'c1', 'contacted');
  });

  it('Log touch calls logTouch', async () => {
    renderDrawer();
    fireEvent.click(screen.getByTestId('rec-touch-btn'));
    await flush();
    expect(hoisted.mockTouch).toHaveBeenCalledWith(TENANT, 'c1');
  });
});

describe('reassign — senior-only gating', () => {
  it('hides the reassign control when the caller cannot reassign', () => {
    renderDrawer({ canReassign: false });
    expect(screen.queryByTestId('rec-reassign-btn')).not.toBeInTheDocument();
  });

  it('shows and fires reassign for a senior caller', async () => {
    renderDrawer({ canReassign: true });
    fireEvent.change(screen.getByLabelText(/reassign to owner/i), { target: { value: 'um2' } });
    fireEvent.click(screen.getByTestId('rec-reassign-btn'));
    await flush();
    expect(hoisted.mockReassign).toHaveBeenCalledWith(TENANT, 'c1', { ownerUid: 'um2', ownerName: 'Unit Two' });
  });
});

describe('archive (two-step, no delete)', () => {
  it('requires confirmation then calls archiveCandidate', async () => {
    renderDrawer();
    fireEvent.click(screen.getByTestId('rec-archive-btn'));
    fireEvent.click(screen.getByTestId('rec-archive-confirm'));
    await flush();
    expect(hoisted.mockArchive).toHaveBeenCalledWith(TENANT, 'c1');
  });
});

describe('note edit', () => {
  it('saves an edited note via updateCandidate', async () => {
    renderDrawer();
    const textarea = screen.getByLabelText(/latest note/i);
    fireEvent.change(textarea, { target: { value: 'Updated note' } });
    fireEvent.click(screen.getByRole('button', { name: /save note/i }));
    await flush();
    expect(hoisted.mockUpdate).toHaveBeenCalledWith(TENANT, 'c1', { note: 'Updated note' });
  });
});

describe('licensed candidate', () => {
  it('shows the hired footer instead of advance/touch', () => {
    render(
      <RecDrillDrawer
        candidate={{ ...baseCandidate, stage: 'licensed', licensedAt: NOW }}
        tenantId={TENANT}
        owners={owners}
        onClose={vi.fn()}
        onMutated={vi.fn()}
      />,
    );
    expect(screen.getByText(/counts toward your war/i)).toBeInTheDocument();
    expect(screen.queryByTestId('rec-advance-btn')).not.toBeInTheDocument();
  });
});
