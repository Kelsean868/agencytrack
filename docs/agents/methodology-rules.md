# Methodology Rules 1–25 — full canonical text

Moved out of CLAUDE.md (original lines 406–697) on the router split. CLAUDE.md retains
a numbered index carrying each rule's **number, name and binding instruction**, so every
in-file `Rule N` citation still resolves. This file is the authority for the rationale,
the incidents, and the PR numbers and SHAs each rule was banked from.

Read this file whenever you are authoring a brief, disputing a rule's scope, or need to
know *why* a gate exists before proposing to change it.

## Methodology requirements (added 2026-05-14, from pilot prep session)

These rules emerged from productive sessions and post-incident learnings (originally 8 from pilot prep 2026-05-14; rule 9 added 2026-05-15 from FU#4 → border-border arc; rules 10–13 added 2026-05-15 from CLAUDE.md methodology batch — firestore-indexes + brief-discipline arc; rule 14 added 2026-05-16 from env-credentials propagation audit closure; rule 15 added 2026-05-17 from PR #176 silent-push recovery arc; rule 16 added 2026-05-17 from FU-H methodology PR (#188) — post-merge fill scope canonization; rule 17 added 2026-05-18 from FU-J methodology PR (#192) — source verification at authoring time). Apply on every CC brief and dispatch.

### 1. Surface before architectural decisions

CC must surface (per Rule 12's STOP and wait for dispatcher semantics) for Kyron's acknowledgement BEFORE making any decision not pre-listed in a brief's "Decisions locked" section. Specifically:

- Scope expansion (touching files outside the brief's file inventory)
- New architectural patterns (cache, helper, state mechanism, localStorage usage, etc.)
- Test file rewrite from scratch (vs. targeted edits that preserve existing coverage)
- Inline fix of unexpected behavior (vs. STOP and wait for dispatcher)
- Any "how to solve" decision not explicitly pre-decided

"Solve rather than surface" is itself a strike condition even when the resulting fix is correct. The methodology requirement statement should appear at the top of every brief that involves implementation work. SHAKEDOWN-001 (#141), SEC-9b (#139), and the original shakedown (#140) all had at least one unsurfaced methodology decision; #142, #144, and subsequent re-runs were clean once the requirement was banked into briefs.

### 2. Phase 1 audits enumerate ALL data paths

For permission-boundary fixes, Phase 1 must enumerate every function that returns data joinable to the entity being scoped — not just the ones mentioned in the bug report.

SHAKEDOWN-002's first fix (#142) scoped two user-list queries (`getTenantUsers`, `getAllUsers`) but missed two submission paths (`getWeeklySubmissions`, `getAllYTDSubmissions`). SHAKEDOWN-002B (#144) closed those. A complete Phase 1 audit before #142 would have caught all four.

Pattern: when a bug report says "X data leaks to Y," Phase 1 enumerates every read path that could leak any data joinable to X, not just the specific one cited. Document the enumeration in the Phase 1 surface output — list every exported function in the relevant service(s) and classify each (already scoped / not joinable / unscoped gap).

### 3. Autonomous-mode strike calibration

For autonomous CC runs (shakedown-style multi-hour execution where Kyron is away):

- **Bugs found are NOT strikes.** The shakedown finding defects is the test working as designed.
- **Infrastructure failures ARE strikes** — seed failures, wipe failures, cleanup orphans, script crashes, mid-run script bugs.
- **Data safety issues are STOP IMMEDIATELY** — single stop, not 2-strike. If any operation could touch real production data or cross tenant boundaries, halt and surface, regardless of strike count.
- **Cleanup is non-negotiable.** Even if a shakedown finds 50 bugs mid-flight, Phase 6 cleanup must execute. Wrap orchestration in `try/finally` with cleanup in `finally`. The original shakedown (#140) initially missed this and orphaned 10 test users for ~13 seconds before emergency recovery.

STOP IMMEDIATELY is the data-safety variant of Rule 12's halt-condition vocabulary.

### 4. env-listing commands filter for KEY= pattern

Any PowerShell or bash command that lists `.env.local` (or any env file) contents must filter for `^[A-Z0-9_]+=` patterns to prevent echoing non-KEY=VALUE lines as raw values.

The pilot prep session caught a SendGrid SMTP credential leak this way — CC's command split on `=` and printed the value of a bare URI line. Credential was rotated; this rule prevents recurrence.

Correct pattern in PowerShell:

`Get-Content .env.local | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object { ($_ -split '=')[0] }`

Returns only the key names. Values never reach the chat. Apply the same `^[A-Z0-9_]+=` filter in bash, grep, or any equivalent command.

Character class must include digits (`[A-Z0-9_]+`, not `[A-Z_]+`) — keys like `A11Y_AGENT_PASSWORD`, `A11Y_BRANCH_MANAGER_PASSWORD` etc. begin with digit-containing prefixes and the digit-less pattern silently misses them. PR #156 smoke walk surfaced this gap when env-listing reported `A11Y_*` keys as absent; values were then pasted inline to unblock, requiring post-PR credential rotation. Both the credentials and the regex pattern are now fixed; this rule update prevents recurrence.

### 5. Phase 3 verification must include actual invocation, not just module resolution

For briefs that include scripts touching external services (Firestore, APIs, cloud resources, file systems), Phase 3 verification must include an actual invocation in non-destructive mode (dry-run, list, count, etc.), not just module loading or import resolution checks.

PR #147's `denormalize-submission-unitId.mjs` passed Phase 3 with "module resolution path is right" but had a missing `credential.cert(...)` initialization block that only surfaced when Kyron ran the script. A real dry-run invocation in Phase 3 would have caught the credentials gap before it reached production verification.

Pattern: for any new script that connects to external services, Phase 3 must include a real invocation that exercises the connection layer (auth, transport, basic round-trip). "Compiles" or "loads" is insufficient. The dry-run pattern (read-only, non-destructive default with explicit `--execute` flag) makes this safe to run against production from Phase 3.

### 6. Phase 1 validates data quality, not just data structure

For permission-boundary fixes, denormalization work, or any change that depends on existing data having specific values populated, Phase 1 must verify both:
- **Structural integrity:** does the source field exist on the doc?
- **Assignment completeness:** does the field have a non-null, non-empty value?

PR #147's Phase 1 hard stops covered "agent doc missing" (structural) but not "agent doc exists with `unitId` field missing or null" (assignment). Result: all 22 backfilled submissions wrote `unitId = null`, only surfaced when Kyron reviewed the dry-run output. The new rules would have silently broken UM visibility in production if the dry-run hadn't been carefully read.

Pattern: for any denormalization or value-dependent fix, Phase 1 must sample-read a representative subset of source docs and verify the relevant field values are populated as the change assumes. Surface sparse fields, unexpected nulls, or assignment gaps as Phase 1 findings before designing the fix, not after running it.

### 7. Active follow-ups table = active items only

When a row's status transitions to CLOSED (resolving PR merged), remove the row from Active follow-ups in the same Phase 4 docs commit as the resolving PR. Audit trail is preserved in git log + the Recently-shipped table + `docs/FOLLOW_UPS.md` closed sections. Closed rows lingering in Active follow-ups is documentation debt, not audit trail. Banked from PR #153 Phase 4 (Mobile FU#2 row left as CLOSED in Active follow-ups, cleaned up post-hoc at `ba2f4e5`).

### 8. Phase 4 stale-row audit

During Phase 4 docs maintenance, in addition to filling the current PR's placeholders, scan the Active follow-ups table's status column for "PR open", "awaiting merge", "in progress", or similar live-state claims. For each, verify against `gh pr list --state open` and recent `git log origin/main --oneline -20`. Reconcile any drift in the same commit. Banked from one session surfacing three stale SEC-9b "PR open" references (PR #139 had shipped weeks earlier); without this audit, CONTEXT.md state drifts silently from shipped reality.

The audit extends to CONTEXT.md prose claims, not just the table. Component-consumer tracking ("X.jsx still consumed by Y"), deferred-but-still-valid annotations, and recently-shipped narrative all drift silently in the same way. PR #156 exposed a 22-day-stale "still consumed by ManagerDashboard" claim about MotivationalCarousel that survived the table-scoped scan because it lived in prose. Phase 4 must `git grep` for any named component referenced in CONTEXT.md prose and verify the claim against current state.

### 9. Dispatcher Phase-5 scope-extension protocol

Phase 5 stops exist for dispatcher review and authorization, not just go/no-go on merge. When CC surfaces findings adjacent to the brief's locked scope — same category, same risk profile, same verification basis — the dispatcher MAY authorize an in-PR extension rather than requiring a follow-up. CC MUST NOT unilaterally expand; the scope-lock protects against silent drift. The dispatcher's authority to extend exists precisely because Phase 5 is review-authorization.

Protocol: surface as out-of-scope per brief → dispatcher evaluates → if authorized, CC applies via NEW commit (not amend — preserves "extended at Phase 5 review" audit trail), updates PR description, re-stops at Phase 5. Validated in PR #158 (placeholder-sweep), where 2 additional sites mapping to PRs already verified HIGH-confidence landed via commit 0f6a4b5 on the same branch. 

**Carve-out (banked 2026-05-30):** the `text-*-faint → text-*-muted` contrast fix established in PR #392 is standing pre-authorized — CC MAY apply it in-PR and report it without a per-instance Phase-5 stop. This is the ONLY pre-authorized self-extension; ANY OTHER new serious/critical axe node vs the main baseline still requires surface → STOP → dispatcher authorization per this rule. (Origin: PR #393 review — CC applied the fix unilaterally citing this rule, which actually forbids unilateral expansion; the carve-out makes that one specific fix compliant going forward.)

### 10. Kickoff briefs commit before CC dispatch

Every kickoff brief for an implementation PR (any size — XS, S, M, L, XL — no exception) commits to `docs/briefs/` via a small standalone docs PR BEFORE CC is dispatched against it. The pattern: dispatcher drafts brief → opens `docs(briefs): <topic> kickoff` PR → merges → dispatches CC against the merged brief on a fresh feature branch. This preserves the dispatch-vs-implementation boundary in git history (the brief's authorship and timing is separate from CC's execution) and lets reviewers trace methodology drift across PRs.

Audit-only dispatches stay inline. Pre-flight surface audits, read-only investigations, and any task that produces no source/docs commit do NOT require a committed brief — the chat prompt is the brief.

Banked from May 2026 closure cadence (PRs #161/#162, #163/#164, #165/#166 all followed this pattern).

**Execution.** The docs-PR landing is performed by the `/land-brief <topic-slug>` skill — CC creates the docs branch off `origin/main`, moves the brief (+ optional annotation) into `docs/briefs/` / `docs/design/`, and opens the `docs(briefs)` PR. The dispatcher merges it, then `/dispatch`es the merged brief. The separate-docs-PR requirement above is unchanged; only the executor moves from manual dispatcher terminal to CC. Banked from PR #428.

**Dispatch guard (enforced in `/dispatch`).** Before reading any brief, `/dispatch` MUST `git fetch origin` and confirm the brief path exists on `origin/main` (`git ls-tree origin/main -- docs/briefs/<file>` non-empty); if it is missing, **STOP IMMEDIATELY** ("brief not on origin/main — merge the docs PR first"). Dispatching against a local/docs-branch copy is forbidden — it ships the work while the Rule 10 audit trail (brief on main) is still absent. Banked from the 2026-06-04 #476 near-miss: the Prospecting Calls Flip work (#477) merged while its brief docs PR (#476) was still open, leaving the brief off `origin/main` until caught post-merge.

### 11. FU body re-audit before first work

When a FU is referenced for first implementation work after any gap (banking-date to dispatch-date), the brief author must verify the FU body's diagnosis claims against current source code BEFORE locking the brief's "Decisions locked" section. Specifically, for any FU body that names:

- a root cause / mechanism (e.g., "regex adjustment", "downstream of bug X", "race condition in handler Y")
- a file:line target
- a suggested fix shape ("just adjust the regex", "wrap in useMemo")

the brief MUST quote the current source at that location and either (a) confirm the FU diagnosis matches reality, or (b) document the corrected diagnosis in the brief's audit-findings section. The corrected diagnosis lands in the RESOLVED note when the FU closes — preserving the drift trail.

Banked from PR #164 (react-hooks Item 2: FU body claimed "downstream of Item 1"; reality was "eslint-disable was vestigial — unused at any baseline") and PR #166 Bug 001 (FU body claimed "regex adjustment only"; reality was navigator off-by-one).

### 12. Hard-stop language must be unambiguous

Briefs use only two phrases for halt conditions, no synonyms:

- **STOP and wait for dispatcher** — CC halts execution, posts the surface finding to chat, and does NOT proceed until receiving an explicit dispatcher reply. No autonomous next step, no "I'll continue with a defensible path." This is the default for any condition the brief identifies as a stop.
- **STOP IMMEDIATELY** — reserved for data-safety / production-touch / cross-tenant risk (carried from Rule 3). Same halt semantics, escalated visual weight.

Forbidden synonyms: "hard stop and surface", "flag to Kelsean", "note and continue", "surface for review". These are interpretable as either halt-and-wait OR proceed-with-note; the ambiguity caused PR #166's first-turn methodology miss (CC encountered an env-gap stop, rationalized continuation via the smoke waiver, and only halted on the second turn). Brief authors must rewrite any halt condition into one of the two canonical phrases.

Existing committed briefs (pre-banking) are grandfathered. Rule applies to all new briefs from banking date forward.

### 13. Acceptance-criteria waiver protocol

When environment conditions prevent a brief's acceptance criteria from being verified at Phase 3 (seeded data absent, third-party service unavailable, indexed-state not yet propagated, etc.), the dispatcher MAY authorize merge with an explicit waiver. The waiver requires BOTH artifacts to land at merge time:

- **Waiver decision in PR body** — dispatcher's explicit "verification waived because <env condition>" note. Not implicit. Not "merge anyway, will verify later."
- **Deferred-verification FU banked in `docs/FOLLOW_UPS.md`** — full re-run instructions (commands, env prerequisites, seed paths) and the unverified acceptance criteria copied verbatim. Banked in the same merge cycle as the resolving PR — never deferred to a follow-up commit.

CC's Phase 3 surfaces the env gap (via Rule 12's STOP and wait for dispatcher); dispatcher authorizes waiver or instructs CC to resolve the env condition. Banked from PR #166 (shakedown harness re-run blocked by absent `*@agencytrack.test` accounts; deferred FU at `docs/FOLLOW_UPS.md:44`, PR #166 squash commit `eedd2bb`).

### 14. .env.example is canonical credential documentation

Every `process.env.X`, `import.meta.env.X`, or post-`loadEnv` env read site must reference a key documented in `.env.example`. When a new credential is introduced:

- Add the key + a one-line purpose comment to `.env.example` in the same PR as the first read site.
- If the credential is deprecated, REMOVE it from `.env.example` in the same PR as the reader removal. Do NOT leave deprecated keys with explanatory comments — they accumulate as bait.

Why: drift between `.env.example` and live read sites creates onboarding gaps (new contributors don't know what to set) and stale-bait risk (deprecated vars get re-populated by anyone copying the template). Surfaced via 2026-05-16 env-credentials propagation audit: A11Y_* test credentials for multiple role tiers were partly documented in `.env.example`, partly drifting in script env reads (later quantified in the 2026-05-17 FU-B audit: 7 role flavors actively read, 2 documented at banking time). `VITE_TENANT_ID` was documented as deprecated despite having no live reader post-SEC-11. Rule 14 canonicalizes `.env.example` as the credential doc.

How to apply: Before opening a PR that adds or removes a credential read site, grep `.env.example` for the key name. If new, add it. If the last reader was removed, delete the entry. Brief Phase 1 audits for any work touching credential-reading scripts MUST scan both `.env.example` and live `process.env.X` reads as part of the enumeration.

Banked from PR #174 (env-credentials propagation audit closure).

### 15. Direct-to-main pushes require origin verification

For any commit that lands on `main` outside the squash-merge-PR path — including the post-merge placeholder-fill commit (per Session Protocol step 9 and § Post-merge local cleanup), authorized hotfixes, and any other dispatcher-authorized direct push — CC MUST run `git fetch origin && git log origin/main --oneline -1` immediately after the push, and confirm the SHA matches `git rev-parse HEAD` on local `main`.

If the SHA does not match: the push has not reached origin. **STOP and wait for dispatcher** — do not retry, do not amend, do not exit the sequence. Push-failure modes are non-obvious (auth re-prompt, upstream rejection, network blip, malformed commit) and each warrants dispatcher review rather than autonomous retry.

CC's sequence summary MUST include an explicit line stating the commit was pushed to `origin/main` and the verification SHA matched. "Committed" alone is not equivalent to "pushed and verified" — the verification step is not complete until both have been confirmed in the report.

Why: on 2026-05-17 a silent push failure from the previous day's post-merge sequence was caught only when the next PR's Phase 0 gate detected a divergence between local `main` and `origin/main`. PR #176's placeholder-fill commit (`148c15c`) had been committed locally but never reached origin; the failure was invisible because the post-merge summary described the commit without claiming verification. Same shape as the "preview verified + merged via UI is not proof of shipping" learning already in memory: execution reports don't equal verification.

Note on terminology: This rule anchors to canonical CLAUDE.md sections (Session Protocol step 9 + § Post-merge local cleanup), not to "Rule 4." Some prior briefs use "Rule 4" as shorthand for the post-merge placeholder-fill sequence; that shorthand collides with canonical Rule 4 (env-listing credential safety) and should not be carried forward in new briefs.

Banked from PR #180 (2026-05-17, methodology batch).

### 16. Post-merge fill scope is canonical

The post-merge cleanup sequence (Session Protocol step 9.5 + § Post-merge local cleanup) MUST update the following in `docs/CONTEXT.md` as part of every cycle, regardless of whether the work brief's Phase 4 specified them:

- **Current main HEAD** — squash SHA of the most recently merged PR (the work PR squash, not the post-merge fill commit which is housekeeping). For direct-to-main commits without an associated PR, use the commit SHA.
- **Active track** — identifier of the just-shipped work.
- **Next track** — remove items that just shipped; promote the next-up item, or note "(queue clear)" if none.
- **"Where we left off"** prose — summary of the just-shipped PR and what's next. Format flexible; content must be current.
- **Last updated** — ISO date of the fill commit.

Any `#TBD` or `{TBD}` placeholders introduced in the work PR's Phase 4 are filled with the work PR's number and squash SHA (the pre-existing mechanic, now consolidated under Rule 16).

**Housekeeping / docs-only merges take no post-merge fill commit; `Current main HEAD` tracks work squashes only.** A docs-only or housekeeping merge — kickoff-brief landings, scoping/design notes, methodology-doc edits, branch-cleanup commits, test-only PRs, and audit/verification scripts that nothing in the build/runtime imports — does NOT get its own CONTEXT.md fill cycle and does NOT become the `Current main HEAD` value (which continues to point at the last *work*-PR squash). This avoids fill-commit churn for merges that ship nothing to production. A merge counts as "work" when it changes `src/`, `functions/`, schema, rules, or config that the build/runtime consumes. Banked from the Track J overnight queue (2026-06-04).

**Terminology resolution.** Some prior briefs used "Rule 4 shorthand" to refer to this sequence; that collides with canonical Rule 4 (env-listing safety) and is retired. Briefs and dispatches cite **Rule 16** when referencing the post-merge fill scope.

**Verification anchor.** Rule 15 (origin-verification) verifies the push produced by Rule 16's fill commit.

**16(c): consolidated post-merge fill for auto-merge programs.** Any program that auto-merges multiple work PRs (harvest batch, night-queue, remediation batch, or similar) is NOT complete until a single consolidated post-merge fill commit covers every merged PR in the program. The fill may be written as one direct-to-main commit with a fill ledger in the commit body (each PR number + squash SHA, with Rule 16(b) classification noted). The program's closing report must reference the fill commit SHA. CC must not declare a program closed without the fill; the dispatcher's "program complete" acknowledgement carries the same obligation.

Motivating incident (2026-06-06): the Gemini harvest program (Batches A–E, PRs #520–#525) + night-queue R1 fixes (PRs #526–#528, #530) merged via GREEN-CHANNEL without a consolidated fill; `Current main HEAD` in CONTEXT.md remained at `4a72d79` (#517) while the actual last work squash was `681af69` (#528) — a 9-PR drift that only surfaced at the next morning's dispatcher check. Resolved by fill commit `731da1e`.

**CONTEXT.md size caps (banked 2026-06-19):** `Recently shipped` ≤ 5 rows; `Last updated` / `Where we left off` / `Current main HEAD` / `Active track` each ≤ 3 entries. When a fill would exceed a cap, move the oldest entry to `docs/CONTEXT-history.md` in the same fill commit. The cap note at the top of `CONTEXT.md` is the canonical reminder; this bullet is the enforcement hook in the fill sequence.

### 17. Source verification at authoring time

When a brief or methodology rule describes source behavior — default behavior, example values, command syntax, file paths, line numbers, existing structural format — the author MUST verify each claim against current source BEFORE locking the brief's "Decisions locked" section or proposing rule wording. Specifically:

- **Default behavior / fallback claims:** grep or read the consumer site; never paraphrase from memory.
- **Example values:** trace through actual call sites (scheme prefixes, separator characters, escape rules, units). Operator copy-paste must work verbatim.
- **File paths and line numbers:** open the file and confirm; line numbers drift between sessions.
- **Enumeration tracked-status:** when listing files via `grep -rn` to scope a migration or audit, pair with `git ls-files` (or use `git grep`) to filter to tracked-only paths. Untracked or excluded files appear in `grep` output but are not part of canonical repo state, and silently inflate migration-target counts in briefs.
- **Existing structural format:** read the existing target document end-to-end before prescribing changes (table cadence, paragraph count, heading levels).
- **Operational possibility of proposed wording:** for rule additions, mentally simulate the rule's first execution and check for chicken-and-egg conditions (e.g., "fill commit SHA captured before fill commit exists").
- **Aggregated snapshots:** aggregated snapshots (e.g. `repomix` output) compress function bodies to `⋮----`; a value seen in such a snapshot is **not** verified source — open the actual file, and never substitute an embedded older brief for a compressed body. (Banked from the 2026-06-02 Daily Capture key-casing catch.)

Rule 11 is the specific case of this discipline for FU-body diagnoses; Rule 17 is the general principle applied to all source-derived claims in briefs and rule wording. Cite Rule 11 when the FU-body diagnosis itself is the gap; cite Rule 17 otherwise.

Phase 1 audits remain the execution-time safety net (per Rule 11's "re-audit before first work" and existing Phase 1 gates in every brief). Rule 17 shifts the primary verification surface to authoring time — Phase 1 catches what authoring missed, not what authoring shouldn't have written.

Banked from PR #192 (2026-05-18). Six instances surfaced 2026-05-17 across FU-G + FU-F + FU-H briefs and Rule 16 wording; enumerated in `docs/FOLLOW_UPS.md` FU-J body at banking time (PR #190, `54c7d1c`).

**Source-verification sub-bullet: paired Phase 1 commands for source-derived claims.**

Brief authoring frequently makes assertions about source state beyond mere file existence — file paths in specific directories, grep counts, line numbers, gitignore reachability, per-token sub-counts. Each such source-derived claim must be paired with a Phase 1 verification command that CC can execute against current source, not just asserted in the brief body.

Common patterns:

- File paths in specific directories: `git ls-files | Select-String "<filename>"` (catches wrong-directory assertions)
- Grep counts: `git grep -c "<pattern>"` (catches drift from prior audit)
- Gitignore reachability when adding new file paths: `git check-ignore -v "<path>"` (catches negation-pattern gaps when introducing files into ignored parent directories)
- Per-token / per-rule sub-counts: explicit grep with token isolation (catches commit-message-template drift)

If a brief asserts a source-derived fact without a paired Phase 1 verification command, CC may verify inline as part of Phase 1 before relying on it. Strikes do NOT accrue for inline verification of unguarded source-derived assertions, nor for inline correction via Rule 9 scope extension when the corrected detail does not change the PR's surface area, scope, or risk profile.

Banked from PR #223 (`d40fa85`). Motivating catches: PR #217 (`d84a752`, CLAUDE.md path), PR #217 (`d84a752`, .gitignore scope), PR #219 (`0b3f058`, AgentReportDocument path), PR #221 (`e074b50`, per-token sub-counts).

**Brief-completeness sub-bullet: enumerate the full architectural unit when introducing a new Firestore collection.**

Briefs that introduce a new Firestore collection must enumerate ALL parts of the architectural unit explicitly in Phase 1 source-verify and Phase 2 edits, not just the obvious surfaces. The full unit includes:

- **Rules block** — read/write permissions, helper functions or inline role checks, tenant scoping if applicable
- **Write surface** — Cloud Function logic (with `Admin SDK` writes bypassing rules) and/or client-side write logic (subject to rules)
- **Read surface** — client-side query shape if any frontend consumes the collection, including filter clauses and orderBy
- **Composite indexes** — required for any query with 2+ `where()` clauses, range filters, or `orderBy` on non-equality fields. Encode as `firestore.indexes.json` additions in Phase 2 alongside the rules block.
- **Smoke verification** — if user-visible behavior depends on the new collection, the smoke's own query is part of the architectural unit. The smoke's index requirements must be in `firestore.indexes.json` even if the production app does not yet query the collection in the same shape.

Common gap: smoke queries on the new collection often have different shape than production app queries. The smoke's index requirements are easy to miss because the brief author is focused on the production app's read surface (if any). The smoke is real verification code that runs against real Firestore — its query needs its index.

Two Rule 9 in-PR extensions on a single PR is a signal the brief under-specified the verification surface and should be banked as a methodology learning. Strikes do NOT accrue for these Rule 9 extensions when the corrections are mechanical (filter clause addition, index addition) and the brief's locked decisions remain intact.

Banked from PR #231 (`5be20e7`). Motivating catch: PR #229 (`0fdebc0`, Resend invite server-side + `auditInviteResends`). Brief covered rules, CF write, frontend swap, and smoke, but missed the smoke's composite index (4-field: `tenantId + actorUid + targetUid + timestamp DESC`) and the smoke query's required `tenantId` filter clause for the rules to accept the read. Both surfaced during operator smoke as Rule 9 extensions: `848c16c` (smoke query tenantId filter), `cd2ef7b` (composite index add).

### 18. PR checklist from ground truth

When opening a PR, fill the template checklist by what is actually verified at PR-creation time — not what is expected to be true:

- Check `[x]` only for items confirmed true at the moment the PR is opened: tests passing, lint/build clean, docs updated, scope matches brief.
- Leave the smoke box **unchecked** (`[ ]`) until the smoke actually runs. After the smoke completes, edit the PR description to reflect the real result and annotate any findings inline (e.g., `[x] smoke — 4/4 pass; Finding: leaderboard ranking not filtered (out of scope)`).
- An unchecked or annotated box is information, not a failure of process. A reflexively checked box that doesn't reflect reality is the failure.

Why: PR #296's smoke ran after PR open and surfaced two out-of-scope findings (leaderboard ranking gap, `deactivateUser` CF crash). A checklist pre-checked at creation would have obscured both. The checklist's value is as a live signal, not a formality.

Banked from PR #296 smoke (`27b1c8a`, 2026-05-24).

### 19. CC never merges or deploys

CC never merges PRs or deploys rules/functions. These are explicit dispatcher/human actions. Merge is the dispatcher's action after review in the GitHub UI. Rules and functions deploys are explicitly dispatched steps — CC does not self-initiate them.

When a deploy or merge gate blocks a task (e.g. a rules-dependent smoke needs the new rules live), **STOP and wait for dispatcher** — report the blocker explicitly. Never cross the gate to unblock yourself.

Why: PR #299 smoke surfaced this when the Firestore `licenseStatus` allowlist extension hadn't been deployed pre-merge. The correct response was to stop and report the blocker; instead the deploy ran autonomously, which violated the gate. Banked from PR #299 post-merge fill (2026-05-24).

### 20. PR-ready report names the feature-branch HEAD SHA

Every "PR is ready for review" / "smoke PASS, holding for pre-review" report from CC MUST include the exact feature-branch HEAD SHA the report describes — captured via `git rev-parse HEAD` on the feature worktree at report time. The SHA is the contract between CC's verification (tests + smoke + the report's narrative) and the dispatcher's merge decision.

Once a PR-ready report is sent, **no further commits may be pushed to that PR's branch without an explicit re-report** stating the new HEAD SHA + a re-run of any verification the new commit could invalidate (smoke at minimum; lint/tests/build per scope). The dispatcher merges only the SHA in the latest verified report.

**Dispatcher protocol:** before clicking merge, compare the PR's current HEAD on GitHub against the SHA in the latest CC report. If they disagree, the PR is NOT ready — request a re-report or wait for the gap to close.

Why: PR #418 surfaced this. CC posted the PR-ready report; the dispatcher merged shortly after. Two follow-up smoke-debugging commits (`94a196d` per-scorecard value testid + `6e52923` card-scoped fillProductionStep + LOW-FU bank) were pushed AFTER the dispatcher's squash had already executed and never made it into main. The 1-line `data-testid={${testid}-value}` addition to `WeekSoFarPanel.jsx` Scorecard was a small production-functional source change that should have shipped via the merged PR; it was orphaned by the timing gap and surfaced only at post-merge smoke (`0fb0992`, 2026-06-01). Folded into Wizard v2 PR3 as a 1-line carry-over per dispatcher direction.

Banked from PR #418 post-merge fill (2026-06-01).

### 21. Bot reviewer disposition gate

After opening any PR, poll for **both** configured bot reviewers (up to 10 min each; if a reviewer is absent, note its absence explicitly — do NOT treat absence as "no comments"). Every comment from each reviewer gets a disposition in the Phase 5 report using the same taxonomy: IMPLEMENT (agreed, in-family with the PR's scope — apply in-PR before the report) · ALREADY-RESOLVED · OBSOLETE · DISAGREE (one-line technical rationale; recorded doctrine and dispatcher rulings outrank any bot) · OUT-OF-SCOPE (valid but expands the PR — banked as an FU, never silently implemented). The disposition table covers both reviewers and is a mandatory report section; a PR is not pre-review-ready without it. On auto-merge green-channel PRs, CC self-dispositions under the same taxonomy and the report records it; DISAGREE and OUT-OF-SCOPE items on auto-merged PRs roll up to the dispatcher in the next report.

**Configured reviewers and poll targets:**

**Note: bot-author logins in the GitHub JSON carry NO `[bot]` suffix.** The display names shown in the GitHub UI (e.g. `gemini-code-assist[bot]`, `coderabbitai[bot]`) differ from the `.author.login` field returned by the API. Filtering on the `[bot]`-suffixed display name silently matches nothing. Correct values: Gemini = `"gemini-code-assist"`, CodeRabbit = `"coderabbitai"`. Banked from PR #735 audit (2026-06-23); CodeRabbit login confirmed from PR #756.

- **Gemini** (`gemini-code-assist` in API) — PR Reviews API. Poll: `gh pr view <pr> --json reviews` → entries where `.author.login == "gemini-code-assist"` (state `COMMENTED`). *Gemini sunsets 2026-07-17; CodeRabbit is the durable reviewer after sunset.* **On money/rules PRs, trigger Gemini via the on-demand `/gemini review` PR comment (posted via PowerShell to avoid Git-Bash MSYS path mangling) — the auto-batch review is materially weaker (missed 3 HIGH money-write races on PR #756 that the on-demand pass caught).**
- **CodeRabbit** (`coderabbitai` in API) — GitHub App; no workflow file required. Posts **both** a review (`gh pr view <pr> --json reviews` → entries where `.author.login == "coderabbitai"`, state `COMMENTED`) with actionable findings, and a summary comment (`gh pr view <pr> --json comments` → entries where `.author.login == "coderabbitai"`). Poll both channels; the reviews channel carries the substance. CodeRabbit activates automatically on PR open via the GitHub App — no trigger comment needed.

**Pre-merge final poll.** Before any squash-merge (dispatcher click or green-channel auto-merge alike), check for reviewer activity posted AFTER the last disposition table — `gh pr view <pr> --json reviews,comments` and compare timestamps against the report's disposition table. Any newer reviewer comment gets dispositioned under the same taxonomy BEFORE clicking merge; a stale disposition table does not satisfy the gate. Banked from the #783/#784 near-miss: a Gemini re-review landed after the disposition table was posted and was only caught post-merge, forcing a docs-side backstop bank instead of an in-PR fix.

**Post-merge backstop.** A pre-merge "absent" is provisional for each reviewer independently. `/post-merge` re-polls for BOTH reviewers; any comment that arrived after the pre-merge window is dispositioned in the post-merge report under the same taxonomy — IMPLEMENT → banked as a follow-up PR or FU (the PR is already merged, no in-PR fix possible) · DISAGREE → recorded in summary · OUT-OF-SCOPE → banked as FU · ALREADY-RESOLVED → noted · OBSOLETE → noted. The gate is not satisfied by a pre-merge "absent" for either reviewer alone.

### 22. Self-critique gate

Before posting any PR-ready report, plan, or final session summary, CC enumerates ≥1 known gap — what it did NOT verify, the weakest part of the change, or an assumption that could be wrong. Self-generated and independent of Rule 21 (bot reviewer disposition gate): surfaces blind spots before external review, not after. A report with no stated gap is incomplete, not clean.

### 23. Falsification-before-banking gate

Before a finding is banked as a locked decision (CONTEXT.md § Locked decisions), an active follow-up, or a CLAUDE.md rule, state what evidence would overturn it. If that can't be answered, the finding is provisional — record it as provisional, do not bank it as settled. Applies to architecture findings, audit conclusions, and rule rationales.

### 24. Currency verification

Any time-sensitive or current-world fact handed to the operator — role holders, prices, laws/regulatory status, product or model availability, recent events — is web-searched and verified current at answer time, not asserted from training priors. Rule 17 extended from brief-authoring to live answers: training-era confidence on a present-tense fact is the trigger to search, not to assert. State the as-of date or source when the fact could have changed. Applies to the dispatcher's chat answers and CC's knowledge-work outputs alike.

### 25. Session & cache hygiene

Load repomix once per session; never re-paste a fresh pack mid-session. Don't edit CLAUDE.md or add/remove MCP servers mid-build — batch those at session boundaries. Keep the task/volatile instruction last in the turn. Batch related work into one session; spin a fresh context only when isolation buys tangle-safety.


---

## Appendix — brief-drafting verification note (was CLAUDE.md line 764)

Removed from CLAUDE.md § Banked patterns as a restatement of Rules 11 and 17. Preserved
here because the `project_knowledge_search` lag claim is stated nowhere else:

**Brief-drafting verification rule (already banked, reinforced this session):** `project_knowledge_search` lags `main` by several PRs. Briefs based on project knowledge alone can embed stale premises. The Phase 1 discovery gate in every brief catches this — never skip it, even for "small" fixes. emailQueued (#136), SEC-9b (#139), and SHAKEDOWN-001 (#141) all had brief assumptions Phase 1 corrected.
