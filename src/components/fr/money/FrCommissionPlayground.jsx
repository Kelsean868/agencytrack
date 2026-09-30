import React, { useMemo } from 'react';
import useMinWidth from '../../../hooks/useMinWidth';
import useGoalDecomposition from '../../goals/CommissionPlayground/tabs/useGoalDecomposition';
import useModalTargeting from '../../goals/CommissionPlayground/tabs/useModalTargeting';
import { buildInsights } from '../../goals/CommissionPlayground/utils/insights';
import FrCommissionView from './FrCommissionView';

/**
 * FrCommissionPlayground — the FR layout of the Commission playground (R2-7).
 * Rendered by CommissionPlayground (look="fr") in place of its Nexus card.
 * Each calculator mode is its own component that runs the SAME hook as the
 * Nexus tab (useGoalDecomposition / useModalTargeting) and mounts only while
 * its mode is shown — exactly as the Nexus tabs mount and unmount — so every
 * read, save, scenario and derivation is shared. Layout by width:
 * phone < 768 ≤ tablet < 1280 ≤ desktop.
 *
 * @param {{ activeTab: 'goal'|'modal', onTabChange: Function, submissions?: object[],
 *           agentId: string, tenantId: string, currentGoal?: number|null,
 *           onGoalSaved?: Function, defaultCommissionRate: number }} props
 */
function useLayout() {
  const wide = useMinWidth(768);
  const desktop = useMinWidth(1280);
  return !wide ? 'phone' : desktop ? 'desktop' : 'tablet';
}

function FrGoalTab({ layout, onTabChange, submissions, agentId, tenantId, currentGoal, onGoalSaved }) {
  const goal = useGoalDecomposition({ submissions, agentId, tenantId, onGoalSaved });
  return <FrCommissionView layout={layout} tab="goal" onTabChange={onTabChange} goal={{ ...goal, currentGoal }} />;
}

function FrModalTab({ layout, onTabChange, defaultCommissionRate }) {
  const modal = useModalTargeting({ defaultCommissionRate });
  const { totalApi, modeMix, commissionRate, targetCommission } = modal;
  const insights = useMemo(
    () => (totalApi > 0 ? buildInsights({ totalApi, modeMix, commissionRate, targetCommission }) : []),
    [totalApi, modeMix, commissionRate, targetCommission],
  );
  return <FrCommissionView layout={layout} tab="modal" onTabChange={onTabChange} modal={{ ...modal, insights }} />;
}

export default function FrCommissionPlayground({
  activeTab, onTabChange, submissions = [], agentId, tenantId, currentGoal = null, onGoalSaved, defaultCommissionRate,
}) {
  const layout = useLayout();
  if (activeTab === 'goal') {
    return (
      <FrGoalTab
        layout={layout}
        onTabChange={onTabChange}
        submissions={submissions}
        agentId={agentId}
        tenantId={tenantId}
        currentGoal={currentGoal}
        onGoalSaved={onGoalSaved}
      />
    );
  }
  if (activeTab === 'modal') {
    return <FrModalTab layout={layout} onTabChange={onTabChange} defaultCommissionRate={defaultCommissionRate} />;
  }
  throw new Error(`FrCommissionPlayground: unknown tab "${activeTab}"`);
}
