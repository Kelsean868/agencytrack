import { useEffect, useCallback } from 'react';
import { X, Bell, AlertTriangle, Unlock, Award, TrendingUp } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

const TYPE_META = {
  submission_reminder: { Icon: Bell,          color: 'text-primary',  bg: 'bg-primary/10' },
  deadline_missed:     { Icon: AlertTriangle, color: 'text-danger',   bg: 'bg-danger/10'  },
  report_unlocked:     { Icon: Unlock,        color: 'text-warning',  bg: 'bg-warning/10' },
  manager_alert:       { Icon: AlertTriangle, color: 'text-warning',  bg: 'bg-warning/10' },
  badge_earned:        { Icon: Award,         color: 'text-success',  bg: 'bg-success/10' },
  level_up:            { Icon: TrendingUp,    color: 'text-primary',  bg: 'bg-primary/10' },
};

function relativeTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationDrawer({ open, onClose }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-ink/20"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full z-40 w-80 max-w-full bg-card shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-ink">Notifications</h2>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-primary hover:text-primary-dark transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors"
              aria-label="Close notifications"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
              <Bell size={32} className="text-ink-muted/30" />
              <p className="text-sm text-ink-muted">You're all caught up</p>
            </div>
          ) : (
            notifications.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.submission_reminder;
              const { Icon } = meta;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead(n.id);
                    if (n.link) window.location.href = n.link;
                  }}
                  className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-surface transition-colors ${
                    !n.read
                      ? 'bg-surface-raised border-l-2 border-primary'
                      : ''
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 p-1.5 rounded-full ${!n.read ? `${meta.bg} ${meta.color}` : 'bg-border/40 text-ink-muted'}`}>
                    <Icon size={14} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-[10px] text-ink-muted/50 mt-1">{relativeTime(n.createdAt)}</p>
                  </div>

                  {!n.read && (
                    <span className="mt-2 shrink-0 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
