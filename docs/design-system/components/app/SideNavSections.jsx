// SideNavSections — desktop sidebar body: sectioned nav with mono eyebrow
// headers, teal active state, aria-current, and drag-reorder (mouse + long-
// press touch, persisted by the host). Render inside your .side container.
import * as React from 'react';
import { Icon } from '../icons/Icon.jsx';
import { Eyebrow } from '../core/Eyebrow.jsx';
import { useTouchReorder } from './nexus-hooks.jsx';
const { useState, useRef } = React;

export function SideNavSections({ sections, active, onNav, onReorder }) {
  const drag = useRef(null);
  const [over, setOver] = useState(null);
  const onTouch = useTouchReorder();
  const guardClick = (el, fn) => { if (el && el.__reorderJustDragged && Date.now() - el.__reorderJustDragged < 400) return; fn(); };
  return sections.map(sec => (
    <div key={sec.g} className="side-sec">
      <Eyebrow tone="faint">{sec.g}</Eyebrow>
      {sec.items.map(([ic, label]) => (
        <button key={label}
          data-rid={label} data-rgroup={'nav-' + sec.g}
          className={'nav-item' + (active === label ? ' is-active' : '') + (over === sec.g + '|' + label ? ' is-drop' : '')}
          aria-current={active === label ? 'page' : undefined}
          draggable={!!onReorder}
          onPointerDown={onReorder ? onTouch(label, 'nav-' + sec.g, (from, to) => onReorder(sec.g, sec.items.map(i => i[1]), from, to)) : undefined}
          onDragStart={e => { drag.current = { g: sec.g, label, labels: sec.items.map(i => i[1]) }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', label); } catch (x) {} }}
          onDragOver={e => { const d = drag.current; if (d && d.g === sec.g) { e.preventDefault(); if (d.label !== label) setOver(sec.g + '|' + label); } }}
          onDragLeave={() => setOver(o => o === sec.g + '|' + label ? null : o)}
          onDrop={e => { e.preventDefault(); const d = drag.current; if (d && d.g === sec.g && d.label !== label && onReorder) onReorder(sec.g, d.labels, d.label, label); drag.current = null; setOver(null); }}
          onDragEnd={() => { drag.current = null; setOver(null); }}
          onClick={e => guardClick(e.currentTarget, () => onNav && onNav(label))} title={label}>
          {onReorder && <span className="nav-grip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>}
          <Icon name={ic} size={17} /><span>{label}</span>
        </button>
      ))}
    </div>
  ));
}
