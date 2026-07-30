/**
 * TYPE_TONE derivation parity lock.
 *
 * P0-A replaced the hand-maintained 16-entry TYPE_TONE literal with a derivation
 * over ACTIVITY_METADATA (hue from `family`, solid/dashed from `counts`,
 * fill-vs-tint from `emphasis`). §2 of the brief calls that refactor
 * "behaviour-preserving" — but NOTHING in the suite pinned the actual class
 * strings. plannerService.test.js:99-105 only asserts each entry is truthy, so a
 * derivation that produced entirely wrong classes for all 16 types would have
 * passed the whole suite while silently restyling every chip in the planner.
 *
 * FIXTURE below is the map transcribed VERBATIM from plannerTone.js at
 * origin/staging (7e2c112b), before the derivation landed. It is a captured
 * snapshot, deliberately hardcoded and deliberately NOT derived from the same
 * source it is checking — that is the whole point.
 *
 * If this test fails, the derivation changed a rendered colour. Either the
 * change was intended (update the fixture in the same commit, and say what moved
 * and why) or the table edit had a side-effect nobody wanted. Do not "fix" a
 * failure by regenerating the fixture from the derivation.
 */

import { describe, it, expect } from 'vitest';
import { TYPE_TONE } from '../plannerTone';

// Verbatim capture — origin/staging:src/components/planner/plannerTone.js:48-73.
const FIXTURE = {
  PC:    { chip: 'bg-card-raised text-ink-muted border border-border',      dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  SC:    { chip: 'bg-card-raised text-ink-muted border border-border',      dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  AI:    { chip: 'bg-primary/10 text-primary border border-primary/20',     dot: 'bg-primary', bar: 'border-l-primary' },
  FFI:   { chip: 'bg-primary/10 text-primary border border-primary/20',     dot: 'bg-primary', bar: 'border-l-primary' },
  CI:    { chip: 'bg-primary text-white dark:bg-primary-dark border border-primary dark:border-primary-dark', dot: 'bg-white', bar: 'border-l-primary' },
  SALE:  { chip: 'bg-gold/20 text-gold-ink border border-gold/50',          dot: 'bg-gold',    bar: 'border-l-gold' },
  FREE:  { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  SEM:   { chip: 'bg-card-raised text-ink-muted border border-border',      dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  TRADE: { chip: 'bg-card-raised text-ink-muted border border-border',      dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  PROP:  { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  PAPER: { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  COLL:  { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  DEL:   { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  MTG:   { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  TRAIN: { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  ADMIN: { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
};

describe('TYPE_TONE derivation parity (pre-P0-A capture)', () => {
  it('derives the pre-refactor map byte-for-byte', () => {
    expect(TYPE_TONE).toEqual(FIXTURE);
  });

  it('covers exactly the 16 live codes — no more, no less', () => {
    expect(Object.keys(TYPE_TONE).sort()).toEqual(Object.keys(FIXTURE).sort());
  });

  // The one distinction family+borderStyle alone could not express: CI shares
  // AI/FFI's hue and solid border but is a FILL, not a tint. If `emphasis` were
  // dropped from the table these three would collapse into one another and the
  // deep-equal above would fail — this names the reason so the next reader
  // knows what `emphasis` is for.
  it('keeps CI distinct from the rest of its own ladder family', () => {
    expect(TYPE_TONE.CI.chip).not.toBe(TYPE_TONE.AI.chip);
    expect(TYPE_TONE.AI.chip).toBe(TYPE_TONE.FFI.chip);
    expect(TYPE_TONE.CI.bar).toBe(TYPE_TONE.AI.bar); // same hue — only the fill differs
  });
});
