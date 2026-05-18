# PR brief — @apply CSS-var named-utility sweep

**Sized:** XS
**Branch:** `chore/tailwind-apply-css-var-sweep`
**Type:** Internal refactor (CSS-only, single file). Runtime-equivalent at default opacity, capability-additive.

## Outcome

Sweep 11 `@apply` arbitrary-value CSS-var instances in `src/index.css` `@layer components` rules to named-utility equivalents from `tailwind.config.js`. Closes the `@apply` sweep FU banked from PR #219 (`0b3f058`).

Token mapping (6 rules, 11 substitutions across 4 component rules):

1. `bg-[color:var(--color-surface)]` → `bg-card`
2. `bg-[color:var(--color-surface-muted)]` → `bg-surface-muted` (hover only)
3. `border-[color:var(--color-border)]` → `border-border`
4. `text-[color:var(--color-text)]` → `text-ink`
5. `text-[color:var(--color-text-muted)]` → `text-ink-muted`
6. `placeholder-[color:var(--color-text-faint)]` → `placeholder-ink-faint`

Distribution per audit: `.btn-secondary` (4), `.card` (2), `.input` (4), `.label` (1) = 11 total.

## Decisions locked

- **Text family maps to `ink` Tailwind namespace** per PR-C-FU3 convention. Intentional — avoids `text-text-*` redundancy. NOT a naming error. CC must apply mapping rules 4–6 without surfacing as a decision point.
- **Bundle hash will change** — named utilities emit `rgb(var(--X-channels) / <alpha-value>)` form vs bare `var(--color-X)` aliases. Expected divergence.
- **Bundle grows ~400 bytes** — accepted. Capability-additive: named form supports opacity modifiers (`bg-card/50` etc.). Arbitrary-value form did not.
- **Verification axis is "structurally equivalent runtime behavior"**, not byte-equivalent. Audit confirmed identical color resolution at default opacity, same specificity, same cascade order.

## Out of scope

- `AgentReportDocument.jsx` (canonical path: `src/components/profile/AgentReportDocument.jsx`) — uses hardcoded hex only per banked rule for `@react-pdf/renderer` compatibility
- Any color-token addition or modification in `tailwind.config.js`
- Working-tree cleanup of 7 untracked verification scripts (separate housekeeping concern)
- Dark-mode behavior changes (both forms resolve identically in dark mode per audit)
- JSX surface (PR #219 closed that scope)

## Phase 0 — gate

Standard. STOP and wait for dispatcher on any divergence.

## Phase 1 — sanity checks (Rule 17 source-verify)

1. Confirm 4 `@apply` rules + 11 substitution sites:
git grep -nE "@apply.*[(color:)?var(" src/index.css
   Expected ≥4 lines (multi-line `@apply` chains expected). Per-rule sub-counts: `.btn-secondary` (4), `.card` (2), `.input` (4), `.label` (1) = 11 total substitutions. If structural shape differs from audit, STOP and wait for dispatcher.

2. Confirm all 6 replacement tokens exist in `tailwind.config.js`:
Select-String -Path tailwind.config.js -Pattern "card:|surface-muted:|border:|ink:" -CaseSensitive
   Required tokens: `bg-card`, `bg-surface-muted`, `border-border`, `text-ink`, `text-ink-muted`, `placeholder-ink-faint`. Note `text-ink` etc. derive from the `ink` color family — text-prefix utility comes from Tailwind's default `text-{color}` shorthand.

3. Verify `src/components/profile/AgentReportDocument.jsx` (canonical path — DO NOT use `src/components/reports/` per PR #219 Rule 17 catch) has zero arbitrary-value matches:
git grep -nE "[(color:)?var(" src/components/profile/AgentReportDocument.jsx
   Expected: 0.

4. Verify post-PR-#219 JSX state still clean:
git grep -nE "(bg|text|border|ring|accent|hover:bg)-[(color:)?var(" src/ -- ":!src/index.css"
   Expected: 0 matches outside `src/index.css`.

## Phase 2 — edits

Apply the 6-rule mapping table to `src/index.css`. Sequence:

1. Read `src/index.css` fully to get current state of the 4 affected rules.
2. For each of the 6 mapping rules, apply `str_replace` per occurrence (or `replace_all` where the source pattern is unique in-file).
3. After applying all 6 mapping rules, run final sanity grep:
git grep -nE "@apply.*[(color:)?var(" src/index.css
   Expected: 0 matches. If any remain, STOP and wait for dispatcher — premise mismatch.

4. Full-src sanity check:
git grep -nE "[(color:)?var(" src/
   Expected: 0 matches anywhere in `src/`.

## Phase 3 — verification

1. `npm run lint` → clean. STOP if errors surface on a file outside this PR's edit set.

2. `npm run build` → clean. Build produces `dist/assets/index-*.css`. Bundle hash WILL differ from baseline — expected.

3. Static CSS structural verification (load-bearing per CLAUDE.md banked pattern, axis shifted from byte- to structural-equivalent per this PR's decision-lock):

   Extract each of `.btn-secondary`, `.card`, `.input`, `.label` rule bodies from new compiled CSS:
$css = (Get-ChildItem dist/assets/index-*.css | Select-Object -First 1).FullName

   For each rule, verify it contains the channel-split form (NOT the bare `var(--color-X)` form):
   - `background-color:rgb(var(--surface-channels)` or `var(--surface-muted-channels)` — present in `.card`, `.input` (hover), `.btn-secondary` (hover) per affected rules
   - `border-color:rgb(var(--border-channels)` — present in `.card`, `.input`
   - `color:rgb(var(--ink-channels)` or `var(--ink-muted-channels)` — present in `.input`, `.label`, `.btn-secondary`
   - No bare `background-color:var(--color-surface)` or `border-color:var(--color-border)` aliases remain (these would indicate the substitution didn't take effect)

   If any rule body still contains bare `var(--color-X)` aliases instead of channel-split form, STOP and wait for dispatcher.

4. Run targeted tests:
npm test -- --run
   Expected: pass. Snapshot updates may be needed if any test captures compiled class output for the affected components — update inline and note in commit message.

## Phase 4 — smoke

**Waived with operator visual check substitute.**

Static CSS structural verification (Phase 3 step 3) is the primary load-bearing check. However, because `.card`, `.input`, `.btn-secondary`, `.label` are user-visible components touched across many surfaces, the brief mandates a 3-minute operator visual sanity check before merge:

1. After PR opens, wait for Vercel preview deploy.
2. Operator opens preview URL in incognito.
3. Spot-check `.card`, `.input`, `.btn-secondary`, `.label` rendering in light mode AND dark mode (toggle theme).
4. Confirm no visual regression on any of: card backgrounds, card borders, input field text/placeholder/border, button-secondary hover state, label text.
5. Operator reports back to dispatcher before squash merge.

This is NOT a full smoke walk (no write-read-verify cycle, no auth flow). Pure visual diff against expected baseline.

Bake the visual-check requirement into the PR description so reviewer (Kyron + future audit) sees the explicit gating step.

## Phase 5 — commit, push, open PR

1. Fresh branch off Phase 0 SHA: `git checkout -b chore/tailwind-apply-css-var-sweep` (Rule 1).
2. Stage `src/index.css` + `docs/FOLLOW_UPS.md` (Phase 5b) + `docs/CONTEXT.md` (Phase 5c).
3. Commit message:
chore(tailwind): replace 11 @apply CSS-var arbitrary-value utilities with named tokens
Sweeps 4 @layer components rules in src/index.css (.btn-secondary, .card,
.input, .label) following PR #219 precedent. Channel-split tokens preserve
runtime color resolution at default opacity:

bg-[color:var(--color-surface)] (1x) -> bg-card
bg-[color:var(--color-surface-muted)] (1x) -> bg-surface-muted
border-[color:var(--color-border)] (1x) -> border-border
text-[color:var(--color-text)] (3x) -> text-ink
text-[color:var(--color-text-muted)] (4x) -> text-ink-muted
placeholder-[color:var(--color-text-faint)] (1x) -> placeholder-ink-faint

Text family maps to ink namespace per PR-C-FU3 convention (intentional,
avoids text-text-* redundancy).
Bundle change: hash differs from baseline, ~400 bytes growth accepted.
Named form is capability-additive -- gains opacity-modifier support
(bg-card/50 etc).
Verification:

Static CSS structural analysis confirms channel-split forms emit per
PR-C-FU3 token design
Operator visual check on .card / .input / .btn-secondary / .label in
light AND dark mode (3-min spot-check, NOT full smoke walk)

Closes @apply sweep FU banked from PR #219 (0b3f058).

4. Push: `git push -u origin chore/tailwind-apply-css-var-sweep`.
5. Open PR via `gh pr create` or GitHub UI. Title: `chore(tailwind): replace 11 @apply CSS-var arbitrary-value utilities with named tokens`.
6. PR description: include the Phase 4 visual check requirement explicitly.
7. Surface PR URL.

## Phase 5b — close @apply sweep FU

Update `docs/FOLLOW_UPS.md`:

1. Find the FU section banked from PR #219: `### @apply bg-[color:var(--color-X)] sweep in src/index.css (LOW, refactor)` (or similar heading — search for `@apply` in `FOLLOW_UPS.md`).
2. Prefix the heading with ✅ and suffix with `— CLOSED {YYYY-MM-DD} (PR #TBD, {TBD})`. Use today's date.
3. Prepend to the body: `**RESOLVED {YYYY-MM-DD}**`.
4. Append closing note:
Shipped via PR #TBD ({TBD}). Audit confirmed runtime-equivalent at default opacity; capability-additive (opacity-modifier support gained on .card/.input/.btn-secondary/.label). Bundle grew ~400 bytes — accepted. Channel-split tokens per PR-C-FU3 design preserved.

## Phase 5c — update CONTEXT.md

1. Drop oldest row in Recently-shipped table.
2. Add new row with `#TBD` / `{TBD}` placeholders. Description: "@apply CSS-var sweep — 11 substitutions across 4 @layer components rules in src/index.css. Channel-split tokens preserve runtime color; capability-additive (opacity-modifier support). Closes @apply sweep FU banked from PR #219."
3. Update `Current main HEAD` field to `{TBD}`.
4. Update `Active track` to "@apply CSS-var sweep — chore/tailwind-apply-css-var-sweep in flight."
5. Update `Next track` to "Pending: 7 untracked verification scripts cleanup, Resend invite mail/ swap (#215), Resend invite audit log (#215)."
6. Update "Where we left off" prose: 1–2 short paragraphs noting this PR closed the @apply sweep FU, validated channel-split token design at scale (15 substitution sites total across #219 + this PR), and bumped bundle ~400 bytes for opacity-modifier support gain.

## Phase 6 — held

Do NOT auto-execute. Dispatcher confirms merge after operator visual check passes, then invokes `/post-merge <pr-number>` separately. Per the closed UI discovery FU at `cb18914`: if CLI shows the slash command as "unrecognized" but CC executes, ignore the display — that's the documented dual-surface gap.
