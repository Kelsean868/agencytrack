/**
 * importCopy.js — every user-facing string for the portfolio import modal, in
 * one place, so the wording is reviewable without reading JSX.
 */
export const COPY = {
  modalTitle: 'Import portfolio',

  // Pick step
  pickIntro: 'Choose the OIPA portfolio export (.xlsx) for your book of business. It is reviewed here first — nothing is added to your ledger until you confirm the import.',
  chooseFile: 'Choose a file…',
  fileHint: '.xlsx exported from OIPA, up to 5 MB',
  continueLabel: 'Review import',
  checkingFile: 'Reading file…',

  // Review step
  exportDateLabel: 'Export date',
  sheetLabel: 'Sheet',
  fileLabel: 'File',
  newLabel: 'New',
  updatedLabel: 'Updated',
  unchangedLabel: 'Unchanged',
  notYoursSuffix: 'not yours — skipped',
  notYoursExplain: 'Only policies serviced by you can be imported into your ledger.',
  testRecordsSuffix: 'test records skipped',
  planClassPendingTitle: (n) => `${n} ${n === 1 ? 'policy needs' : 'policies need'} a product confirmed`,
  planClassPendingExplain: 'The product for these policies could not be identified from the export. They import anyway — set the correct product afterward.',
  overridesTitle: 'Overrides that will apply',
  // P4e ruling 2 — head office wins, but never quietly.
  statusOverwriteTitle: (n) => `${n} ${n === 1 ? 'status you set will be changed' : 'statuses you set will be changed'} by this import`,
  statusOverwriteExplain: 'Head office is the source of truth, so these will be updated. The status you set is kept on the policy as its previous status.',
  statusOverwriteRow: (o) => `#${o.policyNumber} — ${o.from} becomes ${o.to}`,
  noConfigNotice: 'No personal import settings were found for you, so no overrides will be applied to this import.',
  nothingWrittenYet: 'Nothing is written to your ledger until you press Import.',
  cancel: 'Cancel',
  importLabel: 'Import',
  importingLabel: 'Importing…',

  // Importing step
  importingMessage: 'Writing your portfolio to the ledger…',

  // Result step
  importCompleteTitle: 'Import complete',
  createdLabel: 'Created',
  refusedNotice: (n) => `${n} could not be written — contact support with the policy numbers below.`,
  done: 'Done',

  // Expiry
  expiredMessage: 'This review expired after 15 minutes. Choose the file again to start a new review.',
  startAgain: 'Start again',

  // Undo
  undoButton: 'Undo this import',
  undoChecking: 'Checking what would be removed…',
  undoConfirmCount: (n) => `Remove ${n} ${n === 1 ? 'policy' : 'policies'} added by this import?`,
  undoConfirmButton: 'Remove policies',
  undoCancelButton: 'Keep them',
  undoDeleting: 'Removing…',
  undoSuccess: (n) => `Removed ${n} ${n === 1 ? 'policy' : 'policies'} added by this import.`,
  undoTryAgain: 'Try again',
  // Undo can only ever reach the agent's most recent import. If another import
  // has happened since this one, this screen must say so rather than quietly
  // undoing the other one.
  undoNotThisRunTitle: 'This import can no longer be undone here',
  undoNotThisRunDetail:
    'Another import has happened since this one. Undo only removes your most recent import, so it would remove that one instead. Close this and use Undo from the newest import.',
};
