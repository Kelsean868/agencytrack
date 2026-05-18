# Kickoff brief — Archive 9 stale kickoff briefs to `docs/archive/briefs/`

## Header

| Field | Value |
|---|---|
| **Type** | Working-tree hygiene — archive stale shipped-PR kickoff briefs |
| **Shape** | 9 file moves via `git mv` + `mkdir -p docs/archive/briefs/` + 2 docs updates (FOLLOW_UPS.md, CONTEXT.md). No code changes. |
| **Size** | XS–S (~30 minutes execution) |
| **Banking source** | FOLLOW_UPS.md L8–40 "## Untracked legacy briefs + verification scripts cleanup (LOW, banked 2026-05-13)" |
| **Closes** | This PR resolves the briefs portion of the FU; scripts portion remains deferred per FU body's locked direction (no action on the 6 untracked scripts). FU heading flips to `[RESOLVED PR #{TBD}, {TBD}]` with closure block documenting that scripts stay deferred. |
| **Rule 17 + Rule 11 pre-applied** | FU body lists 11 untracked files at banking time (2026-05-13). Actual count today is 15 (9 briefs + 6 scripts) — 4 additional verification scripts joined the untracked pool post-banking. Per Rule 11: preserve FU body wording unchanged; closure block records corrected-diagnosis with explicit count divergence. |
| **Smoke walk** | **WAIVED.** Pure docs-archive work — no code change, no runtime surface change. Lint + build + working-tree-clean check is the substantive verification. Waiver justified inline per Rule 27 default. |
| **Strike count** | 0/2 — clean. |

---

## Architectural decisions (locked at brief authoring)

These are source-verified locked decisions for CC to honor.

1. **Scope: briefs only.** Move the 9 stale briefs enumerated in the FU body to `docs/archive/briefs/`. The 6 untracked verification scripts stay deferred — do NOT delete them, do NOT commit them, do NOT archive them. Per FU body wording: "possibly reusable — defer fate to next consumer." Scripts get a corrected-count note in the closure block (FU body said 2 scripts; today there are 6) but no action.

2. **`git mv` (not filesystem mv + `git add`).** Preserves the file rename in git history. Git's similarity detection will flag these as renames in the diff, not delete+add pairs.

3. **`mkdir -p docs/archive/briefs/` first.** If directory already exists from prior cleanup, the `-p` flag is a no-op. Safer than relying on `git mv` to auto-create parent directories.

4. **Single docs-only commit** per FU body step 4. No need to split per-brief.

5. **Phase 1 re-enumerates untracked files** (Rule 17 enumeration tracked-status discipline from FU-N PR #206). Don't trust the FU body's "11 untracked files" claim — re-run `git status --porcelain` and compare against the FU body's enumeration. Document divergence (expected: 4 additional verification scripts post-banking — Phase 1 confirms).

6. **Rule 11 corrected-diagnosis preservation in FU body.** Do NOT edit the FU body's bulleted enumeration to add the 4 additional scripts. The FU body is a banking-time historical snapshot. Closure block records the corrected diagnosis as new content appended at the end of the section.

---

## Source-verified state at brief authoring

### FU body verbatim (FOLLOW_UPS.md L8–40)

> ## Untracked legacy briefs + verification scripts cleanup (LOW, banked 2026-05-13)
>
> **Scope:** `git status` on `main` surfaces 11 untracked files left over from shipped work. Cleanup deferred during the memory-refresh session.
>
> **Stale kickoff briefs** (all features shipped — archive to `docs/archive/briefs/`):
> - `docs/PR-3-Claude-Code-Brief.md` — user-mgmt PR-3 (#28). Already noted in CONTEXT.md Pending Operational across PR #39 + #40; un-actioned since.
> - `docs/briefs/e1-slice-2a-kickoff.md` — E1 schema split (#68).
> - `docs/briefs/e1-slice-2b-kickoff.md` — E1 schema split (#69/#70).
> - `docs/briefs/e4-phase-8-followup-kickoff.md` — E4 follow-up.
> - `docs/briefs/e4-production-report-kickoff.md` — E4 (#72).
> - `docs/briefs/e5-kiosk-mode-kickoff.md` — E5 (#73).
> - `docs/briefs/e6-agent-of-month-kickoff.md` — E6 AOM (#76).
> - `docs/briefs/e6-daily-input-kickoff.md` — E6 daily (#71).
> - `docs/briefs/pr-d-server-side-email-kickoff.md` — PR-D (#133).
>
> **Verification scripts** (possibly reusable — defer fate to next consumer):
> - `scripts/mgr-mobile-audit.cjs` — used by Mobile FU#1 #90 mgr-mobile audit.
> - `scripts/verification/pr-d-email-smoke.mjs` — used by PR-D #133 smoke.
>
> **Cleanup approach:**
> 1. `mkdir -p docs/archive/briefs/` if not present.
> 2. `git mv` each stale brief into `docs/archive/briefs/`.
> 3. Surface the two verification scripts for decision: archive, delete, or leave as-is for the next manager-mobile / email-smoke iteration.
> 4. Single docs-only commit: `docs(archive): archive Track-E + PR-D kickoff briefs (shipped)`.
>
> Priority: **LOW**. Not blocking. Bank for the next docs-hygiene session.

### CONTEXT.md L138 verbatim (Pending operational state)

> - **Untracked legacy docs + scripts** — `git status` shows untracked files left over from shipped work, across three categories: `docs/PR-3-Claude-Code-Brief.md` (user-mgmt PR-3 brief, shipped PR #28), Track-E/PR-D kickoff briefs under `docs/briefs/` (E1 #68–#70, E4 #72, E5 #73/#74, E6 daily #71, E6 AOM #76, PR-D #133), and verification scripts under `scripts/` and `scripts/verification/` from Mobile FU#1 (#90), PR-D (#133), Mobile FU#2 (#153), Mobile FU#4 (#154), and border-border (#156). Cleanup tracked in `docs/FOLLOW_UPS.md` — likely fate: archive briefs to `docs/archive/briefs/`, defer scripts (possibly reusable). Not blocking.

This line gets removed from CONTEXT.md as part of Phase 4 (natural pending → shipped lifecycle).

### Today's afternoon `git status` paste-back (operator-observed, verbatim)

```
docs/PR-3-Claude-Code-Brief.md
docs/briefs/e1-slice-2a-kickoff.md
docs/briefs/e1-slice-2b-kickoff.md
docs/briefs/e4-phase-8-followup-kickoff.md
docs/briefs/e4-production-report-kickoff.md
docs/briefs/e5-kiosk-mode-kickoff.md
docs/briefs/e6-agent-of-month-kickoff.md
docs/briefs/e6-daily-input-kickoff.md
docs/briefs/pr-d-server-side-email-kickoff.md
scripts/mgr-mobile-audit.cjs
scripts/verification/border-border-smoke.mjs
scripts/verification/high6-ytd-smoke.mjs
scripts/verification/mobile-fu2-tap-targets-smoke.mjs
scripts/verification/mobile-fu4-cosmetics-smoke.mjs
scripts/verification/pr-d-email-smoke.mjs
```

Plus `gh pr create` warned "15 uncommitted changes" — confirms the count.

**Reconciliation against FU body:**
| Category | FU body count (2026-05-13) | Actual count (2026-05-18) | Delta |
|---|---|---|---|
| Briefs | 9 | 9 | 0 |
| Scripts | 2 | 6 | **+4** |
| **Total** | **11** | **15** | **+4** |

The 4 additional scripts (post-2026-05-13):
- `scripts/verification/border-border-smoke.mjs` (border-border #156)
- `scripts/verification/high6-ytd-smoke.mjs` (HIGH-6 YTD)
- `scripts/verification/mobile-fu2-tap-targets-smoke.mjs` (Mobile FU#2 PR #153, 2026-05-14)
- `scripts/verification/mobile-fu4-cosmetics-smoke.mjs` (Mobile FU#4 PR #154, 2026-05-14)

These 4 scripts inherit the same deferred status as the original 2 — no action this PR.

---

## Phase 0 — Pre-flight gate

```powershell
# From C:\Projects\AgencyTrack
git status                              # capture untracked file count for Phase 1
git fetch origin
git pull --ff-only origin main
git log origin/main --oneline -1        # capture current main HEAD
```

**Expected state:**
- Working tree shows the same 15 untracked files; otherwise tree clean
- Current main HEAD matches `docs/CONTEXT.md` top-table § `Current main HEAD`

**Hard-stop if:**
- `git pull` not fast-forward → surface, do not force
- Untracked file count differs from afternoon's 15 → surface in chat (some files may have been committed by another PR; brief scope may need adjustment)

Capture HEAD SHA. Create worktree:

```powershell
git worktree add ../agencytrack-worktrees/archive-stale-briefs chore/archive-stale-briefs
cd ../agencytrack-worktrees/archive-stale-briefs
```

---

## Phase 1 — Source-verify untracked file landscape (Rule 17 + Rule 11)

### Step 1 — Re-enumerate untracked files

```powershell
git status --porcelain | Where-Object { $_ -match '^\?\?' }
```

**Expected output (verbatim — paste back to dispatcher):**
15 entries matching the afternoon `git status` paste-back (see Source-verified state above). Capture verbatim.

**Hard-stop if:**
- Count is not 15 → surface immediately; brief scope assumes 15 files
- Any of the 9 briefs in the FU body's enumeration is missing → another PR may have committed it; reconcile before proceeding

### Step 2 — Cross-check each of the 9 briefs is still untracked

```powershell
# Each of these should print 'untracked' status
foreach ($f in @(
  'docs/PR-3-Claude-Code-Brief.md',
  'docs/briefs/e1-slice-2a-kickoff.md',
  'docs/briefs/e1-slice-2b-kickoff.md',
  'docs/briefs/e4-phase-8-followup-kickoff.md',
  'docs/briefs/e4-production-report-kickoff.md',
  'docs/briefs/e5-kiosk-mode-kickoff.md',
  'docs/briefs/e6-agent-of-month-kickoff.md',
  'docs/briefs/e6-daily-input-kickoff.md',
  'docs/briefs/pr-d-server-side-email-kickoff.md'
)) {
  $tracked = git ls-files --error-unmatch $f 2>&1
  $exists = Test-Path $f
  Write-Output "$f`: exists=$exists tracked=$(if ($LASTEXITCODE -eq 0) { 'YES' } else { 'NO' })"
}
```

**Expected:** Each prints `exists=True tracked=NO`.

**Hard-stop if:**
- Any file shows `tracked=YES` → already committed somewhere; reconcile
- Any file shows `exists=False` → file deleted from disk without git tracking; reconcile

### Step 3 — Check `docs/archive/briefs/` directory state

```powershell
Test-Path docs/archive/briefs
ls docs/archive/briefs -ErrorAction SilentlyContinue
```

**Report:**
- Directory exists or not?
- If exists, what's already in it? (Other archived briefs from past cleanups.)

This doesn't gate progress — Phase 2 `mkdir -p` is idempotent. Just informational for the brief audit trail.

### Step 4 — Confirm FU body + CONTEXT.md L138 still present

```powershell
Select-String -Path docs/FOLLOW_UPS.md -Pattern "Untracked legacy briefs.*scripts cleanup" | Select-Object -First 3
Select-String -Path docs/CONTEXT.md -Pattern "Untracked legacy docs" | Select-Object -First 3
```

**Expected:**
- FOLLOW_UPS.md returns the FU heading + (optionally) a body line
- CONTEXT.md returns the pending-operational-state line at ~L138

### Step 5 — Phase 1 report (paste-back to dispatcher)

- Untracked file count: actual (expected 15) — paste verbatim `git status --porcelain` output
- Each of 9 briefs: exists + untracked status (expected `exists=True tracked=NO` for all 9)
- `docs/archive/briefs/` directory: exists / does-not-exist (+ contents if exists)
- FU body present at FOLLOW_UPS.md line N (capture N)
- CONTEXT.md L138 (or wherever it lives now) present at line N (capture N)
- **Divergences from FU body's 2026-05-13 banking-time enumeration:** 4 additional verification scripts in `scripts/verification/` (list each: border-border-smoke, high6-ytd-smoke, mobile-fu2-tap-targets-smoke, mobile-fu4-cosmetics-smoke)

Wait for dispatcher clearance before Phase 2.

---

## Phase 2 — Execute archive

### Step 1 — Create archive directory (idempotent)

```powershell
mkdir -p docs/archive/briefs
```

Or equivalent PowerShell:

```powershell
New-Item -ItemType Directory -Path docs/archive/briefs -Force | Out-Null
```

### Step 2 — `git mv` each of the 9 briefs

```powershell
git mv docs/PR-3-Claude-Code-Brief.md            docs/archive/briefs/PR-3-Claude-Code-Brief.md
git mv docs/briefs/e1-slice-2a-kickoff.md         docs/archive/briefs/e1-slice-2a-kickoff.md
git mv docs/briefs/e1-slice-2b-kickoff.md         docs/archive/briefs/e1-slice-2b-kickoff.md
git mv docs/briefs/e4-phase-8-followup-kickoff.md docs/archive/briefs/e4-phase-8-followup-kickoff.md
git mv docs/briefs/e4-production-report-kickoff.md docs/archive/briefs/e4-production-report-kickoff.md
git mv docs/briefs/e5-kiosk-mode-kickoff.md       docs/archive/briefs/e5-kiosk-mode-kickoff.md
git mv docs/briefs/e6-agent-of-month-kickoff.md   docs/archive/briefs/e6-agent-of-month-kickoff.md
git mv docs/briefs/e6-daily-input-kickoff.md      docs/archive/briefs/e6-daily-input-kickoff.md
git mv docs/briefs/pr-d-server-side-email-kickoff.md docs/archive/briefs/pr-d-server-side-email-kickoff.md
```

⚠ **Note:** `git mv` may fail on untracked files. If so, fallback is:

```powershell
# For each file
Move-Item docs/briefs/<file> docs/archive/briefs/<file>
git add docs/archive/briefs/<file>
```

Git's similarity detection should still flag these as renames in the diff stat if the content is identical (which it will be — pure move, no edit).

**Decision tree:**
1. Try `git mv` first (cleanest history)
2. If `git mv` errors with "fatal: not under version control" → use `Move-Item + git add` fallback
3. Report which path was used in Phase 5 report

### Step 3 — Verify no scripts were touched

```powershell
git status --porcelain | Where-Object { $_ -match 'scripts/' }
```

**Expected:** Still shows 6 untracked scripts (unchanged from Phase 0). If any script status changed → surface.

---

## Phase 3 — Verify

### Step 1 — Diff stat

```powershell
git diff main..HEAD --stat
```

**Expected pattern:**
- 9 renames (or 9 delete+add pairs if `git mv` fell back to fs move + add)
- 2 M entries for Phase 4 docs updates (FOLLOW_UPS.md + CONTEXT.md)

If `git mv` worked cleanly, diff stat shows `docs/{path}/...{name}.md -> docs/archive/briefs/...{name}.md` as renames.

### Step 2 — `.env.example` carve-out check (Rule 14)

```powershell
git diff main..HEAD -- .env.example
```

**Expected:** Empty. (No runtime config touched.)

### Step 3 — Lint + build

```powershell
npm run lint
npm run build
```

**Expected:** Both pass. Docs-only PR, so neither should actually be affected, but standard gate per CLAUDE.md.

### Step 4 — Working tree post-PR state

```powershell
git status --porcelain
```

**Expected:** 6 untracked scripts remaining (the deferred fate). NO untracked briefs. Working tree otherwise clean.

### Step 5 — Smoke walk waiver

**WAIVED** per Rule 27 default. Docs-archive work has zero runtime surface. Justification recorded inline in this brief header.

---

## Phase 4 — Banks

### Phase 4a — FOLLOW_UPS.md: mark resolved with Rule 11 corrected-diagnosis

Locate the heading `## Untracked legacy briefs + verification scripts cleanup (LOW, banked 2026-05-13)` (at L8). Update heading:

**From:**
```
## Untracked legacy briefs + verification scripts cleanup (LOW, banked 2026-05-13)
```

**To:**
```
## Untracked legacy briefs + verification scripts cleanup (LOW, banked 2026-05-13) [RESOLVED PR #{TBD}, {TBD}]
```

**Do NOT modify the bulleted FU body** — preserve banking-time content per Rule 11.

**Append closure paragraph** at end of section (after `Priority: **LOW**. Not blocking. Bank for the next docs-hygiene session.`):

```
**Closure (PR #{TBD}, squash `{TBD}`):** 9 stale kickoff briefs archived to `docs/archive/briefs/` via `git mv`. Single docs-only commit per FU body step 4.

**Rule 11 corrected-diagnosis:** FU body banked-time count of "11 untracked files" was stale at resolution. Actual count: 15 untracked files (9 briefs + 6 scripts). Four additional verification scripts joined the untracked pool between 2026-05-13 banking and 2026-05-18 resolution: `border-border-smoke.mjs` (border-border #156), `high6-ytd-smoke.mjs` (HIGH-6 YTD), `mobile-fu2-tap-targets-smoke.mjs` (Mobile FU#2 PR #153), `mobile-fu4-cosmetics-smoke.mjs` (Mobile FU#4 PR #154). All 6 scripts (original 2 + post-banking 4) intentionally left as deferred per FU body's "possibly reusable — defer fate to next consumer" direction. If/when a future PR re-runs any of these smoke scripts (Mobile FU#5, PR-D follow-up, etc.), the consuming PR can decide commit vs delete vs archive at that time.
```

Phase 6 (post-merge) replaces `#{TBD}` and `{TBD}` placeholders with the work-PR squash details.

### Phase 4b — CONTEXT.md: remove pending-state line + add recently-shipped row

**Edit 1: Remove the line at ~L138 from "Pending operational state" section** — the line beginning:
```
- **Untracked legacy docs + scripts** — `git status` shows untracked files left over from shipped work, across three categories: ...
```

Delete entire bullet (single multi-sentence bullet). Adjacent bullets stay.

After deletion, the "Pending operational state" section will have one fewer item (whichever was below). Same lifecycle pattern as the MotivationalCarousel-line removal yesterday (PR #208).

**Edit 2: Add row at top of "Recently shipped" table.** Current top row is for PR #208 (MotivationalCarousel deletion fill). Insert new row above:

```
| #{TBD} | `{TBD}` | Docs hygiene: archived 9 stale kickoff briefs (PR-3, Track-E E1/E4/E5/E6, PR-D) to `docs/archive/briefs/` via `git mv`. Closes FU "Untracked legacy briefs + verification scripts cleanup" (LOW, banked 2026-05-13) per briefs portion; 6 untracked verification scripts intentionally deferred per FU body's reusable-scripts direction. Rule 11 corrected-diagnosis: FU body's banked "11 untracked files" was stale; actual at resolution was 15 (4 additional scripts post-banking). |
```

Drop the oldest row to keep the table at 5 entries (per CONTEXT.md § "How to update this file" maintenance rule).

---

## Phase 5 — Commit + push + PR

### Commit message

```
docs(archive): archive 9 stale kickoff briefs to docs/archive/briefs/

Closes FU "Untracked legacy briefs + verification scripts cleanup" (LOW,
banked 2026-05-13) — briefs portion. Archives via `git mv`:

- docs/PR-3-Claude-Code-Brief.md (user-mgmt PR-3 #28)
- docs/briefs/e1-slice-2a-kickoff.md (E1 #68)
- docs/briefs/e1-slice-2b-kickoff.md (E1 #69/#70)
- docs/briefs/e4-phase-8-followup-kickoff.md (E4 follow-up)
- docs/briefs/e4-production-report-kickoff.md (E4 #72)
- docs/briefs/e5-kiosk-mode-kickoff.md (E5 #73)
- docs/briefs/e6-agent-of-month-kickoff.md (E6 AOM #76)
- docs/briefs/e6-daily-input-kickoff.md (E6 daily #71)
- docs/briefs/pr-d-server-side-email-kickoff.md (PR-D #133)

Six untracked verification scripts (scripts/mgr-mobile-audit.cjs + five
in scripts/verification/) intentionally deferred per FU body's "possibly
reusable — defer fate to next consumer" direction. Working tree post-PR:
6 deferred scripts remaining untracked.

Rule 11 corrected-diagnosis (closure block in FOLLOW_UPS.md): FU body's
2026-05-13 banked "11 untracked files" was stale at resolution. Actual
count: 15 (9 briefs + 6 scripts). Four additional scripts joined the pool
post-banking (border-border, HIGH-6 YTD, Mobile FU#2, Mobile FU#4 smoke
scripts).
```

### PR title

```
docs(archive): archive 9 stale kickoff briefs to docs/archive/briefs/
```

### PR body

Standard structure:
1. **What:** Mechanical archive of 9 stale shipped-PR kickoff briefs to `docs/archive/briefs/`.
2. **Why:** Working-tree hygiene; closes 2026-05-13 banked FU per briefs portion.
3. **Scope boundary:** Scripts portion deferred per FU body direction — 6 untracked verification scripts remain untracked.
4. **Rule 11 + Rule 17 note:** FU body's "11 untracked files" count was stale; actual was 15. Closure block documents the divergence; FU body wording preserved per Rule 11.
5. **Verification:** Phase 1 source-verification re-enumerated all 15 untracked files; lint + build clean; smoke waived per Rule 27 default (docs-only).

### Push

```powershell
git push -u origin chore/archive-stale-briefs
gh pr create --title "docs(archive): archive 9 stale kickoff briefs to docs/archive/briefs/" --body-file ...
```

### End-of-Phase-5 report (paste to dispatcher)

- PR URL
- Branch HEAD SHA
- `git log chore/archive-stale-briefs --oneline -1` verbatim
- `git diff main..HEAD --stat` verbatim (expected pattern: 9 renames + 2 M entries)
- `.env.example` diff (empty expected)
- Phase 1 source-verification capture (`git status --porcelain` output + per-file checks)
- `git mv` path used (clean rename vs fs-move-fallback) — report which
- Lint + build results
- Working tree post-PR state: 6 untracked scripts remaining
- Smoke waiver: applied per Rule 27 default for docs-archive work

Wait for dispatcher merge confirmation before Phase 6.

---

## Phase 6 — Twelfth Rule 16 application (post-merge fill)

After dispatcher confirms merge with verbatim `git log origin/main --oneline -3` paste-back showing:
- PR squash subject containing `docs(archive): archive 9 stale kickoff briefs`
- Captured squash SHA

Execute fill scope (2 files):

1. **`docs/CONTEXT.md`** top-table fields + recently-shipped row replacement:
   - Current main HEAD → work-PR squash SHA (NOT the fill commit — per Rule 16 corrected wording)
   - Active track → "9 stale kickoff briefs archived to `docs/archive/briefs/` (PR #{this}, squash `{SHA}`). Closes FU 'Untracked legacy briefs + verification scripts cleanup' (LOW, banked 2026-05-13) per briefs portion; scripts portion remains deferred per FU body direction."
   - Next track → "Smaller follow-ups remaining: react-hooks ×3, aria-label sweep (CampaignForm + History row), `bg-[var(--color-X)]` arbitrary-syntax sweep, shakedown bugs 001/003/004/006, Wizard R2-R5 residual. Resend invite UI (MEDIUM) remains in Active follow-ups table for substantive work."
   - Where we left off → 2-paragraph update covering: (1) Archive shipped as the second post-arc PR after MotivationalCarousel deletion. Third Rule 11 corrected-diagnosis preservation of the day (after FU-F-1 stale parser claims and MotivationalCarousel LOC divergence). Rule 17 enumeration tracked-status pattern (FU-N PR #206 sub-bullet) fired again at brief authoring — FU body's "11 untracked files" was stale; actual 15. (2) Twelfth consecutive Rule 16 cycle, zero drift maintained. Two-day arc closes with 10 work PRs across 29+ commits.
   - Last updated → 2026-05-18
   - Replace `#{TBD}` and `{TBD}` in the recently-shipped row with the squash details.

2. **`docs/FOLLOW_UPS.md`** closure paragraph in the "Untracked legacy briefs + verification scripts cleanup" section — replace `#{TBD}` and `{TBD}` with the squash details (both heading and closure block).

**Commit message:**
```
docs: fill PR #{TBD} placeholders (untracked-legacy-briefs archival closure) — twelfth Rule 16 application
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
| `git mv` fails on untracked files | Medium | Phase 2 step 2 has documented fallback (filesystem `Move-Item` + `git add`). |
| Some briefs already committed by an unrelated PR since afternoon | Low | Phase 1 step 2 checks each brief's tracked status; hard-stops if any show tracked. |
| `docs/archive/briefs/` directory has a conflict (file with same name as new directory, etc.) | Very low | Phase 1 step 3 checks state before Phase 2 acts. `mkdir -p` is idempotent if dir exists. |
| Working tree picks up a new untracked file mid-PR that wasn't there at Phase 0 | Low | Phase 3 step 4 final `git status --porcelain` will show this; surface in Phase 5 report if so. |
| Diff stat shows delete+add instead of renames | Low | Cosmetic, not blocking. Git's rename detection should kick in. Phase 5 report notes which pattern git produced. |

---

## Strike count

**0/2** — clean entering this PR.

Two-day arc summary at brief authoring time:
- 9 work PRs shipped (FU-J → FU-N methodology arc + MotivationalCarousel deletion)
- 11 Rule 16 cycles, zero drift
- 9 Rule 17 in-the-wild signals (7 in methodology arc + 2 in afternoon recommendation pivots; this brief surfaces a tenth at FU body's stale count)
- 6 Rule 11 corrected-diagnosis preservations (this PR will be the 7th)
- 2 Rule 9 in-PR scope extensions

This PR continues the trend: source-verify before authoring; preserve historical claims per Rule 11; correct the diagnosis in closure blocks.

---

## End of brief.
