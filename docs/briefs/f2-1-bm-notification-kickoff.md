# PR Kickoff — Track F2.1: Joint-Call → Branch-Manager Notification

**Track:** F (fast-follow — completes the F arc). **Type:** Feature PR · **Size:** S · **Risk:** Low.
**Provenance:** Tatil manager workshop 2026-05-19 ("automated message to the branch manager"); deferred from F2 (#244).

---

## Key finding — NO Cloud Function needed

The live `/tenants/{tid}/notifications` rule already allows `create` by any manager (`canManage`), and the manager logging a joint-call observation can resolve the agent's BM via reads `canManage` permits (agent doc → `branchId` → `branches/{branchId}.managerId`). So the BM notification is a **client-side, best-effort write** on joint-call save — no CF, no new deploy target, no legacy `createNotification` rework. (An actual EMAIL to the BM would need the `mail/` queue + a CF — that's deferred to F2.2.)

## Goal

When a manager logs a joint-call observation (F2), the agent's branch manager gets an in-app notification so they're aware and can pull up the data in review sessions.

## Source-verify first (Rule 17, Phase 1 — STOP on contradiction)

- **Current notification schema + read path** (`notificationService` / NotificationContext): the exact fields the app reads and displays (`userId`, `title`, `body`, `link`, `read`, timestamp field name) so the client-written doc matches and renders. The legacy `createNotification` shape is a guide; the live read path is authoritative.
- **The notifications create rule:** confirm `allow create: if canManage(tenantId)` is live (per repomix). No rule change expected — confirm.
- **BM resolution:** agent user doc carries `branchId`; `branches/{branchId}.managerId` is the BM; both readable by `canManage`. Confirm the field names and that a UM author (own unit) can read the agent doc + the branch doc.
- **Where `addJointCall` lives** (`jointCallsService`) to add the post-save notification step.

## Behavior

On joint-call observation create, **after the jointCall is saved**:
1. Resolve the agent's BM: `agent.branchId` → `branches/{branchId}.managerId`.
2. If a BM exists AND `bmUid !== authorUid` (skip self-notification), write a notification to `/tenants/{tid}/notifications`: `{ userId: bmUid, title, body, link, read: false, <timestamp> }` (match the live schema).
3. **Best-effort:** a notification failure must NOT fail or block the joint-call save — the save is the primary action; the notification is a side effect. Wrap in try/catch, log, move on.
4. No BM (no `branchId` / no `managerId`) → skip silently.

## Notification content (no leakage)

- `title`: e.g. "Joint call logged for {agentName}"
- `body`: e.g. "{authorName} logged a joint-call observation for {agentName}." — **an alert only.** The observation's coaching/observation detail is manager-chain-private (F2); it must NOT appear in the notification body. The BM opens the app to see details.
- `link`: to the agent's joint-call surface (per-agent modal / Master Sheet) — sensible target per Phase 1.

## Privacy

- `userId` = the BM (recipient reads their own per the existing rule). The agent is never involved and never sees it. No new privacy boundary.
- Body carries no observation specifics (alert only). This is an explicit acceptance criterion.

## Scope

**IN**
- BM-resolution helper + best-effort notification write in `jointCallsService.addJointCall` (or a thin wrapper).
- Unit tests (mock firestore): BM resolved + notification doc shape correct; **self-notification skipped** (author is the BM); **no-BM skipped**; **notification failure swallowed** (the joint-call save still succeeds).

**OUT / DEFERRED**
- **F2.2:** actual email-to-BM (via the `mail/` Trigger-Email queue + a CF — bigger build).
- Notifications to the UM / SM (BM only for F2.1).
- Any Cloud Function.

## Phases

1. **Source-verify** (above). STOP if the notification schema, the create rule, or the BM-resolution fields differ from this brief.
2. **Logic + tests.** BM-resolution helper + best-effort notification write in `addJointCall`. Unit tests for the four cases above.
3. **UI:** none new — the BM sees it in the existing notification UI. Confirm the existing UI renders the new doc shape; no component work expected.
4. **Docs (placeholders).** CONTEXT.md recently-shipped row (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark F2.1 shipped (**Track F arc COMPLETE**), queue F2.2 (email).
5. **Commit / push / PR.** Single branch off fresh main (`git fetch` first; expected HEAD `cf4e0ee`). No rule/index change expected — confirm; if none, no `firebase deploy`. Lint + build. **Run the full suite with `.env.local` moved aside** (env-unset parity). Push, open PR via `gh`, Rule 15 verify. Do NOT merge.

**Smoke: RUN** (real write-read-verify via `setupBypassSession`):
- A manager who is NOT the agent's BM (e.g. the tenant_admin) logs a joint-call observation on the test agent → log in as the agent's **branch manager** → the BM sees a new in-app notification ("Joint call logged for {agent}"). Confirm in the real notification UI.
- **Self-notification skipped:** if the BM logs it themselves, no notification to the BM.
- **No leakage:** the notification body contains no observation detail — just the alert.
- Light + dark, 0 console errors. (Confirm in Phase 1 which test account is the test agent's BM so the author ≠ BM.)

## Acceptance criteria

- BM notified on joint-call create by a non-BM author; self-notification skipped; no-BM skipped.
- Notification failure never breaks the joint-call save (best-effort).
- Notification body leaks no observation detail.
- Lint 0; build green; suite green incl. env-unset parity; smoke green.

## Post-merge

Standard sequence: sync main, capture squash SHA, fill `#TBD`/`{TBD}`, commit + push direct to main, Rule 15 verify. (No deploy if no rule change.)
