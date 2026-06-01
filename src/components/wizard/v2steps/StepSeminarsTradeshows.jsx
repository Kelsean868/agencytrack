/**
 * Track J Wizard v2 PR1 — Activity step 2 of 5: "Seminars & tradeshows".
 *
 * v2 re-pagination of the legacy Step1Prospecting's "Seminars" + "Tradeshows"
 * Cards. Identical field markup as the legacy step — same `NumericField`s,
 * same `name` keys, same parent `onChange` flow. Persisted fields unchanged.
 *
 * Pure re-fan; the legacy `Step1Prospecting.jsx` file is intentionally
 * NOT modified.
 */

import React from 'react';
import { Card, NumericField } from '../CardStack';

export default function StepSeminarsTradeshows({ data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <Card badge="Seminars" desc="Seminars you conducted or attended, and names collected from each.">
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
          <NumericField
            label="Seminars Attended"
            name="seminarsAttended"
            value={data.seminarsAttended}
            onChange={onChange}
          />
          <NumericField
            label="Names from Seminars Attended"
            name="namesFromSeminarsAttended"
            value={data.namesFromSeminarsAttended}
            onChange={onChange}
          />
        </div>
      </Card>

      <Card badge="Tradeshows" desc="Tradeshows you conducted or attended, and names collected.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Tradeshows Conducted"
            name="tradeshowsConducted"
            value={data.tradeshowsConducted}
            onChange={onChange}
          />
          <NumericField
            label="Names from Tradeshows Conducted"
            name="namesFromTradeshowsConducted"
            value={data.namesFromTradeshowsConducted}
            onChange={onChange}
          />
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
