// MobileMore — full navigation sheet: Pinned + Frequent + labelled sections
// (mirror the desktop sidebar grouping, ≤4–5 items each — never one blob).
// Focus-trapped dialog; Done is a filled primary at thumb reach; closed sheets
// leave the tab order. Optional lens switch (My Book / My Team) for dual roles.
import * as React from 'react';
import { Icon } from '../icons/Icon.jsx';
import { Eyebrow } from '../core/Eyebrow.jsx';
import { useFocusTrap } from './nexus-hooks.jsx';

export function MobileMore({ open, title, sections, active, onNav, onClose, lens, onLens, pinnedItems, frequentItems, pinnedSet, onTogglePin }) {
  const trapRef = useFocusTrap(open);
  const cell = ([ic, label]) => (
    <div key={label} className="m-sheet-cell">
      <button className={'m-sheet-item' + (active === label ? ' is-active' : '')} onClick={() => onNav(label)} aria-current={active === label ? 'page' : undefined}>
        <Icon name={ic} size={18} /><span>{label}</span>
      </button>
      <button className={'m-sheet-pin' + (pinnedSet && pinnedSet.has(label) ? ' is-pinned' : '')}
        onClick={e => { e.stopPropagation(); onTogglePin && onTogglePin(label); }}
        aria-label={pinnedSet && pinnedSet.has(label) ? 'Unpin' : 'Pin'} title={pinnedSet && pinnedSet.has(label) ? 'Unpin' : 'Pin to top'}>
        <Icon name="pin" size={13} />
      </button>
    </div>
  );
  return (
    <div className={'m-sheet' + (open ? ' is-open' : '')} onClick={onClose} role="dialog" aria-modal="true" aria-label={title || 'Navigation menu'} aria-hidden={!open}>
      <div className="m-sheet-panel" ref={trapRef} onClick={e => e.stopPropagation()}>
        <button className="m-sheet-grip" onClick={onClose} aria-label="Close menu" />
        <div className="m-sheet-head"><span>{title || 'All screens'}</span></div>
        {onLens && (
          <div className="m-lens m-lens--insheet">
            <button className={'m-lens-btn' + (lens === 'book' ? ' is-on' : '')} onClick={() => onLens('book')}><Icon name="home" size={15} /> My Book</button>
            <button className={'m-lens-btn' + (lens === 'team' ? ' is-on' : '')} onClick={() => onLens('team')}><Icon name="users" size={15} /> My Team</button>
          </div>
        )}
        <div className="m-sheet-scroll">
          {pinnedItems && pinnedItems.length > 0 && (
            <div className="m-sheet-sec">
              <Eyebrow tone="faint"><Icon name="pin" size={11} style={{ marginRight: 5, verticalAlign: '-1px' }} />Pinned</Eyebrow>
              <div className="m-sheet-grid">{pinnedItems.map(cell)}</div>
            </div>
          )}
          {frequentItems && frequentItems.length > 0 && (
            <div className="m-sheet-sec">
              <Eyebrow tone="faint">Frequent</Eyebrow>
              <div className="m-sheet-grid">{frequentItems.map(cell)}</div>
            </div>
          )}
          {sections.map(sec => (
            <div key={sec.g} className="m-sheet-sec">
              <Eyebrow tone="faint">{sec.g}</Eyebrow>
              <div className="m-sheet-grid">{sec.items.map(cell)}</div>
            </div>
          ))}
        </div>
        <button className="m-sheet-close is-done" onClick={onClose}><Icon name="check" size={18} /> Done</button>
      </div>
    </div>
  );
}
