// MobileCreateSheet — role-scoped quick-create. `actions` are pre-filtered to
// what the current role can create (agent: log activity / new policy / weekly
// report / commission; manager: settlement / meeting; admin: branch / user).
// Focus-trapped dialog; Done is a filled primary at thumb reach.
import * as React from 'react';
import { Icon } from '../icons/Icon.jsx';
import { useFocusTrap } from './nexus-hooks.jsx';

export function MobileCreateSheet({ open, actions, onGo, onClose }) {
  const trapRef = useFocusTrap(open);
  return (
    <div className={'m-sheet' + (open ? ' is-open' : '')} onClick={onClose} role="dialog" aria-modal="true" aria-label="Create" aria-hidden={!open}>
      <div className="m-sheet-panel" ref={trapRef} onClick={e => e.stopPropagation()}>
        <button className="m-sheet-grip" onClick={onClose} aria-label="Close" />
        <div className="m-sheet-head"><span>Create</span></div>
        <div className="m-sheet-scroll">
          <div className="m-create-list">
            {actions.map(([ic, label, id]) => (
              <button key={label} className="m-create-item" onClick={() => onGo(id)}>
                <span className="m-create-ic"><Icon name={ic} size={17} /></span>
                <span className="m-create-lab">{label}</span>
                <Icon name="arrow" size={15} style={{ color: 'var(--inkFaint)' }} />
              </button>
            ))}
          </div>
        </div>
        <button className="m-sheet-close is-done" onClick={onClose}><Icon name="check" size={18} /> Done</button>
      </div>
    </div>
  );
}
