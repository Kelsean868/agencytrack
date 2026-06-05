import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import GoalDecompositionTab from './tabs/GoalDecompositionTab';
import ModalTargetingTab from './tabs/ModalTargetingTab';

const TABS = [
  { key: 'goal',  label: 'Goal Decomposition' },
  { key: 'modal', label: 'Modal Targeting'     },
];

export default function CommissionPlayground({ submissions = [], agentId, tenantId, _agentName, isManagerSelf, currentGoal = null, onGoalSaved }) {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('goal');

  return (
    <div className="card flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-ink">Commission Playground</p>
        <p className="text-xs text-ink-muted mt-0.5">
          {isManagerSelf
            ? 'Calculate the activity needed to hit your personal income goal'
            : 'Reverse-engineer the activity needed to hit your income goal'}
        </p>
      </div>

      {/* Tab pills */}
      <div
        className="flex gap-1 p-1 rounded-lg bg-card-raised self-start"
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
                ? 'bg-card text-ink shadow-sm'
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
          currentGoal={currentGoal}
          onGoalSaved={onGoalSaved}
        />
      )}
      {activeTab === 'modal' && (
        <ModalTargetingTab
          defaultCommissionRate={parseFloat(userProfile?.commissionRate) || 35}
        />
      )}
    </div>
  );
}
