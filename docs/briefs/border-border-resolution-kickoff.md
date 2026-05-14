# `border-border` utility resolution fix — kickoff brief

**Scope:** one-line addition to `tailwind.config.js` to bind the `border-border` utility to the `--color-border` theme token. Resolves a silent partial defect surfaced during the arbitrary-syntax sweep audit (PR #155 closure): 201 usages of `border-border` across 49 files were rendering Tailwind's hardcoded Preflight fallback `#e5e7eb` (cool gray-200) instead of the warm `--color-border` theme value (#e5e2db light / #3a3530 dark).
**Size:** 1 LOC source change + verification artifacts. Single PR.
**Severity:** Medium — silent visual defect affecting all theme-bordered surfaces. Light-mode delta is subtle (gray-200 vs warm beige are visually close); dark-mode delta is significant (gray-200 light borders on warm-dark surfaces is theme-incorrect and would have been caught by the original a11y/dark-mode audit if the rendered color had been inspected explicitly).

---

## Goal

Add `border` to `theme.extend.colors` in `tailwind.config.js`, mapped to `rgb(var(--border-channels) / <alpha-value>)`. All 201 existing `border-border` usages light up correctly without any JSX touched. Pattern B sites (`border-border` without a width utility) remain visually unchanged because `border-width: 0` is still set by Preflight — banking those as a separate audit FU.

### Out of scope (explicitly banked or deferred)

- **`theme.extend.borderColor.DEFAULT`** — making bare `border` (width-only, no explicit color) theme-aware. Reasoning: the codebase convention surfaced by the audit is `border border-border` (named utility for theme color). Making bare `border` theme-aware would change behavior for any usage we haven't enumerated, including potential intentional gray-200 borders for one-off contrast elements. **Do NOT bank** as a follow-up — would be speculative (rule 7). If a future need arises, it's a separate decision.
- **Pattern B sites** (`border-border` without `border` width utility, e.g. `AgentDashboard.jsx:482`). Currently render no border because Preflight sets `border-width: 0`. After this fix they will *still* render no border (border-color is set but border-width remains 0). **Bank as a separate audit FU** during Phase 4 — needs per-site judgment whether a visible border is intended.
- **Pattern A behavior on dark mode** — the visual delta WILL be visible. Smoke walk in Phase 6 captures it; that's the verification, not out of scope. Mentioned here only to flag that the PR is "visible change to existing borders" not "no behavioral change."

---

## Phase 1 — Verify audit against current main

Before any code change, re-verify the audit's findings haven't changed:

1. Confirm `tailwind.config.js` still does NOT define `border` under `theme.extend.colors`. Read the file; look for the exact absence.
2. Confirm `src/index.css` still defines `--color-border` and `--border-channels` in both `:root` and `.dark` blocks.
3. Fetch current production CSS bundle (`https://agencytrack.vercel.app` → find bundle URL → fetch). Confirm `.border-border` rule is still absent from the bundle (grep returns 0 hits). Confirm Preflight's `*,:before,:after{...border:0 solid #e5e7eb}` rule is still present.
4. Count current `border-border` usages: `git grep -c 'border-border' src/` — expect ~201 across ~49 files. Small drift acceptable (±10); large drift means the codebase has shifted in ways that might change the fix's impact.

If any of (1), (2), (3) returns unexpected state, **STOP and surface** — the audit's diagnosis may have been outdated. If (4) drift exceeds ±10, surface for review but don't block.

---

## Phase 2 — Implementation

**Single file: `tailwind.config.js`**

Add one entry to `theme.extend.colors`:

```js
border: 'rgb(var(--border-channels) / <alpha-value>)',
```

Match the existing entries' format exactly (look at how `surface`, `card`, `ink`, etc. are defined — most use the `rgb(var(--*-channels) / <alpha-value>)` pattern). Place alphabetically if the existing entries follow alphabetical order; otherwise place near other neutral-surface tokens (card, surface, ink).

Hard stops:
- Any other file touched
- Any change to `theme.borderColor` or `theme.extend.borderColor`
- Adding any plugin, preset, or postcss configuration

---

## Phase 3 — Verification (no new tests)

Class-presence tests don't catch this category of defect (Tailwind config-level). Verification rests on:

1. **`npm run lint`** — must exit 0 (no new errors; pre-existing warnings unchanged)
2. **`npm run build`** — must complete green. Tailwind would error if the `<alpha-value>` syntax is wrong.
3. **`npm run test`** — existing suite must pass (currently 682/682). Catches structural regressions.
4. **Compiled bundle inspection** — after build, grep `dist/assets/index-*.css` for `.border-border` rule. Expect the rule to now exist with content like `.border-border{--tw-border-opacity:1;border-color:rgb(var(--border-channels)/var(--tw-border-opacity,1))}` or similar. **This is the deterministic proof the fix works.** If the rule is still absent, the fix didn't land — STOP and surface.

If any of steps 1-3 fail, **STOP and surface**. If step 4 finds the rule absent or malformed, **STOP and surface** — the fix didn't land for some reason and we need to diagnose.

---

## Phase 4 — Docs (with SHA placeholders)

### `docs/CONTEXT.md`

1. **Top table:** update HEAD SHA + active/next track lines with `<sha>` placeholder + this PR scope
2. **Recently-shipped table:** prepend a new row:
   ```
   #<pr#> | <sha> | fix(styles): bind border-border utility to theme token (1 LOC fix, 201 silent usages corrected)
   ```
3. **Drop the oldest row** from the recently-shipped table (cap is 5)
4. **"Where we left off":** rewrite to describe the audit→fix arc closure, note the Pattern B audit FU banked, and what's next in the queue
5. **Stale-row audit (per CLAUDE.md rule 8):** grep CONTEXT.md for any references to "border-border" or "border utility" outside the Active-follow-ups table. Reconcile if found.

### `docs/FOLLOW_UPS.md`

1. Locate the `border-border` utility resolution audit FU (banked during PR #155). Mark resolved:
   ```
   - ✅ **`border-border` utility resolution audit** — CLOSED by PR #<pr#> (<sha>): mechanism untraced because no binding existed. Audit confirmed 201 usages across 49 files were rendering Tailwind's Preflight fallback (#e5e7eb gray-200) instead of the warm --color-border theme token. Fixed via 1-line addition to tailwind.config.js: theme.extend.colors.border → rgb(var(--border-channels) / <alpha-value>). All 201 named-utility usages now resolve correctly. Pattern B sites (border-border without width utility) banked as separate audit (see below).
   ```

2. **Bank new audit FU** for Pattern B sites under LOW section:
   ```
   - [ ] **Pattern B `border-border` sites audit** — Some occurrences of `border-border` in the codebase don't pair with a `border` width utility, so Preflight's `border-width: 0` keeps them invisible even after the PR #<pr#> color-binding fix. Audit task: enumerate Pattern B sites (grep for border-border NOT preceded/followed by a border width class on the same element), per-site judgment whether a visible border was intended. Surfaced during the border-border resolution audit (PR #155 follow-up). LOW because no visual regression — sites currently render no border and continue to render no border post-PR #<pr#>; this is intentionality verification, not defect remediation.
   ```

Per CLAUDE.md rule 7: do NOT bank `theme.extend.borderColor.DEFAULT` as a future FU — it's been explicitly excluded from scope as a speculative concern.

---

## Phase 5 — Commit, push, open PR

1. Feature branch: `fix/border-border-resolution`
2. Commit organization:
   - Source: `fix(styles): bind border-border utility to --color-border theme token`
   - Docs: `docs: bank PR-<pr#> placeholders + Pattern B audit FU (border-border resolution closure)`
3. Push the feature branch (NOT main)
4. PR title: `fix(styles): bind border-border utility to theme token (resolves 201 silent usages)`
5. PR description content (write verbatim, filling placeholders):

```markdown
## Summary

Closes the `border-border` utility resolution audit FU banked during PR #155. One-line addition to `tailwind.config.js` resolves 201 silent usages of `border-border` across 49 files that were rendering Tailwind's hardcoded Preflight fallback (`#e5e7eb` gray-200) instead of the warm `--color-border` theme token.

### Why one line fixes 201 usages

`border-border` was never bound to a color value in the Tailwind config — `theme.extend.colors` had no `border` key. Tailwind JIT therefore emitted no `.border-border` rule into the compiled CSS bundle. The 201 usages still produced visible borders only because Tailwind's Preflight base layer sets `*,:before,:after { border: 0 solid #e5e7eb }` as a hardcoded literal. The fallback color is independent of the theme system and was being used everywhere `border-border` appeared.

Adding the binding makes the JIT emit the rule with the theme token. All 201 usages light up correctly without any JSX changed.

### Visual change to expect

- **Light mode:** subtle. `#e5e2db` (warm beige theme token) vs `#e5e7eb` (cool gray-200 Preflight fallback) are visually close enough that the off-theme cool tone is easy to miss. The shift is correct but minor.
- **Dark mode:** significant. `#3a3530` (warm dark theme token) vs `#e5e7eb` (light gray Preflight fallback) — the Preflight color was rendering light gray borders on warm-dark surfaces, which was theme-incorrect. This was missed in the original a11y/dark-mode audit because the borders looked plausible enough not to flag.

### Held back from scope

- `theme.extend.borderColor.DEFAULT` — making bare `border` (width-only, no explicit color) theme-aware. Codebase convention is `border border-border` (named utility for theme color); making bare `border` theme-aware would change behavior for any one-off usage. Not banked as future work — would be speculative.
- Pattern B sites (`border-border` without `border` width utility). Currently render no border because Preflight sets `border-width: 0`. After this fix they still render no border (border-color is now set, but border-width remains 0). Banked as a separate audit FU — needs per-site judgment whether a visible border is intended.

### Verification

- Lint: 0 errors (16 pre-existing warnings unchanged)
- Build: green
- Test suite: 682/682 pass
- Compiled bundle: `.border-border` rule now present in `dist/assets/index-*.css` with theme-token resolution
- Smoke walk: visual verification on 2-3 high-density Pattern A surfaces in both light and dark mode (see results table below)

### Smoke results

| Surface | Light mode | Dark mode | Result |
|---|---|---|---|
| [surface 1] | [observation] | [observation] | ✅/❌ |
| [surface 2] | [observation] | [observation] | ✅/❌ |
| [surface 3] | [observation] | [observation] | ✅/❌ |
```

6. Open PR against `main`, link to the brief at `docs/briefs/border-border-resolution-kickoff.md`

---

## Phase 6 — Smoke walk (REQUIRED, not waivable)

Memory 35 waiver does NOT apply — this PR changes both compiled CSS output (new `.border-border` rule) and rendered visual output (gray-200 → warm theme color). Smoke is the load-bearing verification.

### Walk specification

Pick 2-3 Pattern A surfaces with high `border-border` density. Suggested candidates (CC's call to confirm via grep):
- `Toast.jsx` (CC identified Pattern A example)
- Any component in `src/components/dashboard/` with high `border-border` usage
- Any form modal or panel with theme borders (`UserManagementPanel`, `EditUserDrawer`, `CampaignPanel` were high-density in the prior sweep)

Setup: `setupBypassSession` to authenticate as needed. The relevant surfaces span agent and manager roles; pick one per role if convenient.

**Viewport: 390×844 throughout** (mobile baseline; theme colors are theme-mode-driven, not viewport-driven, so desktop wouldn't add information).

### Procedure per surface (both modes)

1. Navigate to the surface in light mode. Take screenshot.
2. Identify a known `border-border` element via DevTools or class inspection. Read its computed `border-color`. Expected: `rgb(229, 226, 219)` or near-equivalent (the resolved light-mode `--color-border` value at full opacity). **Reject** if computed color is `rgb(229, 231, 235)` (Preflight's `#e5e7eb` — old behavior).
3. Toggle dark mode (header toggle).
4. Re-read the same element's computed `border-color`. Expected: `rgb(58, 53, 48)` or near-equivalent (resolved dark-mode `--color-border`). **Reject** if computed color is unchanged from light mode (would indicate the binding didn't take effect under dark mode).
5. Take screenshot in dark mode for the PR description.

Fill the smoke results table in the PR description with measured RGB values, not just pass/fail. Computed-color evidence is what makes this verification rigorous; pass/fail alone would be operator-judgment.

If any surface shows the wrong color OR shows no border at all where one previously rendered, **STOP and surface** — the fix has unexpected interaction we need to investigate.

---

## Phase 7 — Stop for review

After Phase 6, **stop**. Surface:
1. PR URL
2. Verification table (lint, build, tests, compiled bundle inspection)
3. Smoke results table with measured computed RGB values
4. Any Phase 1 hard-stop findings (config drift, missing CSS vars, bundle anomalies)
5. Current strike count

Do NOT merge. Do NOT run the post-merge sequence yet.

---

## Post-merge sequence (CC, after merge confirmation)

Per CLAUDE.md banked post-merge sequence (with Phase 0 branch-confirmation gate validated in PR #155):

1. **Phase 0:** Verify on main — `git rev-parse --abbrev-ref HEAD` returns `main`. If not, `git checkout main` BEFORE any other step.
2. `git fetch origin --prune && git pull origin main`
3. Capture squash SHA: `git log origin/main --oneline -1`
4. Fill `<pr#>` + `<sha>` placeholders in `docs/CONTEXT.md` + `docs/FOLLOW_UPS.md`
5. Commit + push direct to main: `docs: fill PR #<pr#> placeholders (border-border resolution closure)`
6. Worktree cleanup (if a worktree was created): remove + delete local branch
7. Verify clean state honestly — report what's actually there. Pre-existing stale branches are expected; the verification target is "no new stale branches from this PR," not "only main."

---

## Strike rules

Session opens at 0/2. Two-strike rule applies. Hard stops in this brief:
- Phase 1 confirms the audit's findings are stale or config has shifted unexpectedly
- Phase 2 touches any file other than `tailwind.config.js`
- Phase 3 build fails OR compiled bundle still lacks `.border-border` rule
- Phase 6 any surface shows wrong computed color or unexpected loss of borders
- Any scope expansion (borderColor.DEFAULT, Pattern B fixes, JSX touches, plugin additions)
