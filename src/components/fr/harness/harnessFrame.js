import { createContext } from 'react';

/**
 * True while a scene renders inside the app frame (`?frame=app`, W-1 width
 * sweep). ScenePage reads it to step aside for the real `.shell-content`.
 */
export const HarnessFrameContext = createContext(false);

const PAGE_ONLY = /^(?:(?:sm|md|lg):)?(?:mx-auto|max-w-\S+|w-\[\d+px\]|p[xy]?-\S+)$/;

/** Drop a scene page's centring, max-width, fixed width and padding; keep flow classes. */
export function framedClass(className = '') {
  return className.split(/\s+/).filter((t) => t && !PAGE_ONLY.test(t)).join(' ');
}
