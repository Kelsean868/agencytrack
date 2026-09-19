// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Hoisted mocks ────────────────────────────────────────────────────────────
// Only the network-calling exports are mocked. `describeImportError` and
// `MAX_CLIENT_FILE_BYTES` come from the real module (pure, no Firebase) so the
// plain-words mapping is exercised for real, not re-implemented in the test.

const hoisted = vi.hoisted(() => ({
  fileToBase64: vi.fn(),
  previewPortfolioImport: vi.fn(),
  applyPortfolioImport: vi.fn(),
  undoLastPortfolioImport: vi.fn(),
}));

vi.mock('../../../../../services/portfolioImportService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fileToBase64: hoisted.fileToBase64,
    previewPortfolioImport: hoisted.previewPortfolioImport,
    applyPortfolioImport: hoisted.applyPortfolioImport,
    undoLastPortfolioImport: hoisted.undoLastPortfolioImport,
  };
});

import ImportPortfolioModal from '../ImportPortfolioModal';
import { describeImportError } from '../../../../../services/portfolioImportService';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function xlsxFile(name = 'export.xlsx') {
  return new File(['dummy contents'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function makePreview(overrides = {}) {
  return {
    planId: 'plan-1',
    exportDate: '2026-09-01',
    sheetName: 'Portfolio',
    agentNumber: 'A1234',
    counts: {
      rowsInFile: 10,
      shadowRows: 0,
      testRecords: 1,
      skippedNotYours: 2,
      yours: 7,
      creates: 4,
      updates: 2,
      unchanged: 1,
    },
    planClassPending: [],
    classUnconfirmed: [],
    overridesApplied: [],
    importConfigApplied: { overrides: [], selfOrFamily: [], testPolicyNumbers: [] },
    testRecordNumbers: [],
    skippedNotYoursNumbers: [],
    unknownPlanPrefixes: {},
    unmappedStatus: [],
    orphanedInLedger: [],
    statusCounts: {},
    createPolicyNumbers: [],
    updatePolicyNumbers: [],
    ...overrides,
  };
}

function makeApplyResult(overrides = {}) {
  return {
    planId: 'plan-1',
    runId: 'run-1',
    exportDate: '2026-09-01',
    created: 4,
    updated: 2,
    unchanged: 1,
    refused: 0,
    refusedPolicyNumbers: [],
    counts: {},
    planClassPending: [],
    overridesApplied: [],
    ...overrides,
  };
}

function httpsError(code, message) {
  return Object.assign(new Error(message), { code: `functions/${code}` });
}

async function goToReview(user, previewData = makePreview()) {
  hoisted.fileToBase64.mockResolvedValue('base64==');
  hoisted.previewPortfolioImport.mockResolvedValue(previewData);
  render(<ImportPortfolioModal onClose={vi.fn()} onImported={vi.fn()} />);

  const input = screen.getByTestId('import-file-input');
  await user.upload(input, xlsxFile());
  await user.click(screen.getByTestId('import-preview-button'));
  await waitFor(() => expect(screen.getByTestId('import-step-review')).toBeInTheDocument());
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ── Pick → review ────────────────────────────────────────────────────────────

describe('ImportPortfolioModal — pick to review', () => {
  it('renders every count from the preview fixture on the review step', async () => {
    const user = userEvent.setup();
    await goToReview(user);

    expect(screen.getByTestId('import-count-new')).toHaveTextContent('4');
    expect(screen.getByTestId('import-count-updated')).toHaveTextContent('2');
    expect(screen.getByTestId('import-count-unchanged')).toHaveTextContent('1');
    expect(screen.getByTestId('import-count-skipped-not-yours')).toHaveTextContent('2');
    expect(screen.getByTestId('import-count-skipped-not-yours')).toHaveTextContent('not yours');
    expect(screen.getByTestId('import-count-test-records')).toHaveTextContent('1');
    expect(screen.getByText(/2026-09-01/)).toBeInTheDocument();
    expect(screen.getByText(/Portfolio/)).toBeInTheDocument();
  });

  it('shows planClassPending policy numbers and overridesApplied notes', async () => {
    const user = userEvent.setup();
    await goToReview(user, makePreview({
      planClassPending: ['POL-1', 'POL-2'],
      overridesApplied: [
        { policyNumber: 'POL-9', from: { oipaStatus: 'X' }, to: { status: 'lapsed' }, note: 'Moved to lapsed per your override rule.' },
      ],
    }));

    const pending = screen.getByTestId('import-plan-class-pending');
    expect(pending).toHaveTextContent('POL-1, POL-2');
    expect(pending).toHaveTextContent('product could not be identified'.split(' ')[0]); // sanity substring

    const overrides = screen.getByTestId('import-overrides-applied');
    expect(overrides).toHaveTextContent('POL-9');
    expect(overrides).toHaveTextContent('Moved to lapsed per your override rule.');
  });

  it('shows an information notice when no personal import settings were found', async () => {
    const user = userEvent.setup();
    await goToReview(user);
    expect(screen.getByTestId('import-no-config-notice')).toBeInTheDocument();
  });

  it('does NOT show the no-config notice when any override config is present', async () => {
    const user = userEvent.setup();
    await goToReview(user, makePreview({
      importConfigApplied: { overrides: ['x'], selfOrFamily: [], testPolicyNumbers: [] },
    }));
    expect(screen.queryByTestId('import-no-config-notice')).not.toBeInTheDocument();
  });

  it('states that nothing is written until Import is pressed', async () => {
    const user = userEvent.setup();
    await goToReview(user);
    expect(screen.getByTestId('import-nothing-written-notice')).toHaveTextContent(/nothing is written/i);
  });
});

// ── Nothing written on review ────────────────────────────────────────────────

describe('ImportPortfolioModal — review does not write', () => {
  it('apply is not called merely by reaching the review step', async () => {
    const user = userEvent.setup();
    await goToReview(user);
    expect(hoisted.applyPortfolioImport).not.toHaveBeenCalled();
  });

  it('apply is called only after the Import button is clicked', async () => {
    const user = userEvent.setup();
    await goToReview(user);
    hoisted.applyPortfolioImport.mockResolvedValue(makeApplyResult());

    expect(hoisted.applyPortfolioImport).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('import-confirm-button'));
    await waitFor(() => expect(hoisted.applyPortfolioImport).toHaveBeenCalledWith({ planId: 'plan-1' }));
  });
});

// ── Import → result ──────────────────────────────────────────────────────────

describe('ImportPortfolioModal — import to result', () => {
  it('shows created/updated/unchanged from the apply response', async () => {
    const user = userEvent.setup();
    await goToReview(user);
    hoisted.applyPortfolioImport.mockResolvedValue(makeApplyResult({ created: 9, updated: 3, unchanged: 5 }));

    await user.click(screen.getByTestId('import-confirm-button'));

    await waitFor(() => expect(screen.getByTestId('import-step-result')).toBeInTheDocument());
    expect(screen.getByTestId('import-result-created')).toHaveTextContent('9');
    expect(screen.getByTestId('import-result-updated')).toHaveTextContent('3');
    expect(screen.getByTestId('import-result-unchanged')).toHaveTextContent('5');
  });

  it('calls onImported after a successful apply', async () => {
    const user = userEvent.setup();
    hoisted.fileToBase64.mockResolvedValue('base64==');
    hoisted.previewPortfolioImport.mockResolvedValue(makePreview());
    hoisted.applyPortfolioImport.mockResolvedValue(makeApplyResult());
    const onImported = vi.fn();

    render(<ImportPortfolioModal onClose={vi.fn()} onImported={onImported} />);
    await user.upload(screen.getByTestId('import-file-input'), xlsxFile());
    await user.click(screen.getByTestId('import-preview-button'));
    await waitFor(() => screen.getByTestId('import-step-review'));
    await user.click(screen.getByTestId('import-confirm-button'));

    await waitFor(() => expect(onImported).toHaveBeenCalled());
  });
});

// ── Expiry ───────────────────────────────────────────────────────────────────

describe('ImportPortfolioModal — expired plan', () => {
  it('shows the expiry message and a start-again button on deadline-exceeded', async () => {
    const user = userEvent.setup();
    await goToReview(user);
    hoisted.applyPortfolioImport.mockRejectedValue(
      httpsError('deadline-exceeded', 'That review expired. Start again.')
    );

    await user.click(screen.getByTestId('import-confirm-button'));

    await waitFor(() => expect(screen.getByTestId('import-expired')).toBeInTheDocument());
    expect(screen.getByTestId('import-expired')).toHaveTextContent(/expired/i);
    expect(screen.getByTestId('import-start-again')).toBeInTheDocument();
  });

  it('start-again returns to the pick step with a clean slate', async () => {
    const user = userEvent.setup();
    await goToReview(user);
    hoisted.applyPortfolioImport.mockRejectedValue(httpsError('deadline-exceeded', 'Expired.'));
    await user.click(screen.getByTestId('import-confirm-button'));
    await waitFor(() => screen.getByTestId('import-expired'));

    await user.click(screen.getByTestId('import-start-again'));
    expect(screen.getByTestId('import-step-pick')).toBeInTheDocument();
    expect(screen.queryByTestId('import-expired')).not.toBeInTheDocument();
  });
});

// ── Ruling-5 errors ──────────────────────────────────────────────────────────

describe('ImportPortfolioModal — ruling 5 errors render in plain words', () => {
  it('wrong file type is refused client-side before any call is made', async () => {
    render(<ImportPortfolioModal onClose={vi.fn()} onImported={vi.fn()} />);

    // fireEvent bypasses the input's `accept=".xlsx"` filter (userEvent.upload
    // enforces it and would silently refuse to select a mismatched file) —
    // this represents drag-and-drop or a browser that doesn't enforce `accept`,
    // which is exactly why the client-side check exists as a courtesy, not the
    // security boundary (the server re-validates regardless).
    const badFile = new File(['x'], 'export.csv', { type: 'text/csv' });
    const input = screen.getByTestId('import-file-input');
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(screen.getByTestId('import-pick-error')).toBeInTheDocument();
    expect(screen.getByTestId('import-pick-error')).not.toHaveTextContent(/invalid-argument|functions\//);
    expect(hoisted.previewPortfolioImport).not.toHaveBeenCalled();
  });

  it('server invalid-argument (e.g. no rows serviced by me) shows the server message, never the code', async () => {
    const user = userEvent.setup();
    hoisted.fileToBase64.mockResolvedValue('base64==');
    hoisted.previewPortfolioImport.mockRejectedValue(
      httpsError('failed-precondition', 'None of the 10 policies in that file are serviced by agent A1234. Check you exported your own portfolio.')
    );

    render(<ImportPortfolioModal onClose={vi.fn()} onImported={vi.fn()} />);
    await user.upload(screen.getByTestId('import-file-input'), xlsxFile());
    await user.click(screen.getByTestId('import-preview-button'));

    await waitFor(() => expect(screen.getByTestId('import-pick-error')).toBeInTheDocument());
    expect(screen.getByTestId('import-pick-error')).toHaveTextContent(/serviced by agent A1234/);
    expect(screen.getByTestId('import-pick-error')).not.toHaveTextContent(/failed-precondition|functions\//);
  });

  it('file over the 5 MB limit is refused client-side with a plain message', async () => {
    const user = userEvent.setup();
    render(<ImportPortfolioModal onClose={vi.fn()} onImported={vi.fn()} />);

    const big = new File(['x'], 'export.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    await user.upload(screen.getByTestId('import-file-input'), big);

    expect(screen.getByTestId('import-pick-error')).toHaveTextContent(/5 MB/);
    expect(hoisted.previewPortfolioImport).not.toHaveBeenCalled();
  });

  it('an apply-time error other than expiry returns to review with a plain-words banner', async () => {
    const user = userEvent.setup();
    await goToReview(user);
    hoisted.applyPortfolioImport.mockRejectedValue(
      httpsError('internal', 'The plan did not account for every policy in the file. Nothing was changed.')
    );

    await user.click(screen.getByTestId('import-confirm-button'));

    await waitFor(() => expect(screen.getByTestId('import-step-review')).toBeInTheDocument());
    expect(screen.getByTestId('import-apply-error')).toHaveTextContent(/did not account for every policy/);
    expect(screen.getByTestId('import-apply-error')).not.toHaveTextContent(/functions\/internal/);
  });
});

// ── Undo ─────────────────────────────────────────────────────────────────────

describe('ImportPortfolioModal — undo', () => {
  async function goToResult(user, applyResult = makeApplyResult()) {
    await goToReview(user);
    hoisted.applyPortfolioImport.mockResolvedValue(applyResult);
    await user.click(screen.getByTestId('import-confirm-button'));
    await waitFor(() => screen.getByTestId('import-step-result'));
  }

  it('asks for confirmation stating the count, and does not call the delete until confirmed', async () => {
    const user = userEvent.setup();
    await goToResult(user);
    hoisted.undoLastPortfolioImport.mockResolvedValue({
      via: 'runRecord', runId: 'run-1', exportDate: '2026-09-01',
      found: 4, notRemovable: 0, totalImported: 4,
      policyNumbers: [], policyNumbersTruncated: false, notRemovablePolicyNumbers: [],
      dryRun: true, deleted: 0, historyDeleted: 0, orphanedHistory: 0,
    });

    await user.click(screen.getByTestId('undo-import-button'));

    await waitFor(() => expect(screen.getByTestId('undo-confirm-panel')).toBeInTheDocument());
    expect(screen.getByTestId('undo-confirm-count')).toHaveTextContent('4');
    // Dry run only — the delete call has not happened.
    expect(hoisted.undoLastPortfolioImport).toHaveBeenCalledTimes(1);
    expect(hoisted.undoLastPortfolioImport).toHaveBeenLastCalledWith({});

    await user.click(screen.getByTestId('undo-confirm-button'));

    await waitFor(() => expect(hoisted.undoLastPortfolioImport).toHaveBeenCalledTimes(2));
    expect(hoisted.undoLastPortfolioImport).toHaveBeenLastCalledWith({ confirm: true, runId: 'run-1' });
  });

  it('shows the deleted count after a confirmed undo, and reloads the ledger', async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    hoisted.fileToBase64.mockResolvedValue('base64==');
    hoisted.previewPortfolioImport.mockResolvedValue(makePreview());
    hoisted.applyPortfolioImport.mockResolvedValue(makeApplyResult());
    render(<ImportPortfolioModal onClose={vi.fn()} onImported={onImported} />);
    await user.upload(screen.getByTestId('import-file-input'), xlsxFile());
    await user.click(screen.getByTestId('import-preview-button'));
    await waitFor(() => screen.getByTestId('import-step-review'));
    await user.click(screen.getByTestId('import-confirm-button'));
    await waitFor(() => screen.getByTestId('import-step-result'));
    onImported.mockClear(); // isolate the undo-triggered call from the apply-triggered call

    // `via: 'runRecord'` with THIS run's id. A result screen only exists after
    // an apply, and an apply always writes a run record, so the server always
    // has one to find — the history path is unreachable from here.
    hoisted.undoLastPortfolioImport
      .mockResolvedValueOnce({ via: 'runRecord', runId: 'run-1', exportDate: '2026-09-01', found: 4, notRemovable: 0, totalImported: 4, dryRun: true, deleted: 0, historyDeleted: 0, orphanedHistory: 0 })
      .mockResolvedValueOnce({ via: 'runRecord', runId: 'run-1', exportDate: '2026-09-01', found: 4, notRemovable: 0, totalImported: 4, dryRun: false, deleted: 4, historyDeleted: 4, orphanedHistory: 0 });

    await user.click(screen.getByTestId('undo-import-button'));
    await waitFor(() => screen.getByTestId('undo-confirm-panel'));
    await user.click(screen.getByTestId('undo-confirm-button'));

    await waitFor(() => expect(screen.getByTestId('undo-result-success')).toBeInTheDocument());
    expect(screen.getByTestId('undo-result-success')).toHaveTextContent('4');
    expect(onImported).toHaveBeenCalled();
  });

  it('a refused undo (e.g. nothing to undo) shows the refusal message in plain words', async () => {
    const user = userEvent.setup();
    await goToResult(user);
    hoisted.undoLastPortfolioImport.mockRejectedValue(
      httpsError('not-found', 'You have no imported policies to undo.')
    );

    await user.click(screen.getByTestId('undo-import-button'));

    await waitFor(() => expect(screen.getByTestId('undo-result-error')).toBeInTheDocument());
    expect(screen.getByTestId('undo-result-error')).toHaveTextContent(/no imported policies to undo/i);
    expect(screen.getByTestId('undo-result-error')).not.toHaveTextContent(/not-found|functions\//);
    // Refused before any confirmation — no confirm panel ever appeared, no delete call possible.
    expect(screen.queryByTestId('undo-confirm-panel')).not.toBeInTheDocument();
  });

  it('a mismatch on confirm (someone imported again in between) shows the refusal in plain words', async () => {
    const user = userEvent.setup();
    await goToResult(user);
    hoisted.undoLastPortfolioImport.mockResolvedValueOnce({
      via: 'runRecord', runId: 'run-1', exportDate: '2026-09-01', found: 4, notRemovable: 0, totalImported: 4,
      dryRun: true, deleted: 0, historyDeleted: 0, orphanedHistory: 0,
    });
    await user.click(screen.getByTestId('undo-import-button'));
    await waitFor(() => screen.getByTestId('undo-confirm-panel'));

    hoisted.undoLastPortfolioImport.mockRejectedValueOnce(
      httpsError('failed-precondition', 'Your last import is now import run run-2 (2026-09-05), not the runId "run-1" you confirmed. Check the count again.')
    );
    await user.click(screen.getByTestId('undo-confirm-button'));

    await waitFor(() => expect(screen.getByTestId('undo-result-error')).toBeInTheDocument());
    expect(screen.getByTestId('undo-result-error')).toHaveTextContent(/Check the count again/);
  });

  it('REFUSES when the newest run is not the one on this screen, and deletes nothing', async () => {
    // The button says "Undo this import". `undoLastPortfolioImport` does not
    // take a run to undo — it always acts on the agent's most recent un-undone
    // run, and the runId in the payload is only a confirmation token compared
    // against the run the server already picked. So echoing back whatever the
    // dry run returned ALWAYS matches, and without this guard the delete would
    // land on a DIFFERENT import while this screen showed this one's numbers.
    const user = userEvent.setup();
    await goToResult(user);                       // this screen is run-1

    hoisted.undoLastPortfolioImport.mockResolvedValue({
      via: 'runRecord', runId: 'run-2', exportDate: '2026-09-05',   // a later import
      found: 99, notRemovable: 0, totalImported: 99,
      dryRun: true, deleted: 0, historyDeleted: 0, orphanedHistory: 0,
    });

    await user.click(screen.getByTestId('undo-import-button'));

    await waitFor(() => expect(screen.getByTestId('undo-result-error')).toBeInTheDocument());
    expect(screen.getByTestId('undo-result-error')).toHaveTextContent(/no longer be undone here/i);
    expect(screen.getByTestId('undo-result-error')).toHaveTextContent(/most recent import/i);
    // No confirm panel, so the other run's count was never offered as this one's.
    expect(screen.queryByTestId('undo-confirm-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('undo-confirm-count')).not.toBeInTheDocument();
    // The dry run happened; the delete did not.
    expect(hoisted.undoLastPortfolioImport).toHaveBeenCalledTimes(1);
    expect(hoisted.undoLastPortfolioImport).toHaveBeenLastCalledWith({});
  });

  it('REFUSES when the dry run fell back to the history path — it cannot prove that is this run', async () => {
    const user = userEvent.setup();
    await goToResult(user);
    hoisted.undoLastPortfolioImport.mockResolvedValue({
      via: 'history', runId: null, exportDate: '2026-09-01',
      found: 4, notRemovable: 0, totalImported: 4,
      dryRun: true, deleted: 0, historyDeleted: 0, orphanedHistory: 0,
    });

    await user.click(screen.getByTestId('undo-import-button'));

    await waitFor(() => expect(screen.getByTestId('undo-result-error')).toBeInTheDocument());
    expect(screen.queryByTestId('undo-confirm-panel')).not.toBeInTheDocument();
    expect(hoisted.undoLastPortfolioImport).toHaveBeenCalledTimes(1);
  });
});

describe('describeImportError — never shows a raw code (ruling 5)', () => {
  it('uses the sentence the Cloud Function wrote', () => {
    expect(describeImportError(httpsError(
      'failed-precondition',
      'None of the 229 policies in that file are serviced by agent 099Z00.',
    )).detail).toMatch(/serviced by agent/);
  });

  it.each(['internal', 'unavailable', 'deadline-exceeded', 'cancelled'])(
    'falls back to plain words when the SDK message is the bare status %s', (code) => {
      // The Firebase SDK sets `message` to the status string whenever the
      // backend supplied none — a dropped connection, a cold-start timeout, an
      // unhandled throw. Passing it through would put "internal" on screen as
      // the explanation, which is exactly the raw code ruling 5 keeps away.
      const { detail } = describeImportError(httpsError(code, code));
      expect(detail).not.toBe(code);
      expect(detail).toMatch(/\s/);
    },
  );

  it('falls back when there is no message at all', () => {
    const { title, detail } = describeImportError({ code: 'functions/internal' });
    expect(title).toBe('Something went wrong');
    expect(detail).toMatch(/try again/i);
  });

  it('marks permission-denied as not retryable, everything else as retryable', () => {
    expect(describeImportError(httpsError('permission-denied', 'x y')).canRetry).toBe(false);
    expect(describeImportError(httpsError('invalid-argument', 'x y')).canRetry).toBe(true);
  });
});
