import React from 'react';

export default function TabPills({ tabs, activeId, onChange, className = '' }) {
  return (
    <div
      role="tablist"
      className={[
        'flex gap-1 p-1 rounded-xl bg-surface border border-border',
        className,
      ].filter(Boolean).join(' ')}
    >
      {tabs.map(({ id, label, badge }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={activeId === id}
          onClick={() => onChange(id)}
          className={[
            'flex-1 min-w-max h-11 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap px-3',
            activeId === id
              ? 'bg-card text-primary shadow-sm'
              : 'text-ink-muted hover:text-ink',
          ].join(' ')}
        >
          {label}
          {badge != null && badge > 0 && (
            <span className="ml-1 text-[10px] font-bold opacity-70">({badge})</span>
          )}
        </button>
      ))}
    </div>
  );
}
