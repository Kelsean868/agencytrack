# Track J — Legacy-Step Retirement (autonomous stacked queue)

**Type:** Refactor / cleanliness. Machine-verifiable (payload-identity + smoke).
**Merge:** Human-merge — Kyron runs the ordered merge-sequence on return. NOT auto-merge.
**Mode:** AUTONOMOUS — dispatcher away ~10h. Build the stack to open PRs; do not merge or deploy (Rule 19).

---

## Context

Wizard v2 is fully ported (#416 shell / #418 compute / #419 review). But the v2 wizard still **renders the legacy step components** for the single-file-move steps, and PR1's 3 Activity-split files **duplicate** Step1's markup. Retirement = give every v2 step its own v2 component, fix the Step4 `id="apps"` collision in the process, and delete the retired legacy files.

**This task explicitly supersedes the "Step1–9 NEVER modified" rule for the files being retired** — they are being replaced by v2 components and then deleted. That is the point of the retirement; it is the authorized end of that rule for these files.

---

## AUTONOMY PROTOCOL (read first)

- Proceed through Phase 1 **without a dispatcher checkpoint** — the dispatcher is away. The payload-identity regression + smoke are the safety net.
- Build the stack **R1 → R2 → R3**, each branch off the prior, each to an **open PR**, stopping at each (Rule 19 — no merge, no deploy).
- **Rule 20:** each PR's ready-report names the feature-branch HEAD SHA; no silent post-report pushes.
- **If ANY surprise-stop fires, HALT the entire remaining stack** (do not build R2/R3 on an unresolved R1) and write a clear "STOPPED AT [point] — [reason]" report for the dispatcher's return.
- Do as many of R1→R3 as the window allows; a partial clean stack is fine. Never rush a smoke to fit more in.

---

## Phase 1 — audit (proceed, no checkpoint)

1. Determine which of the 12 v2 steps currently render a **legacy** component vs already have a v2 component (from PR1's Activity split).
2. Full field inventory per legacy-rendered step — every persisted field, its on-change logic, its `lastWeek`/suggested derivations (e.g. New Names' `oldNamesPool` suggestion, Deliveries' `policiesOutstanding`, Step4's `suggestedCiConducted`). All must survive the extraction unchanged.
3. Confirm the `Step4ClosingSales` duplicate `id="apps"` (NB + PPP). The v2 extraction gives each input a unique id — this is where the MEDIUM duplicate-id FU gets fixed.
4. **Grep each legacy step file for imports OUTSIDE the wizard.** If any legacy step is consumed elsewhere, deleting it would break that consumer → **STOP and report** (deletion-unsafe; needs dispatcher).
5. Confirm PR1's 3 Activity-split files and their relationship to `Step1Prospecting` (now partially superseded).

**Surprise-stop:** a legacy step imported outside the wizard (step 4).

---

## Phase 2/3 — build (suggested 3-PR stack; adjust grouping to the Phase-1 findings)

For every extracted step: create a v2 component that renders the **same fields with the same on-change logic and the same `lastWeek`/suggested derivations**, then swap the wizard's mount to it. Reuse `CardStack`'s `CurrencyField`/`NumericField` (with the PR2 `lastWeek` hint prop where the legacy step had it). Do **not** alter persisted shape or the submit path.

- **PR-R1 (Sales phase):** Approaches (step 6), ClosingSales (step 7 — **fix the duplicate `id="apps"` with unique ids**), Delivery & Service (step 8). Swap mounts. Do NOT delete legacy yet.
- **PR-R2 (Reflection + Goals):** Hours/Time (step 9), Self-Evaluation (step 10), Goals (step 11). Swap mounts.
- **PR-R3 (Activity remainders + deletion):** any remaining legacy-rendered Activity steps (Calls/Telephone step 3, Social step 4, New Names step 5); reconcile PR1's split files; **then delete all now-unused legacy step files** and remove dead imports. This PR ends the duplication.

Nexus tokens, 44px targets, motion-reduce safe, no new hardcoded hex.

---

## Phase 3f — verification (per PR — this is the autonomy safety net, do not shortcut)

1. **Payload-identity regression:** the submission shape + values are IDENTICAL after each extraction — assert the `submitReport` key set + values match the pre-retirement baseline for fixed inputs. A dropped or renamed field fails here.
2. **Component tests** per extracted step: renders the same fields; on-change writes the same state keys; `lastWeek`/suggested derivations preserved.
3. For R1 specifically: assert **no duplicate ids** in the ClosingSales v2 component (the duplicate-id fix proof).
4. Lint + full vitest + build green.
5. **Wizard smoke (write-read-verify, both themes):** fill a full WAR through all 12 v2 steps → submit → reload → assert persisted shape unchanged. Use an unsubmitted week, cleanup to 0, re-delete the service-account-key (Rule 4). This is the end-to-end proof the wizard still works after the extractions.

**Surprise-stop (halt the whole remaining stack):** any payload-identity failure; any dropped/renamed field; any step whose logic can't be cleanly preserved.

---

## Phase 4 — docs per PR (with placeholders)

- `docs/CONTEXT.md`: recently-shipped row (`#TBD/{TBD}`); Next-track points to the next retirement PR (or, after R3, to the remaining agent redesigns). Check/clean double-Next-track-row.
- `docs/track-j-port-ledger.md`: Wizard row stays FULLY PORTED (retirement is cleanliness, not a new port); note the legacy removal in R3.
- `docs/FOLLOW_UPS.md`: mark retirement progress; resolve the **Step4 duplicate-id** FU when R1 lands; note PR1's duplication closed when R3 deletes the legacy files.

## Phase 5 — per PR

Open PR, STOP, Rule 20 ready-report (HEAD SHA). Move to the next stacked PR off the current branch. Halt the stack on any surprise-stop.

---

## Out of scope

Any change to persisted shape or submit path · the SUGGESTED atom / goal-seeding · social-channel inclusion in canonical aggregations · the remaining agent redesigns (Daily Capture, etc.) · anything requiring a dispatcher decision (halt and report instead).

---

## On return (dispatcher)

A stack of open PRs (R1→R2→R3, as far as the window reached). Merge in order: merge R1 → dispatch CC to Phase 6 + rebase R2 onto new main (reset --hard + cherry-pick, the squash-rebase pattern) → merge R2 → rebase R3 → merge R3. Each frontend-only, no deploy.
