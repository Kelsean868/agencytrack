/**
 * Guard 2 — firestore.rules allowlists mirror the live table.
 *
 * This is the one place v3 rule 1 ("adding a code requires zero edits anywhere
 * except the table") is provably false: `firestore.rules` cannot import JS, so
 * its two `d.type in [...]` allowlists are literal copies of the code set. They
 * are therefore GUARDED rather than derived — the divergence is made loud here
 * instead of being discovered in production as a rejected write.
 *
 * Asserts SET equality against LIVE_CODES, in both directions:
 *   • a live code missing from the rules  → every write of it is REJECTED
 *   • a rules code that is not live       → the rules permit something the app
 *                                            has no table entry for
 * A count check would miss a same-size swap; the existing cheap canary at
 * plannerService.test.js:89 (`TYPE_KEYS` has length 16) still runs, and this
 * supersedes it in generality.
 *
 * NOTE the regex must be MULTI-LINE: both literals span three physical lines in
 * firestore.rules. `[^\]]*` with a default-flags regex matches them by accident
 * today and would keep working, but `[\s\S]` states the intent.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LIVE_CODES, ALL_CODES, ACTIVITY_METADATA } from '../../constants/activityMetadata.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RULES = resolve(ROOT, 'firestore.rules');

/** Every `d.type in [ ... ]` allowlist in firestore.rules, with its line number. */
function extractTypeAllowlists(src) {
  const out = [];
  const re = /d\.type\s+in\s+\[([\s\S]*?)\]/g;
  for (let m; (m = re.exec(src)) !== null;) {
    const codes = [...m[1].matchAll(/'([A-Z_]+)'/g)].map((c) => c[1]);
    out.push({ line: src.slice(0, m.index).split('\n').length, codes });
  }
  return out;
}

const source = readFileSync(RULES, 'utf-8');
const allowlists = extractTypeAllowlists(source);

const FIX = 'Fix: edit BOTH d.type allowlists in firestore.rules to match, land it '
  + 'as its own HUMAN-MERGE PR (rules are never green-channel), then the dispatcher '
  + 'runs `firebase deploy --only firestore:rules`. Only flip a code to `live: true` '
  + 'in activityMetadata.js once that deploy has happened — TYPE_KEYS is a write '
  + 'gate, and a code that is live in the app but absent from the deployed rules '
  + 'has every write rejected by Firestore.';

describe('Guard 2 — firestore.rules type allowlists mirror ACTIVITY_METADATA', () => {
  it('finds exactly the two known allowlists (validApptWrite + validTemplateWrite)', () => {
    expect(
      allowlists.length,
      'Expected exactly 2 `d.type in [...]` allowlists in firestore.rules '
      + '(validApptWrite + validTemplateWrite). A third write path gating on type '
      + 'must be added to this guard, not left unchecked.\n' + FIX,
    ).toBe(2);
  });

  it.each([0, 1])('allowlist #%i is set-equal to the live codes', (i) => {
    const found = allowlists[i];
    const inRules = [...found.codes].sort();
    const live = [...LIVE_CODES].sort();

    const missingFromRules = live.filter((c) => !inRules.includes(c));
    const notLive = inRules.filter((c) => !live.includes(c));

    expect(
      { missingFromRules, notLive },
      `firestore.rules:${found.line} has drifted from the live activity codes.\n`
      + `  live but NOT in rules (writes will be REJECTED): ${missingFromRules.join(', ') || '—'}\n`
      + `  in rules but NOT live (rules permit an unknown type): ${notLive.join(', ') || '—'}\n`
      + FIX,
    ).toEqual({ missingFromRules: [], notLive: [] });
  });

  it('both allowlists are identical to each other', () => {
    expect(
      [...allowlists[0].codes].sort(),
      'validApptWrite and validTemplateWrite must gate on the same set — a '
      + 'template that can be saved but not booked (or vice versa) is a broken '
      + 'round trip.\n' + FIX,
    ).toEqual([...allowlists[1].codes].sort());
  });

  it('names the not-yet-live codes so the pending set is explicit, never implicit', () => {
    const pending = ALL_CODES.filter((c) => !ACTIVITY_METADATA[c].live);
    // Documented, asserted state — not a tolerance. These are deliberately absent
    // from the rules AND from every live export; each ships with its own brief.
    expect(pending).toEqual(['JC', 'ONE', 'RI', 'UM', 'SUGGESTION']);
    for (const code of pending) {
      expect(
        allowlists[0].codes.includes(code),
        `${code} is not live but IS in firestore.rules — flip it to live: true in `
        + 'activityMetadata.js (and give it a pickerGroup), or remove it from the rules.',
      ).toBe(false);
    }
  });
});
