import { Card, NumericField } from '../CardStack';

export default function Step3Approaches({ data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <Card badge="Qualifying Criteria" desc="A prospect qualifies when they meet all three criteria:">
        <ul className="flex flex-col gap-1.5 mt-1">
          {[
            'Need — they have an identifiable insurance need',
            'Means — they can afford the premiums',
            'Insurability — they are likely to be approved',
          ].map((item) => (
            <li key={item} className="flex gap-2 text-xs text-ink">
              <span className="text-primary font-bold mt-px">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card badge="Approaches" desc="Contacts made with qualified prospects this week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Qualified Approaches"
            name="qualifiedApproaches"
            value={data.qualifiedApproaches}
            onChange={onChange}
            desc="Total qualified prospects you approached this week."
          />
          <NumericField
            label="Appointments Set"
            name="appointmentsSet"
            value={data.appointmentsSet}
            onChange={onChange}
            desc="Approaches that resulted in a confirmed appointment."
          />
        </div>
      </Card>

      <Card badge="FFI — Fact Finding Interview" desc="In-depth meetings to understand prospect needs and gather information.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="FFIs Scheduled"
            name="ffisScheduled"
            value={data.ffisScheduled}
            onChange={onChange}
            desc="FFI appointments booked this week (may be for a future date)."
          />
          <NumericField
            label="FFIs Conducted"
            name="ffiConducted"
            value={data.ffiConducted}
            onChange={onChange}
            desc="FFIs that were actually completed this week."
          />
        </div>
      </Card>

      <Card badge="Presentations" desc="Solution presentations delivered to prospects.">
        <NumericField
          label="Solution Presentations"
          name="solutionPresentations"
          value={data.solutionPresentations}
          onChange={onChange}
          desc="Formal product/solution presentations made to prospects this week."
        />
      </Card>
    </div>
  );
}
