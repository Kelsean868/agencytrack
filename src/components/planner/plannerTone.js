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
 */

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
// says what it is; the border style says whether it counts. `SELLING_TYPE_KEYS`
// in plannerService.js is the authority for the second half and must stay in
// step with the solid/dashed split here.
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
// than changing meaning.
export const TYPE_TONE = {
  // Calls family — neutral SOLID (counts).
  PC:    { chip: 'bg-card-raised text-ink-muted border border-border',      dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  SC:    { chip: 'bg-card-raised text-ink-muted border border-border',      dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  // Interview ladder — teal.
  AI:    { chip: 'bg-primary/10 text-primary border border-primary/20',     dot: 'bg-primary', bar: 'border-l-primary' },
  FFI:   { chip: 'bg-primary/10 text-primary border border-primary/20',     dot: 'bg-primary', bar: 'border-l-primary' },
  CI:    { chip: 'bg-primary text-white dark:bg-primary-dark border border-primary dark:border-primary-dark', dot: 'bg-white', bar: 'border-l-primary' },
  // The money type — gold.
  SALE:  { chip: 'bg-gold/20 text-gold-ink border border-gold/50',          dot: 'bg-gold',    bar: 'border-l-gold' },
  // Legacy catch-all block — neutral DASHED (does not count).
  FREE:  { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  // Seminar + tradeshow — prospecting activity, so they join the CALLS family
  // (neutral SOLID) even though the picker files them under Block.
  SEM:   { chip: 'bg-card-raised text-ink-muted border border-border',      dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  TRADE: { chip: 'bg-card-raised text-ink-muted border border-border',      dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  // Support work — neutral DASHED (does not count).
  PROP:  { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  PAPER: { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  COLL:  { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  DEL:   { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  // Non-production blocks — neutral DASHED (does not count).
  MTG:   { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  TRAIN: { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  ADMIN: { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
};

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
  return STATUS_BAR[status] ?? (TYPE_TONE[type] ?? TYPE_TONE.FREE).bar;
}
