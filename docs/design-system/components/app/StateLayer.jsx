// StateLayer — wrap a data surface and swap in loading / empty / error states.
// Drive `state` from the fetch; default 'ready' shows children. This is the
// single contract every data screen renders through (addendum §1).
import * as React from 'react';
import { SkeletonScreen } from './SkeletonScreen.jsx';
import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';

export function StateLayer({ state = 'ready', kind = 'cards', empty, error, onRetry, children }) {
  if (state === 'loading') return <SkeletonScreen kind={kind} />;
  if (state === 'empty') return empty || <EmptyState title="Nothing here yet" body="Once data comes in, it will appear here." />;
  if (state === 'error') return error || <ErrorState onRetry={onRetry} />;
  return children;
}
