import { useState, useEffect, useCallback } from 'react';
import { Trophy, Award, TrendingUp, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getCurrentMonthKey,
  getPrevMonthKey,
  isWithinEditWindow,
  getAgentOfMonth,
  getCandidates,
  setAgentOfMonth,
} from '../../services/agentOfMonthService';
import AOMCategorySection from './AOMCategorySection';

const CATEGORIES = [
  { key: 'api',      label: 'API Champion',    Icon: Trophy },
  { key: 'apps',     label: 'Apps Leader',     Icon: Award },
  { key: 'activity', label: 'Activity Winner', Icon: TrendingUp },
];

export default function AgentOfMonthTab() {
  const { userProfile } = useAuth();
  const branchId = userProfile?.branchId;

  const currentKey  = getCurrentMonthKey();
  const prevKey     = getPrevMonthKey();
  const editWindow  = isWithinEditWindow();

  const [monthKey,    setMonthKey]    = useState(currentKey);
  const [aomData,     setAomData]     = useState(null);
  const [candidates,  setCandidates]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [approving,   setApproving]   = useState(null); // `${category}:${agentUid}`

  const isLocked = monthKey !== currentKey && !editWindow;

  const load = useCallback(async () => {
    if (!branchId || !monthKey) return;
    setLoading(true);
    setError(null);
    try {
      const [aom, cands] = await Promise.all([
        getAgentOfMonth(monthKey),
        getCandidates({ branchId, monthKey }),
      ]);
      setAomData(aom);
      setCandidates(cands);
    } catch (err) {
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [branchId, monthKey]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (category, agentUid) => {
    setApproving(`${category}:${agentUid}`);
    setError(null);
    try {
      await setAgentOfMonth({ branchId, monthKey, category, agentUid });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to save winner.');
    } finally {
      setApproving(null);
    }
  };

  if (!branchId) {
    return (
      <div className="p-6 text-sm text-ink-muted">
        No branch assigned to your account. Contact an administrator.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-ink">Agent of the Month</h2>
          <p className="text-ink-muted text-sm mt-1">
            Select one winner per category to display on the branch kiosk.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {editWindow && (
            <div
              className="flex items-center bg-surface-raised rounded-lg p-1 gap-1"
              role="group"
              aria-label="Select month"
            >
              <button
                type="button"
                onClick={() => setMonthKey(prevKey)}
                aria-pressed={monthKey === prevKey}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  monthKey === prevKey
                    ? 'bg-card text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {prevKey}
              </button>
              <button
                type="button"
                onClick={() => setMonthKey(currentKey)}
                aria-pressed={monthKey === currentKey}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  monthKey === currentKey
                    ? 'bg-card text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {currentKey}
              </button>
            </div>
          )}

          {!editWindow && (
            <span className="px-3 py-1.5 text-sm font-medium text-ink bg-surface-raised rounded-lg">
              {currentKey}
            </span>
          )}

          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isLocked && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-warning-tint text-warning flex items-center gap-2 text-sm">
          <Lock size={15} aria-hidden="true" />
          This month is locked. Winners can no longer be changed.
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-danger-tint text-danger text-sm flex items-center gap-2">
          <AlertCircle size={15} aria-hidden="true" />
          {error}
        </div>
      )}

      {loading && !candidates && (
        <div className="py-16 text-center text-ink-muted text-sm">Loading candidates…</div>
      )}

      {candidates && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(({ key, label, Icon }) => (
            <AOMCategorySection
              key={key}
              category={key}
              label={label}
              Icon={Icon}
              candidates={candidates[key] || []}
              winner={aomData?.[key] || null}
              isLocked={isLocked}
              onApprove={(agentUid) => handleApprove(key, agentUid)}
              approving={
                approving?.startsWith(`${key}:`) ? approving.split(':')[1] : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
