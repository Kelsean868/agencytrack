import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * portfolioImportService — P4c browser wrappers over the three DEPLOYED
 * Cloud Functions that own the OIPA portfolio import (P4a/P4b). This file
 * does no parsing and no business logic of its own — RULING 1 keeps the
 * spreadsheet reader and the import rules server-side. The browser only
 * sends the file and relays what the callables return.
 */

/** Courtesy-only client check; the Cloud Function is the real limit (previewImport.js). */
export const MAX_CLIENT_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Reads a File as base64, stripping the `data:...;base64,` prefix that
 * `FileReader.readAsDataURL` adds — the callable expects the bare payload.
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/** Writes nothing — returns the plan for the agent to review. */
export async function previewPortfolioImport({ fileBase64, fileName }) {
  const fn = httpsCallable(functions, 'previewPortfolioImport');
  const result = await fn({ fileBase64, fileName });
  return result.data;
}

/** Writes exactly the plan `planId` refers to. */
export async function applyPortfolioImport({ planId }) {
  const fn = httpsCallable(functions, 'applyPortfolioImport');
  const result = await fn({ planId });
  return result.data;
}

/**
 * Dry run by default (writes nothing). Pass `{ confirm: true, runId }` or
 * `{ confirm: true, exportDate }` — whichever the dry run's `via` field calls
 * for — to actually delete. Always echo back exactly what the dry run
 * returned; the callable refuses a mismatch rather than guessing.
 */
export async function undoLastPortfolioImport(payload = {}) {
  const fn = httpsCallable(functions, 'undoLastPortfolioImport');
  const result = await fn(payload);
  return result.data;
}

const TITLE_BY_CODE = {
  'invalid-argument': "That file can't be used",
  'failed-precondition': "That import can't proceed",
  'permission-denied': "You don't have permission",
  'deadline-exceeded': 'Review expired',
  'not-found': 'Nothing to undo',
  'resource-exhausted': 'File too large',
};

const DETAIL_BY_CODE = {
  'invalid-argument': 'Check the file is an .xlsx export from OIPA, under 5 MB, and has an "as at" date in its title row.',
  'failed-precondition': 'Check the details and try again.',
  'permission-denied': "Your account isn't set up to import a portfolio.",
  'deadline-exceeded': 'That review is more than 15 minutes old. Start again with a fresh review.',
  'not-found': 'There is nothing here to act on.',
  'resource-exhausted': 'That file is too large to review right now. Try a smaller export.',
};

/**
 * Maps a callable error to plain words for the agent. The Cloud Functions
 * (previewImport.js / applyImport.js / undoImport.js) already write their
 * `HttpsError` messages in plain language for every ruling-5 case, so the
 * server message is preferred whenever present; the code-keyed fallback below
 * only covers the rare case where a message is missing. The raw error code is
 * never shown to the agent.
 */
/**
 * Is this message a SENTENCE somebody wrote for a human, or a machine token?
 *
 * The Firebase SDK sets `message` to the bare status string — `internal`,
 * `unavailable`, `deadline-exceeded` — whenever the backend did not supply one,
 * which happens for every failure the Cloud Function did not anticipate:
 * a dropped connection, a cold-start timeout, an unhandled throw. Passing that
 * straight through puts `internal` on screen as the explanation, which is the
 * raw code ruling 5 exists to keep away from the agent.
 *
 * Every message the three callables DO write is a full sentence with spaces, so
 * requiring whitespace separates the two reliably without maintaining a list of
 * SDK tokens that would go stale.
 */
function isHumanMessage(message, code) {
  if (!message) return false;
  if (message === code || message === `functions/${code}`) return false;
  return /\s/.test(message);
}

export function describeImportError(error) {
  const rawCode = typeof error?.code === 'string' ? error.code : '';
  const code = rawCode.startsWith('functions/') ? rawCode.slice('functions/'.length) : rawCode;
  const message = typeof error?.message === 'string' ? error.message.trim() : '';

  const title = TITLE_BY_CODE[code] || 'Something went wrong';
  const detail = isHumanMessage(message, code)
    ? message
    : DETAIL_BY_CODE[code] || 'Please try again, or contact support if this continues.';
  // permission-denied is the one case retrying the same action cannot fix.
  const canRetry = code !== 'permission-denied';

  return { title, detail, canRetry };
}
