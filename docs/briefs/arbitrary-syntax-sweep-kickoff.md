# Arbitrary CSS-var-syntax → named-utility sweep — kickoff brief

**Scope:** mechanical migration of `bg-[var(--color-surface)]`, `bg-[var(--color-surface-raised)]`, and `text-[var(--color-text)]` arbitrary-syntax utility classes to their named-utility equivalents (`bg-card`, `bg-card-raised`, `text-ink`). Sourced from the LOW FU banked during Mobile FU#4 closure (PR #154).
**Size:** ~83 utility substitutions across 28 files. Scope: M.
**Severity:** None — pure code-hygiene. Compiled CSS is byte-identical pre- and post-PR. Zero user-visible change.

---

## Goal

Migrate every occurrence of three specific arbitrary-CSS-variable utility classes to their named-utility aliases. Mechanical find/replace operation; per-edit cognitive load is low. The 28-file diff is the only thing that makes this M instead of S.

### Migration mapping (exhaustive — no other patterns in scope)

| Arbitrary syntax | Named utility | Occurrences |
|---|---|---|
| `bg-[var(--color-surface)]` | `bg-card` | ~77 |
| `bg-[var(--color-surface-raised)]` | `bg-card-raised` | 5 |
| `text-[var(--color-text)]` | `text-ink` | 1 |

### Out of scope (explicitly banked or deferred)

- **`border-[var(--color-border)]` (2 occurrences in WizardForm.jsx)** — leave as-is. Migrating to `border-border` would shift these 2 explicit-and-working occurrences into the unresolved 201-usage `border-border` question (no `border` color found under `theme.extend.colors` in tailwind.config.js; resolution mechanism untraced). **Bank as a new audit FU** during Phase 4: investigate whether `border-border` actually resolves, and if so via what mechanism. Until that audit resolves, the 2 outliers stay explicit.
- **Hex-literal arbitrary syntax** (`bg-[#01696f]/8`, kiosk shell colors, CampaignCard medal palette, GapAnalysisPanel categorical purple) — different category from CSS-var arbitrary syntax. Some have clear token homes (KioskShell → presentation token family), some don't (categorical badge colors). **Bank KioskShell → presentation-token migration as a new LOW FU** during Phase 4. Do NOT bank the categorical-color items — they have no clear token home (rule 7).
- **`text-ink` naming-collision callout** — CC's audit flagged that `text-ink` (Tailwind utility) resolves to `--text-channels` while `--color-ink` in src/index.css is `--ink-channels` (purple activity-feed accent). The migration is correct; only the future-reader confusion is the concern. **Do NOT bank** — informational, not a defect.
- **`bg-[color:var(--color-X)]` typed-arbitrary syntax inside `@apply` directives in src/index.css** — different surface (CSS not JSX). The banked FU is JSX-scoped. Genuinely out of scope.

---

## Phase 1 — Verify audit against current main

Before any code change, re-verify CC's counts against current `origin/main`:

1. `git grep -c 'bg-\[var(--color-surface)\]' src/` — expect ~77 across 27 files
2. `git grep -c 'bg-\[var(--color-surface-raised)\]' src/` — expect 5 across 4 files
3. `git grep -c 'text-\[var(--color-text)\]' src/` — expect 1 (WizardForm.jsx:419)
4. Confirm `bg-card` and `bg-card-raised` resolve in `tailwind.config.js` — both should map to `rgb(var(--surface-channels))` / `rgb(var(--surface-raised-channels))` respectively
5. Confirm `text-ink` resolves in `tailwind.config.js` — should map to `rgb(var(--text-channels))`

If any count differs by more than ~5 from the audit figures, **STOP and surface** — the codebase may have shifted in a way that changes the migration mapping. Small drift (±5) is acceptable; large drift means the audit is stale.

If any utility alias does NOT resolve in `tailwind.config.js`, **STOP and surface** — that's a brief-writing error and we need to revisit the mapping before proceeding.

---

## Phase 2 — Implementation

Mechanical find/replace across the codebase. Two viable approaches:

**Preferred: scripted batch replace.** Use `sed` or equivalent across all files in `src/`:
- `bg-[var(--color-surface)]` → `bg-card`
- `bg-[var(--color-surface-raised)]` → `bg-card-raised`
- `text-[var(--color-text)]` → `text-ink`

Be precise with the sed regex — escape brackets correctly, anchor on the exact pattern. Run the replace on a per-file basis (loop) so failures isolate cleanly.

**Fallback: per-file edits** if scripted replace introduces any unexpected matches. Slower but safer.

After replacement, run:
- `git diff --stat` — expect ~28 files changed, ~83 lines touched
- Spot-check 3 files with the highest occurrence count (UserManagementPanel, EditUserDrawer, CampaignPanel each have ~10) — confirm the diffs are clean utility-name swaps with no unintended changes to surrounding class strings

Hard stops:
- Any file shows changes to non-utility content (component logic, imports, JSX structure)
- Any file appears in the diff that isn't in the audit's 28-file list
- Lint or build fails immediately after replacement (would indicate a typo'd utility name or a missing alias)

---

## Phase 3 — Tests

**No new tests.** This sweep has no behavioral change; class-presence tests across 28 files would be ~28 dubious-value test additions.

Verification rests on:
1. `npm run lint` — catches typos in utility names
2. `npm run build` — Tailwind would error on an undefined utility class (e.g., if `text-ink` weren't defined, the build would fail with a CSS error)
3. `npm run test` — existing suite must pass (currently 683/683). Catches any structural regression introduced by the sweep.

If any of these three checks fails, **STOP and surface** — do not iterate without my approval.

---

## Phase 4 — Docs (with SHA placeholders)

### `docs/CONTEXT.md`

1. **Top table:** update HEAD SHA + active/next track lines with `<sha>` placeholder + this PR scope
2. **Recently-shipped table:** prepend a new row:
   ```
   #<pr#> | <sha> | refactor: arbitrary CSS-var-syntax → named-utility sweep (~83 substitutions, 28 files)
   ```
3. **Drop the oldest row** from the recently-shipped table (cap is 5)
4. **"Where we left off":** rewrite to describe sweep closure, note the two new banked FUs (border-border audit, KioskShell presentation-token migration), and what's next in the LOW queue
5. **Stale-row audit (per CLAUDE.md rule 8):** grep CONTEXT.md for any references to "arbitrary syntax" or "CSS-var sweep" outside the Active-follow-ups table. Reconcile if found.

### `docs/FOLLOW_UPS.md`

1. Locate the LOW FU "`bg-[var(--color-X)]` arbitrary-syntax → named-utility sweep" (lines 961–963). Mark resolved:
   ```
   - ✅ **`bg-[var(--color-X)]` arbitrary-syntax → named-utility sweep** — CLOSED by PR #<pr#> (<sha>): ~83 utility substitutions across 28 files. bg-[var(--color-surface)] → bg-card (~77), bg-[var(--color-surface-raised)] → bg-card-raised (5), text-[var(--color-text)] → text-ink (1). Compiled CSS byte-identical. border-[var(--color-border)] outliers held back pending separate audit (see banked FU).
   ```

2. **Bank new audit FU** under the LOW section (or MEDIUM if you judge it merits — see note below):
   ```
   - [ ] **`border-border` utility resolution audit** — Codebase has 201 usages of `border-border` across 49 files, but tailwind.config.js does NOT define `border` under `theme.extend.colors`. Either there's a resolution mechanism not yet traced (custom plugin, safelist, Tailwind default, base-layer rule) or all 201 usages are silently producing no border. Surfaced during the arbitrary-syntax sweep audit when the 2 `border-[var(--color-border)]` outliers in WizardForm.jsx looked for a named equivalent. Two outliers held back from the sweep pending resolution. Audit task: determine whether `border-border` actually applies a visible border color, and if so via what mechanism. If not — major defect; if yes — document the mechanism and migrate the 2 outliers.
   ```

   Priority note: if Phase 1 verification reveals the `border-border` mechanism is obvious (e.g., a Tailwind plugin in postcss.config or a base-layer `@apply` rule), drop the FU to LOW. If the mechanism remains untraced, MEDIUM — silently-broken borders across 201 usages would be a real defect.

3. **Bank new LOW FU** for KioskShell hex literals:
   ```
   - [ ] **KioskShell hex literals → presentation token family** — `src/components/kiosk/KioskShell.jsx:80` and `src/components/kiosk/KioskRoute.jsx:44` use hex literals (`bg-[#1a1612]`, `border-[#4ab5b8]`, `text-[#f0ebe0]`, `text-[#b8aea0]`) for the kiosk fullscreen presentation shell. The `bg-presentation`, `text-presentation`, `bg-presentation-accent` token family in tailwind.config.js appears designed to encode exactly this intent. Migration would unify kiosk styling with the theme system. Surfaced during arbitrary-syntax sweep audit as a sibling pattern. Different category from the sweep itself (hex literal vs CSS-var arbitrary syntax) so banked separately.
   ```

Per CLAUDE.md rule 7: do NOT bank `text-ink` naming-collision callout, CampaignCard medal palette, GapAnalysisPanel categorical purple, or the index.css `@apply` typed-arbitrary syntax. Brief explicitly excludes these.

---

## Phase 5 — Commit, push, open PR

1. Feature branch: `refactor/arbitrary-syntax-sweep`
2. Commit organization:
   - Source: `refactor(styles): migrate bg-[var(--color-surface*)] arbitrary syntax to bg-card / bg-card-raised utilities`
   - Source: `refactor(styles): migrate text-[var(--color-text)] arbitrary syntax to text-ink utility`
   - Docs: `docs: bank PR-<pr#> placeholders + border-border audit FU + KioskShell presentation-token FU (sweep closure)`

   Two source commits keep the bg-* and text-* changes separately bisectable. Optional: collapse into one source commit if the diff is genuinely uniform.

3. Push the feature branch (NOT main)
4. PR title: `refactor(styles): arbitrary CSS-var-syntax → named-utility sweep`
5. PR description content (write verbatim, filling placeholders):

```markdown
## Summary

Closes the LOW FU "`bg-[var(--color-X)]` arbitrary-syntax → named-utility sweep" banked during Mobile FU#4. Pure code-hygiene refactor with zero user-visible change — compiled Tailwind CSS is byte-identical pre- and post-PR.

### Changes

- `bg-[var(--color-surface)]` → `bg-card` (~77 occurrences across 27 files)
- `bg-[var(--color-surface-raised)]` → `bg-card-raised` (5 occurrences across 4 files)
- `text-[var(--color-text)]` → `text-ink` (1 occurrence in WizardForm.jsx:419)

Total: ~83 utility substitutions across 28 files.

### Held back from scope

`border-[var(--color-border)]` (2 occurrences in WizardForm.jsx) intentionally NOT migrated. The intuitive replacement `border-border` is used 201× across 49 files in this codebase, but tailwind.config.js does not define `border` under `theme.extend.colors`. Resolution mechanism untraced. Migrating the 2 explicit-and-working outliers to an unverified utility would shift them from "known correct" to "unverified" — worse, not better. Banked as a separate audit FU.

### Banked from this PR's audit

Two new follow-ups entered the queue:
1. `border-border` utility resolution audit (priority pending mechanism trace — likely MEDIUM if untraced, LOW if obvious)
2. KioskShell hex literals → presentation token family (LOW)

### Verification

- Lint: 0 errors
- Build: green
- Test suite: 683/683 pass
- Smoke walk: **waived per Memory 35** — compiled CSS is byte-identical; this is the genuine "internal refactor with no user-visible behavior" carve-out. Spot-check visual review performed on 3 high-density surfaces (UserManagementPanel, EditUserDrawer, CampaignPanel) via preview URL — zero visual delta confirmed.
```

6. Open PR against `main`, link to the brief at `docs/briefs/arbitrary-syntax-sweep-kickoff.md`

---

## Phase 6 — Smoke walk WAIVED

**Waiver justification (per Memory 35):** This sweep is a pure Tailwind utility-alias refactor. The three migrations (`bg-card`, `bg-card-raised`, `text-ink`) are defined in tailwind.config.js as exact aliases for the arbitrary CSS-var values being replaced. Compiled CSS output is byte-identical pre- and post-PR. No user-visible behavior changes possible.

Memory 35's default-RUN-requires-justification rule is satisfied by this paragraph.

**Replacement verification (lightweight):** open the preview URL once Vercel builds, navigate to 2-3 high-density surfaces (UserManagementPanel, EditUserDrawer, CampaignPanel), spot-check that rendering is identical to production. No automated smoke script, no real-pixel measurement, no two-session protocol. ~3 minutes of visual review.

If the spot-check reveals ANY visual delta, **STOP and surface** — that would indicate the utility aliases don't actually resolve to identical CSS, which contradicts the waiver justification and means the brief is wrong.

---

## Phase 7 — Stop for review

After Phase 6, **stop**. Surface:
1. PR URL
2. Verification table (lint pass, build pass, test count, spot-check results)
3. Any Phase 1 hard-stop findings (count drift, missing aliases)
4. Confirmation that no unexpected files appeared in the diff
5. Current strike count

Do NOT merge. Do NOT run the post-merge sequence yet. Wait for merge confirmation per Memory 26.

---

## Post-merge sequence (CC, after merge confirmation)

Per CLAUDE.md banked post-merge sequence:
1. Verify on main: `git rev-parse --abbrev-ref HEAD` returns `main`
2. `git fetch origin --prune && git pull origin main`
3. Capture squash SHA: `git log origin/main --oneline -1`
4. Fill `<pr#>` + `<sha>` placeholders in `docs/CONTEXT.md` + `docs/FOLLOW_UPS.md`
5. Commit + push direct to main: `docs: fill PR #<pr#> placeholders (arbitrary-syntax sweep closure)`
6. Optional worktree + branch cleanup

Step 1 is new — explicit branch-confirmation gate per the FU#4 post-merge hiccup. Do not skip.

---

## Strike rules

Session opens at 0/2. Two-strike rule applies. Hard stops in this brief:
- Phase 1 count drift > ±5, or any utility alias not defined in tailwind.config.js
- Phase 2 diff includes non-utility changes or files outside the audit's 28-file list
- Phase 3 lint/build/test failure
- Phase 6 spot-check reveals any visual delta
- Any scope expansion (e.g., touching `border-[var(--color-border)]` outliers, KioskShell hex literals, or any item in "Out of scope")
