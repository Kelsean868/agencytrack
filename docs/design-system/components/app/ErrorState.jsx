// ErrorState — persistent inline error with Retry (never a toast). A load
// failure stays on screen with a way to recover and reassurance work is safe.
import * as React from 'react';
import { Icon } from '../icons/Icon.jsx';

export function ErrorState({
  title = 'Couldn\u2019t load this view',
  body = 'Something went wrong fetching this data \u2014 your work is safe. Try again.',
  onRetry, retryLabel = 'Retry',
}) {
  return (
    <div className="nx-error" role="alert">
      <div className="nx-error-icon"><Icon name="bell" size={22} /></div>
      <div className="nx-error-title">{title}</div>
      <div className="nx-error-body">{body}</div>
      {onRetry && <button className="nx-btn nx-btn--ghost" onClick={onRetry}><Icon name="repeat" size={15} /> {retryLabel}</button>}
    </div>
  );
}
