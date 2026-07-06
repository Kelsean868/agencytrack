// MobileTab — fixed 5-slot bottom bar. Slot 5 is ALWAYS More (position never
// moves; carries a ⋮ affordance even when it adaptively shows the current deep
// screen's name). `primary` adds the center raised create FAB. Tabs are
// drag-reorderable when onReorder is supplied. Shows under [data-view="mobile"].
import * as React from 'react';
import { Icon } from '../icons/Icon.jsx';
import { useTouchReorder } from './nexus-hooks.jsx';
const { useState, useRef } = React;

export function MobileTab({ tabs, screen, go, onMore, primary, onCreate, current, onReorder }) {
  const inTabs = tabs.some(t => t[2] === screen);
  const deep = !inTabs;
  const moreItem = { more: true, on: deep, ic: deep && current ? current.ic : 'grid', lab: deep && current ? current.label : 'More' };
  const items = [...tabs.map(([ic, lab, id]) => ({ ic, lab, id, on: screen === id })), moreItem];
  const drag = useRef(null);
  const [over, setOver] = useState(null);
  const onTouch = useTouchReorder();
  const btn = (it) => it.more
    ? <button key="more" className={'mtab mtab-more' + (it.on ? ' is-on' : '')} onClick={onMore} aria-current={it.on ? 'page' : undefined} aria-haspopup="dialog" aria-label={it.on ? (it.lab + ' \u2014 open menu') : 'More \u2014 open menu'}>
        <span className="mtab-more-ic"><Icon name={it.ic} size={20} /><span className="mtab-dots" aria-hidden="true"><i></i><i></i><i></i></span></span>
        <span>{it.lab}</span>
      </button>
    : <button key={it.id} data-rid={it.id} data-rgroup="mtab" className={'mtab' + (it.on ? ' is-on' : '') + (over === it.id ? ' is-drop' : '')}
        aria-current={it.on ? 'page' : undefined}
        draggable={!!onReorder}
        onPointerDown={onReorder ? onTouch(it.id, 'mtab', (from, to) => onReorder(from, to)) : undefined}
        onDragStart={e => { drag.current = it.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', it.id); } catch (x) {} }}
        onDragOver={e => { if (drag.current) { e.preventDefault(); if (drag.current !== it.id) setOver(it.id); } }}
        onDragLeave={() => setOver(o => o === it.id ? null : o)}
        onDrop={e => { e.preventDefault(); if (drag.current && drag.current !== it.id && onReorder) onReorder(drag.current, it.id); drag.current = null; setOver(null); }}
        onDragEnd={() => { drag.current = null; setOver(null); }}
        onClick={e => { if (drag.current) return; const el = e.currentTarget; if (el.__reorderJustDragged && Date.now() - el.__reorderJustDragged < 400) return; go(it.id); }}><Icon name={it.ic} size={20} /><span>{it.lab}</span></button>;
  if (!primary) return <nav className="mobile-tab" aria-label="Primary">{items.map(btn)}</nav>;
  const mid = Math.ceil(items.length / 2);
  const left = items.slice(0, mid), right = items.slice(mid);
  return (
    <nav className="mobile-tab has-fab" aria-label="Primary">
      {left.map(btn)}
      <button className="mtab-fab" onClick={onCreate} aria-label={primary.label}><Icon name="plus" size={26} /></button>
      {right.map(btn)}
      <span className="mtab-fab-label">{primary.label}</span>
    </nav>
  );
}
