# Kickoff brief — Comprehensive aria-label sweep (9 sites)

## Header

| Field | Value |
|---|---|
| **Type** | Accessibility hygiene — add missing accessible names to interactive elements |
| **Shape** | 6 files modified + 2 docs updates (FOLLOW_UPS.md, CONTEXT.md). No new components. |
| **Size** | XS–S (~45 min execution) |
| **Banking source** | 2026-05-19 audit ([dispatcher's audit-stack run, 4 audits in 70 min](#)). 9 sites total: 7 net-new + 2 banked. |
| **Closes** | Two banked FUs: FOLLOW_UPS.md L992 (History row aria-label, banked from Mobile FU#2 closure audit) + L1053-1057 (CampaignForm close button missing aria-label, banked during Mobile FU#4 smoke). |
| **Smoke walk** | **WAIVED.** All changes are `aria-label` attribute additions or Tailwind `sr-only`/`md:not-sr-only` class swaps. Affects accessibility-tree content only. Zero visible UI behavior change. Lint + build is the substantive verification. Manual screen-reader verification optional, not required for ship. Justification per Rule 27 default. |
| **Strike count** | 0/2 — clean. |

---

## Architectural decisions (locked at brief authoring)

1. **Two distinct defect classes — different fix patterns.**

   **Class A — Icon-only buttons (7 sites).** Button content is purely an icon component (e.g. `<X size={20} />`, `<Eye />`) with no accessible text. jsx-a11y lint doesn't catch these because the icon component has child content. Fix: add `aria-label` attribute to the `<button>` element.

   **Class B — Mobile-hidden-text pattern (2 sites in ManagerDashboard).** Button has `<Icon /> + <span className="hidden md:inline">Text</span>`. On desktop, visible text gives the accessible name. On mobile, `display: none` removes the span from the accessibility tree, leaving the button without an accessible name. Fix: replace `hidden md:inline` with `sr-only md:not-sr-only` so text stays in the DOM (and a11y tree) at all viewport widths, only visually hidden on mobile.

2. **Phase 1 verifies `sr-only` usage exists in the project before committing to Class B fix.** If `sr-only` is not used anywhere in the codebase, fall back to `aria-label` on the button (same value as the visible text). Phase 1 step 4 captures this.

3. **Both banked FUs get marked RESOLVED by this single sweep PR.** Per Rule 11, do NOT edit the original FU body content. Add closure paragraph at the end of each section noting "resolved as part of comprehensive aria-label sweep" with the PR reference.

4. **Scope locked to the 9 sites identified in the 2026-05-19 audit.** No additional defensive sweeping of "similar-looking patterns" elsewhere. Phase 1 step 3 re-verifies the 9 sites still exist (Rule 17 — they could have been touched in the past few PRs since the audit).

5. **No new components, no new utilities.** Pure attribute additions and Tailwind class swaps. Maximum 9 line-level edits across 6 files.

6. **CONTEXT.md L138 pending-operational-state line stays unchanged.** That line tracks the 6 deferred verification scripts; not relevant to this PR's scope.

---

## Source-verified state at brief authoring

### The 9 sites (from 2026-05-19 audit by CC)

| # | Severity | File | Line | Element | Icon | Suggested aria-label | Defect class | Banking source |
|---|---|---|---|---|---|---|---|---|
| 1 | P1 | `src/components/campaigns/CampaignPanel.jsx` | 283 | modal close | `<X size={20} />` | "Close campaign form" | A (icon-only) | FU L1053-1057 (banked Mobile FU#4) |
| 2 | P1 | `src/components/dashboard/AgentDashboard.jsx` | 722-747 | history row preview | `<Eye />` decorative | "Preview submission from week of {date}" | A | FU L992 (banked Mobile FU#2 closure) |
| 3 | P1 | `src/components/manager/UserManagementPanel.jsx` | 140 | drawer close (CreateUserDrawer) | `<X size={18} />` | "Close create user drawer" | A | NEW |
| 4 | P1 | `src/components/profile/CareerPortal.jsx` | 185 | cancel-edit | `<X size={12} />` | "Cancel edit" | A | NEW |
| 5 | P1 | `src/components/dashboard/ManagerDashboard.jsx` | 163 | Export Branch Report | `<Download />` + hidden md:inline | "Export Branch Report" | B (mobile-hidden) | NEW |
| 6 | P1 | `src/components/dashboard/ManagerDashboard.jsx` | 172 | Start Meeting | `<Presentation />` + hidden md:inline | "Start Meeting" | B (mobile-hidden) | NEW |
| 7 | P2 | `src/components/campaigns/CampaignPanel.jsx` | 441 | remove-target metric | `<X size={14} />` | "Remove target" | A | NEW |
| 8 | P2 | `src/components/kiosk/KioskModeTab.jsx` | 170 | copy URL | `<Copy size={15} />` | "Copy kiosk URL" | A (has title fallback) | NEW |
| 9 | P2 | `src/components/kiosk/KioskModeTab.jsx` | 187 | revoke URL | `<Trash2 size={15} />` | "Revoke kiosk URL" | A (has title fallback) | NEW |

**Files touched: 6**
1. `src/components/campaigns/CampaignPanel.jsx` (2 sites: L283, L441)
2. `src/components/dashboard/AgentDashboard.jsx` (1 site: L722-747)
3. `src/components/dashboard/ManagerDashboard.jsx` (2 sites: L163, L172 — Class B)
4. `src/components/kiosk/KioskModeTab.jsx` (2 sites: L170, L187)
5. `src/components/manager/UserManagementPanel.jsx` (1 site: L140)
6. `src/components/profile/CareerPortal.jsx` (1 site: L185)

**Note on count discrepancy:** CC's audit said "9 sites across 5 files." Actual is **9 sites across 6 files** (CC counted ManagerDashboard once, but two component-file mentions). Phase 1 step 3 re-verifies.

### Banked FU bodies (Rule 11 — preserve as-is, do not edit)

**FU L992 (History row aria-label, banked from Mobile FU#2 closure audit):**
> Banked during Mobile FU#2 closure audit — `src/components/dashboard/AgentDashboard.jsx:722-747`. History row eye-icon preview button has no aria-label. Has visible "Week of {date}" text in the row, but the button itself (the icon control) has no accessible name. Screen-reader users hear "button" with no context. Defer to comprehensive aria sweep.

**FU L1053-1057 (CampaignForm close button missing aria-label, banked during Mobile FU#4 smoke):**
> `src/components/campaigns/CampaignPanel.jsx:283` close button has no `aria-label`; contains only a decorative `<X />` icon (no visible text). Screen-reader users hear "button" with no description. Same defect pattern as the History row aria-label gap banked from FU#2 (`AgentDashboard.jsx:722-747`). Surfaced during Mobile FU#4 P2-1 smoke walk attempting `waitForSelector('[aria-label="Close"]')` as a form-open gate — selector never resolved, confirming the label is absent. Defer to a comprehensive aria sweep rather than a one-off fix.

---

## Phase 0 — Pre-flight gate

```powershell
# From C:\Projects\AgencyTrack
git status                              # working tree should show 6 untracked scripts only
git fetch origin
git pull --ff-only origin main
git log origin/main --oneline -1        # capture current main HEAD
git branch --show-current               # confirm on main
```

**Expected state:**
- Working tree clean (apart from 6 untracked verification scripts — intentional, per FU body)
- Current main HEAD = `ce24417` (or whatever the latest is — capture from `git log`)
- On main branch

**Hard-stop if:**
- Working tree shows tracked file modifications → surface, do not absorb
- `git pull` not fast-forward → surface

Capture HEAD SHA. Create worktree (this PR modifies tracked files, so worktree convention applies cleanly — unlike the archive-stale-briefs PR where the source files were untracked):

```powershell
git worktree add ../agencytrack-worktrees/aria-label-sweep chore/aria-label-sweep
cd ../agencytrack-worktrees/aria-label-sweep
```

---

## Phase 1 — Source-verify the 9 sites (Rule 17 re-verification)

The audit was 2026-05-19; today's session may have introduced or fixed sites. Re-verify each.

### Step 1 — Confirm each of the 9 files exists

```powershell
foreach ($f in @(
  'src/components/campaigns/CampaignPanel.jsx',
  'src/components/dashboard/AgentDashboard.jsx',
  'src/components/dashboard/ManagerDashboard.jsx',
  'src/components/kiosk/KioskModeTab.jsx',
  'src/components/manager/UserManagementPanel.jsx',
  'src/components/profile/CareerPortal.jsx'
)) {
  Test-Path $f
}
```

**Expected:** all `True`. Hard-stop if any missing.

### Step 2 — Read each of the 9 sites to verify exact line content

Read each file at the specified line range (±3 lines for context). Capture:
- Actual line number (lines may have shifted since audit)
- Verbatim content
- Confirms element type (button vs anchor vs div with role)
- Confirms icon component name
- Confirms `aria-label` is genuinely absent

For Class B sites (L163, L172 in ManagerDashboard), additionally:
- Confirm `<span className="hidden md:inline">Text</span>` pattern is intact

### Step 3 — Confirm no aria-label has been added since the audit

```powershell
git grep -nE "aria-label" -- src/components/campaigns/CampaignPanel.jsx src/components/dashboard/AgentDashboard.jsx src/components/dashboard/ManagerDashboard.jsx src/components/kiosk/KioskModeTab.jsx src/components/manager/UserManagementPanel.jsx src/components/profile/CareerPortal.jsx
```

**Expected:** existing aria-labels on OTHER buttons in these files (not the 9 sites). If any of the 9 target sites already has aria-label → flag for dispatcher; Rule 17 catch (site has been fixed since audit). Hard-stop on those specific sites and confirm scope adjustment.

### Step 4 — Source-verify `sr-only` usage in project (Class B fallback decision)

```powershell
git grep -n "sr-only" -- 'src/**/*.jsx' 'src/**/*.js' 'src/**/*.css'
```

**Expected:** at least a few hits showing `sr-only` is an idiomatic pattern in this codebase. If `sr-only` is unused → use the fallback `aria-label`-on-button approach for Class B sites (same value as visible text).

If `sr-only` IS used → proceed with `hidden md:inline` → `sr-only md:not-sr-only` swap for Class B.

Report `sr-only` usage count to dispatcher.

### Step 5 — Confirm both banked FU bodies still present in FOLLOW_UPS.md

```powershell
Select-String -Path docs/FOLLOW_UPS.md -Pattern "CampaignForm close button missing aria-label" -Context 0,3
Select-String -Path docs/FOLLOW_UPS.md -Pattern "History row aria-label" -Context 0,3
```

**Expected:** both return matches with full context. Capture line numbers for Phase 4a.

### Phase 1 report (paste-back to dispatcher)

- Each of 6 files: confirmed exists ✓
- Each of 9 sites: actual line number (may differ from audit by ±a few) + verbatim content snippet + element type + icon name confirmed
- Existing aria-labels in target files: count + any conflict with target sites
- `sr-only` usage count in project (informs Class B fix decision)
- Both banked FU bodies present + their line numbers
- **Divergences from audit:** any site that's been fixed already, any line drift

Wait for dispatcher clearance before Phase 2.

---

## Phase 2 — Execute fixes

### Step 1 — Class A fixes (7 sites): add `aria-label` to icon-only buttons

For each Class A site, use `str_replace` to add `aria-label` attribute to the `<button>` element. Preserve all other attributes; insert `aria-label` as the first attribute after the opening `<button` for readability.

**Site 1: CampaignPanel.jsx:283 (modal close)**
- Add `aria-label="Close campaign form"`

**Site 2: AgentDashboard.jsx:722-747 (history row preview)**
- Add `aria-label={"Preview submission from week of " + weekDateLabel}` (or whatever variable name expresses the week start; Phase 1 step 2 captures the actual JSX context)
- If the surrounding code doesn't have an easy variable handle for the week, fall back to `aria-label="Preview submission"` and add a Phase 4 banking note explaining the simplification

**Site 3: UserManagementPanel.jsx:140 (CreateUserDrawer close)**
- Add `aria-label="Close create user drawer"`

**Site 4: CareerPortal.jsx:185 (cancel-edit)**
- Add `aria-label="Cancel edit"`

**Site 7: CampaignPanel.jsx:441 (remove-target metric)**
- Add `aria-label="Remove target"`

**Site 8: KioskModeTab.jsx:170 (copy URL)**
- Add `aria-label="Copy kiosk URL"`
- Existing `title` attribute provides additional fallback; leave it intact

**Site 9: KioskModeTab.jsx:187 (revoke URL)**
- Add `aria-label="Revoke kiosk URL"`
- Existing `title` attribute provides additional fallback; leave it intact

### Step 2 — Class B fixes (2 sites in ManagerDashboard)

Per Phase 1 step 4 outcome:

**If `sr-only` is used in the project (expected):**
- Site 5: `<span className="hidden md:inline">Export Branch Report</span>` → `<span className="sr-only md:not-sr-only">Export Branch Report</span>`
- Site 6: `<span className="hidden md:inline">Start Meeting</span>` → `<span className="sr-only md:not-sr-only">Start Meeting</span>`

**Fallback if `sr-only` is unused:**
- Site 5: add `aria-label="Export Branch Report"` to the button; leave `hidden md:inline` span unchanged
- Site 6: add `aria-label="Start Meeting"` to the button; leave `hidden md:inline` span unchanged

Document which path is used in Phase 5 report.

---

## Phase 3 — Verify

### Step 1 — Diff stat

```powershell
git diff main..HEAD --stat
```

**Expected pattern:**
- 6 M entries (the 6 modified files)
- 2 M entries for Phase 4 docs (FOLLOW_UPS.md + CONTEXT.md)
- Total: 8 M entries

**Total line changes per file:** small. Typically 1-2 lines per site, so 9 line-level edits total across 6 source files.

### Step 2 — `.env.example` carve-out check (Rule 14)

```powershell
git diff main..HEAD -- .env.example
```

**Expected:** empty.

### Step 3 — Lint + build

```powershell
npm run lint
npm run build
```

**Expected:** both pass.

Note: jsx-a11y rule violations may CHANGE if the linter newly recognizes aria-label-bearing buttons as compliant. Either way, lint result should be 0 problems (no new errors introduced).

### Step 4 — Spot-check rendered output (build artifact inspection)

After `npm run build` completes, the build verifies the JSX compiles. No runtime check needed; aria-label changes don't affect compilation.

### Step 5 — Smoke walk waiver

**WAIVED** per Rule 27 default for non-visible-behavior changes. Justification recorded inline in this brief header. No runtime UI is altered; only the accessibility tree gains accessible names.

---

## Phase 4 — Banks

### Phase 4a — FOLLOW_UPS.md: mark 2 banked FUs as resolved

#### FU L992 (History row aria-label, banked from Mobile FU#2 closure audit)

Locate the section/bullet containing the History row aria-label gap. Update the heading line (or bullet header — depends on exact FOLLOW_UPS.md structure) to append `[RESOLVED PR #{TBD}, {TBD}]`.

**Do NOT edit the existing FU body content** per Rule 11.

**Append closure paragraph** at the end of the section:

```
**Closure (PR #{TBD}, squash `{TBD}`):** Resolved as part of comprehensive aria-label sweep — 9 sites total (this site + CampaignForm L283 + 7 net-new sites from 2026-05-19 audit). `aria-label` attribute added to the History row preview button at `src/components/dashboard/AgentDashboard.jsx:722-747` providing screen-reader context the visible "Week of {date}" text alone didn't supply for the button affordance.
```

#### FU L1053-1057 (CampaignForm close button)

Same pattern. Update heading to append `[RESOLVED PR #{TBD}, {TBD}]`.

**Append closure paragraph** at the end of the section:

```
**Closure (PR #{TBD}, squash `{TBD}`):** Resolved as part of comprehensive aria-label sweep — 9 sites total (this site + History row L722-747 + 7 net-new sites from 2026-05-19 audit). `aria-label="Close campaign form"` added to the CampaignPanel close button at `src/components/campaigns/CampaignPanel.jsx:283`. Bonus methodology observation banked in closure: 2 ManagerDashboard sites (L163 + L172) had a different defect class — `hidden md:inline` text removed from the a11y tree on mobile. Fixed via `sr-only md:not-sr-only` swap (or aria-label-on-button fallback if sr-only unused; see Phase 5 report).
```

Phase 6 (post-merge) replaces both `#{TBD}` and `{TBD}` placeholders with the work-PR squash details.

### Phase 4b — CONTEXT.md: add recently-shipped row

Add row at top of "Recently shipped" table:

```
| #{TBD} | `{TBD}` | A11y hygiene: comprehensive aria-label sweep — 9 sites across 6 files. 7 icon-only buttons get `aria-label` (CampaignPanel ×2, AgentDashboard, UserManagementPanel, CareerPortal, KioskModeTab ×2); 2 mobile-hidden-text sites in ManagerDashboard get `sr-only md:not-sr-only` swap. Closes FU L992 (History row, banked Mobile FU#2 closure) + FU L1053-1057 (CampaignForm close, banked Mobile FU#4 smoke). |
```

Drop the oldest row to keep the table at 5 entries.

---

## Phase 5 — Commit + push + PR

### Commit message

```
fix(a11y): comprehensive aria-label sweep — 9 sites, 2 defect classes

Closes FU L992 (History row, banked Mobile FU#2 closure) + FU L1053-1057
(CampaignForm close, banked Mobile FU#4 smoke) plus 7 net-new sites
identified via 2026-05-19 audit.

Class A — icon-only buttons (7 sites): add `aria-label` attribute.
- src/components/campaigns/CampaignPanel.jsx:283 ("Close campaign form")
- src/components/campaigns/CampaignPanel.jsx:441 ("Remove target")
- src/components/dashboard/AgentDashboard.jsx:722-747 ("Preview submission")
- src/components/kiosk/KioskModeTab.jsx:170 ("Copy kiosk URL")
- src/components/kiosk/KioskModeTab.jsx:187 ("Revoke kiosk URL")
- src/components/manager/UserManagementPanel.jsx:140 ("Close create user drawer")
- src/components/profile/CareerPortal.jsx:185 ("Cancel edit")

Class B — mobile-hidden-text pattern (2 sites in ManagerDashboard): swap
`hidden md:inline` for `sr-only md:not-sr-only` so accessible name stays
in DOM at all viewports while remaining visually hidden on mobile.
- src/components/dashboard/ManagerDashboard.jsx:163 (Export Branch Report)
- src/components/dashboard/ManagerDashboard.jsx:172 (Start Meeting)

Phase 1 source-verified `sr-only` usage in project before locking Class B
fix; fallback was `aria-label`-on-button if pattern unused. Smoke waived
per Rule 27 default — no visible UI change, only accessibility tree.
```

### PR title

```
fix(a11y): comprehensive aria-label sweep — 9 sites, 2 defect classes
```

### PR body

Standard structure:
1. **What:** 9-site accessibility hygiene sweep closing 2 banked FUs + 7 net-new sites.
2. **Why:** Screen-reader users currently hear "button" with no context on the affected sites. P1 = critical action controls; P2 = secondary/decorative controls with fallback affordances.
3. **Two defect classes:** Class A (icon-only buttons, 7 sites) → `aria-label`. Class B (mobile-hidden-text, 2 sites) → `sr-only md:not-sr-only` swap.
4. **Source verification:** scope locked from 2026-05-19 audit (4-audit autonomous block, 70 min); Phase 1 re-verified all 9 sites at execution time.
5. **Smoke waived** per Rule 27 default for non-visible behavior changes.

### Push

```powershell
git push -u origin chore/aria-label-sweep
gh pr create --title "fix(a11y): comprehensive aria-label sweep — 9 sites, 2 defect classes" --body-file ...
```

### End-of-Phase-5 report (paste to dispatcher)

- PR URL
- Branch HEAD SHA
- `git log chore/aria-label-sweep --oneline -1` verbatim
- `git diff main..HEAD --stat` verbatim
- `.env.example` diff (empty expected)
- Phase 1 source-verification capture (per-site line + content + any divergence from audit)
- `sr-only` usage path decision (Class B fix: which path was taken)
- Lint + build results
- Banked FU references confirmed at their actual line numbers
- Smoke waiver: applied per Rule 27 default

Wait for dispatcher merge confirmation before Phase 6.

---

## Phase 6 — Fourteenth Rule 16 application (post-merge fill)

After dispatcher confirms merge with verbatim `git log origin/main --oneline -3` paste-back showing:
- PR squash subject containing `fix(a11y): comprehensive aria-label sweep`
- Captured squash SHA

Execute fill scope (2 files):

1. **`docs/CONTEXT.md`** top-table fields + recently-shipped row replacement:
   - Current main HEAD → work-PR squash SHA (NOT the fill commit — per Rule 16 corrected wording)
   - Active track → "Comprehensive aria-label sweep shipped (PR #{this}, squash `{SHA}`). 9 sites across 6 files; closes FU L992 (History row) + FU L1053-1057 (CampaignForm close) + 7 net-new sites. Two defect classes: icon-only buttons + mobile-hidden-text pattern."
   - Next track → "Smaller follow-ups remaining: wizard R2-R5 residual, `bg-[var(--color-X)]` arbitrary-syntax sweep, 6 untracked verification scripts (deferred per FU body). Resend invite UI (MEDIUM) is the next substantive feature work — Q1-Q3 dispatcher-recommended (client-side short-term, canAct/isInactive gate, audit log entry), Q4 = Option A (3 buttons always for MVP) per operator decision 2026-05-19."
   - Where we left off → 2-paragraph update covering: (1) Aria-label sweep shipped as first PR of 2026-05-19 session. 70-min autonomous audit block produced clean scope (Audits 1+3 surfaced already-shipped work as Rule 17 catches #12 + #13; audits 2 + 4 produced usable scope). Audit 2 → this sweep (XS-S, 6 files); audit 4 → Resend invite UI brief (M, queued next). (2) Fourteenth consecutive Rule 16 cycle, zero drift. Strike count 0/2 maintained. Total Rule 17 in-the-wild signals across three-day arc: 14. Memory + CONTEXT.md cleaned of stale "react-hooks ×3" + "shakedown bugs 001/003/004/006" references (both shipped PR #164/#165 on 2026-05-15; were stale at memory-write time).
   - Last updated → 2026-05-19
   - Replace `#{TBD}` and `{TBD}` in the recently-shipped row with the squash details.

2. **`docs/FOLLOW_UPS.md`** closure paragraphs in BOTH banked FU sections (L992 History row + L1053-1057 CampaignForm close) — replace `#{TBD}` and `{TBD}` with the squash details. Both heading markers also update to `[RESOLVED PR #{N}, {SHA}]`.

**Commit message:**
```
docs: fill PR #{TBD} placeholders (aria-label sweep closure) — fourteenth Rule 16 application
```

**Rule 15 verification (mandatory):**
- After push: `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
- `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
- Confirm local HEAD == origin/main, fill commit on top, work PR squash directly below.
- Report "pushed and verified" with all SHAs visible.
- Any mismatch → STOP and wait for dispatcher. Hard-stop.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| One or more of the 9 sites already has aria-label (fixed since audit) | Low | Phase 1 step 3 re-greps each file for `aria-label`; surfaces any conflict with the 9 target sites. |
| Line numbers shifted since audit (audit was 2026-05-19; if any PR since touched these files) | Low-Medium | Phase 1 step 2 reads each site with context; reports actual line if shifted. Adjusts Phase 2 str_replace targets to match current state. |
| `sr-only` not used in codebase (forces Class B fallback to aria-label) | Low | Phase 1 step 4 explicitly checks; fallback is well-defined (use `aria-label` on button at L163/L172 with same value as visible text). |
| Build fails on JSX syntax (e.g., string interpolation in aria-label) | Very low | Site 2 has variable interpolation in suggested aria-label — Phase 2 step 1 documents fallback to static string if local variable handle is ambiguous. |
| jsx-a11y linter introduces new errors (e.g., heuristic flags aria-label format) | Very low | Lint exits 0 today; adding aria-labels can only reduce a11y errors. If it does introduce new errors, surface in Phase 5 report. |

---

## Strike count

**0/2** — clean entering this PR.

Two-day + this-morning arc summary at brief authoring time:
- 11 work PRs shipped (FU-J → FU-N methodology + 4 cleanup PRs + this would be 12)
- 13 Rule 16 cycles, zero drift (this would be 14)
- 14 Rule 17 in-the-wild signals (last 3 caught today via autonomous audit)
- 7+ Rule 11 corrected-diagnosis preservations
- 2 Rule 9 in-PR scope extensions

Strike count holds 0/2 throughout. The discipline catches what brief-authoring rushes; this PR continues the pattern: source-verify Phase 1 → execute Phase 2 → standard banks/PR/fill.

---

## End of brief.
