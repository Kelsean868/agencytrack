import React from 'react';
import AgentProductionView from './AgentProductionView';
import UnitManagerProductionView from './UnitManagerProductionView';
import BranchManagerProductionView from './BranchManagerProductionView';

export default function ProductionReportTab({ userRole }) {
  if (userRole === 'agent') {
    return <AgentProductionView />;
  }
  if (userRole === 'unit_manager') {
    return <UnitManagerProductionView />;
  }
  return <BranchManagerProductionView />;
}
