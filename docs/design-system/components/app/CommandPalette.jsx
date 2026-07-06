// CommandPalette — global search + role-scoped quick create (⌘K / "/"). Search
// jumps to any screen; create mode (or typing) surfaces role-scoped actions.
// Focus-trapped, Escape closes. Pass quickActions as [icon,label,id,roles[]].
import * as React from 'react';
import { Icon } from '../icons/Icon.jsx';
import { Eyebrow } from '../core/Eyebrow.jsx';
import { useFocusTrap } from './nexus-hooks.jsx';
const { useState, useEffect, useRef } = React;

export function CommandPalette({ open, mode, screens, roles, onGo, onClose, quickActions }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const trapRef = useFocusTrap(open);
  useEffect(() => { if (open) { setQ(''); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open, mode]);
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const roleSet = roles && roles.length ? roles : ['agent'];
  const quick = (quickActions || []).filter(x => x[3].some(r => roleSet.includes(r)));
  const ql = q.trim().toLowerCase();
  const results = screens.filter(s => s.shell !== 'bare' && s.label.trim().toLowerCase().includes(ql));
  const quickF = quick.filter(x => x[1].toLowerCase().includes(ql));
  const showCreate = mode === 'create' || ql;
  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd" ref={trapRef} role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'Quick create' : 'Search and jump to'} onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Icon name="target" size={18} style={{ color: 'var(--inkFaint)' }} />
          <input ref={inputRef} className="cmd-input" value={q} onChange={e => setQ(e.target.value)}
            placeholder={mode === 'create' ? 'What do you want to create?' : 'Search screens, agents, policies\u2026'} />
          <kbd className="cmd-esc">ESC</kbd>
        </div>
        <div className="cmd-body">
          {showCreate && quickF.length > 0 && (
            <div className="cmd-sec">
              <Eyebrow tone="faint">Quick create</Eyebrow>
              {quickF.map(([ic, label, id]) => (
                <button key={label} className="cmd-item" onClick={() => onGo(id)}>
                  <span className="cmd-ic cmd-ic--create"><Icon name={ic} size={15} /></span>
                  <span>{label}</span><Icon name="arrow" size={14} style={{ marginLeft: 'auto', color: 'var(--inkFaint)' }} />
                </button>
              ))}
            </div>
          )}
          {mode !== 'create' && (
            <div className="cmd-sec">
              <Eyebrow tone="faint">{ql ? 'Screens' : 'Jump to'}</Eyebrow>
              {results.length ? results.slice(0, 8).map(s => (
                <button key={s.id} className="cmd-item" onClick={() => onGo(s.id)}>
                  <span className="cmd-ic"><Icon name={s.ic} size={15} /></span>
                  <span>{s.label.trim()}</span><span className="cmd-grp">{s.grp}</span>
                </button>
              )) : <div className="cmd-empty">No matches for \u201c{q}\u201d</div>}
            </div>
          )}
        </div>
        <div className="cmd-foot"><span>\u2191\u2193 to move</span><span>\u21b5 to open</span><span>Global search &amp; create \u2014 from anywhere</span></div>
      </div>
    </div>
  );
}
