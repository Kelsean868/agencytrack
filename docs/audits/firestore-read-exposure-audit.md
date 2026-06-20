# Firestore read-exposure audit — null-resource deny class (the #701 shape)

**Date:** 2026-06-20 · **Scope:** `firestore.rules` `allow get`/`allow read` arms × `src/` client reads · **Baseline:** `main` @ `a32cb9f` (rules @ `caae5bf`/#701).
**Trigger:** PR #701 was a latent rules-deny on a non-existent doc, invisible to mocked tests (the wizard `getDraft` + `aggregateCurrentWeekDaily` pre-write `getDoc` denied on a fresh week). This audit finds the rest of that class.

## Headline verdict

**No new live #701-class bug.** Every client single-doc `getDoc` on a possibly-non-existent doc lands on a rule that is **either already null-guarded or does not dereference `resource.data`**. The one material gap is **coverage, not behavior**: `managerWeeklyReports` has the correct null-resource guard but **zero rules-test coverage** despite a read-before-write hot path identical in shape to #701 — a future refactor could silently reintroduce the bug. → Item 2: one test-only GREEN PR.

## The class (why it bites)

A `get` on a **non-existent** document evaluates the rule with `resource == null`. Any arm that reads `resource.data.X` then **errors → denies** (returns `permission-denied`, not `not-found`). This is invisible to `getDoc`-mocked unit tests and only surfaces against real Firestore. `list` queries are **immune** — `resource` is never null in list evaluation (only existing docs are candidates). So the risk = (rule derefs `resource.data` in a get/read arm) **AND** (a client does a single-doc `getDoc` on a doc that may not exist — typically read-before-write with no `try/catch`).

## Method

1. Enumerated every `allow get`/`allow read`/`allow list` arm in `firestore.rules` (1438 lines).
2. Flagged arms that dereference `resource.data` (vs `request.resource.data`) — `grep -nE '[^.]resource\.data'`.
3. Bucketed by get/read (null-resource-exposed) vs list (immune).
4. Cross-referenced **every** `await getDoc(` in `src/` (49 call sites) to its collection + rule, isolating single-doc reads on possibly-non-existent docs.

---

## Ranked exposure table

| # | Collection | Rule (get/read) | Client read | Class | Sev | Action |
|---|---|---|---|---|---|---|
| 1 | submissions | `firestore.rules:285` | `submissionService.js:152` (getDraft) · `loggingModeService.js:82,123` | read-before-write | — | **RESOLVED #701** (null-arm `:286`); tested 31/31 |
| 2 | persistency | `firestore.rules:542` | `persistencyService.js:241` (savePersistency RBW) · `:89,:103` | read-before-write | — | **GUARDED** (`:546 \|\| resource == null`); tested (8 null cases) |
| 3 | **managerWeeklyReports** | `firestore.rules:1072` | `managerWarService.js:62,:81` (RBW) · `:96,:102` | read-before-write | **MED** | **GUARDED** (`:1074` ternary) but **NO test file** → add deny-matrix + null-resource test (Item 2, **GREEN**) |
| 4 | managerMonthlyRollups | `firestore.rules:1140` | `managerMonthlyRollupService.js:67,:84,:100` | read-before-write | LOW | GUARDED (`:1141` ternary); tested (3 null cases) |
| 5 | weeklyPlans | `firestore.rules:1301` | `weeklyPlanService.js:41` | read-before-write | LOW | GUARDED (`:1302` ternary); tested (4 null cases) |
| 6 | leaderboard (singular) | `firestore.rules:593` | `submissionService.js:192` · `useLeaderboard.js:57` | single-doc get | LOW | SAFE — tenant-scope, **no `resource.data` deref** |
| 7 | policies | `firestore.rules:321` | `policiesService.js:84,:316,:334` (**getDocs list**) | missing-null-arm, **not exercised** | LOW | List-read only → null-resource never hit. Optional defensive test |
| 8 | policies/history | `firestore.rules:447` | `policiesService.js:312` (**getDocs list**) | missing-null-arm, not exercised | LOW | List-read only. Optional defensive test |
| 9 | settlements | `firestore.rules:616` | `settlementService.js:17,:37` (**getDocs list**) | missing-null-arm, not exercised | LOW | List-read only. `settlements.rules.test.mjs` exists (0 null cases) |
| 10 | notifications | `firestore.rules:582` | `notificationService.js:31` (**getDocs list**) | missing-null-arm, not exercised | LOW | List-read only |
| 11 | coachingNotes | `firestore.rules:784` | `coachingNotesService.js:92` (**getDocs list**) | missing-null-arm, not exercised | LOW | List-read only |
| 12 | prospectInfo | `firestore.rules:841` | `prospectInfoService.js:209` (**getDocs list**) | missing-null-arm, not exercised | LOW | List-read only |
| 13 | jointCalls | `firestore.rules:929` | `jointCallsService.js:159` (**getDocs list**) | missing-null-arm, not exercised | LOW | List-read only |
| 14 | users | `firestore.rules:143` | own: `AuthContext.jsx:56,:145` (path-var SAFE) · subject: `jointCallsService.js:49` | owner-arm path-var | LOW | Owner arm `request.auth.uid == userId` is path-var → own non-existent **SAFE**; manager arm derefs `resource.data.unitId` but only on a non-existent *other* user (not exercised — you don't act on non-existent agents) |
| 15 | moneyNeeds (mgr arms) | `firestore.rules:1320,:1326,:1332` | `moneyNeedsService.js:300,:313` (own) | owner-arm path-var | LOW | Owner arm `request.auth.uid == uid` path-var → SAFE; manager arms deref `resource.data.visibility` but managers don't read non-existent |
| 16 | audit logs ×3 | `firestore.rules:85,:98,:109` | admin list reads only | missing-null-arm, not exercised | LOW | Admin-only list reads; no single-doc getDoc |

**Severity key:** HIGH = live-bearing hot path actively denied (none). MED = correct-but-untested on a live hot path. LOW = rule derefs but no client `getDoc`-on-non-existent exercises it (would only bite if a future client adds one).

---

## Already-safe inventory (the guards that exist)

Confirming the codebase already applies the correct pattern broadly — this is *why* the headline is clean:

- **Null-resource guards present & exercised:** submissions (`:286`, #701), persistency (`:546`), managerWeeklyReports (`:1074` ternary), managerMonthlyRollups (`:1141` ternary), weeklyPlans (`:1302` ternary).
- **Path-var / token-claim owner arms (no `resource.data` deref → non-existent safe):** users-owner (`:144`), goals (`:565` `goalId == uid`), dailyActivity (`:250` `uid == userId`), moneyNeeds/yearPlan/monthlyPlan owner (`:1317/:1349/:1360`), nudges (`:1404` `nudgeId.split`), config (`:598`), leaderboard (`:593`), weeklyChampions (`:752`), branches (`:700`), agentOfMonth (`:715`), managerActivityStandardOverrides (`:1196` `managerId` path-var + cross-doc `get()`).
- **Goal-hierarchy reads (the scariest hot-path candidate) are SAFE:** `unitGoals` (`:627`), `branchGoals` (`:645`), `salesManagerGoals` (`:657`), `campaigns` (`:670`) all gate on `request.auth.token.tenantId == tenantId` with **no `resource.data` deref** — so `getGoalHierarchy`'s `getDoc` on a non-existent tier returns cleanly. (#699 was a *users-list* permission issue, not this class.)

---

## Item 2 feed

- **GREEN (test-only, rule confirmed correct):** add `tests/rules/managerWeeklyReports.rules.test.mjs` — deny-matrix (owner-allow · non-owner-deny · unsigned-deny · cross-tenant-deny) **plus** the null-resource case: `owner + non-existent (warId prefix == uid) → ALLOW`, `non-owner + non-existent → DENY` (existence-oracle guard), mirroring `submissions.rules.test.mjs` cases 27–31. This locks the `:1074` ternary so a future drop is caught (the exact #701 regression vector).
- **LOW / optional defensive (no live risk):** `policies` and `settlements` lack a null-resource case, but their client reads are list-only; a defensive `owner + non-existent → DENY` test would document the current (deny) behavior. Not required unless a single-doc `getDoc` is later added to those services.
- **No rule fixes recommended.** No legitimate read is currently denied.

## Falsification (Rule 23)

This audit's "no live bug" conclusion is overturned if **any** of these is found:
1. A client `getDoc` (single-doc) on a deref-rule collection (rows 7–13) reading a doc that may not exist — e.g. a future "open policy by id where it may be absent" path. (Current `grep` of all 49 `getDoc` sites shows none.)
2. A `resource.data`-deref arm reachable on a non-existent doc whose owner arm is NOT a path-var (rows 14–15 are safe only because the owner arm is path-var).
3. `managerWarService` losing the `warId.split('_')[0]` correspondence to the doc id (would invalidate the `:1074` guard's owner check).

Re-run trigger: any new `await getDoc(` added to `src/services/` on a collection in rows 7–16.
