/**
 * ACTIVITY_METADATA contract test — pins the table's own CONTENT.
 *
 * The other three guards each prove something about the table's RELATIONSHIPS:
 *   • Guard 1 — no twin lists exist anywhere else
 *   • Guard 2 — firestore.rules agrees with `live`
 *   • plannerTone.parity — presentation is byte-identical to pre-refactor
 * None of them proves the table is CORRECT, and six later phases read it. On the
 * five not-yet-live codes in particular, no other test touches a single field:
 * they are absent from every live export by construction, so today they could all
 * be silently wrong and the whole suite would still be green.
 *
 * ⚠ THE FAILURE THIS FILE EXISTS TO PREVENT — read before "tidying" the table.
 *
 * `UM` is `mgr: true, dev: FALSE` while `JC`/`ONE`/`RI` are `mgr: true, dev: TRUE`.
 * That looks like an oversight. It is not. It is the entire basis of Phase 5.2's
 * three-way hours split: JC/ONE/RI are COACHING (development hours, excluded from
 * the manager's own production), whereas a unit meeting is OVERHEAD — named
 * separately precisely so a week eaten by meetings reads as that rather than as
 * generic time. "Tidying" UM to `dev: true` would make booking a unit meeting
 * count as coaching, which is the inverted incentive of decision §7 coming back
 * through a different door: the manager's "% yours" would move for scheduling a
 * meeting. Nothing but this test fails when that edit is made.
 *
 * The same applies to `prepCapable: true` on `JC` — a joint call gets the 4-item
 * prep checklist; the other manager-ladder codes do not.
 *
 * Every membership below is asserted as SET EQUALITY, so a missing member and an
 * extra member both fail. If you are changing one deliberately, change it here in
 * the same commit and say why in the PR body.
 */

import { describe, it, expect } from 'vitest';
import { ACTIVITY_METADATA, ALL_CODES, LIVE_CODES } from '../activityMetadata';

const sorted = (xs) => [...xs].sort();
const codesWhere = (pred) => sorted(ALL_CODES.filter((c) => pred(ACTIVITY_METADATA[c])));

/** Keys every entry must carry. */
const REQUIRED_KEYS = [
  'label', 'name', 'family', 'counts', 'icon',
  'mgr', 'dev', 'prepCapable', 'seedsDailyField', 'live',
];

/**
 * Keys an entry MAY carry. `emphasis` defaults to 'tint'; `pickerGroup` is absent
 * on non-live codes by design (see the `live` note in the table); `pickerOrder`
 * overrides within-group sort order.
 */
const OPTIONAL_KEYS = ['emphasis', 'pickerGroup', 'pickerOrder', 'callAttributed'];

describe('ACTIVITY_METADATA — shape', () => {
  it('holds exactly the 21 expected codes, in table order', () => {
    expect(ALL_CODES).toEqual([
      'PC', 'SC', 'AI', 'FFI', 'CI', 'SALE', 'FREE',
      'PROP', 'PAPER', 'COLL', 'DEL',
      'SEM', 'TRADE', 'MTG', 'TRAIN', 'ADMIN',
      'JC', 'ONE', 'RI', 'UM', 'SUGGESTION',
    ]);
  });

  // This is what closes the silent-typo class: `emphassis: 'fill'` would today
  // fall back to 'tint' with nothing failing — a rule-11 violation sitting inside
  // the file that enforces rule 11. It guards every FUTURE field too, not just
  // the ones that exist now.
  it.each(ALL_CODES)('%s carries every required key and no unrecognised key', (code) => {
    const keys = Object.keys(ACTIVITY_METADATA[code]);
    const missing = REQUIRED_KEYS.filter((k) => !keys.includes(k));
    const unknown = keys.filter((k) => !REQUIRED_KEYS.includes(k) && !OPTIONAL_KEYS.includes(k));
    expect(
      { missing, unknown },
      `${code}: an unrecognised key is almost always a typo (it would fall back `
      + 'silently); a missing key means a consumer reads undefined.',
    ).toEqual({ missing: [], unknown: [] });
  });

  it.each(ALL_CODES)('%s has correctly typed values', (code) => {
    const m = ACTIVITY_METADATA[code];
    expect(typeof m.label).toBe('string');
    expect(typeof m.name).toBe('string');
    expect(typeof m.icon).toBe('string');
    expect(m.name.length).toBeGreaterThan(0);
    for (const flag of ['counts', 'mgr', 'dev', 'prepCapable', 'live']) {
      expect(typeof m[flag], `${code}.${flag} must be a real boolean`).toBe('boolean');
    }
    expect(m.seedsDailyField === null || typeof m.seedsDailyField === 'string').toBe(true);
    if ('emphasis' in m) expect(['tint', 'fill']).toContain(m.emphasis);
  });

  // plannerService.test.js:96 enforces this too, but only over APPOINTMENT_TYPES,
  // which is LIVE-ONLY. Without this, a non-live code could carry a 7-char label
  // that breaks nothing until the day it goes live — inside the phase that has
  // other things to worry about.
  it.each(ALL_CODES)('%s keeps the ≤5-char dense-card label budget', (code) => {
    const { label } = ACTIVITY_METADATA[code];
    expect(label.length, `${code}: label "${label}" is ${label.length} chars`).toBeLessThanOrEqual(5);
  });
});

describe('ACTIVITY_METADATA — semantic axes (set equality both directions)', () => {
  it('live — the codes in both deployed firestore.rules allowlists', () => {
    expect(codesWhere((m) => m.live)).toEqual(sorted([
      'PC', 'SC', 'AI', 'FFI', 'CI', 'SALE', 'FREE',
      'PROP', 'PAPER', 'COLL', 'DEL',
      'SEM', 'TRADE', 'MTG', 'TRAIN', 'ADMIN',
    ]));
    expect(sorted(LIVE_CODES)).toEqual(codesWhere((m) => m.live));
  });

  it('counts — selling activity (SEM/TRADE are IN; the five new codes are not)', () => {
    expect(codesWhere((m) => m.counts))
      .toEqual(sorted(['PC', 'SC', 'AI', 'FFI', 'CI', 'SALE', 'SEM', 'TRADE']));
  });

  it('mgr — manager-ladder activity', () => {
    expect(codesWhere((m) => m.mgr)).toEqual(sorted(['JC', 'ONE', 'RI', 'UM']));
  });

  // ⚠ UM is deliberately ABSENT here while present in `mgr` above. See the header.
  it('dev — coaching hours, excluded from own production; UM is overhead, NOT coaching', () => {
    expect(
      codesWhere((m) => m.dev),
      'If UM appears here, booking a unit meeting has started counting as coaching '
      + 'and the manager\'s "% yours" moves for scheduling a meeting. That is the '
      + 'inverted incentive decision §7 exists to prevent — see this file\'s header.',
    ).toEqual(sorted(['JC', 'ONE', 'RI']));

    expect(ACTIVITY_METADATA.UM.mgr).toBe(true);
    expect(ACTIVITY_METADATA.UM.dev).toBe(false);
  });

  it('prepCapable — the 4-item prep checklist (03-DATA-MODEL.md names these four)', () => {
    expect(codesWhere((m) => m.prepCapable)).toEqual(sorted(['AI', 'FFI', 'CI', 'JC']));
  });

  // ⚠ This axis decides how the ACTIVITY LEDGER counts. A code marked
  // callAttributed has its blocks treated as scheduled CAPACITY — the ledger
  // counts the CALLS inside the window, `max(block.dials, itemised)`, and pools
  // all such codes into one `CALLS` row. Marking a non-call code here would make
  // its blocks stop counting one-per-block and silently vanish into that pool;
  // UNmarking PC or SC would sum a container with its contents, which is the
  // defect that put a false "MOSTLY DECLARED" verdict on a named agent.
  it('callAttributed — PC and SC only; drives the ledger pooled CALLS row', () => {
    expect(codesWhere((m) => m.callAttributed === true)).toEqual(sorted(['PC', 'SC']));
    // Omitted entirely on every other code — absent, not `false`.
    for (const code of ALL_CODES.filter((c) => !['PC', 'SC'].includes(c))) {
      expect('callAttributed' in ACTIVITY_METADATA[code], `${code} must omit callAttributed`)
        .toBe(false);
    }
  });

  it("emphasis 'fill' — CI alone; the money type, same family as AI/FFI", () => {
    expect(codesWhere((m) => m.emphasis === 'fill')).toEqual(['CI']);
    expect(ACTIVITY_METADATA.CI.family).toBe('ladder');
    expect(ACTIVITY_METADATA.AI.family).toBe('ladder');
    expect(ACTIVITY_METADATA.FFI.family).toBe('ladder');
  });

  it('family — the grouping key Phase 2.1 ledger rows and 5.2 hours split read', () => {
    const byFamily = {};
    for (const code of ALL_CODES) {
      (byFamily[ACTIVITY_METADATA[code].family] ??= []).push(code);
    }
    const normalised = Object.fromEntries(
      Object.entries(byFamily).map(([f, cs]) => [f, sorted(cs)]),
    );
    expect(normalised).toEqual({
      call: sorted(['PC', 'SC', 'SEM', 'TRADE']),
      ladder: sorted(['AI', 'FFI', 'CI']),
      sale: ['SALE'],
      support: sorted(['PROP', 'PAPER', 'COLL', 'DEL']),
      meeting: sorted(['MTG', 'JC', 'ONE', 'RI']),
      admin: sorted(['TRAIN', 'ADMIN', 'FREE', 'UM']),
      suggestion: ['SUGGESTION'],
    });
  });

  it('seedsDailyField — the exact plan→Daily-Capture mapping', () => {
    const mapped = Object.fromEntries(
      ALL_CODES
        .filter((c) => ACTIVITY_METADATA[c].seedsDailyField !== null)
        .map((c) => [c, ACTIVITY_METADATA[c].seedsDailyField]),
    );
    // SALE is deliberately absent — it carries as apps + API, handled separately.
    expect(mapped).toEqual({
      PC: 'dials',
      SC: 'telContacts',
      AI: 'qualifiedApproaches',
      FFI: 'ffiConducted',
      CI: 'ciConducted',
    });
  });

  it('pickerGroup — present on every live code, ABSENT on every non-live one', () => {
    const grouped = {};
    for (const code of ALL_CODES) {
      const g = ACTIVITY_METADATA[code].pickerGroup;
      if (g !== undefined) (grouped[g] ??= []).push(code);
    }
    expect(Object.fromEntries(Object.entries(grouped).map(([g, cs]) => [g, sorted(cs)]))).toEqual({
      prospect: sorted(['PC', 'SC', 'AI', 'FFI', 'CI', 'SALE']),
      support: sorted(['PROP', 'PAPER', 'COLL', 'DEL']),
      block: sorted(['SEM', 'TRADE', 'MTG', 'TRAIN', 'ADMIN', 'FREE']),
    });

    // The absence is the forcing function: plannerService.test.js:99-105 asserts
    // every APPOINTMENT_TYPES entry has a group, so flipping a code live without
    // assigning one fails loudly rather than landing it in the default group.
    for (const code of ALL_CODES.filter((c) => !ACTIVITY_METADATA[c].live)) {
      expect(
        'pickerGroup' in ACTIVITY_METADATA[code],
        `${code} is not live and must NOT carry a pickerGroup — its absence is what `
        + 'forces the phase that ships it to choose one deliberately.',
      ).toBe(false);
    }
  });

  it('the not-yet-live five are exactly JC ONE RI UM SUGGESTION', () => {
    expect(codesWhere((m) => !m.live)).toEqual(sorted(['JC', 'ONE', 'RI', 'UM', 'SUGGESTION']));
  });
});
