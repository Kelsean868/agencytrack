import React from 'react';
import { Card } from '../CardStack';

/**
 * Wizard v2 step 10 — Rate your week.
 *
 * v2 extraction of the legacy Step8SelfEvaluation component (retirement R2).
 * Faithful 1:1 port — same 5 rating keys (ratingPlanning /
 * ratingTimeManagement / ratingSalesPerformance / ratingProspecting /
 * ratingOverall) via the 1-10 button rows, same `notes` textarea, same
 * direct on-change.
 */

const RATINGS = Array.from({ length: 10 }, (_, i) => i + 1);

function RatingCard({ badge, label, name, value, onChange, desc, variant = 'default' }) {
  return (
    <Card badge={badge} desc={desc} variant={variant}>
      <div className="flex flex-col gap-2 mt-1">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium text-ink">{label}</span>
          {value > 0 && (
            <span className="text-sm font-bold text-primary">{value}/10</span>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {RATINGS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(name, n)}
              className={`w-10 h-11 rounded-lg border font-semibold text-sm transition-colors ${
                value === n
                  ? 'border-primary bg-primary dark:bg-primary-dark text-white'
                  : n < value
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-card text-ink hover:border-primary/50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function StepRateYourWeek({ data, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-muted px-1">
        Rate your performance honestly. 1 = well below expectations, 10 = outstanding. Ratings are
        visible to your manager.
      </p>

      <RatingCard
        badge="Planning"
        label="Planning Effectiveness & Effort"
        name="ratingPlanning"
        value={data.ratingPlanning}
        onChange={onChange}
        desc="How well did you plan your week and execute that plan?"
      />
      <RatingCard
        badge="Time Management"
        label="Time & Priority Management"
        name="ratingTimeManagement"
        value={data.ratingTimeManagement}
        onChange={onChange}
        desc="How effectively did you manage your time and focus on income-producing activities?"
      />
      <RatingCard
        badge="Sales"
        label="Sales Performance & Effectiveness"
        name="ratingSalesPerformance"
        value={data.ratingSalesPerformance}
        onChange={onChange}
        desc="How would you rate the quality and outcome of your sales interactions?"
      />
      <RatingCard
        badge="Prospecting"
        label="Prospecting Effort & Effectiveness"
        name="ratingProspecting"
        value={data.ratingProspecting}
        onChange={onChange}
        desc="How consistent and effective was your prospecting activity?"
      />
      <RatingCard
        badge="Overall"
        label="Overall Rating of Your Week"
        name="ratingOverall"
        value={data.ratingOverall}
        onChange={onChange}
        desc="Taking everything into account — how would you rate this week overall?"
        variant="teal"
      />

      <Card badge="Notes">
        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-xs text-ink-muted">
            Wins, challenges, things to discuss with your manager, or goals for next week.
          </p>
          <textarea
            value={data.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            rows={4}
            placeholder="Add any notes here…"
            className="w-full p-3 border border-border/60 rounded-lg bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>
      </Card>
    </div>
  );
}
