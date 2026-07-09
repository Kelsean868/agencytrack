/**
 * awardProvenance.js — pure derivation for the Awards provenance SHELL
 * (item 3.4, flag `awardsProvenance`).
 *
 * The awards engine already computes an award's PRIMARY criterion `current`
 * (the settled production banked toward the award) and `target`. Those are the
 * honestly-derivable inputs, so the provenance panel is built from them.
 *
 * HONESTY NOTES:
 *  - Source is stated ACTUALLY, not aspirationally. The awards engine reads the
 *    agent's Policy Ledger when `usesPolicyLedger` is set, otherwise it reads
 *    confirmed settlements — the chip reflects whichever is live for this agent.
 *  - Per-campaign attribution (the mockup's base-vs-campaign split) is NOT
 *    available from the awards engine inputs, so it is surfaced as a documented
 *    PENDING row rather than a fabricated split. The base (settled) segment is
 *    real; the campaign segment is not invented.
 */

/**
 * deriveAwardProvenance(award, opts) — provenance model for one award, or null
 * when the award has no primary criterion to explain.
 *
 * @param {object} award   — an award row from computeAgentAwards (+ criteria[])
 * @param {{ usesPolicyLedger?: boolean }} [opts]
 */
export function deriveAwardProvenance(award, { usesPolicyLedger = false } = {}) {
  const prim = award?.criteria?.[0];
  if (!prim) return null;

  const settled = Number(prim.current) || 0;
  const target = Number(prim.target) || 0;
  const unit = prim.unit ?? 'TTD';

  return {
    source: usesPolicyLedger ? 'POLICY LEDGER' : 'CONFIRMED SETTLEMENTS',
    sourceLive: Boolean(usesPolicyLedger),
    unit,
    settled,
    target,
    // Only the base (settled production) segment is derivable; campaign
    // attribution is pending (see honesty note above).
    segments: [{ kind: 'base', label: 'Settled production', value: settled }],
    campaignPending: true,
    // Pending-settlement value is not separately available from the engine.
    pending: null,
    pct: target > 0 ? Math.min(100, Math.round((settled / target) * 100)) : 0,
  };
}
