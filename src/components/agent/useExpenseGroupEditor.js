import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  updateExpenseGroup, annualizeAmount, computeGroupTotal, calcFedValue,
} from '../../services/moneyNeedsService';

function makeItemId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * useExpenseGroupEditor — the edit + save state of ONE Money needs expense
 * group, moved verbatim out of MoneyNeedsPanel's ExpenseGroupAccordion (R2-9)
 * so the Nexus accordion and the FR worksheet group run the SAME code: the
 * same local line items, the same save payload through updateExpenseGroup,
 * the same calc-fed override / reset rules, the same derived group total and
 * filled count. Pinned by MoneyNeedsPanel.characterization.test.jsx.
 *
 * @param {{ groupKey: string, group: object|undefined, worksheetDoc: object,
 *           onGroupSaved: (groupKey: string, updatedGroup: object, rollup: object) => void }} args
 */
export default function useExpenseGroupEditor({ groupKey, group, worksheetDoc, onGroupSaved }) {
  const { tenantId, user } = useAuth();
  const [localItems, setLocalItems] = useState(() => group?.lineItems ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setLocalItems(group?.lineItems ?? []);
  }, [group]);

  async function saveGroup(items) {
    setSaving(true);
    setSaveError('');
    try {
      const processedItems = items.map((item) => {
        const amount = parseFloat(item.amount) || 0;
        return {
          ...item,
          amount,
          annualizedAmount: annualizeAmount(amount, item.frequency),
        };
      });
      const groupAnnualTotal = computeGroupTotal({ lineItems: processedItems });
      const updatedGroup = {
        lineItems: processedItems,
        subCalculatorRefs: [],
        groupAnnualTotal,
      };
      const newAllGroups = { ...worksheetDoc.expenseGroups, [groupKey]: updatedGroup };
      const rollup = await updateExpenseGroup(
        tenantId, user.uid, worksheetDoc.year, groupKey, updatedGroup, newAllGroups,
      );
      onGroupSaved(groupKey, updatedGroup, rollup);
    } catch {
      setSaveError('Save failed — check connection.');
    } finally {
      setSaving(false);
    }
  }

  function handleAddItem() {
    const newItem = {
      id: makeItemId(),
      label: '',
      amount: 0,
      frequency: 'M',
      annualizedAmount: 0,
      isCustom: true,
    };
    const next = [...localItems, newItem];
    setLocalItems(next);
    saveGroup(next);
  }

  function handleDeleteItem(id) {
    const next = localItems.filter((i) => i.id !== id);
    setLocalItems(next);
    saveGroup(next);
  }

  // Editing a calc-fed line's amount/frequency stores an explicit override.
  function handleItemChange(id, field, value, saveNow = false) {
    const next = localItems.map((i) => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (i.calcKey && (field === 'amount' || field === 'frequency')) updated.isOverridden = true;
      return updated;
    });
    setLocalItems(next);
    if (saveNow) saveGroup(next);
  }

  // Reset a calc-fed line back to its current calculator value.
  function handleResetCalcLine(id) {
    const next = localItems.map((i) => {
      if (i.id !== id || !i.calcKey) return i;
      const synced = calcFedValue(i.calcKey, worksheetDoc.subCalculators);
      return { ...i, isOverridden: false, amount: synced, frequency: 'A', annualizedAmount: synced };
    });
    setLocalItems(next);
    saveGroup(next);
  }

  function handleBlur() {
    saveGroup(localItems);
  }

  const calcFedItems = localItems.filter((i) => i.calcKey);
  const manualItems = localItems.filter((i) => !i.calcKey);

  const groupAnnualTotal = computeGroupTotal({
    lineItems: localItems.map((item) => ({
      ...item,
      annualizedAmount: annualizeAmount(parseFloat(item.amount) || 0, item.frequency),
    })),
  });

  const filledCount = localItems.filter((i) => (parseFloat(i.amount) || 0) > 0).length;

  return {
    localItems,
    calcFedItems,
    manualItems,
    groupAnnualTotal,
    filledCount,
    saving,
    saveError,
    handleAddItem,
    handleDeleteItem,
    handleItemChange,
    handleResetCalcLine,
    handleBlur,
  };
}
