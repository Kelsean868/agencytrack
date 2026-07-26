// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SavedScenarioChips from '../components/SavedScenarioChips.jsx';
import { COMMISSION_SCENARIO_CAP } from '../../../../services/userPrefsService';

const mk = (n) => Array.from({ length: n }, (_, i) => ({
  id: `sc-${i}`, label: `Scenario ${i}`, savedAt: '2026-07-25T10:00:00.000Z',
  inputs: { incomeGoal: 300000 + i }, freqKey: 'annual',
}));

describe('SavedScenarioChips — R-06', () => {
  it('shows the invitation empty state and the count when there are no scenarios', () => {
    render(<SavedScenarioChips scenarios={[]} />);
    expect(screen.getByTestId('scenario-chips-empty')).toBeInTheDocument();
    expect(screen.getByTestId('scenario-chips')).toHaveTextContent(`0/${COMMISSION_SCENARIO_CAP}`);
  });

  it('renders one apply + delete control per scenario, labelled', () => {
    render(<SavedScenarioChips scenarios={mk(2)} />);
    expect(screen.getByTestId('scenario-apply-sc-0')).toHaveTextContent('Scenario 0');
    expect(screen.getByTestId('scenario-apply-sc-1')).toHaveTextContent('Scenario 1');
    expect(screen.getByTestId('scenario-delete-sc-0')).toBeInTheDocument();
    expect(screen.queryByTestId('scenario-chips-empty')).toBeNull();
  });

  it('applying a chip hands the WHOLE scenario back (inputs + cadence), not just its id', () => {
    const onApply = vi.fn();
    const [s] = mk(1);
    render(<SavedScenarioChips scenarios={[s]} onApply={onApply} />);
    fireEvent.click(screen.getByTestId('scenario-apply-sc-0'));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sc-0', inputs: { incomeGoal: 300000 }, freqKey: 'annual',
    }));
  });

  it('saving prompts for a name and emits the trimmed label', () => {
    const onSave = vi.fn();
    render(<SavedScenarioChips scenarios={[]} onSave={onSave} />);
    fireEvent.click(screen.getByTestId('scenario-save-open'));
    fireEvent.change(screen.getByTestId('scenario-name-input'), { target: { value: '  Stretch goal  ' } });
    fireEvent.click(screen.getByTestId('scenario-save-confirm'));
    expect(onSave).toHaveBeenCalledWith('Stretch goal');
  });

  it('does not emit a save for a blank name', () => {
    const onSave = vi.fn();
    render(<SavedScenarioChips scenarios={[]} onSave={onSave} />);
    fireEvent.click(screen.getByTestId('scenario-save-open'));
    fireEvent.change(screen.getByTestId('scenario-name-input'), { target: { value: '   ' } });
    expect(screen.getByTestId('scenario-save-confirm')).toBeDisabled();
    fireEvent.click(screen.getByTestId('scenario-save-confirm'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('deleting emits the scenario id', () => {
    const onDelete = vi.fn();
    render(<SavedScenarioChips scenarios={mk(1)} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('scenario-delete-sc-0'));
    expect(onDelete).toHaveBeenCalledWith('sc-0');
  });

  it('disables saving at the cap and says why', () => {
    render(<SavedScenarioChips scenarios={mk(COMMISSION_SCENARIO_CAP)} />);
    const btn = screen.getByTestId('scenario-save-open');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(`Limit ${COMMISSION_SCENARIO_CAP}`);
    expect(screen.getByTestId('scenario-chips'))
      .toHaveTextContent(`${COMMISSION_SCENARIO_CAP}/${COMMISSION_SCENARIO_CAP}`);
  });

  it('marks THE active scenario chip (sc-1) distinctly, and not the inactive one (sc-0)', () => {
    render(<SavedScenarioChips scenarios={mk(2)} activeId="sc-1" />);
    // Identify each chip by ITS OWN scenario, not by counting — a count-only
    // assertion passes even if the styling lands on the wrong chip.
    const activeChip   = screen.getByTestId('scenario-apply-sc-1').closest('span');
    const inactiveChip = screen.getByTestId('scenario-apply-sc-0').closest('span');
    expect(activeChip.className).toContain('border-primary');
    expect(inactiveChip.className).not.toContain('border-primary');
    expect(inactiveChip.className).toContain('border-border');
  });
});
