# Kickoff brief — Delete dead `MotivationalCarousel` component

## Header

| Field | Value |
|---|---|
| **Type** | Dead-code removal (mechanical) |
| **Shape** | 1–2 file deletions + 2 docs updates (FOLLOW_UPS.md, CONTEXT.md). No runtime surface change. |
| **Size** | XS (~10 minutes execution) |
| **Banking source** | FOLLOW_UPS.md L1059–1061 "## Delete dead MotivationalCarousel component (LOW, banked during Mobile FU#4 smoke)" |
| **Historical context** | M2 / PR #107 (squash `46eda67`) removed `MotivationalCarousel` from `ManagerDashboard` and wired `ManagerOverviewTab`. Component file was retained in source; deletion was deferred to a future dead-code sweep. This PR is that sweep — scoped to this one component only. |
| **Cross-references** | CONTEXT.md "Pending operational state" L142 also flags this same dead code. Both locations get updated by Phase 4. |
| **Smoke walk** | **WAIVED.** Pure dead-code removal — no JSX consumers (to be re-verified Phase 1), no runtime surface change, no behavior to walk. Lint + build + grep-verify-no-imports is the substantive verification. Waiver justified inline per Rule 27 default. |
| **Strike count** | 0/2 — clean. |

---

## Architectural decisions (locked at brief authoring)

These are the decisions for CC to honor, not re-litigate. Each is source-verifiable.

1. **Scope: component file + colocated test file only.** Per FU body, the only artifacts to delete are `src/components/dashboard/MotivationalCarousel.jsx` plus its test file if it exists (the FU body alludes to "no JSX usage anywhere in `src/` outside the test file" — implying a test file exists). Phase 1 enumerates the actual files; Phase 2 deletes both if both exist, just the component if not.

2. **Do NOT touch `dailyNudge` / `dailyEntry` / other dashboard components.** Mock review confirmed: the new design-v2 dashboards use `ActivityFeed.jsx` (B3) and the goal carousel (`GoalCarousel.jsx`, B2). `MotivationalCarousel.jsx` is the legacy component being removed. Sibling files in `src/components/dashboard/` are out of scope.

3. **Do NOT re-verify "dead since PR #107" with `git log`.** That historical claim in the FU body is anchored at PR #107 squash `46eda67`. Phase 1 verifies *current state* (no imports/JSX usage today) — that's the only condition that gates safe deletion. Whether it became dead at PR #107 vs later is documentation-historical, not a deletion-safety question.

4. **Phase 4 removes the CONTEXT.md L142 pending-operational-state line.** Once the component is deleted, that pending-state line no longer reflects truth. Remove the line; add a recently-shipped row capturing the deletion. Standard lifecycle for a pending item that ships.

5. **No FU letter.** This is a dead-code feature cleanup, not a methodology/infra FU. FU-letter naming (FU-A through FU-N) is reserved for methodology/infra work. Phase 4a marks the heading-only "Delete dead MotivationalCarousel component" entry as `[RESOLVED PR #{TBD}, {TBD}]` — heading edit + checkbox tick + closure paragraph (no FU letter renaming).

---

## Source-verified state at brief authoring (read these for Phase 1 ground truth)

These claims are source-verified against the uploaded artifacts at brief authoring time. Phase 1 re-verifies them against live repo state (per Rule 17 — the FU body's "no JSX usage anywhere" claim is from PR #154 era; some time has passed).

**FU body verbatim (FOLLOW_UPS.md L1059–1061):**
> ## Delete dead MotivationalCarousel component (LOW, banked during Mobile FU#4 smoke)
> - [ ] **Delete dead `MotivationalCarousel` component** — `src/components/dashboard/MotivationalCarousel.jsx` (~150 LOC) has had zero live consumers since M2 (PR #107, `46eda67`) removed it from `ManagerDashboard` and wired `ManagerOverviewTab`. Component remains in source. Verified dead via grep (no JSX usage anywhere in `src/` outside the test file) and git log of PR #107 commit message ("Removes MotivationalCarousel + Sparkles placeholder"). Surfaced during Mobile FU#4 P2-3 smoke walk when the component could not be located in any rendered dashboard. Removal is mechanical: delete the component file. No imports remain to clean up. Defer to a dead-code-removal sweep rather than a one-off.

**CONTEXT.md L142 verbatim (Pending operational state):**
> - **`MotivationalCarousel.jsx` is dead code** — removed from ManagerDashboard by M2 (PR #107, `46eda67`). Component file retained in source pending deletion sweep (FU banked in `docs/FOLLOW_UPS.md`).

**Project-knowledge snippet showing legacy component still has internal structure** (no live consumers, but file content exists):
> `src/components/dashboard/MotivationalCarousel.jsx` contains card builder functions: `buildAgentCards()`, `buildManagerCards()`, helpers for streak / rank / MDRT / quarter countdown / closing ratio / encouragement messages.

The component's internal richness is irrelevant to deletion — Phase 1 only checks for current consumers, not implementation depth.

---

## Phase 0 — Pre-flight gate

```powershell
# From C:\Projects\AgencyTrack
git status                         # working tree clean
git fetch origin
git pull --ff-only origin main
git log origin/main --oneline -1   # capture current main HEAD
```

**Expected state:** Working tree clean. Current main HEAD matches the SHA in CONTEXT.md top-table § `Current main HEAD`.

**Hard-stop if:**
- Working tree not clean → surface in chat, do not absorb
- `git pull` not fast-forward → surface in chat, do not force
- Local HEAD ≠ origin/main → surface, do not proceed

Capture HEAD SHA for Phase 0 report. Create worktree under `worktrees/`:

```powershell
git worktree add ../agencytrack-worktrees/dead-motivationalcarousel chore/dead-motivationalcarousel-deletion
cd ../agencytrack-worktrees/dead-motivationalcarousel
```

---

## Phase 1 — Source-verify deletion safety (Rule 17 — re-verify FU body claims)

### Step 1 — Confirm component file exists

```powershell
ls src/components/dashboard/MotivationalCarousel.jsx
```

**Expected:** File exists. Capture line count via `(Get-Content src/components/dashboard/MotivationalCarousel.jsx | Measure-Object -Line).Lines` — expected ~150 LOC per FU body, but tolerate ±30% (file may have been touched since FU was banked).

**Hard-stop if:** File doesn't exist (already deleted by some prior PR not captured in CONTEXT.md). Surface in chat.

### Step 2 — Enumerate test file (if any)

```powershell
git ls-files src/components/dashboard/ | Select-String "MotivationalCarousel"
```

**Expected:** Returns the component file path. May also return a test file (`MotivationalCarousel.test.jsx`, `MotivationalCarousel.test.js`, or similar) per FU body's allusion. Capture both paths.

If test file exists → both files get deleted in Phase 2.
If no test file → only component file gets deleted.

### Step 3 — Grep for ALL imports / JSX usage in `src/`

Per Rule 17 Enumeration tracked-status sub-bullet: `grep` plus `git ls-files` filter to scope to tracked files only.

```powershell
# All references in tracked files (excluding the component itself)
git ls-files src/ | Select-String -SimpleMatch -InputObject { Get-Content $_ -Raw } -Pattern "MotivationalCarousel" 2>$null
```

Or simpler equivalent:

```powershell
git grep -n "MotivationalCarousel" -- 'src/**/*.js' 'src/**/*.jsx'
```

**Expected:** Returns ZERO hits outside `src/components/dashboard/MotivationalCarousel.jsx` itself and (if exists) its `.test.jsx` sibling. The FU body claims this; Phase 1 re-verifies.

**Hard-stop if:** Any external import or JSX usage found. Surface in chat with file paths. Do not proceed to deletion — the FU body's "dead" claim would be falsified and a real consumer would break. This is exactly what Rule 17 catches.

### Step 4 — Confirm no Tailwind / CSS class collateral

```powershell
# Look for any CSS class names tied specifically to the carousel
git grep -n "motivational-carousel\|motivational_carousel\|MotivationalCarousel" -- 'src/index.css' 'tailwind.config.js'
```

**Expected:** ZERO hits. If `src/index.css` has carousel-specific class blocks tied to MotivationalCarousel (separate from `GoalCarousel` B2 work), surface in chat — may need targeted CSS block deletion in Phase 2.

### Step 5 — FU body re-verification + Phase 1 report

Quote-verify the FU body and CONTEXT.md L142 are still present (not removed by some other PR):

```powershell
Select-String -Path docs/FOLLOW_UPS.md -Pattern "Delete dead MotivationalCarousel" | Select-Object -First 3
Select-String -Path docs/CONTEXT.md   -Pattern "MotivationalCarousel.jsx. is dead code"
```

**Expected:** FOLLOW_UPS.md returns the heading + checkbox line. CONTEXT.md returns the pending-operational-state line at ~L142.

**Phase 1 report content (paste-back to dispatcher):**
- Component file path + LOC
- Test file path (or "none")
- External imports / JSX usage count (must be 0; paste verbatim grep output)
- CSS / Tailwind references (must be 0; paste verbatim grep output)
- FU body still present in FOLLOW_UPS.md (line number)
- CONTEXT.md L142 line still present (line number)
- **Divergences from FU body claims:** (if any — e.g., FU body says no test file but one exists, or vice versa)

Wait for dispatcher clearance before Phase 2.

---

## Phase 2 — Execute deletion

Per Phase 1 enumeration:

```powershell
git rm src/components/dashboard/MotivationalCarousel.jsx
# If Phase 1 found a test file:
git rm src/components/dashboard/MotivationalCarousel.test.jsx
```

If Phase 1 step 4 found CSS collateral, additionally edit `src/index.css` to remove only the MotivationalCarousel-specific blocks (use `str_replace`, not bulk edits).

---

## Phase 3 — Verify

### Step 1 — Diff stat

```powershell
git diff main..HEAD --stat
```

**Expected:** 1 or 2 deletions (D lines), plus Phase 4 docs updates (2 M lines). No other M/A entries.

### Step 2 — `.env.example` carve-out check (Rule 14)

```powershell
git diff main..HEAD -- .env.example
```

**Expected:** Empty. (This PR has no runtime config surface; touching `.env.example` would be wrong.)

### Step 3 — Lint + build

```powershell
npm run lint
npm run build
```

**Expected:** Lint exits 0. Build clean. Build especially matters — if any latent import path was missed by the grep, Vite's tree-shaker will catch it as an unresolved module error.

### Step 4 — Smoke walk waiver

Smoke walk **WAIVED** per Rule 27 default for clearly non-user-visible changes (dead-code removal, no runtime surface change). Justification recorded inline in this brief header.

---

## Phase 4 — Banks

### Phase 4a — FOLLOW_UPS.md: mark resolved

Locate the heading at `## Delete dead MotivationalCarousel component (LOW, banked during Mobile FU#4 smoke)`. Update heading and tick checkbox:

**From:**
```
## Delete dead MotivationalCarousel component (LOW, banked during Mobile FU#4 smoke)

- [ ] **Delete dead `MotivationalCarousel` component** — `src/components/dashboard/MotivationalCarousel.jsx` (~150 LOC) ...
```

**To:**
```
## Delete dead MotivationalCarousel component (LOW, banked during Mobile FU#4 smoke) [RESOLVED PR #{TBD}, {TBD}]

- [x] **Delete dead `MotivationalCarousel` component** — `src/components/dashboard/MotivationalCarousel.jsx` (~150 LOC) ...
```

Append a closure paragraph at the end of the section (after the existing bulleted body):

```
**Closure (PR #{TBD}, squash `{TBD}`):** Component file deleted at `src/components/dashboard/MotivationalCarousel.jsx`. Test file [deleted at `src/components/dashboard/MotivationalCarousel.test.jsx` if existed | no test file existed — confirm per Phase 1]. Re-verified at execution: zero external imports / JSX usage in tracked `src/` files. Sweep scope was limited to this one component per locked decision; broader dead-code sweeps deferred.
```

Phase 6 (post-merge) replaces `#{TBD}` and `{TBD}` with the work-PR squash details.

### Phase 4b — CONTEXT.md: remove pending-state line + add recently-shipped row

**Edit 1: Remove line 142 from "Pending operational state" section** — the line beginning:
```
- **`MotivationalCarousel.jsx` is dead code** — removed from ManagerDashboard by M2 (PR #107, `46eda67`) ...
```

Delete entire bullet (single line). Adjacent bullets stay.

**Edit 2: Add row at top of "Recently shipped" table.** Current top row is for PR #206 (Rule 17 sub-bullet). Insert new row above:

```
| #{TBD} | `{TBD}` | Dead-code removal: deleted `src/components/dashboard/MotivationalCarousel.jsx` (~150 LOC, zero live consumers since M2 / PR #107 / `46eda67`). Closes FU "Delete dead MotivationalCarousel component" (LOW, banked during Mobile FU#4 smoke). |
```

Drop the oldest row to keep the table at 5 entries (per CONTEXT.md § "How to update this file" maintenance rule).

---

## Phase 5 — Commit + push + PR

### Commit message

```
chore(cleanup): delete dead MotivationalCarousel component (banked during Mobile FU#4)

Component file at src/components/dashboard/MotivationalCarousel.jsx (~150 LOC) had
zero live consumers since M2 / PR #107 (46eda67) removed it from ManagerDashboard
and wired ManagerOverviewTab. Test file [deleted alongside | absent] per Phase 1.

Re-verified at execution per Rule 17: zero external imports / JSX usage in
tracked src/ files; zero CSS / Tailwind references. Build passes — Vite's
tree-shaker confirms no latent module unresolved.

Closes FU "Delete dead MotivationalCarousel component" (LOW, banked during
Mobile FU#4 smoke).
```

### PR title

```
chore(cleanup): delete dead MotivationalCarousel component (banked during Mobile FU#4)
```

### PR body

Standard structure:
1. **What:** Mechanical dead-code removal, closing FU banked during Mobile FU#4 smoke.
2. **Why:** Component file retained in source after M2 / PR #107 removed its sole consumer. FU body marked it dead; this PR is the deferred deletion sweep.
3. **Verification:** Phase 1 grep proof (paste verbatim output), lint + build clean, smoke waived per Rule 27 default.
4. **Files touched:** Component file + (optionally) test file deletions + docs updates (FOLLOW_UPS.md mark resolved + CONTEXT.md pending-state line removal + recently-shipped row).

### Push

```powershell
git push -u origin chore/dead-motivationalcarousel-deletion
gh pr create --title "chore(cleanup): delete dead MotivationalCarousel component (banked during Mobile FU#4)" --body-file ...
```

### End-of-Phase-5 report (paste to dispatcher)

- PR URL
- Branch HEAD SHA
- `git log chore/dead-motivationalcarousel-deletion --oneline -1` verbatim
- `git diff main..HEAD --stat` verbatim
- `.env.example` diff (empty expected)
- Phase 1 source-verification capture (grep outputs)
- Lint + build results
- Phase 1 divergences from FU body (if any)
- Smoke waiver: applied per Rule 27 default for dead-code removal

Wait for dispatcher merge confirmation before Phase 6.

---

## Phase 6 — Eleventh Rule 16 application (post-merge fill)

After dispatcher confirms merge with verbatim `git log origin/main --oneline -3` paste-back showing:
- PR squash subject containing `chore(cleanup): delete dead MotivationalCarousel component`
- Captured squash SHA

Execute fill scope (2 files):

1. **`docs/CONTEXT.md`** top-table fields + recently-shipped row replacement:
   - Current main HEAD → work-PR squash SHA (NOT the fill commit — per Rule 16 corrected wording)
   - Active track → "Dead `MotivationalCarousel` component deleted (PR #{this}, squash `{SHA}`). Closes FU banked during Mobile FU#4 smoke."
   - Next track → "Smaller follow-ups remaining: react-hooks ×3, aria-label sweep (CampaignForm + History row), `bg-[var(--color-X)]` arbitrary-syntax sweep, untracked legacy briefs/scripts cleanup, shakedown bugs 001/003/004/006, Wizard R2-R5 residual. Resend invite UI (MEDIUM) remains in Active follow-ups table for substantive work."
   - Where we left off → 2-paragraph update covering: deletion shipped, methodology arc closing PR + first non-arc PR (mechanical dead-code), Rule 17 caught two upstream recommendations (B1 + Mobile FU#4 both already shipped) before any wasted brief work. Eleventh consecutive Rule 16 cycle, zero drift.
   - Last updated → 2026-05-18
   - Replace `#{TBD}` and `{TBD}` in the recently-shipped row with the squash details.

2. **`docs/FOLLOW_UPS.md`** closure paragraph in the "Delete dead MotivationalCarousel component" section — replace `#{TBD}` and `{TBD}` with the squash details.

**Commit message:**
```
docs: fill PR #{TBD} placeholders (MotivationalCarousel deletion closure) — eleventh Rule 16 application
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
| Latent import path missed by grep (e.g., dynamic `import()` or string-based ref) | Low | Build step (`npm run build`) catches unresolved modules at Vite tree-shake. Hard-fails if any. |
| Test file pulls in component but no production code does | Medium | Phase 1 step 2 enumerates test file. Phase 2 deletes test file alongside component if present. |
| FU body claim "no JSX usage" is stale (some other PR added a consumer since Mobile FU#4) | Low-Medium | Phase 1 step 3 re-verifies grep. Hard-stop if any external usage found. This is exactly what Rule 17 catches. |
| CSS variable / Tailwind class tied specifically to MotivationalCarousel survives | Low | Phase 1 step 4 grep checks `src/index.css` + `tailwind.config.js`. |
| Memory entry "Mobile FU#4 cosmetics" implies untouched work — but FU#4 shipped at #154 | (already manifested) | Caught at brief-authoring time before any waste. Memory needs a sweep at session close — banked. |

---

## Strike count

**0/2** — clean entering this PR. Rule 17 has fired 9× across the two-day arc; all caught at progressively earlier layers; strikes never accrued.

---

## End of brief.
