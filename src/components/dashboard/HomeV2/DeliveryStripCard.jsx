/**
 * DeliveryStripCard — STUB for the v2 Agent Dashboard home.
 *
 * The v2 mockup's DeliveryStripCard shows outstanding policies to deliver
 * + a 30-day clawback clock. Its source data is `POLICIES` /
 * `DELIVERY_STATES` from the mockup-only `cro-v2-shared.jsx` module — that
 * data shape does not yet exist in Firestore (Track H ships `policies` but
 * with a different lifecycle).
 *
 * Per the J-AD-home brief, this component STUBS to null. Banked as a LOW
 * FU to wire to Track H `policies` / `policyDeliveryDate` data later.
 *
 * Self-guard preserved: returns null cleanly with no console error, so the
 * RecentPanel right column can include it unconditionally without breaking
 * either of the two themes.
 */
export default function DeliveryStripCard() {
  return null;
}
