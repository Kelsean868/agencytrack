# Kickoff — Contrast-Debt Retirement: faint sweep + status-ink tokens + allowlist shutdown

**Size:** M · **Type:** app-wide chrome/token slice (TOKEN DEFINITIONS → ALWAYS
HUMAN-MERGE per the standing channel) · **Merge:** HUMAN-MERGE + dispatcher pre-review.
**Branch:** `feat/contrast-debt-retirement`
**Goal:** retire the entire documented contrast-debt family in one pass, then SHRINK the
smoke axe allowlists to (at most) the pre-existing bell badge — the allowlist's size is
this slice's score.

## The debt inventory (regenerated in Phase 0, not trusted from memory)
1. **text-ink-faint legacy nodes** (~49 at last audit; D5 banned new ones) — the
   pre-authorized faint→muted carve-out applies en masse.
2. **StatusPill on-tint family** — text-{danger|warning|success} on bg-{status}/10–15
   tints fails AA (dark for all three; danger marginal in light at 4.33). Named in the
   FOLLOW_UPS extension from Compliance S1/S2.
3. **primary-light teal** — the single remaining node from the #465 gold pass.
4. Anything NEW the Phase-0 sweep finds — enumerate, classify, include.

## Locked decisions

### D1 — Status-ink tokens via deterministic contrast math (the #465 pattern)
Define per-status DEEP text tokens for on-tint use: `--color-danger-ink`,
`--color-warning-ink`, `--color-success-ink` — one value per theme, each computed to
clear AA ≥ 4.5 against BOTH the raw card/surface background AND the /10–/15 tint of its
own status color in that theme. Derivation is DETERMINISTIC: a unit-tested contrast
module (extend the #465 gold-math approach) asserts every (token, background) pair's
ratio ≥ 4.5 in both themes — executed proof, not eyeballs. Tailwind utilities
(`text-danger-ink` etc.) wired through tailwind.config.js exactly like existing tokens.
Tint backgrounds and chip shapes are UNCHANGED — only the text ink deepens.

### D2 — Adoption: one shared primitive at a time
StatusPill variants adopt the -ink tokens (every consumer inherits — cite the consumer
list); then the non-StatusPill on-tint chips found in the sweep (the Compliance count
badge, any others) adopt the same utilities. NO per-surface forks: if a chip can't use
the shared token, STOP and surface it.

### D3 — Faint sweep (mechanical, carve-out pre-authorized)
Regenerate the faint inventory by grep + the deterministic audit script; apply
faint→muted to every TEXT usage. Non-text uses of ink-faint (decorative ticks — e.g.
the pace-row floor tick uses bg-ink-faint) are NOT text and stay; enumerate them in the
PR body as deliberately retained.

### D4 — primary-light node
Fix per its context (likely the same deep-ink treatment or the D6 pairing); cite the
node and the chosen mechanism in the PR.

### D5 — Allowlist shutdown (the acceptance)
After the fixes: edit the S1/S2/S3 compliance smokes' axe allowlists DOWN to at most the
pre-existing notification-bell badge (fix that too if it's a one-liner within scope —
it's bg-danger text-white chrome; if D6's pairing fixes it, take it and empty the list).
Every removed allowlist entry must now PASS, proven by re-running those smokes.

## Phase 0 — source-verify (Rule 17)
Regenerate the full inventory: faint-grep (text vs non-text classification) · on-tint
chip census (StatusPill consumers + ad-hoc tint chips) · the primary-light node · the
bell badge construction · current token definitions + the #465 contrast-math module
location (extend, don't duplicate) · the three compliance smokes' allowlist blocks ·
WHICH surfaces the faint sweep touches (screen list drives the verification matrix).
Output the inventory as a table in the PR body. STOP only if a family member resists the
shared-token treatment (D2's fork condition).

## Phase 2–3
Tokens + contrast unit tests (every pair, both themes) · StatusPill + chip adoption ·
faint sweep · primary-light fix · allowlist shrink · lint 0 · FULL suite green (faint
swaps may touch test snapshots/assertions — consciously evolve with rationale) · build ·
hex-grep (new tokens land in config/CSS vars, not inline hex — the contrast module may
hold computed hex WITH a comment, matching #465 precedent).

## Smoke (E3 — both themes)
Re-run ALL THREE compliance smokes with the shrunk allowlists (their pass now PROVES the
debt is gone where it was documented) + a targeted axe pass on the top faint-affected
surfaces from the Phase-0 screen list (use the BM + agent shakedown nav patterns; assert
0 serious color-contrast on each) · §2 screenshots of StatusPill states + one
faint-heavy screen, both themes · 0 console errors · no data writes beyond the smokes'
own established nudge/cleanup cycles.

## Phase 4 — docs
CLOSE the umbrella contrast-debt FOLLOW_UP (all named families) with the inventory table
+ per-family resolution · note the -ink tokens in the design-token docs/CLAUDE.md token
list IF such a list exists (cite; do not create new doc structure) · standard
placeholders.

## Out of scope
Any layout/spacing/composition change · new components · theme value changes beyond the
new -ink tokens + the primary-light fix · gold (closed in #465) · Master Sheet/WARs
anything.

## Acceptance
Deterministic contrast tests green for every (token, background, theme) pair · zero
text-ink-faint TEXT usages remain (grep-proven; retained non-text uses enumerated) ·
StatusPill family AA in both themes via shared tokens (no forks) · allowlists shrunk
with the re-run smokes proving it · full suite green via conscious evolution only ·
inventory table in the PR body · Rules 12/15/17/18/19/20.
