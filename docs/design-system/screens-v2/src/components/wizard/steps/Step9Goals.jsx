import { Card, NumericField, CurrencyField } from '../CardStack';
import { formatCurrency } from '../../../utils/formatters';

export default function Step9Goals({ data, onChange }) {
  const hasTarget = (data.targetAPI ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <Card badge="Prospecting Goals" desc="How many dials and contacts are you committing to next week?">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Target Dials"
            name="targetDials"
            value={data.targetDials}
            onChange={onChange}
            desc="Total outbound call attempts you plan to make."
          />
          <NumericField
            label="Target Tel Contacts"
            name="targetTelContacts"
            value={data.targetTelContacts}
            onChange={onChange}
            desc="Calls where you successfully speak with a prospect."
          />
          <NumericField
            label="Target F2F Attempts"
            name="targetF2FAttempts"
            value={data.targetF2FAttempts}
            onChange={onChange}
            desc="In-person prospecting contacts you aim to make."
          />
        </div>
      </Card>

      <Card badge="Activity Goals" desc="Meetings and interviews you are committing to next week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Target FFI"
            name="targetFFI"
            value={data.targetFFI}
            onChange={onChange}
            desc="Fact-finding interviews you plan to conduct."
          />
          <NumericField
            label="Target CI"
            name="targetCI"
            value={data.targetCI}
            onChange={onChange}
            desc="Closing interviews you plan to conduct."
          />
        </div>
      </Card>

      <Card badge="Production Goals" desc="Sales targets you are committing to next week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Target Applications Sold"
            name="targetAppsSold"
            value={data.targetAppsSold}
            onChange={onChange}
            desc="Number of new policy applications you aim to close."
          />
          <CurrencyField
            label="Target API (TTD)"
            name="targetAPI"
            value={data.targetAPI}
            onChange={onChange}
            desc="Annual Premium Income you are targeting for next week's sales."
          />
        </div>
      </Card>

      {hasTarget && (
        <Card variant="teal">
          <p className="text-sm font-semibold text-primary text-center">
            You're targeting {formatCurrency(data.targetAPI)} in API next week.
          </p>
        </Card>
      )}

      <Card badge="Notes">
        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-xs text-ink-muted">
            Any commitments, focus areas, or things you want to hold yourself accountable to.
          </p>
          <textarea
            value={data.goalNotes}
            onChange={(e) => {
              if (e.target.value.length <= 500) onChange('goalNotes', e.target.value);
            }}
            rows={3}
            maxLength={500}
            placeholder="Optional — your goals for next week…"
            className="w-full p-3 border border-border/60 rounded-lg bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
          <p className="text-xs text-ink-muted text-right">
            {(data.goalNotes ?? '').length}/500
          </p>
        </div>
      </Card>
    </div>
  );
}
