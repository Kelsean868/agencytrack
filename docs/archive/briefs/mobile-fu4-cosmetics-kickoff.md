# Mobile FU#4 — non-core cosmetic cleanup — kickoff brief

**Scope:** three P2 items from `docs/FOLLOW_UPS.md` § Mobile FU#4 (lines 952–958). One ships as code with sibling sweep (P2-1), one ships as a token swap (P2-3), one closes as already-resolved-structurally (P2-2, no code change + FOLLOW_UPS doc-accuracy correction).
**Size:** ~6 LOC source across 3 files + ~4 RTL tests + smoke walk. Single PR.
**Severity:** Low — pure cosmetic / theme-consistency hygiene. Not pilot-blocking. Two of three items have zero visible change in light mode.

---

## Goal

Close all three P2 items from Mobile FU#4:

- **P2-1** — Wizard + Campaign modal close-button tap-target pass. **DECISION LOCKED: sweep both surfaces in same PR.** `src/components/wizard/WizardForm.jsx` and `src/components/campaigns/CampaignPanel.jsx` carry the identical `w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface text-ink-muted transition-colors` class on their close buttons. Fix both — same precedent as FU#2 P1-1 Cancel/Save sibling extension. Strict-scope-to-WizardForm would create the worse-pattern problem: agent gets 44px in one modal flow, sub-44px in another.
- **P2-2** — Leaderboard avatar/row. **DECISION LOCKED: close as already-resolved-structurally — no code change.** `LeaderRow` is non-interactive (no `onClick`, no `role`, no `href`), `py-3 + content` gives ~60px row height (already above 44px threshold), and avatar is actually 36px (`size="md"`) not 40px as FOLLOW_UPS stated. Tap-target rules only apply to actual tap targets. Document the finding in the PR description + correct the doc-accuracy gap when marking the item resolved in FOLLOW_UPS.md. **Do NOT bank "interactive Leaderboard rows" as a new FU** — that's a feature decision, not a cosmetic-cleanup banking obligation. If Kyron wants the feature later, he'll surface it directly.
- **P2-3** — MotivationalCarousel hardcoded hex → token swap. **DECISION LOCKED: strict scope on the named line, no sweep.** Replace `bg-[#01696f]/8` → `bg-primary/8` and `border-[#01696f]/15` → `border-primary/15` at `src/components/dashboard/MotivationalCarousel.jsx:366`. Visible dark-mode delta: card background and border shift from old-teal (`#01696f` @ 8%) to lifted dark-teal (`#4ab5b8` @ 8%) — faint but real, and breaks the dark-mode theme contract. PR #132 (FU#3 channel-split) is already on main, so `bg-primary/8` resolves correctly.

### Out of scope (banked separately or genuinely deferred)

- **`bg-[var(--color-X)]` arbitrary-syntax → named-utility sweep** — different cosmetic-hygiene category from the hex-literal swap. Works correctly through the var; just inconsistent. **Bank as a NEW FU** in `docs/FOLLOW_UPS.md` LOW section during Phase 4 (see Phase 4 spec below for entry text).
- **`src/lib/kiosk/utils.js:5` `'#01696f'` constant** — programmatic canvas/SVG color, not a Tailwind utility class. Different category. Genuinely out of scope, do NOT bank as an FU.
- **Interactive Leaderboard rows** — feature, not cosmetic. Not banking speculatively.

---

## Phase 1 — Verify audit against current main

Before any code change, re-verify the three named lines against current `origin/main`:

1. Confirm `WizardForm.jsx` close button still uses `w-10 h-10 …` (exact class string from audit)
2. Confirm `CampaignPanel.jsx:283` close button uses the identical class string
3. Confirm `MotivationalCarousel.jsx:366` still uses `bg-[#01696f]/8 border border-[#01696f]/15`
4. Confirm no fourth modal close-button sibling exists with the same `w-10 h-10` close-button pattern (grep across `src/components/` for `w-10 h-10.*rounded-full`). If a third sibling surfaces, **STOP and surface** — the brief locked scope at 2 surfaces and a 3rd would need a scoping decision.
5. Confirm `LeaderRow` in `Leaderboard.jsx:12` remains non-interactive (no `onClick`, no `role`, no `href`). If interactivity has been added since the audit, **STOP and surface** — P2-2 closure rationale changes.

Hard stop on any discrepancy — do not silently adapt.

---

## Phase 2 — Implementation

### P2-1: Wizard + Campaign close buttons

**File 1: `src/components/wizard/WizardForm.jsx`**
- Change: `w-10 h-10` → `w-11 h-11` (44×44px, theme-independent)
- Rationale for `w-11 h-11` over `min-w-[44px] min-h-[44px]`: close buttons are a fixed-dimension pattern (single icon child, no variable content). `h-11` is the same fixed-height choice locked in FU#2 P1-1 for the Edit/Cancel/Save trio — preserves the design-system pattern of fixed-dimension utility buttons.

**File 2: `src/components/campaigns/CampaignPanel.jsx`**
- Same change: `w-10 h-10` → `w-11 h-11` at line 283 (verify line number against current main in Phase 1)

### P2-3: MotivationalCarousel token swap

**File: `src/components/dashboard/MotivationalCarousel.jsx:366`**
- Change: `bg-[#01696f]/8` → `bg-primary/8`
- Change: `border-[#01696f]/15` → `border-primary/15`
- No other lines in this file touched.

### P2-2: no code change

Documented in PR description + FOLLOW_UPS resolution note. No source edits.

---

## Phase 3 — Tests

Add class-presence assertions only — no behavioral tests (these are pure class-token changes).

1. **`WizardForm.test.jsx`** — assert close button has `w-11 h-11` (not `w-10 h-10`)
2. **`CampaignPanel.test.jsx`** — same assertion for that surface's close button
3. **`MotivationalCarousel.test.jsx`** — assert the carousel section wrapper has `bg-primary/8 border-primary/15` (string-contains check, not regex on hex)

If any test file doesn't exist for the target component, **STOP and surface** before creating it — test-file creation has been a scope-expansion vector historically and warrants explicit approval.

P2-2 has no new tests. Verify existing `Leaderboard.test.jsx` still passes (no regression risk, but ensures the audit's "non-interactive" finding holds).

---

## Phase 4 — Docs (with SHA placeholders)

### `docs/CONTEXT.md`

1. **Top table:** update HEAD SHA + active/next track lines with `<sha>` placeholder + this PR scope
2. **Recently-shipped table:** prepend a new row:
   ```
   #<pr#> | <sha> | fix(mobile): FU#4 cosmetic cleanup (P2-1 + P2-3; P2-2 closed structurally)
   ```
3. **Drop the oldest row** from the recently-shipped table (cap is 5)
4. **"Where we left off":** rewrite to describe FU#4 closure, the P2-2 structural finding, the new banked FUs, and what's next in the LOW queue
5. **Stale-row audit (per CLAUDE.md rule 8):** grep CONTEXT.md for any references to "Mobile FU#4" or "P2 cosmetic" outside the Active-follow-ups table. If found anywhere stale, reconcile.

### `docs/FOLLOW_UPS.md`

1. Locate the **Mobile FU#4** section at lines 952–958
2. Mark all three P2 items resolved:
   ```
   - ✅ **P2-1** — CLOSED by PR #<pr#> (<sha>): WizardForm + CampaignPanel close buttons bumped to `w-11 h-11` (44×44px). Sibling sweep included.
   - ✅ **P2-2** — CLOSED by PR #<pr#> (<sha>): already-resolved structurally. LeaderRow is non-interactive (no onClick/role/href), row height ~60px via `py-3` + content, and avatar is 36px (`size="md"`) not 40px. Tap-target rules apply only to tap targets. FOLLOW_UPS text "40×40" was a doc-accuracy gap — actual size 36px. No code change required.
   - ✅ **P2-3** — CLOSED by PR #<pr#> (<sha>): MotivationalCarousel hex literals replaced with `bg-primary/8` + `border-primary/15` tokens. Dark-mode theme contract restored.
   ```
3. **Bank a new FU entry** under the LOW section:
   ```
   - [ ] **`bg-[var(--color-X)]` arbitrary-syntax → named-utility sweep** — Several components use `bg-[var(--color-surface)]` and similar arbitrary syntax instead of the named `bg-card` / `bg-surface` utilities. Resolves correctly through the var; purely a code-hygiene inconsistency. Surfaced during Mobile FU#4 P2-3 closure audit. Defer to a comprehensive sweep rather than one-off fixes. Originally flagged in CLAUDE.md § Cosmetic Inconsistencies.
   ```

Per CLAUDE.md rule 7: do NOT bank "interactive Leaderboard rows" or the kiosk utils.js color constant — those are explicitly excluded in the brief and banking them would re-introduce the noise rule 7 is designed to prevent.

---

## Phase 5 — Commit, push, open PR

1. Feature branch: `fix/mobile-fu4-cosmetics`
2. Commit organization:
   - Source: `fix(mobile): bump wizard + campaign close buttons to 44px (FU#4 P2-1)`
   - Source: `refactor(dashboard): replace hex literal with primary token in MotivationalCarousel (FU#4 P2-3)`
   - Tests: `test(mobile): class-presence assertions for FU#4 cosmetic fixes`
   - Docs: `docs: bank PR-<pr#> placeholders + arbitrary-syntax sweep FU (FU#4 closure)`
3. Push the feature branch (NOT main)
4. PR title: `fix(mobile): FU#4 cosmetic cleanup (P2-1 + P2-3; P2-2 closed structurally)`
5. PR description content (write verbatim, filling placeholders):

```markdown
## Summary

Closes Mobile FU#4. Two items resolved with code (P2-1 + P2-3); P2-2 closed via structural finding (no code change needed).

### Changes

- **P2-1** — `WizardForm.jsx` + `CampaignPanel.jsx`: modal close-button class bumped from `w-10 h-10` (40×40px) to `w-11 h-11` (44×44px). Sibling sweep across both surfaces — same class, same fix, same precedent as FU#2 P1-1 Cancel/Save extension.
- **P2-3** — `MotivationalCarousel.jsx:366`: `bg-[#01696f]/8` → `bg-primary/8`, `border-[#01696f]/15` → `border-primary/15`. Hardcoded hex bypassed the dark-mode token switch (light: `#01696f`, dark: `#4ab5b8`); swap restores theme contract. Light-mode rendering identical.
- **P2-2** — `Leaderboard.jsx` LeaderRow: **no code change**. Structural finding: the row is non-interactive (no `onClick`, no `role`, no `href`), already ~60px tall via `py-3 + content`, and the avatar is 36px (`size="md"`) not 40px as FOLLOW_UPS.md originally stated. Tap-target rules apply only to actual tap targets. The original audit's "40×40" measurement was a doc-accuracy gap.

### Banked from this PR's audit

A new follow-up entered the LOW queue: `bg-[var(--color-X)]` arbitrary-syntax → named-utility sweep. Different hygiene category from the hex-literal swap; works correctly through the var, just inconsistent. Surfaced during P2-3 closure but kept out of this PR's scope to avoid scope creep.

### Tests

- RTL class-presence assertions for both P2-1 surfaces (WizardForm + CampaignPanel close buttons)
- RTL class-presence assertion for P2-3 (MotivationalCarousel token classes)
- No new tests for P2-2 (no code change); existing Leaderboard tests verify no regression

### Smoke

Production smoke walk at mobile viewport (390×844):
- WizardForm close button measured via `getBoundingClientRect()` — height + width both ≥ 44px
- CampaignPanel close button measured same — height + width both ≥ 44px
- MotivationalCarousel verified visually in light mode (no change) and dark mode (background lifts to `#4ab5b8` @ 8% via `var(--color-primary)`)

Walk results inline below.
```

6. Open PR against `main`, link to the brief at `docs/briefs/mobile-fu4-cosmetics-kickoff.md`

---

## Phase 6 — Production smoke walk

Per CLAUDE.md banked smoke default (commit `c85c90b`): run on every PR unless waived with justification. **No waiver here** — P2-1 is a real-pixel dimension change, P2-3 has visible dark-mode delta.

### Walk specification

Setup: `setupBypassSession` per established pattern. Two role sessions needed (agent for WizardForm + carousel; branch_manager or above for CampaignPanel).

**Viewport: 390×844 (iPhone 13/14 baseline) throughout.**

1. **Agent session** — log in as test agent (`kelsean@gmail.com`)
2. Navigate to Dashboard → start Weekly Wizard → measure close button:
   ```js
   document.querySelector('[aria-label="Close" or matching selector]').getBoundingClientRect()
   ```
   Assert `height >= 44 && width >= 44`. Record measured pixels.
3. While on Dashboard, locate MotivationalCarousel. Screenshot in light mode.
4. Toggle dark mode (header toggle). Screenshot the carousel again. Verify computed `background-color` of the carousel section element resolves to `rgba(74, 181, 184, 0.08)` (i.e., `#4ab5b8` @ 8%) — confirms the token swap is working, not still rendering the old `#01696f` @ 8%.
5. Sign out.
6. **Manager session** — log in as `branch.manager@tatillife.com` (or whichever manager-tier account has access to CampaignPanel)
7. Navigate to Campaigns → open the CampaignPanel modal → measure close button same way. Assert `height >= 44 && width >= 44`.

### Smoke output for PR description

Inline table in PR description:
```
| Surface              | Light mode    | Dark mode             | Pass |
|----------------------|---------------|-----------------------|------|
| Wizard close         | 44×44px       | 44×44px               | ✅   |
| Campaign close       | 44×44px       | 44×44px               | ✅   |
| Carousel background  | #01696f@8%    | #4ab5b8@8% (resolved) | ✅   |
```

If any measurement fails, **STOP and surface** — do not iterate without my approval.

---

## Phase 7 — Stop for review

After Phase 6, **stop**. Surface:
1. PR URL
2. Smoke results table
3. Any Phase 1 hard-stop findings (additional siblings, doc-accuracy corrections beyond the P2-2 one)
4. Any test files that didn't exist and were created (if approved during Phase 3)
5. Current strike count

Do NOT merge. Do NOT run the post-merge sequence yet. Wait for my merge confirmation per Memory 26.

---

## Post-merge sequence (CC, after my merge confirmation)

Per CLAUDE.md banked post-merge sequence:
1. `git fetch origin --prune && git pull origin main`
2. Capture squash SHA: `git log origin/main --oneline -1`
3. Fill `<pr#>` + `<sha>` placeholders in `docs/CONTEXT.md` + `docs/FOLLOW_UPS.md`
4. Commit + push direct to main: `docs: fill PR #<pr#> placeholders (FU#4 closure)`
5. Optional worktree + branch cleanup (only if confirmed cleanup is wanted)

---

## Strike rules

Session opens at 0/2 carry-in. Two-strike rule applies. Hard stops in this brief:
- Phase 1 discrepancy (third sibling, LeaderRow now interactive)
- Phase 3 test-file creation
- Phase 6 smoke measurement failure
- Any scope expansion beyond the three named files for code changes
