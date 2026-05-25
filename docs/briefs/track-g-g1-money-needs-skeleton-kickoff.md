# Build Lock — Track G · G1: Money Needs Walking Skeleton

**FOUNDATION GATE — build to PR-OPEN, then STOP. Do NOT merge.** Dispatcher + Kyron review the data model and rules arm before merge.

**Branch:** `feat/track-g-g1-money-needs-skeleton` (git fetch origin before branching off main).

---

## Why
First slice of Track G — the Money Needs Worksheet: an agent's analysis of their *own* annual financial need, which drives their first-year-commission income target. G1 establishes the collection, the agent-only rules arm, and the panel shell. Money math (PAYE), expense entry, sub-calculators, privacy/sharing, commission targets, and validation come in G2–G7. Greenfield — nothing exists yet.

## Locked decisions (Kyron)
- Collection: per-user subcollection `/tenants/{tid}/users/{uid}/moneyNeeds/{year}`.
- **Visibility defaults to `'private'` (OFF). Sharing is opt-in, built in G5.** No manager reads in G1.
- G1 rules = **agent-only** (own create / get / update; `delete: if false`). All manager visibility, consent, audit, and sharing deferred to G5.
- The PRD §6 privacy table is corrected to off-by-default / opt-in as part of this PR's docs.

## Scope — declared file set (scope-check must match exactly)
- `src/services/moneyNeedsService.js` (new)
- `src/components/agent/MoneyNeedsPanel.jsx` (new)
- `src/components/dashboard/AgentDashboard.jsx` (NAV_ITEMS entry + mount)
- `firestore.rules` (moneyNeeds arm)
- `src/services/__tests__/moneyNeedsService.test.js` (new)
- `tests/rules/moneyNeeds.rules.test.mjs` (new)
- `docs/CONTEXT.md`, `docs/FOLLOW_UPS.md`, `docs/phase7-8-PRD.md`

## Build detail

### `moneyNeedsService.js` (follow the policiesService house style)
- `createMoneyNeeds(tenantId, uid, year)` — writes a blank doc at the path with the schema scaffolded: `year`, `productLines: []`, the 5 `expenseGroups` each `{ lineItems: [], subCalculatorRefs: [], groupAnnualTotal: 0 }`, the 3 `subCalculators` scaffolded empty, totals 0, **`visibility: 'private'`**, `shareWithSm: false`, `createdAt`/`createdBy`/`updatedAt`/`updatedBy`. Validate `year` is a sane integer. Idempotent guard: if the year doc already exists, return it / throw — never overwrite.
- `getMoneyNeeds(tenantId, uid, year)` — single-doc get by path → `{ id, ...data }` or `null`.
- No numeric line-item entry yet (parseFloat enforcement lands in G3). No PAYE (G2).

### `firestore.rules` — moneyNeeds arm (agent-only)
- On the user-subcollection path, allow `get`, `create`, `update` only where the path `uid == request.auth.uid` (signed-in + tenant match + own-uid, via the existing `canAccessOwn` helper). `allow delete: if false`.
- **No manager/admin read arm in G1.**
- On `create`, require `request.resource.data.visibility == 'private'` (default locked) plus ownership/tenant fields.

### `MoneyNeedsPanel.jsx` (shell only)
- Year header/selector, default current year.
- On mount: `getMoneyNeeds(currentYear)`; if `null`, show an empty state with a "Start [year] worksheet" action → `createMoneyNeeds` → reload.
- 5 collapsed accordion groups (Fixed Expenses / Living Expenses / Business Expenses / Savings & Accumulation / Miscellaneous) — labels + collapsed shells only, **no line-item entry yet**.
- Loading / error / empty states (house pattern). Nexus tokens (`text-ink`, etc.), 44px touch targets, explicit `import React`.

### `AgentDashboard.jsx`
- NAV_ITEMS: `{ id: 'money-needs', label: 'Money Needs', Icon: <a fitting lucide icon, e.g. Calculator>, tabId: 'money-needs', testId: 'agent-tab-money-needs' }`.
- Mount: `{activeTab === 'money-needs' && <MoneyNeedsPanel />}`.

### Tests
- `moneyNeedsService.test.js` — create writes the blank doc with `visibility:'private'` + the full scaffold; `getMoneyNeeds` returns the shaped doc / `null`; idempotent-guard behavior.
- `moneyNeeds.rules.test.mjs` (emulator, allow AND deny): ALLOW agent create/get/update own; DENY another agent get + create (uid mismatch); DENY any manager (UM/BM) get (no manager arm yet); DENY cross-tenant; DENY unauthenticated; DENY delete.

### Docs
- `CONTEXT.md` recently-shipped row with `#TBD`/`{TBD}` placeholders.
- `phase7-8-PRD.md` §6 privacy table: correct the Agent + UM rows to **off-by-default / opt-in to share** (was opt-out).
- `FOLLOW_UPS.md`: bank the G2–G7 slice plan — G2 PAYE engine (parity-tested against Kyron's Excel vectors), G3 expense-group entry, G4 sub-calculators, G5 privacy + opt-in share + audit + manager reads, G6 commission targets + Send-to-Playground, G7 soft-validation nudge + PAYE-refresh banner. Note **G5 lands PR-open for review** like G1.

## Verification
- Emulator rules suite green (allow + deny). Unit tests green. Lint + build clean.
- **Pre-merge preview smoke** is UI-only: the new moneyNeeds rules aren't deployed until merge (rules are global), so the create/read path can't be exercised on the preview yet. Smoke = log in as the test agent → open the Money Needs tab → the empty state renders, no error/crash. (The full write-read-verify is the post-deploy smoke below.)

## Gates & finish
- Build to PR-OPEN, run the emulator suite + the UI preview smoke, fill the PR checklist (smoke box reflects the UI-only smoke), **STOP. Do NOT merge.**
- Dispatcher + Kyron review the data model + the agent-only rules arm, then **Kyron merges**.
- Post-merge (a rules arm was added, so this needs a deploy): post-merge sequence (squash SHA, fill `#TBD`/`{TBD}` docs, push direct to main, Rule 15) → deploy `firestore.rules` → **post-deploy own-read smoke** (agent creates the year worksheet → reload → the 5-group shell renders → clean up the doc + re-enumerate empty) → if the post-deploy smoke fails, report.
- Single-doc get by path — no composite index needed for G1.
