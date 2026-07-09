import React from 'react';
import AgentProductionView from './AgentProductionView';
import UnitManagerProductionView from './UnitManagerProductionView';
import BranchManagerProductionView from './BranchManagerProductionView';

/**
 * @param {string}   props.userRole
 * @param {Function} [props.onDownloadPDF]  agent view only — wires to the host
 *   dashboard's existing ReportRangeModal → generateAgentPDF flow (the manager
 *   views self-generate their Branch/Unit PDFs from their own loaded data).
 * @param {boolean}  [props.generating]     agent PDF generation in flight
 */
export default function ProductionReportTab({ userRole, onDownloadPDF, generating = false }) {
  if (userRole === 'agent') {
    return <AgentProductionView onDownloadPDF={onDownloadPDF} generating={generating} />;
  }
  if (userRole === 'unit_manager') {
    return <UnitManagerProductionView />;
  }
  return <BranchManagerProductionView />;
}
