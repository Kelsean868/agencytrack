// @vitest-environment jsdom
//
// FlagRow is fully controlled (no internal state) — `confirming` is a prop
// the parent owns. This wrapper mirrors how a real parent would flip it in
// response to onRequestEnable/onCancelConfirm, so the test exercises the
// real OFF → confirm-strip → Enable-now interaction rather than re-rendering
// with hardcoded props.

import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import FlagRow from '../FlagRow';

const FLAG = { id: 'persistency-v2', key: 'persistency.v2_model', name: 'Persistency v2 model', desc: 'Uses the v2 persistency calc for all agents.' };

function ControlledFlagRow({ onConfirmEnable, onDisable }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <FlagRow
      flag={FLAG}
      on={false}
      confirming={confirming}
      onRequestEnable={() => setConfirming(true)}
      onCancelConfirm={() => setConfirming(false)}
      onConfirmEnable={onConfirmEnable}
      onDisable={onDisable}
      userCount={214}
      company="Tatil Life"
    />
  );
}

describe('FlagRow — OFF state confirm-strip interaction', () => {
  it('opens the danger confirm strip on "Enable for everyone" and commits via "Enable now"', () => {
    const onConfirmEnable = vi.fn();
    render(<ControlledFlagRow onConfirmEnable={onConfirmEnable} onDisable={vi.fn()} />);

    expect(screen.getByText('NOT SET → OFF')).toBeInTheDocument();
    expect(screen.queryByTestId('ccfg-flag-confirm-persistency.v2_model')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ccfg-flag-enable-persistency.v2_model'));

    const strip = screen.getByTestId('ccfg-flag-confirm-persistency.v2_model');
    expect(strip).toHaveTextContent('Turn on Persistency v2 model for all 214 users at Tatil Life, effective immediately?');

    fireEvent.click(screen.getByTestId('ccfg-flag-confirm-enable-persistency.v2_model'));
    expect(onConfirmEnable).toHaveBeenCalledTimes(1);
  });

  it('Cancel closes the confirm strip without committing', () => {
    const onConfirmEnable = vi.fn();
    render(<ControlledFlagRow onConfirmEnable={onConfirmEnable} onDisable={vi.fn()} />);

    fireEvent.click(screen.getByTestId('ccfg-flag-enable-persistency.v2_model'));
    expect(screen.getByTestId('ccfg-flag-confirm-persistency.v2_model')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ccfg-flag-cancel-persistency.v2_model'));
    expect(screen.queryByTestId('ccfg-flag-confirm-persistency.v2_model')).not.toBeInTheDocument();
    expect(onConfirmEnable).not.toHaveBeenCalled();
  });
});
