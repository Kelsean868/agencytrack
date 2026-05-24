# Sidebar Collapse Toggle Hit-Target — Kickoff Brief

**Track:** Sidebar collapse toggle hit-target  
**Type:** CSS / accessibility polish  
**Size:** XS  
**Risk:** LOW — single CSS rule change, desktop-only surface, no logic or Firestore involvement  
**Goal of eventual PR:** Bump `.sidebar-collapse-btn` in `src/index.css` from its current 32×32px to the project's 44px minimum (or 40px — see open questions), without disrupting the surrounding sidebar header layout.

> **Methodology Rule 1 applies to any implementation work.** CC must STOP and wait for dispatcher before making any decision not pre-listed in the locked decisions section of the eventual build brief.

---

## Phase 0 — clean main

```
git checkout main
git fetch origin
git pull --ff-only origin main
git status
```

**Expected:** On branch `main`. Untracked files under `scripts/verification/` and `scripts/seed/` are expected and benign — do NOT treat them as dirt. Any other untracked or modified file, a non-fast-forward pull, or a dirty tracked file is a **STOP and wait for dispatcher** condition.

**Rule 12 hard-stop conditions:**
- Not on `main` after checkout → **STOP and wait for dispatcher**
- Dirty tree beyond the known untracked paths above → **STOP and wait for dispatcher**
- Pull conflict or non-fast-forward → **STOP and wait for dispatcher**

**Do NOT create a branch. This phase is read-only.**

---

## Phase 1 — source-verify, then HARD-STOP

Verify each item below using `git grep` / `git ls-files` paired reads. Do not rely on memory or assumptions — file paths and class names drift between sessions.

1. **Locate `.sidebar-collapse-btn` in tracked CSS.**  
   Run: `git grep -n 'sidebar-collapse-btn' -- '*.css' '*.jsx' '*.js' '*.tsx'`  
   Confirm: the rule exists in a tracked file (expected: `src/index.css`). Note the exact file path and every line number where the selector appears (there may be multiple blocks — media queries, hover states, etc.). If the selector is absent from tracked files entirely → **STOP and wait for dispatcher**.

2. **Read the current size declarations on `.sidebar-collapse-btn`.**  
   Open the file at the line numbers found in step 1. Quote the current `width`, `height`, `min-width`, `min-height`, `padding`, and any `@apply` tokens verbatim. Confirm the FU body's claim of "32×32" against the actual source — if the current size differs → note the actual values; do NOT assume the FU body is correct (Rule 17).

3. **Identify the sidebar header layout context.**  
   Run: `git grep -n 'sidebar-collapse-btn\|sidebar.*header\|sidebar.*toggle' -- '*.jsx' '*.js' '*.tsx'`  
   For each JSX hit, quote the surrounding ~5 lines to identify: (a) what element wraps the button, (b) whether the wrapper has a fixed height, (c) whether sibling elements share the same row. This is needed to assess whether a height bump will overflow the header.

4. **Check for Tailwind utility equivalents already in use.**  
   Run: `git grep -n 'sidebar-collapse' -- '*.jsx' '*.js' '*.tsx'`  
   Confirm whether `.sidebar-collapse-btn` is applied as a plain class in JSX or composed via `@apply` in CSS only. If the button is set inline via Tailwind utilities rather than this CSS class, the fix location changes.

5. **Verify the 44px minimum convention in `src/index.css`.**  
   Run: `git grep -n 'min-h-\[44px\]\|h-11\|44px\|min.*touch' -- 'src/index.css'`  
   Sample 2–3 existing 44px touch-target implementations to confirm the project's canonical pattern (e.g., `min-width: 44px; min-height: 44px;` vs `width: 44px; height: 44px;` vs Tailwind `h-11 w-11`). Quote the patterns verbatim — the fix should match the house style.

6. **Check for any existing smoke or walk script that asserts on the sidebar collapse button.**  
   Run: `git grep -rn 'sidebar-collapse\|collapse.*btn\|collapse.*toggle' -- 'scripts/'`  
   List every hit. If a smoke script exists that asserts on the button's rendered size or visibility, the build brief must include updating it. If none → note "no existing smoke asserts on this button".

7. **Verify no test file references `.sidebar-collapse-btn` sizing.**  
   Run: `git grep -rn 'sidebar-collapse' -- 'src/**/*.test.*' 'src/**/__tests__'`  
   If a unit test asserts on this class → note the file:line; the build brief must keep that test passing.

8. **Check that `src/index.css` is not in any auto-generated or vendor path.**  
   Run: `git ls-files src/index.css`  
   Expected: exactly one tracked file returned. If absent or multiple → **STOP and wait for dispatcher**.

---

**STOP and wait for dispatcher.**

---

## Phase 1 Recommendations (report, do not implement)

After completing steps 1–8, surface the following so the dispatcher can lock decisions before build:

1. **Actual current size** — quote the exact CSS declarations found. The FU body claims 32×32; confirm or correct.
2. **Fix location** — is the correct edit in `src/index.css` (the CSS class rule), in JSX Tailwind utilities on the button element, or both? Quote the relevant line(s).
3. **Safe height approach** — given the sidebar header layout context found in step 3, does bumping `height` or `min-height` risk overflowing the wrapper? Report whether `min-height: 44px` (overflow-safe) or `height: 44px` (exact replacement) is the safer choice.
4. **Target size recommendation** — the FU body hedges between 40px and 44px. Report which existing 44px patterns in the codebase are closest to this button's role, and flag if the sidebar header wrapper's height would constrain a 44px target.
5. **Smoke/test impact** — list any existing smoke or test files (from steps 6–7) that reference this button and would need updating.
6. **PR breakdown** — this is XS scope (one or two CSS lines). Confirm whether a single PR suffices or whether a smoke update would meaningfully expand it.
