import { useMemo } from 'react';
import { Card, NumericField, CurrencyField, SuggestedField } from '../CardStack';

export default function Step4ClosingSales({ data, onChange }) {
  const suggestedCiConducted = useMemo(
    () => (data.newCIBooked ?? 0) + (data.oldCIBooked ?? 0),
    [data.newCIBooked, data.oldCIBooked]
  );

  return (
    <div className="flex flex-col gap-4">
      <Card badge="Closing Interviews" desc="A CI is a scheduled meeting where you present the solution and ask for the sale.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="New CIs Booked"
            name="newCIBooked"
            value={data.newCIBooked}
            onChange={onChange}
            desc="Closing interview appointments booked this week with new prospects."
          />
          <NumericField
            label="Old CIs Booked"
            name="oldCIBooked"
            value={data.oldCIBooked}
            onChange={onChange}
            desc="Closing interview appointments booked this week with previously seen prospects."
          />
          <SuggestedField
            label="CIs Conducted"
            name="ciConducted"
            value={data.ciConducted}
            onChange={onChange}
            suggestion={suggestedCiConducted}
            note="adjust if different"
            desc="Total closing interviews actually completed this week."
          />
        </div>
      </Card>

      <Card badge="Sales Results" desc="Applications sold and lives covered this week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Applications Sold"
            name="applicationsSold"
            value={data.applicationsSold}
            onChange={onChange}
            desc="Number of new policy applications completed and submitted."
          />
          <NumericField
            label="Lives Sold"
            name="livesSold"
            value={data.livesSold}
            onChange={onChange}
            desc="Total lives covered across all applications sold this week."
          />
        </div>
      </Card>

      <Card badge="Production Value" desc="Annual Premium Income and estimated commissions from this week's sales.">
        <div className="flex flex-col gap-4">
          <CurrencyField
            label="API Sold (TTD)"
            name="apiSold"
            value={data.apiSold}
            onChange={onChange}
            desc="Total Annual Premium Income from all applications sold this week."
          />
          <CurrencyField
            label="Estimated Commissions (TTD)"
            name="estimatedCommissions"
            value={data.estimatedCommissions}
            onChange={onChange}
            desc="Your estimated commission earnings from this week's sales."
          />
        </div>
      </Card>
    </div>
  );
}
