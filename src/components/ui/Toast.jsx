import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Toast — single toast display component.
 *
 * Rendered by ToastProvider inside a top-center portal stack. Auto-dismisses
 * after `duration` ms (0 = sticky until manual dismiss). Variant drives icon,
 * colour, and ARIA role/aria-live politeness.
 *
 * A11y:
 *   - success/info → role="status" + aria-live="polite"
 *   - error/warning → role="alert" + aria-live="assertive"
 *   - X button has aria-label="Dismiss" and 44px touch target
 *
 * Animation respects prefers-reduced-motion via Tailwind's motion-reduce: variant
 * (matches the BulkImport modal precedent for reduced-motion guards).
 */

const VARIANT_CONFIG = {
  success: {
    Icon: CheckCircle2,
    className: 'bg-success text-white shadow-lg',
    iconClassName: 'text-white',
    closeClassName: 'text-white/80 hover:text-white hover:bg-white/10',
    role: 'status',
    ariaLive: 'polite',
  },
  error: {
    Icon: AlertCircle,
    className: 'bg-danger text-white shadow-lg',
    iconClassName: 'text-white',
    closeClassName: 'text-white/80 hover:text-white hover:bg-white/10',
    role: 'alert',
    ariaLive: 'assertive',
  },
  warning: {
    Icon: AlertTriangle,
    className: 'bg-warning/15 border border-warning/40 text-ink shadow-md',
    iconClassName: 'text-warning',
    closeClassName: 'text-ink-muted hover:text-ink hover:bg-warning/10',
    role: 'alert',
    ariaLive: 'assertive',
  },
  info: {
    Icon: Info,
    className: 'bg-card border border-border text-ink shadow-md',
    iconClassName: 'text-primary',
    closeClassName: 'text-ink-muted hover:text-ink hover:bg-border/40',
    role: 'status',
    ariaLive: 'polite',
  },
};

export default function Toast({
  id,
  message,
  variant = 'info',
  duration = 3000,
  action,           // { label: string, onClick: () => void } — optional
  onDismiss,        // (id) => void — called by timeout, X button, or action
}) {
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.info;
  const { Icon, className, iconClassName, closeClassName, role, ariaLive } = config;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss?.(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const handleAction = () => {
    action?.onClick?.();
    onDismiss?.(id);
  };

  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={[
        'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-medium max-w-md w-full',
        'transition-opacity duration-200 motion-reduce:transition-none',
        className,
      ].join(' ')}
      data-testid={`toast-${variant}`}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${iconClassName}`} aria-hidden="true" />
      <div className="flex-1 leading-snug">{message}</div>
      {action && (
        <button
          type="button"
          onClick={handleAction}
          className="shrink-0 h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss?.(id)}
        aria-label="Dismiss"
        className={[
          'shrink-0 -mr-1 -my-1 w-11 h-11 rounded-lg flex items-center justify-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          closeClassName,
        ].join(' ')}
      >
        <X size={16} />
      </button>
    </div>
  );
}
