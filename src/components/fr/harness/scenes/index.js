/**
 * FR harness scene registry. Each slice appends its scenes here.
 * Scene: { id, title, slice, viewport: 'desktop'|'phone', hasVariants?, pager?, render }
 */
import { FOUNDATION_SCENES } from './foundationScenes';
import { SHELL_SCENES } from './shellScenes';
import { TODAY_SCENES } from './todayScenes';

export const SCENES = [...FOUNDATION_SCENES, ...SHELL_SCENES, ...TODAY_SCENES];
