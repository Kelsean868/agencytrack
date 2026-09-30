import React from 'react';
import useMinWidth from '../../../hooks/useMinWidth';
import FrGamePlanView from './FrGamePlanView';
import { gamePlanModel } from './gamePlanModel';

/**
 * FrGamePlan — the FR layout switch for the Game plan hub (R2-8). Rendered by
 * GamePlanScreen (dashboard/GamePlanV2) in place of its Nexus content block,
 * only under the FR look. It receives the hub's ALREADY-DERIVED values and
 * handlers — no read, no derivation of its own beyond arranging them
 * (gamePlanModel) — and picks one layout by width (same switch as FrToday).
 *
 * @param {{ values: object, onOpenMoneyNeeds?: Function, onOpenMonthlyPlan?: Function,
 *           onOpenReviewCommit?: Function, slots?: object }} props
 */
export default function FrGamePlan({ values, onOpenMoneyNeeds, onOpenMonthlyPlan, onOpenReviewCommit, slots }) {
  const wide = useMinWidth(768);
  const model = gamePlanModel(values);
  return (
    <FrGamePlanView
      model={model}
      wide={wide}
      onOpenMoneyNeeds={onOpenMoneyNeeds}
      onOpenMonthlyPlan={onOpenMonthlyPlan}
      onOpenReviewCommit={onOpenReviewCommit}
      slots={slots}
    />
  );
}
