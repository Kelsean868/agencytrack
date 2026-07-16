// Kiosk v2 (3.6) — pure rotation builder.
//
// Turns the static base panel order into the EFFECTIVE rotation the wall
// actually plays: dynamic campaign-leaderboard panels are spliced in after the
// period leaderboards, the celebrations panel lands before compliance, and any
// panel reporting empty (no honest data to show) is dropped so the wall never
// sits on a blank slide.
//
// Each returned entry is `{ key, campaignId? }`:
//   • `key`        — drives the PANEL_COMPONENTS lookup + PANEL_DURATIONS.
//   • `campaignId` — present only on campaign panels; also part of the React key.

/**
 * buildKioskRotation(baseOrder, opts)
 *
 * @param {string[]} baseOrder                 static panel keys (kioskConfig.PANEL_ORDER)
 * @param {object}   opts
 * @param {Array}    opts.flaggedCampaigns     [{ id, ... }] active + kiosk-flagged, non-empty
 * @param {boolean}  opts.hasCelebrations      true when there is ≥1 celebration this week
 * @param {Set<string>|string[]} opts.droppedKeys base keys to drop (reported empty)
 * @param {Set<string>|string[]} opts.disabledKeys base keys a manager turned OFF
 *   (kioskConfig.disabledPanels). Excluded from the rotation BEFORE the empty-drop
 *   logic; the welcome-slide fallback below is never suppressed (result-empty is
 *   backfilled regardless of what was disabled). Dynamic campaign/celebration
 *   panels remain auto — a disabled `weekLeaderboards`/`awardsWatch` still marks
 *   the splice position for them.
 * @returns {Array<{ key: string, campaignId?: string }>}
 */
export function buildKioskRotation(baseOrder = [], opts = {}) {
  const {
    flaggedCampaigns = [],
    hasCelebrations = false,
    droppedKeys = [],
    disabledKeys = [],
  } = opts;

  const dropped = droppedKeys instanceof Set ? droppedKeys : new Set(droppedKeys);
  const disabled = disabledKeys instanceof Set ? disabledKeys : new Set(disabledKeys);
  const result = [];

  for (const key of baseOrder) {
    if (!dropped.has(key) && !disabled.has(key)) {
      result.push({ key });
    }

    // Campaign panels ride directly after the weekly leaderboard cluster.
    if (key === 'weekLeaderboards') {
      for (const c of flaggedCampaigns) {
        if (c && c.id) result.push({ key: 'campaignLeaderboards', campaignId: c.id });
      }
    }

    // Celebrations land after Awards Watch (before Compliance) — only if any.
    if (key === 'awardsWatch' && hasCelebrations) {
      result.push({ key: 'celebrations' });
    }
  }

  // Never hand back an empty rotation — fall back to the welcome slide so the
  // wall always has something to display.
  if (result.length === 0) result.push({ key: 'welcome' });

  return result;
}
