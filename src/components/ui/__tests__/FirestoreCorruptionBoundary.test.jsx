// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  repairFirestoreCache: vi.fn().mockResolvedValue(),
}));

vi.mock('../../../lib/firestoreRecovery', async () => {
  const actual = await vi.importActual('../../../lib/firestoreRecovery');
  return {
    ...actual,
    repairFirestoreCache: hoisted.repairFirestoreCache,
  };
});

import FirestoreCorruptionBoundary from '../FirestoreCorruptionBoundary';

// A child that throws a Firestore internal-assertion-failure-shaped error
// during render — simulates the 2026-09-23 incident (ID: b815).
function BoomAssertionFailure() {
  throw new Error(
    'FIRESTORE (12.12.1) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)'
  );
}

// A child that throws an unrelated render error — must NOT be swallowed by
// this boundary (SEC-10 scopes it to the Firestore assertion family only).
function BoomUnrelated() {
  throw new Error('TypeError: cannot read properties of undefined');
}

describe('FirestoreCorruptionBoundary', () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.repairFirestoreCache.mockClear();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    cleanup();
  });

  it('renders children normally when there is no error', () => {
    render(
      <FirestoreCorruptionBoundary>
        <div data-testid="child-ok">loaded</div>
      </FirestoreCorruptionBoundary>,
    );
    expect(screen.getByTestId('child-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('state-firestore-corrupt')).toBeNull();
  });

  it('renders the Repair app data fallback when a descendant throws an INTERNAL ASSERTION FAILED error', () => {
    render(
      <FirestoreCorruptionBoundary>
        <BoomAssertionFailure />
      </FirestoreCorruptionBoundary>,
    );
    expect(screen.getByTestId('state-firestore-corrupt')).toBeInTheDocument();
    expect(screen.getByText(/saved data is damaged/i)).toBeInTheDocument();
    // a11y: announced to assistive tech.
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('firestore-repair-button')).toBeInTheDocument();
  });

  it('does NOT catch an unrelated render error (rethrows past this boundary)', () => {
    // No boundary above this one in the test tree, so React's own
    // uncaught-error path fires — the assertion is that OUR fallback never
    // renders for a non-matching error (no false-positive "Repair app
    // data" screen masking an unrelated bug).
    expect(() => render(
      <FirestoreCorruptionBoundary>
        <BoomUnrelated />
      </FirestoreCorruptionBoundary>,
    )).toThrow(/cannot read properties of undefined/);
  });

  it('clicking Repair app data calls repairFirestoreCache()', () => {
    render(
      <FirestoreCorruptionBoundary>
        <BoomAssertionFailure />
      </FirestoreCorruptionBoundary>,
    );
    fireEvent.click(screen.getByTestId('firestore-repair-button'));
    expect(hoisted.repairFirestoreCache).toHaveBeenCalledOnce();
  });

  it('an async unhandledrejection matching the assertion-failure family also renders the fallback ("at app start" path)', () => {
    render(
      <FirestoreCorruptionBoundary>
        <div data-testid="child-ok">loaded</div>
      </FirestoreCorruptionBoundary>,
    );
    expect(screen.getByTestId('child-ok')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('unhandledrejection'), {
          reason: new Error('FIRESTORE (12.12.1) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)'),
        }),
      );
    });

    expect(screen.getByTestId('state-firestore-corrupt')).toBeInTheDocument();
  });

  it('an unrelated unhandledrejection is ignored — children keep rendering', () => {
    render(
      <FirestoreCorruptionBoundary>
        <div data-testid="child-ok">loaded</div>
      </FirestoreCorruptionBoundary>,
    );

    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('unhandledrejection'), {
          reason: new Error('Network request failed'),
        }),
      );
    });

    expect(screen.getByTestId('child-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('state-firestore-corrupt')).toBeNull();
  });
});
