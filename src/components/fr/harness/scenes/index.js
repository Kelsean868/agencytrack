/**
 * FR harness scene registry. Each slice appends its scenes here.
 * Scene: { id, title, slice, viewport: 'desktop'|'phone', hasVariants?, pager?, render }
 */
import { FOUNDATION_SCENES } from './foundationScenes';

export const SCENES = [...FOUNDATION_SCENES];
