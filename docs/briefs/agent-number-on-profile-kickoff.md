# Kickoff brief - show `agentNumber` on the agent's own profile

**Drafted:** 26 August 2026 - **Merge channel:** HUMAN-MERGE (identity field on a user-facing surface)
**Model:** Sonnet 5 - **Effort:** medium
**repomix:** scoped pack of `src/components/profile/` is fine - this brief does NOT touch `functions/`.
**Deploy gate:** none. Client-only, ships with the Vercel build on merge.

---

## Why this exists

An agent's Tatil agent number is captured, stored on their own user doc, used to match
policies to them, and printed on their PDF report - but they cannot see it anywhere in the
app. The operator asked for it on the profile so the agent can read their own number
without generating a report.

## Phase 0 - audit findings (completed 26 Aug 2026, quoted from current source)

| # | Finding |
|---|---|
| **F1** | `agentNumber` is a real field on `tenants/{tid}/users/{uid}`. Captured at creation (`UserManagementPanel.jsx:107,164,286`) and a **required column** in the bulk CSV import (`BulkImportUsersModal.jsx:380`). |
| **F2** | It is **already agent-visible in one place** - the report PDF renders `Agent #{agentNumber}` (`AgentReportDocument.jsx:386`, `agentReportPdfModel.js:259`). This slice is not new exposure; it is the same fact on a better surface. |
| **F3** | Manager editing is role-gated and already tested: a unit manager editing an agent **hides** `agentNumber`; a branch manager **shows** it (`EditUserDrawer.test.jsx:113,132`). Rules agree - the `canManage` arm allowlists `agentNumber` (`firestore.rules:190`). |
| **F4** | **The agent can already set it themselves, write-once.** `firestore.rules:222-230` lets the owner write `agentNumber` **only when the stored value is null**, and only as a non-empty string. `saveOnboardingIdentity()` in `userService.js:141-147` is that path. After it is set the owner cannot change it; a manager corrects it via the `canManage` arm. |
| **F5** | `ProfileScreen.jsx` has **zero** references to `agentNumber` - confirmed by grep across the file and its two test files. |
| **F6** | The data is already in hand. `ProfileScreen.jsx:18` destructures `userProfile` from `useAuth()`, which is the whole user doc. **No new fetch, no new query, no index, no rules change.** |

## Decisions locked

1. **Display only. `ProfileScreen` gets no write path for `agentNumber`.** The write already exists in
   onboarding (F4) and in the manager drawer (F3). A third write path on a write-once field is how
   two surfaces start disagreeing about who owns a value.
2. **Render read-only, in the identity block beside email and join date** - the same visual treatment
   as other non-editable facts on that screen. Not a disabled input; a value.
3. **When `agentNumber` is null, show the field with an em dash and a one-line hint** naming the
   manager as the person who sets it. Do NOT hide the row. A missing number is a real state an agent
   should be able to see and act on, and hiding it makes "I have no number" indistinguishable from
   "this app does not show numbers".
4. **No rules change, no service change, no schema change.** If the implementation finds itself
   editing `firestore.rules` or `userService.js`, the scope is wrong - STOP and wait for dispatcher.
5. **No new label vocabulary.** Reuse whatever the PDF calls it so the two surfaces match; the PDF
   currently renders `Agent #<n>`.

## File inventory (scope-lock)

```
src/components/profile/ProfileScreen.jsx                              the render
src/components/profile/__tests__/ProfileScreen.menuLayout.test.jsx    coverage
docs/CONTEXT.md                                                       Phase 4 only
docs/FOLLOW_UPS.md                                                    Phase 4 only, append per Rule 7(b)
```

Anything outside this list is a Rule 9 surface.

## Phases

1. **Discovery gate.** Re-read `ProfileScreen.jsx` against F5/F6 and confirm `userProfile` still
   carries the field and that nothing already renders it. STOP and wait for dispatcher if a write
   path for `agentNumber` already exists on this screen - that would mean F4's ownership picture
   has moved.
2. **Render.** Locked decisions 2 and 3.
3. **Tests.** Set / not-set / role-independent (an agent, a unit manager and a branch manager all
   see their own number on their own profile - this screen is self-only and has no role gate).
4. **Docs.** CONTEXT.md row; FOLLOW_UPS only if something is deferred.

## Named deliverables

- **Three tests** in the existing profile test file: renders the number when set; renders the em dash
  plus hint when null; does not render an editable control in either case (the guard for decision 1).
- **Smoke walk** on the Vercel preview, **both themes**: sign in, open Profile, read the number.
  Read-only click-through - never a mutating smoke on a feature-branch preview.
- **Post-merge fill:** CONTEXT.md `Recently shipped` row carrying the **squash** SHA from
  `git log origin/main --oneline -1`.

## What this deliberately does not do

It does not backfill missing numbers, does not make the number unique or validated, and does not
touch the bulk import. Those belong with the linked-call-sources work, where the number becomes
load-bearing rather than informational.