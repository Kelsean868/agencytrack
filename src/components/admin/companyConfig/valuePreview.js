import { formatTTD } from './ttd';

/**
 * Pure value-preview formatter shared by `FindSettingPalette` (search result
 * value column) and `ChangeHistoryDrawer` (from/to mono line) — mirrors the
 * prototype's `ccpPreview` (cc-proto-controls.jsx).
 *
 * Locked items preview their lock state, not their value, matching the
 * search-palette copy in the design handoff README (§Interactions & Behavior
 * → Find a setting): "HARDCODED"/"PLATFORM" for locked settings.
 *
 * @param {object} item registry item ({ type, suffix, unbacked, lock, tier, def, ... })
 * @param {*} value the value to preview (effective value, draft value, or item.def)
 * @returns {string}
 */
export function valuePreview(item, value) {
  if (!item) return '';
  if (item.unbacked) return '—';
  if (item.lock === 'soon') return 'HARDCODED';
  if (item.lock === 'platform') return 'PLATFORM';
  if (value === undefined || value === null) return '—';

  switch (item.type) {
    case 'currency':
      return formatTTD(value);
    case 'number': {
      const suffix = item.suffix ? ' ' + String(item.suffix).replace('of month', '').trim() : '';
      return `${value}${suffix}`;
    }
    case 'toggle':
    case 'flag':
      return value ? 'ON' : 'OFF';
    case 'seg':
      return String(value);
    case 'bands':
    case 'standards':
    case 'points':
    case 'awardsRuleset':
      return `${Array.isArray(value) ? value.length : 0} rows`;
    case 'milestones':
      return Array.isArray(value) ? `${value.join(' · ')} wk` : String(value);
    case 'textchips':
      return `${Array.isArray(value) ? value.length : 0} levels`;
    case 'upload':
      return value ? 'Uploaded' : '—';
    case 'text':
    default:
      return String(value);
  }
}
