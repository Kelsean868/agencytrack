import React from 'react';
import { Edit3, Calculator } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { formatCurrency } from '../../utils/formatters';

function formatPercent(decimal) {
  if (decimal == null || !Number.isFinite(decimal)) return '—';
  return `${(decimal * 100).toFixed(1)}%`;
}

function badgeClass(decimal) {
  if (decimal == null || !Number.isFinite(decimal)) return 'bg-border/40 text-ink-muted';
  if (decimal >= 0.90) return 'bg-success/15 text-success-ink';
  if (decimal >= 0.80) return 'bg-warning/15 text-warning-ink';
  return 'bg-danger/15 text-danger-ink';
}

function formatLastEdited(record) {
  if (!record?.lastEditedAt) return null;
  try {
    const d = record.lastEditedAt.toDate
      ? record.lastEditedAt.toDate()
      : new Date(record.lastEditedAt);
    return d.toLocaleDateString('en-TT', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
}

export default function PersistencyAgentRow({ user, record, onEdit, onOpenPlayground }) {
  const lastEdited = formatLastEdited(record);

  return (
    <div
      data-testid={`persistency-agent-row-${user.id}`}
      className="card flex flex-wrap items-center gap-3 sm:gap-4 py-3"
    >
      <Avatar src={user.photoURL} name={user.name ?? user.email ?? '?'} size="lg" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{user.name ?? user.email ?? user.id}</p>
        <p className="text-xs text-ink-muted truncate">
          {record
            ? `Gross ${formatCurrency(record.grossSettled)} · Net ${formatCurrency(record.netSettled)}`
            : 'No entry yet'}
          {lastEdited && record && (
            <span className="ml-1">· edited {lastEdited}</span>
          )}
        </p>
      </div>

      <span
        className={`px-2.5 py-1 rounded-lg text-sm font-bold ${badgeClass(record?.persistency)}`}
        data-testid={`persistency-badge-${user.id}`}
      >
        {formatPercent(record?.persistency)}
      </span>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="h-10 px-3 rounded-lg border border-border text-xs font-semibold text-ink hover:bg-card-raised transition-colors flex items-center gap-1"
          data-testid={`persistency-edit-${user.id}`}
        >
          <Edit3 size={12} /> Edit
        </button>
        <button
          type="button"
          onClick={onOpenPlayground}
          className="h-10 px-3 rounded-lg border border-border text-xs font-semibold text-ink hover:bg-card-raised transition-colors flex items-center gap-1"
          data-testid={`persistency-playground-${user.id}`}
        >
          <Calculator size={12} /> Playground
        </button>
      </div>
    </div>
  );
}
