/**
 * Planner tone maps — the single source of appointment TYPE / STATUS hue.
 *
 * Lives apart from `plannerPrimitives.jsx` because that file may only export
 * components (react-refresh/only-export-components); the maps and the
 * `typeBarClass` helper are consumed by both the chip primitive and the dense
 * week card, so duplicating them would let the two drift.
 *
 * Tone mapping (handoff §6): calls (P.C/S.C) read low-emphasis neutral; the
 * interview ladder (A.I/F.F.I) reads teal; C.I is solid teal (the money type,
 * white text paired with dark:bg-primary-dark per UI rule D6); Sale reads gold
 * (strong gold tint + gold-ink text, AA-safe — a full gold fill would fail
 * AA-large for the label, so "solid gold" is expressed as a strong tint + dot);
 * Free is a dashed neutral block. The repo ships no violet token, so the
 * handoff's violet "call" hue maps to the neutral family (documented divergence).
 *
 * `bar` is the dense (week-column) card's 3px left rail — the mockup's
 * DeskApptChip conveys TYPE by a coloured left border rather than repeating a
 * chip at a width that cannot hold one. Tokens only; mirrors each `chip` hue.
 *
 * TYPE_TONE IS DERIVED from ACTIVITY_METADATA — hue from `family`, solid/dashed
 * from `counts`, and fill-vs-tint from `emphasis`. Adding an activity code must
 * never require an edit here. The derivation is pinned byte-for-byte against the
 * pre-derivation map by plannerTone.parity.test.js.
 */

import {
  ACTIVITY_METADATA,
  LIVE_CODES,
  borderStyleOf,
  emphasisOf,
} from '../../constants/activityMetadata';
import { devAssertKnown } from '../../utils/devAssertKnown';

// ── SOLID vs DASHED is SEMANTIC, not decorative ──────────────────────────────
// The nine types added alongside the original seven are all NEUTRAL — none gets
// a new hue. They are separated by BORDER STYLE, extending the convention the
// shipped map already had (PC/SC are neutral SOLID; FREE is neutral DASHED):
//
//   neutral SOLID  → counts toward selling activity   (PC, SC, SEM, TRADE)
//   neutral DASHED → does NOT count                   (PROP, PAPER, COLL, DEL,
//                                                      MTG, TRAIN, ADMIN, FREE)
//
// This is deliberate, not an oversight — do not "fix" SEM/TRADE to match the
// other block types, and do not give the support types a hue. The chip LABEL
// says what it is; the border style says whether it counts.
//
// Border style is now DERIVED from the table's `counts` flag (borderStyleOf), so
// it and `SELLING_TYPE_KEYS` — also derived from `counts` — cannot drift. The
// hand-maintained "keep these two in step" warning that used to live here is
// gone with the twin it guarded.
//
// The durable decision is FAMILY MEMBERSHIP, not hue: SEM/TRADE belong to the
// CALLS family (with PC/SC). The canonical mockups colour that family violet;
// the app renders it neutral per the divergence stated in this file's header
// comment above. ⚠ THAT HEADER'S STATED CAUSE — "the repo ships no violet
// token" — IS NOW FALSE: the token ships at exact DS parity as `--color-ink` /
// `--color-ink-tint` (src/index.css:155-157, :386-388). It is left uncorrected
// here on purpose; correcting it is bundled into the MEDIUM Track J conformance
// FU that restores violet (docs/FOLLOW_UPS.md), because the fix and the comment
// must land together. If violet is later restored to the calls family, SEM/TRADE
// inherit it automatically and the solid/dashed distinction sharpens rather
// than changing meaning. That FU is now a one-field change: the hue moves in
// FAMILY_HUE below and every member of the family follows.

/**
 * Hue per family. `neutral` covers every family that renders un-hued today —
 * calls, support work, meetings and admin — which the solid/dashed axis then
 * separates. Phase 2.3 owns `suggestion`'s final treatment; neutral until then.
 */
const FAMILY_HUE = {
  call: 'neutral',
  ladder: 'primary',
  sale: 'gold',
  support: 'neutral',
  meeting: 'neutral',
  admin: 'neutral',
  suggestion: 'neutral',
};

/** chip / dot / bar recipes, keyed by the derived (hue, borderStyle, emphasis). */
function toneFor(code) {
  const meta = ACTIVITY_METADATA[code];
  const hue = FAMILY_HUE[meta.family];
  const dashed = borderStyleOf(code) === 'dashed';

  if (hue === 'primary') {
    return emphasisOf(code) === 'fill'
      ? {
        chip: 'bg-primary text-white dark:bg-primary-dark border border-primary dark:border-primary-dark',
        dot: 'bg-white',
        bar: 'border-l-primary',
      }
      : {
        chip: 'bg-primary/10 text-primary border border-primary/20',
        dot: 'bg-primary',
        bar: 'border-l-primary',
      };
  }

  if (hue === 'gold') {
    return {
      chip: 'bg-gold/20 text-gold-ink border border-gold/50',
      dot: 'bg-gold',
      bar: 'border-l-gold',
    };
  }

  // Neutral: the counts/does-not-count split is the whole signal.
  return {
    chip: dashed
      ? 'bg-transparent text-ink-muted border border-dashed border-border'
      : 'bg-card-raised text-ink-muted border border-border',
    dot: 'bg-ink-dim',
    bar: 'border-l-ink-dim',
  };
}

export const TYPE_TONE = Object.freeze(
  Object.fromEntries(LIVE_CODES.map((code) => [code, Object.freeze(toneFor(code))])),
);

// Retired statuses override the type rail so a tombstone reads as a tombstone
// at a glance — the dense card has no room for a status pill (mockup parity).
const STATUS_BAR = {
  cancelled: 'border-l-danger',
  postponed: 'border-l-warning',
};

/**
 * typeBarClass — the dense card's left-rail border colour for an appointment.
 * Status wins over type for retired appointments (cancelled / postponed).
 */
export function typeBarClass(type, status) {
  if (!STATUS_BAR[status]) devAssertKnown(TYPE_TONE, type, 'TYPE_TONE');
  return STATUS_BAR[status] ?? (TYPE_TONE[type] ?? TYPE_TONE.FREE).bar;
}
