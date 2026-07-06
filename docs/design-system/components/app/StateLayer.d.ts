import * as React from 'react';

/**
 * The state contract every data surface renders through — swaps content for a
 * matching skeleton (loading), an actionable empty, or a persistent error with
 * Retry. Drive `state` from your fetch; `ready` renders children.
 */
export interface StateLayerProps {
  /** Current data state. @default 'ready' */
  state?: 'loading' | 'empty' | 'error' | 'ready';
  /** Skeleton archetype used when state='loading'. @default 'cards' */
  kind?: 'cards' | 'table' | 'timeline' | 'detail';
  /** Custom empty element; falls back to a generic EmptyState. */
  empty?: React.ReactNode;
  /** Custom error element; falls back to ErrorState with onRetry. */
  error?: React.ReactNode;
  /** Retry handler passed to the default ErrorState. */
  onRetry?: () => void;
  /** The real content, shown when state='ready'. */
  children?: React.ReactNode;
}
export declare function StateLayer(props: StateLayerProps): JSX.Element;
