// EmptyState — actionable empty state (never "No data"). Names why it's empty
// and gives the next step as a real CTA. Icon + title + optional body + CTA.
import * as React from 'react';
import { Icon } from '../icons/Icon.jsx';

export function EmptyState({ icon = 'grid', title, body, cta, onCta }) {
  return (
    <div className="nx-empty">
      <div className="nx-empty-icon"><Icon name={icon} size={22} /></div>
      <div className="nx-empty-title">{title}</div>
      {body && <div className="nx-empty-body">{body}</div>}
      {cta && <button className="nx-btn nx-btn--primary" onClick={onCta}>{cta}</button>}
    </div>
  );
}
