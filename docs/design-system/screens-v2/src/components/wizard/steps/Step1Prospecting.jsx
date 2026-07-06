import { Card, NumericField } from '../CardStack';

export default function Step1Prospecting({ data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <Card badge="Letters & Outreach" desc="Outgoing letters and emails sent to prospects this week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="Prospecting Letters Sent"
            name="prospectingLettersSent"
            value={data.prospectingLettersSent}
            onChange={onChange}
          />
          <NumericField
            label="Prospecting Emails Sent"
            name="prospectingEmailsSent"
            value={data.prospectingEmailsSent}
            onChange={onChange}
          />
        </div>
      </Card>

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

      <Card badge="Face-to-Face" desc="Direct in-person prospecting contacts made this week.">
        <div className="flex flex-col gap-4">
          <NumericField
            label="F2F Attempts"
            name="f2fAttempts"
            value={data.f2fAttempts}
            onChange={onChange}
            desc="Total in-person prospecting attempts made."
          />
          <NumericField
            label="F2F Contacts"
            name="f2fContacts"
            value={data.f2fContacts}
            onChange={onChange}
            desc="Attempts that resulted in a meaningful conversation."
          />
        </div>
      </Card>
    </div>
  );
}
