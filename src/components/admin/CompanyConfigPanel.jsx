import { useState, useEffect, useCallback } from 'react';
import { Pencil, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCompanyMinimums } from '../../services/goalsService';
import { formatCurrency } from '../../utils/formatters';
import EditConfigModal from './EditConfigModal';

/**
 * Company Configuration card for the Tenant Admin (Design System v2 — B5).
 *
 * Renders 6 tiles per the mock:
 *   1. Company Min · Per Agent  — EDITABLE in B5 (annualAPI field)
 *   2. Currency                 — display only (TTD)
 *   3. Fiscal Year              — display only (Jan–Dec)
 *   4. Persistency Floor        — display only in B5; field exists on doc
 *      but editing deferred per locked decision
 *   5. Week Starts              — display only (Sunday)
 *   6. Self-Registration        — display only (Disabled)
 *
 * Read pattern:
 *   - On mount: getCompanyMinimums(tenantId). Tolerates missing doc — falls
 *     back to defaults via the service.
 *   - On modal save: re-reads the doc (the modal's onSaved passes the new
 *     value, but we re-read from source of truth to pick up updatedAt etc.)
 *
 * Edit affordance:
 *   - Single "Edit company minimum" button at card head (mock has "Edit all"
 *     copy but the locked decision is to rename — only annualAPI is editable
 *     in B5, so the copy now matches scope).
 *   - Click opens <EditConfigModal /> with current value pre-seeded.
 */
export default function CompanyConfigPanel() {
  const { tenantId, user } = useAuth();

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState(null);
  const [editing, setEditing] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setReadError(null);
    try {
      const data = await getCompanyMinimums(tenantId);
      setConfig(data);
    } catch (err) {
      setReadError(err?.message ?? 'Failed to load company configuration.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const annualAPI = parseFloat(config?.annualAPI) || 0;
  const persistency = parseFloat(config?.persistency) || 0;

  const tiles = [
    {
      key: 'annualAPI',
      label: 'Company Min · Per Agent',
      value: annualAPI > 0 ? `${formatCurrency(annualAPI)} / yr` : '—',
      sub: 'All personal commitments must meet this floor',
      editable: true,
    },
    {
      key: 'currency',
      label: 'Currency',
      value: 'TTD ($)',
      sub: 'Trinidad & Tobago Dollar',
      editable: false,
    },
    {
      key: 'fiscal',
      label: 'Fiscal Year',
      value: 'Jan – Dec',
      sub: 'Calendar year alignment',
      editable: false,
    },
    {
      key: 'persistency',
      label: 'Persistency Floor',
      value: persistency > 0 ? `${persistency}%` : '—',
      sub: 'Agents below trigger manager review',
      editable: false,
    },
    {
      key: 'week',
      label: 'Week Starts',
      value: 'Sunday',
      sub: 'Reports submitted Sun – Sat',
      editable: false,
    },
    {
      key: 'selfreg',
      label: 'Self-Registration',
      value: 'Disabled',
      sub: 'Managers create all accounts',
      editable: false,
    },
  ];

  return (
    <section aria-labelledby="company-config-heading" className="card">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 id="company-config-heading" className="text-lg font-bold text-ink">
            Company configuration
          </h2>
          <p className="text-sm text-ink-muted mt-0.5">
            Tenant-wide defaults · Only the company minimum is editable in this release
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={loading || !!readError}
          className="h-11 px-4 rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          aria-label="Edit company minimum API"
        >
          <Pencil size={14} aria-hidden="true" />
          <span>Edit company minimum</span>
        </button>
      </div>

      {readError && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-start gap-2"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{readError}</span>
        </div>
      )}

      <div className="config-tile-grid">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className={`config-tile${tile.editable ? ' config-tile-editable' : ''}`}
          >
            <div className="config-tile-label">{tile.label}</div>
            <div className="config-tile-value">{loading ? '—' : tile.value}</div>
            <div className="config-tile-sub">{tile.sub}</div>
          </div>
        ))}
      </div>

      {editing && (
        <EditConfigModal
          tenantId={tenantId}
          currentAnnualAPI={annualAPI}
          currentUid={user?.uid ?? null}
          onClose={() => setEditing(false)}
          onSaved={() => { loadConfig(); }}
        />
      )}
    </section>
  );
}
