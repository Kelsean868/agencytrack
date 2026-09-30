import React from 'react';
import useExpenseGroupEditor from '../../agent/useExpenseGroupEditor';
import { annualizeAmount } from '../../../services/moneyNeedsService';
import FrWorksheetGroup from './FrWorksheetGroup';
import { moneyNeedsRow, moneyNeedsGroupHeader } from './moneyNeedsModel';

/**
 * FrMoneyNeedsGroup — CONTAINER for one FR worksheet group (R2-9). Runs the
 * SAME edit + save code as the Nexus accordion (useExpenseGroupEditor) and
 * hands the view formatted rows plus the hook's own handlers, unchanged.
 * Row yearly figures use annualizeAmount exactly as the Nexus row does.
 */
export default function FrMoneyNeedsGroup({
  groupKey, label, colorIndex, group, worksheetDoc, onGroupSaved, onOpenCalc, layout, open, onToggle,
}) {
  const {
    localItems, groupAnnualTotal, filledCount, saving, saveError,
    handleAddItem, handleDeleteItem, handleItemChange, handleResetCalcLine, handleBlur,
  } = useExpenseGroupEditor({ groupKey, group, worksheetDoc, onGroupSaved });

  const rows = localItems.map((item) => moneyNeedsRow(item, annualizeAmount(item.amount, item.frequency)));
  const header = moneyNeedsGroupHeader({ filledCount, count: localItems.length, total: groupAnnualTotal });

  return (
    <FrWorksheetGroup
      groupKey={groupKey}
      label={label}
      colorIndex={colorIndex}
      header={header}
      rows={rows}
      layout={layout}
      open={open}
      onToggle={onToggle}
      saving={saving}
      saveError={saveError}
      onChange={handleItemChange}
      onBlur={handleBlur}
      onDelete={handleDeleteItem}
      onReset={handleResetCalcLine}
      onAdd={handleAddItem}
      onOpenCalc={onOpenCalc}
    />
  );
}
