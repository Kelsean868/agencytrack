// Planner v3 — the right ACTION PLAN pane, ported from the handoff:
// header + completion ring, collapsible MonthCalendar, group-by-category toggle,
// Must Do / Should Do task sections, draggable TaskItem, quick-add form, and the
// Auto-Advance / Show-play toggles.
const { Icon } = window.AgencyTrackDesignSystem_ad1cd7;
const { useState } = React;

function TaskItem({ task, onDragStart, onDragEnd, onComplete }) {
  const meta = ACTIVITY_METADATA[task.type] || {};
  const fam = famOf(task.type);
  return (
    <div className="ti" draggable onDragStart={(e) => onDragStart(e, task)} onDragEnd={onDragEnd}>
      <span className="ti-grip" aria-hidden="true"><IconGrip size={14} /></span>
      <span className="ti-body">
        <span className="ti-top">
          <span className="ti-code" style={{ color: fam.fg, background: fam.bg, borderColor: fam.rule, borderStyle: fam.dashed ? 'dashed' : 'solid' }}>{task.type}</span>
          <span className="ti-dur">{task.duration >= 1 ? task.duration + 'h' : (task.duration * 60) + 'm'}</span>
        </span>
        <span className="ti-title" title={task.title}>{task.title}</span>
      </span>
      <button className="ti-done" onClick={() => onComplete(task.id)} aria-label={'Complete ' + task.title}><Icon name="check" size={14} /></button>
    </div>
  );
}

function Ring({ done, total }) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className="ring" role="img" aria-label={done + ' of ' + total + ' complete'}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--rule)" strokeWidth="3" />
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeDasharray={pct + ', 100'} />
      </svg>
      <span className="ring-n">{done}/{total}</span>
    </div>
  );
}

function Toggle({ label, on, onChange }) {
  return (
    <label className="tg">
      <span>{label}</span>
      <input type="checkbox" className="tg-in" checked={on} onChange={onChange} />
      <span className="tg-track" aria-hidden="true"><span className="tg-dot"></span></span>
    </label>
  );
}

function ActionPlan({ tasks, onDragStart, onDragEnd, onComplete, onAdd, month, onMonth,
  completed, autoAdvance, setAutoAdvance, showPlay, setShowPlay, counters }) {
  const [grouped, setGrouped] = useState(false);
  const [text, setText] = useState('');
  const [type, setType] = useState('PC');
  const high = tasks.filter(t => t.priority === 'high');
  const low = tasks.filter(t => t.priority !== 'high');
  const total = tasks.length + completed;
  const byType = tasks.reduce((acc, t) => { (acc[t.type] = acc[t.type] || []).push(t); return acc; }, {});

  const submit = (e) => { e.preventDefault(); if (!text.trim()) return; onAdd(text.trim(), type); setText(''); setType('PC'); };
  const list = (items) => items.map(t => <TaskItem key={t.id} task={t} onDragStart={onDragStart} onDragEnd={onDragEnd} onComplete={onComplete} />);

  return (
    <aside className="ap-pane" aria-label="Action plan">
      <div className="ap-head">
        <div>
          <h2 className="ap-h">Action plan</h2>
          <p className="ap-sub">Drag to schedule time</p>
        </div>
        <Ring done={completed} total={total} />
      </div>

      <div className="ap-top">
        <form className="ap-form" onSubmit={submit}>
          <input className="ap-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Quick add task…" aria-label="Quick add task" />
          <select className="ap-sel" value={type} onChange={(e) => setType(e.target.value)} aria-label="Activity type">
            {Object.keys(ACTIVITY_METADATA).filter(k => k !== 'SUGGESTION').map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <button className="ap-send" type="submit" disabled={!text.trim()} aria-label="Add task"><Icon name="arrow" size={16} style={{ transform: 'rotate(-90deg)' }} /></button>
        </form>
        <p className="ap-hint"><IconBulb size={12} style={{ color: 'var(--gold)' }} /> Lands in the list unscheduled — drag it onto the grid to block the time.</p>
      </div>

      <MonthCalendar month={month} onMonth={onMonth} />

      <div className="ap-scroll">
        <div className="ap-counters">
          <span className="ap-clab">WK 27 · BOOKED vs FLOOR</span>
          {counters.map(c => {
            const fam = famOf(c.type);
            const short = c.booked < c.floor;
            return (
              <div key={c.type} className="apc">
                <span className="apc-code" style={{ color: fam.fg, background: fam.bg }}>{c.lab}</span>
                <span className="apc-track"><span style={{ width: Math.min(100, c.booked / c.floor * 100) + '%', background: short ? 'var(--warning)' : 'var(--success)' }}></span></span>
                <span className="apc-n" style={{ color: short ? 'var(--warning)' : 'var(--success)' }}>{c.booked}<i>/{c.floor}</i></span>
              </div>
            );
          })}
        </div>

        <div className="ap-grouprow">
          <button className={'ap-gbtn' + (grouped ? ' is-on' : '')} onClick={() => setGrouped(g => !g)} aria-pressed={grouped}>
            {grouped ? 'Ungroup' : 'Group by category'}
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="ap-empty">
            <span className="ap-empty-ic"><Icon name="check" size={28} /></span>
            <b>All caught up</b>
            <span>Add a task above, or drag one onto the grid.</span>
          </div>
        ) : grouped ? (
          <div className="ap-groups">
            {Object.entries(byType).map(([tp, items]) => {
              const fam = famOf(tp);
              return (
                <div key={tp} className="ap-group">
                  <div className="ap-group-h">
                    <span className="ti-code" style={{ color: fam.fg, background: fam.bg, borderColor: fam.rule }}>{tp}</span>
                    <b>{(ACTIVITY_METADATA[tp] || {}).label || tp}</b>
                    <span className="ap-count">{items.length}</span>
                  </div>
                  <div className="ap-list">{list(items)}</div>
                  <button className="ap-auto"><Icon name="calendar" size={14} /> Auto-schedule batch</button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ap-groups">
            {high.length > 0 && (
              <div>
                <div className="ap-sec"><Icon name="bolt" size={14} style={{ color: 'var(--gold)' }} /><h3>Must do today</h3></div>
                <div className="ap-list">{list(high)}</div>
              </div>
            )}
            {low.length > 0 && (
              <div>
                <div className="ap-sec"><Icon name="grid" size={14} style={{ color: 'var(--inkMute)' }} /><h3>Should do</h3></div>
                <div className="ap-list">{list(low)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ap-foot">
        <div className="ap-toggles">
          <Toggle label="Auto-advance timeline" on={autoAdvance} onChange={() => setAutoAdvance(v => !v)} />
          <Toggle label="Show play controls" on={showPlay} onChange={() => setShowPlay(v => !v)} />
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, { ActionPlan, TaskItem, Ring, Toggle });
