# Brief — Daily Capture v2 · Phase 2: Option B daily-entry UI

**Track:** Daily Capture v2 · **Phase:** 2 of N (stacks on 1b). **Size:** L/XL (UI).
**Merge:** HUMAN-MERGE — deploys to live agents on merge. Do NOT auto-merge.
**Stacks on:** `feat/daily-capture-v2-1b-aggregator`.
**Design source:** `Daily Entry — Option B Build.html` (UI) + `Daily → Weekly Aggregator — Field Map.html` (data). Build to Nexus tokens.

## Goal
Build the Option B daily-entry screen wired to the extended daily schema, with a **raw-points** pill (no pace yet — Phase 3).

## Scope
- Grouped daily card: Prospecting & outreach (incl. the collapsible social breakdown), Appointments & FFI, Interviews (collapsible), Production (apps · lives · `nbApi` money field · optional PPP/lumpsum advanced row), Delivery & service (collapsible), Hours (office/field steppers + Half/Full/Long quick-chips), optional note.
- Steppers per the 1a field set; defaults-to-zero; collapsibles default collapsed.
- **Week strip** with logged / today / missing / upcoming / off / selected states. **Default denominator M–F** (the working-days toggle is wired but static until Phase 3).
- **Back-fill:** tap any day in the strip → fill/edit that date → re-syncs the open **draft** week (read-only once `submitted`).
- **Points pill in the Save card** — `computePoints` on the day's totals; +N pulse per tap. **Raw points only, no pace/ahead-behind** (Phase 3).
- Streak flame; mode pill.
- **Sunday confirm view** — activity/sales/production/servicing/hours all green "from daily"; only ratings + next-week targets left; Submit shows weekly points total.

## Social card reconciliation (the one place CD's mock diverges)
CD breaks social down by **type** (posts/content/engagements). The live weekly is **4 headline fields + breakdown by PLATFORM** (facebook/instagram/whatsapp/linkedin). **Build the live shape**, not CD's guess.

## NON-scope: pace / weeklyPointsFloor / working-days persistence (Phase 3); reopen-after-submit.

## Phase 0 — confirm the 1b weekly fields + 1a daily fields exist as expected; confirm Nexus token names (frontend-design skill).
## Phase 1 — build to the extended schema's read/write service. Phase 2 — lint/build/tests + component tests (loading/error/empty states per house rule).
## Phase 3 — smoke (REAL write-read-verify, BOTH themes): log in → enter a day across all groups → save → reload → assert persisted + pill renders; tap a prior strip day → edit → assert re-sync; **axe gate = no NEW serious/critical vs main baseline** (delta).
## Phase 4 docs · Phase 5 branch `feat/daily-capture-v2-2-ui` off 1b HEAD; PR; Rule 20 SHA; HOLD · Phase 6 Gemini.

## Self-critique (Rule 22)
Stacking a large UI PR three-deep on unmerged 1a/1b carries drift risk if 1a/1b field names shifted in their Phase-0; the Phase-0 confirm above is the guard.
