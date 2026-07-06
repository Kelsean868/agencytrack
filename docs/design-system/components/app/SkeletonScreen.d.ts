import * as React from 'react';

/**
 * Loading skeleton screen — matches the final layout so content doesn't shift
 * when data lands. Reduced-motion gated shimmer. Prefer this over spinners.
 * Usually driven by StateLayer rather than mounted directly.
 */
export interface SkeletonScreenProps {
  /** Layout archetype to mimic. @default 'cards' */
  kind?: 'cards' | 'table' | 'timeline' | 'detail';
}
export declare function SkeletonScreen(props: SkeletonScreenProps): JSX.Element;
