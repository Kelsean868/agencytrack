# HOTFIX — Submissions `allow list` restores `canAccessOwn` — Build Lock / Dispatch

**Type:** Production rules hotfix (regression from SHAKEDOWN-002B `read`→`get`/`list` split; live ~10 days)
**Branch:** `fix/submission-list-agent-access`
**Severity:** HIGH — every agent's awards panel / history / ratio trends silently empty (agent self-list queries denied).
**Scope class:** `firestore.rules` + rules emulator test + docs only. No frontend, no CF, no `AgentDashboard`.
**Environment:** Windows PowerShell. One command per line — never `&&`. All blocks run from repo root `C:\Projects\AgencyTrack`.
**Blocks:** D3 #297 smoke (can't smoke an agent awards panel that's empty for every agent).

---

## Confirmed ground truth (Phase 1 already done)

- Repo `allow get` for submissions includes `canAccessOwn(tenantId, resource.data.agentId)`; `allow list` does **not**.
- Empirical: Admin SDK sees 5 submissions for the test agent; client SDK as `J0j4uBqzTPcfm1IlGCPyDzo27RP2` → `permission-denied`. Bug is live.
- `resource.data.agentId` **is** evaluable in `list` rules — a query constrained `where('agentId','==',uid)` satisfies the rule for every candidate doc; a broader/unconstrained agent query is denied because the other clauses are false for an agent caller. So restoring `canAccessOwn` to `list` is safe and does not loosen the boundary.

## Scope boundary (hard)

- Touch only `firestore.rules`, the rules emulator test file, `docs/CONTEXT.md`, `docs/FOLLOW_UPS.md`.
- Do **not** change the `allow get` / `create` / `update` / `delete` rules.
- Do **not** touch the UM unit-scope clause — preserve it exactly.
- Do **not** fix the `AgentDashboard` `.catch(() => [])` swallow here (logged as a follow-up).

---

## Phase 0 — Branch

```powershell
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b fix/submission-list-agent-access
```

## Phase 2 — The fix (one clause + a comment)

In `firestore.rules`, the submissions `allow list` rule. **Find:**

```
        allow list: if kioskCanRead(tenantId)
          || (canManage(tenantId) && (
               getRole() != 'unit_manager'
               || resource.data.unitId == request.auth.uid
             ));
```

**Replace with** (adds `canAccessOwn` as the second clause, mirroring `allow get`, plus a comment to prevent re-regression):

```
        // list: canAccessOwn restored after the SHAKEDOWN-002B read->get/list split
        //       dropped it. resource.data.agentId IS evaluable in list evaluation, so
        //       an agent self-list query — which MUST be constrained
        //       where('agentId','==',uid) — is allowed; any broader/unconstrained agent
        //       query is denied because the other clauses are false for an agent caller.
        //       UM unit-scope clause below is unchanged.
        allow list: if kioskCanRead(tenantId)
          || canAccessOwn(tenantId, resource.data.agentId)
          || (canManage(tenantId) && (
               getRole() != 'unit_manager'
               || resource.data.unitId == request.auth.uid
             ));
```

## Phase 3 — Emulator rules tests (the correctness gate), lint, build

Find the existing Firestore rules emulator test suite and add cases for the submissions `list` rule. These four are required; the first two are the fix, the second two guard the #147 UM constraint from regressing:

1. **Agent self-list ALLOW** — signed in as an agent, list `where('agentId','==',ownUid)` → allowed.
2. **Agent cross-list DENY** — same agent, list unconstrained AND list `where('agentId','==',otherUid)` → denied.
3. **UM own-unit ALLOW** — unit_manager, list `where('unitId','==',umUid)` → allowed.
4. **UM cross/unconstrained DENY** — unit_manager, list unconstrained AND other-unit → denied.

Run the rules emulator tests (JDK 21), then the full suite, lint, build (confirm script names against `package.json`):

```powershell
npm run test
npm run lint
npm run build
```

All green before proceeding.

## Phase 4 — Docs (placeholders, filled post-merge)

- **`docs/CONTEXT.md`**: top table (Last updated, main HEAD `#TBD`, Active track), recently-shipped row: `HOTFIX — submissions allow list restores canAccessOwn (agent self-list regression from SHAKEDOWN-002B) — #TBD`. Update "Where we left off".
- **`docs/FOLLOW_UPS.md`**:
  - Add **MEDIUM** — *Silent query-error swallowing*: `AgentDashboard`'s `getAgentSubmissions().catch(() => [])` masked this rules regression for ~10 days. Surface/log permission errors (toast or error state) instead of returning `[]`, so the next rules regression is loud.
  - Add **LOW (methodology)** — bank a CLAUDE.md rule: self-service **list** queries must be smoke-tested as the owning user (write → list *as that user* → assert non-empty). This is the 2nd list-rule regression to slip past `get`-only coverage (cf. the E3 lesson).

## Phase 5 — Commit, push, verify, PR (STOP after)

```powershell
git add -A
git status
git commit -m "fix(rules): restore canAccessOwn on submissions allow list (agent self-list regression)"
git push -u origin fix/submission-list-agent-access
```

Rule 15 verify (paste all SHAs full; HEAD must equal origin/branch):

```powershell
git fetch origin
git log origin/fix/submission-list-agent-access --oneline -1
git rev-parse HEAD
git rev-parse origin/fix/submission-list-agent-access
```

Open the PR. Per Rule 18, fill the template checklist from the repo's `.github/pull_request_template.md`, checking only what's true; the "production verified" item stays unchecked (it's a post-merge rules deploy). Write the body to a temp file, create, then remove it:

```powershell
gh pr create --title "fix(rules): restore canAccessOwn on submissions allow list" --body-file pr-body-rules.md
Remove-Item pr-body-rules.md
```

Representative body (adapt to the template; this is a rules PR so the "smoke" line is the emulator test + a post-merge production check):

```markdown
## Hotfix — submissions allow list restores canAccessOwn

SHAKEDOWN-002B's read->get/list split dropped `canAccessOwn` from `allow list`, silently denying
every agent's own submission list query for ~10 days (awards/history/ratios empty). `resource.data.agentId`
is evaluable in list rules, so the original removal was based on a misconception. Restores the clause,
mirroring `allow get`; UM unit-scope unchanged.

### Checklist
- [x] Emulator rules tests: agent self-list ALLOW, cross-list DENY, UM unit-scope ALLOW/DENY preserved
- [x] Lint clean
- [x] Build clean
- [x] Docs updated (CONTEXT.md + FOLLOW_UPS.md)
- [x] Scope: firestore.rules + rules test + docs only
- [ ] Production verified (pending post-merge rules deploy + empirical agent-list check)
```

Report PR number, Rule 15 SHAs, and `gh pr diff <n> --name-only`. Then: **STOP and wait for dispatcher.**

---

## Phase 6 — POST-MERGE (only after dispatcher confirms the merge)

Rules are project-global — they are NOT live on any preview until deployed, so this step is mandatory and easy to miss (Vercel auto-deploys the frontend, NOT Firestore rules).

```powershell
git fetch origin
git checkout main
git pull --ff-only origin main
firebase deploy --only firestore:rules
```

Then **empirically verify the deploy took effect** — re-run the client-SDK agent list query (signed in as `J0j4uBqzTPcfm1IlGCPyDzo27RP2`, `where('agentId','==',uid)`); it must now return the 5 docs instead of `permission-denied`. Paste the result.

Then run the post-merge docs fill (`#TBD` → squash SHA, Rule 15). Once the empirical check passes, D3 #297 is unblocked — re-run its seeded smoke and merge it.

**Hard stops:** end every phase boundary with "STOP and wait for dispatcher." Never merge, never deploy rules, without explicit dispatcher confirmation.
