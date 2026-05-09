import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import GoalDecompositionTab from './tabs/GoalDecompositionTab';
import ModalTargetingTab from './tabs/ModalTargetingTab';

const TABS = [
  { key: 'goal',  label: 'Goal Decomposition' },
  { key: 'modal', label: 'Modal Targeting'     },
];

export default function CommissionPlayground({ submissions = [], agentId, tenantId, _agentName, isManagerSelf }) {
  const { userProfile } = useAuth();
  const [open, setOpen]         = useState(false);
  const [activeTab, setActiveTab] = useState('goal');

  return (
    <div className="card flex flex-col gap-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-semibold text-ink">Commission Playground</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {isManagerSelf
              ? 'Calculate the activity needed to hit your personal income goal'
              : 'Reverse-engineer the activity needed to hit your income goal'}
          </p>
        </div>
        {open ? <ChevronUp size={18} className="text-ink-muted" /> : <ChevronDown size={18} className="text-ink-muted" />}
      </button>

      {open && (
        <div className="flex flex-col gap-5 mt-5">
          {/* Tab pills */}
          <div
            className="flex gap-1 p-1 rounded-lg bg-[var(--color-surface-raised)] self-start"
            role="tablist"
            aria-label="Commission Playground views"
          >
            {TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[var(--color-surface)] text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'goal' && (
            <GoalDecompositionTab
              submissions={submissions}
              agentId={agentId}
              tenantId={tenantId}
            />
          )}
          {activeTab === 'modal' && (
            <ModalTargetingTab
              defaultCommissionRate={parseFloat(userProfile?.commissionRate) || 35}
            />
          )}
        </div>
      )}
    </div>
  );
}
