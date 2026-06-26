# Kickoff Brief — PR-U0 (REV 2) · Smoke Registry (`SMOKES.md`)

**Authored:** 2026-06-25 · dispatcher · **supersedes REV 1** (the seed-tenant/harness brief — fully overtaken; see §0).
**Baseline:** origin/main `3545429` — Phase 0 re-verifies the exact HEAD.
**run_model:** `claude-sonnet-4-6` (enumeration + docs; no judgment-dense code).
**Mode:** Autonomous, ONE PR, build to PR-open, then **HOLD**. No merge, no deploy.
**Merge class:** **Docs-only.** No source/rules/CF/test changes → this is a candidate for the docs fast-path, but author it as a normal PR so the registry table gets one bot-review pass for accuracy. *(If you'd rather, it's eligible for `/land-and-dispatch`-style direct landing — dispatcher's call at merge.)*

---

## 0. Why REV 2 (the pivot)

REV 1 was a verification harness: seed the smoke tenant so the flag-ON drive-through was exercisable. That intent is **fully overtaken** — real prod data now exists and the flag-ON allocator→yearPlan write cycle has been proven four times (U1 smoke, post-deploy rules smoke, two migration runs). Recon (2026-06-25) further found there is **no smoke registry**: smokes are 100% manual/per-PR, there is no CI smoke job and no "standing smokes" index — the knowledge of "which smoke guards which surface" lives only in scattered brief prose. That missing registry is the real durable gap. REV 2 closes it.

---

## 1. Locked decisions

1. Deliverable is a **reference doc**, `scripts/verification/SMOKES.md` — a surface→smoke map. **Not** a process rule (no CLAUDE.md mandate that briefs must consult it). Prove utility first; teeth can come later as a separate decision.
2. Seed it from the **actual** contents of `scripts/verification/` — enumerated in Phase 0, never from memory.
3. Add a **one-line pointer** in CLAUDE.md so the registry is discoverable. Pointer only — not a rule.
4. No CI wiring, no scheduled job, no new smoke code. Smokes stay manual/per-PR; the registry documents them, it does not automate them.

---

## 2. Phase 0 — source-verify (Rule 17; STOP on mismatch)

1. Confirm HEAD `3545429`; clean tree. *(Note: a pre-existing dirty working tree of U1/U2-area files has been observed in prior sessions — if present, it is NOT this PR's; do not stage it. `git status` and confirm only untracked/unrelated.)*
2. **Enumerate `scripts/verification/`** — list every `smoke-*.mjs` (exclude `lib/` helpers and one-off sweeps like `regression-smoke-sweep.mjs`, which is not a standing smoke). For each, read its header to extract: the surface it covers, its **run mode** (local flag-ON vs preview-capable), required env/flags, and any "skipped on preview" caveats.
3. Confirm there is no existing `SMOKES.md` / smoke index (recon says none — re-confirm so this isn't a duplicate).
4. Find the right CLAUDE.md home for a one-line pointer (the smoke-standards / banked-patterns section that already describes how smokes run).

## 3. Build

1. **Create `scripts/verification/SMOKES.md`** — a table, one row per standing smoke:
   | Surface | Smoke file | Run mode | Re-run when touching |
   - **Surface** — the feature area (e.g. "Game Plan loop · allocator → yearPlan write cycle").
   - **Smoke file** — path under `scripts/verification/`.
   - **Run mode** — `local flag-ON` (names the flag, e.g. `VITE_MONEY_NEEDS_MERGED_ENABLED=true`) / `preview-capable` / `split` (note which assertions are local-only vs preview).
   - **Re-run when touching** — the trigger surfaces/files (e.g. "MoneyNeedsAllocator, yearPlanService, GamePlanV2, firestore.rules yearPlan block").
   - Seed every row from Phase-0 findings. `smoke-yearplan-unified.mjs` is the anchor row: split-mode (local flag-ON = full write cycle; preview = rail-collapse only), triggers = allocator / yearPlan / Game Plan loop / yearPlan rules.
   - Header note: this registry is descriptive, not enforced; smokes are manual/per-PR (no CI smoke job); local flag-ON smokes can't run against the flag-OFF Vercel preview.
2. **CLAUDE.md pointer** — one line in the smoke-standards section: *"Standing per-surface regression smokes are catalogued in `scripts/verification/SMOKES.md` (descriptive, not CI-enforced)."*

## 4. Phases 4–6 — docs / PR / hold

- **Phase 4:** `FOLLOW_UPS.md` — record that `delete-stranded-allocation.cjs` is now a dormant no-op (B=0 reached via the post-deploy smoke side-effect; keep as a safety net or retire — dispatcher's call). Resolve the U0 follow-up. *(Note: `yearPlanAllocation.js` orphan remains a separately-banked FU from U2 — do not action here.)*
- **Phase 5:** branch off `3545429`; **Rule 15** verbatim paste-back; **Rule 20** name HEAD SHA. **Smoke waiver:** docs-only, no runtime surface touched → Rule 9 waiver, justified inline. **Rule 21** poll Gemini + CodeRabbit (both channels per CLAUDE.md Rule 21).
- **Phase 6:** **Rule 22** ≥1 named gap. Then **STOP and wait for dispatcher**.

---

## 5. Known risks / notes

- A descriptive registry can **drift** — a new smoke added later won't auto-appear. That's the accepted tradeoff of "reference doc, not rule"; if drift becomes real, the teeth-version (a brief-template requirement to update SMOKES.md) is the follow-on decision, not this PR.
- Keep the table **small and honest** — only genuine standing per-surface smokes. Do not sweep in every one-off `smoke-*.mjs`; if a smoke's standing status is ambiguous, list it with a "one-off?" note rather than guessing.
