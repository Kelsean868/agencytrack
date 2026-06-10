/**
 * Track J Wizard v2 PR1 — Activity step 2 of 5: "Seminars & tradeshows".
 *
 * Collapsed to 4 fields (seminars-tradeshows-wirein): agents CONDUCT seminars
 * and ATTEND tradeshows. The 2×2 "conducted/attended" split is dropped.
 * seminarsConducted + tradeshowsAttended now feed prospectingTouches.
 *
 * Pure re-fan; the legacy `Step1Prospecting.jsx` file is intentionally
 * NOT modified.
 */

import React from 'react';
import { Card, NumericField } from '../CardStack';

export default function StepSeminarsTradeshows({ data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <Card badge="Seminars" desc="Seminars you conducted and names collected.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Seminars Conducted"
            name="seminarsConducted"
            value={data.seminarsConducted}
            onChange={onChange}
          />
          <NumericField
            label="Names from Seminars Conducted"
            name="namesFromSeminarsConducted"
            value={data.namesFromSeminarsConducted}
            onChange={onChange}
          />
        </div>
      </Card>

      <Card badge="Tradeshows" desc="Tradeshows you attended and names collected.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Tradeshows Attended"
            name="tradeshowsAttended"
            value={data.tradeshowsAttended}
            onChange={onChange}
          />
          <NumericField
            label="Names from Tradeshows Attended"
            name="namesFromTradeshowsAttended"
            value={data.namesFromTradeshowsAttended}
            onChange={onChange}
          />
        </div>
      </Card>
    </div>
  );
}
