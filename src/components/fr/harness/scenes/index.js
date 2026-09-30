/**
 * FR harness scene registry. Each slice appends its scenes here.
 * Scene: { id, title, slice, viewport: 'desktop'|'phone', hasVariants?, pager?, render }
 */
import { FOUNDATION_SCENES } from './foundationScenes';
import { SHELL_SCENES } from './shellScenes';
import { TODAY_SCENES } from './todayScenes';
import { MONEY_SCENES } from './moneyScenes';
import { MONEY_NEEDS_SCENES } from './moneyNeedsScenes';
import { GAME_PLAN_SCENES } from './gamePlanScenes';
import { COMMISSION_SCENES } from './commissionScenes';
import { WORK_SCENES } from './workScenes';
import { COMPETE_SCENES } from './competeScenes';
import { CAREER_SCENES } from './careerScenes';
import { PERSISTENCY_TAB_SCENES } from './persistencyTabScenes';
import { PLAYGROUND_SCENES } from './playgroundScenes';
import { REINSTATEMENT_SCENES } from './reinstatementScenes';

export const SCENES = [...FOUNDATION_SCENES, ...SHELL_SCENES, ...TODAY_SCENES, ...MONEY_SCENES, ...MONEY_NEEDS_SCENES, ...GAME_PLAN_SCENES, ...COMMISSION_SCENES, ...WORK_SCENES, ...COMPETE_SCENES, ...CAREER_SCENES, ...PERSISTENCY_TAB_SCENES, ...PLAYGROUND_SCENES, ...REINSTATEMENT_SCENES];
