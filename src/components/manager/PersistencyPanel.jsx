import { useState, useEffect, useCallback } from 'react';
import { Save } from 'lucide-react';
import { getTenantUsers } from '../../services/managerService';
import { getMonthlyPersistency, savePersistencyBatch } from '../../services/persistencyService';
import { useAuth } from '../../context/AuthContext';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildYearOptions() {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2];
}

function formatEnteredAt(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PersistencyPanel() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [agents, setAgents] = useState([]);
  const [records, setRecords] = useState({});
  const [values, setValues]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [saved, setSaved]     = useState(false);

  const yearOptions = buildYearOptions();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    setSaved(false);
    Promise.all([
      getTenantUsers(),
      getMonthlyPersistency(year, month),
    ])
      .then(([userList, persistencyMap]) => {
        const agentList = userList.filter((u) => u.role === 'agent');
        setAgents(agentList);
        setRecords(persistencyMap);
        const init = {};
        agentList.forEach((a) => {
          init[a.id] = persistencyMap[a.id]?.persistency ?? '';
        });
        setValues(init);
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load data.');
      })
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const handleChange = (agentId, raw) => {
    setValues((prev) => ({ ...prev, [agentId]: raw }));
  };

  const validate = () => {
    for (const a of agents) {
      const v = values[a.id];
      if (v === '' || v === undefined) continue;
      const n = parseFloat(v);
      if (isNaN(n) || n < 0 || n > 100) return `Invalid value for ${a.name ?? a.id}: must be 0–100.`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    setError('');
    try {
      const entries = agents
        .filter((a) => values[a.id] !== '' && values[a.id] !== undefined)
        .map((a) => ({
          agentId: a.id,
          agentName: a.name ?? a.email ?? a.id,
          year,
          month,
          persistency: parseFloat(values[a.id]),
        }));
      await savePersistencyBatch(entries, user.uid);
      setSaved(true);
      await load();
    } catch (e) {
      console.error(e);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="h-10 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-10 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60 ml-auto"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save All'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
          {error}
        </div>
      )}

      {saved && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-success font-medium">
          Persistency saved successfully.
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-border/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="py-12 text-center text-sm text-ink-muted">
          No agents in this team yet. Add agents to start tracking persistency.
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_160px_180px] border-b border-border bg-surface px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Agent</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Persistency %</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Last Updated</span>
          </div>

          {agents.map((a) => {
            const rec = records[a.id];
            const val = values[a.id] ?? '';
            const numVal = parseFloat(val);
            const invalid = val !== '' && (isNaN(numVal) || numVal < 0 || numVal > 100);

            return (
              <div
                key={a.id}
                className="grid grid-cols-[1fr_160px_180px] items-center px-4 py-3 border-b border-border/40 last:border-0"
              >
                <span className="text-sm font-medium text-ink">{a.name ?? a.email ?? a.id}</span>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={val}
                    onChange={(e) => handleChange(a.id, e.target.value)}
                    placeholder="—"
                    className={`w-24 h-9 px-2 rounded-lg border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      invalid ? 'border-danger bg-danger/5' : 'border-border bg-surface'
                    }`}
                  />
                  <span className="text-sm text-ink-muted">%</span>
                </div>

                <span className="text-xs text-ink-muted">
                  {rec?.enteredAt ? `Last updated: ${formatEnteredAt(rec.enteredAt)}` : 'Not entered'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
