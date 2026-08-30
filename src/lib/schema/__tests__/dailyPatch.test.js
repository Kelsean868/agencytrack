import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  INGEST_WRITTEN_FIELDS,
  isIngestWritten,
  buildDailyPatch,
  detectConflicts,
  describeConflict,
} from '../dailyPatch.js';

const require = createRequire(import.meta.url);

describe('INGEST_WRITTEN_FIELDS agrees with the endpoint that writes them', () => {
  // THE DRIFT GUARD. outcomeMap.js derives WRITABLE_FIELDS by running every
  // legal effect set through mapEffects, so it cannot be stale. This list is
  // hand-kept because CJS/ESM keeps them apart. If somebody adds an effect
  // there and forgets here, that field silently starts losing its ingested
  // value again on the next Daily Capture save — so it fails HERE instead.
  it('matches WRITABLE_FIELDS, collapsing dotted leaves to their top-level key', () => {
    const { WRITABLE_FIELDS } = require('../../../../functions/callActivity/outcomeMap.js');
    const topLevel = [...new Set(WRITABLE_FIELDS.map((f) => f.split('.')[0]))].sort();
    expect(topLevel).toEqual([...INGEST_WRITTEN_FIELDS].sort());
  });
});

describe('buildDailyPatch', () => {
  const data = {
    dials: 3,
    telContacts: 2,
    prospectingLettersSent: 7,
    officeHours: 4,
    dialsByType: { cold: 0, referral: 0, followUp: 0, seminarTradeshow: 0 },
    newBusiness: { apps: 1, api: 500 },
  };

  it('writes only the touched keys', () => {
    expect(buildDailyPatch(data, ['prospectingLettersSent'])).toEqual({
      prospectingLettersSent: 7,
    });
  });

  it('leaves an untouched call field OUT, so merge:true preserves the ingest', () => {
    // The whole point. The agent typed letters and hours; thirty KQM dials
    // landed while they did. `dials` must not appear in the write at all.
    const patch = buildDailyPatch(data, ['prospectingLettersSent', 'officeHours']);
    expect(patch).not.toHaveProperty('dials');
    expect(patch).not.toHaveProperty('telContacts');
  });

  it('writes a touched nested map whole', () => {
    expect(buildDailyPatch(data, ['newBusiness'])).toEqual({
      newBusiness: { apps: 1, api: 500 },
    });
  });

  it('NEVER writes dialsByType, even if marked dirty', () => {
    // No input writes it. Writing the form's zeroes over the ingest's split
    // would flatten cold/referral/followUp and break the partition the endpoint
    // property-tests.
    expect(buildDailyPatch(data, ['dialsByType', 'dials'])).toEqual({ dials: 3 });
  });

  it('ignores keys absent from the form state, and an empty dirty set', () => {
    expect(buildDailyPatch(data, ['nonsense'])).toEqual({});
    expect(buildDailyPatch(data, [])).toEqual({});
    expect(buildDailyPatch(null, ['dials'])).toEqual({});
  });

  it('preserves an explicit zero the agent typed', () => {
    // A typed 0 is a statement ("I made no calls today"), not an absence.
    expect(buildDailyPatch({ dials: 0 }, ['dials'])).toEqual({ dials: 0 });
  });
});

describe('detectConflicts', () => {
  it('flags an ingest field that moved while the form was open', () => {
    const conflicts = detectConflicts(
      { dials: 0 },      // at load
      { dials: 14 },     // in Firestore now
      ['dials'],
      { dials: 3 },      // what the agent typed
    );
    expect(conflicts).toEqual([{ field: 'dials', wasAtLoad: 0, isNow: 14, yours: 3 }]);
  });

  it('says nothing when the agent never touched the field', () => {
    // Not a conflict — the patch will simply omit it and the ingest survives.
    expect(detectConflicts({ dials: 0 }, { dials: 14 }, ['officeHours'], {})).toEqual([]);
  });

  it('says nothing when the field did not move', () => {
    expect(detectConflicts({ dials: 5 }, { dials: 5 }, ['dials'], { dials: 9 })).toEqual([]);
  });

  it('ignores agent-owned fields that moved (another tab is a different problem)', () => {
    expect(detectConflicts({ officeHours: 1 }, { officeHours: 6 }, ['officeHours'], {})).toEqual([]);
  });

  it('treats a missing baseline as zero rather than throwing', () => {
    const conflicts = detectConflicts(undefined, { telContacts: 4 }, ['telContacts'], {});
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].wasAtLoad).toBe(0);
  });

  it('returns nothing when the doc could not be re-read', () => {
    expect(detectConflicts({ dials: 0 }, null, ['dials'], { dials: 3 })).toEqual([]);
  });
});

describe('the ladder fields — where the two writers genuinely collide', () => {
  // These five are the ONLY entries in the list that agents also type by hand,
  // because until the ladder slice nothing else could write them. If one drops
  // off the list, Daily Capture silently starts flattening the meetings KQM
  // logged — the same bug slice D fixed for dials, on the fields agents care
  // most about, and with no error anywhere.
  const LADDER = [
    'qualifiedApproaches',
    'solutionPresentations',
    'ffiConducted',
    'ciConducted',
    'policiesDelivered',
  ];

  it.each(LADDER)('%s is ingest-written', (field) => {
    expect(isIngestWritten(field)).toBe(true);
  });

  it.each(LADDER)('%s is omitted from the patch when untouched', (field) => {
    // The whole mechanism, per field: a form carrying a stale 0 must not write
    // it over the meetings that landed while the form was open.
    expect(buildDailyPatch({ [field]: 0, officeHours: 4 }, ['officeHours']))
      .toEqual({ officeHours: 4 });
  });

  it.each(LADDER)('%s still wins when the agent DOES type it, and is flagged', (field) => {
    expect(buildDailyPatch({ [field]: 3 }, [field])).toEqual({ [field]: 3 });
    const conflicts = detectConflicts({ [field]: 0 }, { [field]: 1 }, [field], { [field]: 3 });
    expect(conflicts).toEqual([{ field, wasAtLoad: 0, isNow: 1, yours: 3 }]);
    // ...and the banner names it in the agent's own words, not the schema key.
    expect(describeConflict(conflicts[0])).not.toContain(field);
  });
});

describe('isIngestWritten / describeConflict', () => {
  it('knows which side of the line a field is on', () => {
    expect(isIngestWritten('dials')).toBe(true);
    expect(isIngestWritten('serviceCalls')).toBe(true);
    expect(isIngestWritten('ffiConducted')).toBe(true);
    expect(isIngestWritten('officeHours')).toBe(false);
    expect(isIngestWritten('prospectingLettersSent')).toBe(false);
  });

  it('describes a conflict in the agent’s own words', () => {
    expect(describeConflict({ field: 'dials', wasAtLoad: 0, isNow: 14, yours: 3 }))
      .toBe('Dials: KQM Calls logged 14 since you opened this; your entry says 3.');
  });
});
