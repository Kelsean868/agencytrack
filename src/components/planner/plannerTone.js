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

export const TYPE_TONE = {
  PC:   { chip: 'bg-card-raised text-ink-muted border border-border',       dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  SC:   { chip: 'bg-card-raised text-ink-muted border border-border',       dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
  AI:   { chip: 'bg-primary/10 text-primary border border-primary/20',      dot: 'bg-primary', bar: 'border-l-primary' },
  FFI:  { chip: 'bg-primary/10 text-primary border border-primary/20',      dot: 'bg-primary', bar: 'border-l-primary' },
  CI:   { chip: 'bg-primary text-white dark:bg-primary-dark border border-primary dark:border-primary-dark', dot: 'bg-white', bar: 'border-l-primary' },
  SALE: { chip: 'bg-gold/20 text-gold-ink border border-gold/50',           dot: 'bg-gold',    bar: 'border-l-gold' },
  FREE: { chip: 'bg-transparent text-ink-muted border border-dashed border-border', dot: 'bg-ink-dim', bar: 'border-l-ink-dim' },
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
