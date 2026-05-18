# PR brief — Tailwind CSS-var named-utility sweep

**Sized:** XS
**Branch:** `chore/tailwind-css-var-sweep`
**Type:** Internal refactor. No user-visible surface.

## Outcome

Replace 9 arbitrary-value Tailwind utility instances wrapping CSS variables directly with their proper named token equivalents from `tailwind.config.js`. Follows PR #155 precedent (arbitrary CSS-var-syntax → named-utility sweep — CLAUDE.md banked patterns).

5 replacement rules cover all 9 sites:

1. `border-[var(--color-border)]` → `border-border` (2 sites: `WizardForm.jsx:419, :444`)
2. `bg-[color:var(--color-surface-raised)]` → `bg-surface-raised` (1 site: `NotificationDrawer.jsx:94`)
3. `border-[color:var(--color-primary)]` → `border-primary` (1 site: `NotificationDrawer.jsx:94`)
4. `hover:bg-[color:var(--color-primary-dark)]` → `hover:bg-primary-dark` (3 sites: `SaveButton.jsx:38`, `GoalDecompositionTab.jsx:299`, `CareerPortal.jsx:195`)
5. `accent-[color:var(--color-primary)]` → `accent-primary` (2 sites: `PersistencyPlayground.jsx:150, :180`)

## Out of scope

- `src/index.css` `@apply` rules wrapping CSS vars (4 call-sites in `@layer components`: `.btn-secondary`, `.card`, `.input`, `.label`) — separate sweep, requires `@apply`-resolution research first. Banked as new LOW FU in Phase 5b.
- `AgentReportDocument.jsx` — uses hardcoded hex (banked rule for `@react-pdf/renderer` compatibility).
- Any color-token addition or modification in `tailwind.config.js`.
- Dark-mode behavior changes (replacement is byte-equivalent in resolution).

## Phase 0 — gate

1. `git rev-parse --abbrev-ref HEAD` → must be `main`.
2. `git status` → working tree clean except known untracked verification scripts.
3. `git fetch --prune origin && git pull origin main` → fast-forward only.

If divergence: STOP and wait for dispatcher.

## Phase 1 — sanity checks (Rule 17 source-verify)

1. Re-grep to confirm count matches audit (9 hits across 6 files):
git grep -nE "(bg|text|border|ring|accent|hover:bg)-[(color:)?var(" src/

   Expected 9 matches. If count differs from audit, STOP and wait for dispatcher.

2. Confirm all 5 replacement tokens are defined in `tailwind.config.js`:
   - `border-border` (color `border` in extended colors)
   - `bg-surface-raised` (color `surface-raised`)
   - `border-primary` / `bg-primary` / `accent-primary` (color `primary`)
   - `bg-primary-dark` (color `primary-dark`)

   If any token is missing, STOP and wait for dispatcher.

3. Confirm `AgentReportDocument.jsx` has zero arbitrary-value matches:
git grep -nE "[(color:)?var(" src/components/reports/AgentReportDocument.jsx

   Expected: zero matches.

## Phase 2 — edits (5 rules, 9 sites, 8 file edits)

Apply `str_replace` per site. Edits 1–2 share a file; edit 3 has two replacements on one line.

**Edit 1:** `src/components/wizard/WizardForm.jsx:419`
- `border-[var(--color-border)]` → `border-border`

**Edit 2:** `src/components/wizard/WizardForm.jsx:444`
- `border-[var(--color-border)]` → `border-border`

**Edit 3:** `src/components/ui/NotificationDrawer.jsx:94` (two replacements, same line)
- `bg-[color:var(--color-surface-raised)]` → `bg-surface-raised`
- `border-[color:var(--color-primary)]` → `border-primary`

**Edit 4:** `src/components/ui/SaveButton.jsx:38`
- `hover:bg-[color:var(--color-primary-dark)]` → `hover:bg-primary-dark`

**Edit 5:** `src/components/goals/CommissionPlayground/tabs/GoalDecompositionTab.jsx:299`
- `hover:bg-[color:var(--color-primary-dark)]` → `hover:bg-primary-dark`

**Edit 6:** `src/components/profile/CareerPortal.jsx:195`
- `hover:bg-[color:var(--color-primary-dark)]` → `hover:bg-primary-dark`

**Edit 7:** `src/components/persistency/PersistencyPlayground.jsx:150`
- `accent-[color:var(--color-primary)]` → `accent-primary`

**Edit 8:** `src/components/persistency/PersistencyPlayground.jsx:180`
- `accent-[color:var(--color-primary)]` → `accent-primary`

Final sanity grep after all edits:
git grep -nE "(bg|text|border|ring|accent|hover:bg)-[(color:)?var(" src/

Expected: zero matches. If any remain, STOP and wait for dispatcher.

## Phase 3 — verification

1. `npm run lint` → expect clean. If lint surfaces an error on a file outside the edit set, STOP and wait for dispatcher.

2. `npm run build` → expect clean. Build produces `dist/assets/index-*.css`.

3. Static CSS verification (load-bearing per CLAUDE.md banked pattern): grep compiled CSS for each replacement class. Each pattern must produce at least one match:

   - `.border-border` rule
   - `.bg-surface-raised` rule
   - `.border-primary` rule
   - `.hover\:bg-primary-dark` rule (note Tailwind escapes the colon)
   - `.accent-primary` rule

4. `accent-primary` specific verification (audit-flagged risk): confirm the emitted `.accent-primary` rule resolves to the primary channel-split CSS variable. If `accent-primary` does NOT emit (Tailwind 3 default did not generate the utility for `accentColor`), STOP and wait for dispatcher — `tailwind.config.js` may need an explicit `accentColor` extension to enable the utility.

5. Run targeted tests in case any snapshot class names:
npm test -- --run src/components/wizard/tests src/components/ui/tests src/components/persistency/tests src/components/goals src/components/profile

   Expect tests to pass. If a snapshot fails due to class-name change, update the snapshot and note in commit message.

## Phase 4 — smoke

**Waived with static-CSS verification as substitute.**

Justification: internal refactor with byte-equivalent computed-style resolution (channel-split tokens resolve to the same CSS variable values). Static CSS bundle inspection in Phase 3 step 3 is the load-bearing check per CLAUDE.md "Smoke is CC's default" + "Static CSS verification" carve-out for arbitrary-value → named-utility sweeps. Precedent: PR #155.

Include this justification text in the PR description.

## Phase 5 — commit, push, open PR

1. Fresh branch off Phase 0 SHA: `git checkout -b chore/tailwind-css-var-sweep` (Rule 1).
2. Stage all changed files (6 source files + `docs/FOLLOW_UPS.md` from Phase 5b + `docs/CONTEXT.md` from Phase 5c).
3. Commit message:
chore(tailwind): replace 9 bg-[var(--color-X)] arbitrary-value utilities with named tokens
Follows PR #155 precedent. Channel-split tokens preserve dark-mode behavior:

border-[var(--color-border)] (2x) -> border-border
bg-[color:var(--color-surface-raised)] (1x) -> bg-surface-raised
border-[color:var(--color-primary)] (1x) -> border-primary
hover:bg-[color:var(--color-primary-dark)] (3x) -> hover:bg-primary-dark
accent-[color:var(--color-primary)] (2x) -> accent-primary

Static CSS verification: all 5 replacement classes emit into compiled bundle.
Smoke waived: internal refactor, no user-visible behavior change.
Out of scope (banked as new LOW FU): src/index.css @apply bg-[color:var(...)]
rules in @layer components (.btn-secondary, .card, .input, .label) -- requires
@apply-resolution research before sweeping.

4. Push: `git push -u origin chore/tailwind-css-var-sweep`.
5. Open PR via `gh pr create` or GitHub UI. Title: `chore(tailwind): replace 9 arbitrary-value CSS-var utilities with named tokens`.
6. Surface PR URL.

## Phase 5b — bank @apply sweep as new LOW FU

Append to `docs/FOLLOW_UPS.md` under LOW tier (after existing entries):
@apply bg-[color:var(--color-X)] sweep in src/index.css (LOW, refactor)
Banked from PR #TBD ({TBD}) audit. 4 call-sites in src/index.css @layer components
definitions (.btn-secondary, .card, .input, .label) use @apply with
arbitrary-value CSS-var syntax — out of scope for the JSX sweep that PR #TBD addressed.
@apply resolution semantics may differ between arbitrary-value
(@apply bg-[color:var(--color-card)]) and named-utility (@apply bg-card)
syntax inside @layer rules. Requires verification that the compiled output is
byte-equivalent before sweeping.
Next action: scratch-build verification — change one of the 4 call-sites to named
utility, run npm run build, compare compiled dist/assets/index-*.css for that
class rule against baseline. If equivalent, ship the sweep. If divergent, document
the cause and leave as-is.
Banked: PR #TBD ({TBD}).

## Phase 5c — update CONTEXT.md

1. Drop oldest row in Recently-shipped table.
2. Add new row with `#TBD` / `{TBD}` placeholders. Description: "Tailwind CSS-var sweep — 9 arbitrary-value utilities replaced with named tokens across 6 files (PR #155 precedent). New LOW FU banked: @apply sweep in src/index.css @layer components."
3. Update `Current main HEAD` field to `{TBD}`.
4. Update `Active track` to "Tailwind CSS-var sweep — chore/tailwind-css-var-sweep in flight."
5. Update `Next track` to "Pending: @apply sweep audit, Resend invite mail/ swap, /post-merge UI discovery investigation."
6. Update "Where we left off" prose: 1–2 short paragraphs noting this PR shipped 9 utility replacements with static CSS verification, banked the @apply adjacency as new LOW FU, and provided the second data point on the slash command UI display anomaly via the /dispatch invocation.

## Phase 6 — held

Do NOT auto-execute Phase 6. Dispatcher confirms merge in GitHub UI, then invokes `/post-merge <pr-number>` separately.

**This is the second data point on the `/post-merge` slash command UI display anomaly** (per FU banked at `ff0f562`). Note in the post-merge summary whether the operator-facing CLI displayed the command as recognized this time, for FU resolution direction.

If `/post-merge` slash command discovery fails operator-side again, fall back to canonical Session Protocol step 9 + § Post-merge local cleanup sequence manually, and update the slash command UI discovery FU with the second data point details.
