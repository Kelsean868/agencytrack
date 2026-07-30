/**
 * devAssertKnown — make silent lookup fallbacks loud in development (v3 rule 11).
 *
 * `LOOKUP[x] ?? DEFAULT` is the shape that renders something PLAUSIBLE for an
 * unknown key, which is worse than rendering nothing: in the v3 prototype it
 * showed five distinct glyphs as a grid icon, including a Cancel control that
 * displayed a grid where an alert belonged. Nothing threw, nothing logged, and
 * the screen looked fine.
 *
 * This does NOT change the fallback — production behaviour is byte-identical.
 * It only reports the miss while a developer is watching. Call it immediately
 * before the fallback expression:
 *
 *     devAssertKnown(TYPE_TONE, type, 'TYPE_TONE');
 *     return TYPE_TONE[type] ?? TYPE_TONE.FREE;
 *
 * `console.error` rather than `throw`: a hard throw in a render path would turn
 * a cosmetic miss into a blank screen, and these sites are reached from user
 * data. The signal belongs in the console, not in the user's face.
 */

/** True in dev/test builds, false in the production bundle. */
function isDev() {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/**
 * Report — in development only — that `key` is missing from `map`.
 *
 * @param {object} map     the lookup table being indexed
 * @param {string} key     the key about to be looked up
 * @param {string} mapName the table's name, for the message
 * @returns {boolean} true when the key is present (dev and prod alike)
 */
export function devAssertKnown(map, key, mapName) {
  const known = map != null && Object.prototype.hasOwnProperty.call(map, key);
  if (!known && isDev()) {
    console.error(
      `[devAssertKnown] ${mapName} has no entry for ${JSON.stringify(key)}. ` +
        `The call site will fall back to a default, which renders something ` +
        `plausible instead of surfacing the miss. Add the key to its source ` +
        `table (activity codes: src/constants/activityMetadata.js) rather than ` +
        `widening the fallback.`,
    );
  }
  return known;
}

export default devAssertKnown;
