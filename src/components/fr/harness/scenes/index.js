/**
 * FR harness scene registry. Each slice appends its scenes here.
 * Scene: { id, title, slice, viewport: 'desktop'|'phone', hasVariants?, pager?, render }
 */
import { FOUNDATION_SCENES } from './foundationScenes';
import { SHELL_SCENES } from './shellScenes';
import { TODAY_SCENES } from './todayScenes';
import { MONEY_SCENES } from './moneyScenes';
import { WORK_SCENES } from './workScenes';
import { COMPETE_SCENES } from './competeScenes';

export const SCENES = [...FOUNDATION_SCENES, ...SHELL_SCENES, ...TODAY_SCENES, ...MONEY_SCENES, ...WORK_SCENES, ...COMPETE_SCENES];
