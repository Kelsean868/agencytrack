# PR Kickoff — Track F3.1: Link Prospect-Info Prep → Joint-Call Observation

**Track:** F (fast-follow). Connects F3's agent prep (#246) to F2's manager observation (#244).
**Type:** Feature PR · **Size:** S · **Risk:** Low (no new privacy model; reuses F2 + F3).
**Provenance:** Deferred from the F3 brief — the explicit prospect-info ↔ observation link.

---

## Goal

When a manager logs a joint-call observation (F2), let them optionally **link it to the agent's prospect-info prep** (F3) that it corresponds to — so the prep (what the agent expected) and the observation (what happened) are connected on the manager side.

## The one design rule that prevents a leak

Store the link **on the manager's `jointCall` observation doc** (`prospectInfoId`), **never on the agent's `prospectInfo` prep doc.** The agent reads their own prep; if the link lived there, the agent could infer a manager observed the call. Keeping the reference one-directional (observation → prep) means the prep doc is untouched, the agent's view is unchanged, and the F2 agent-exclusion boundary holds exactly as-is.

## Source-verify first (Rule 17, Phase 1 — STOP on contradiction)

- F2's `jointCall` doc + `JointCallsTab` observation form (where the link selector goes) + the `jointCalls` create/update rule — **does it use a field allowlist** (`affectedKeys().hasOnly([...])`)? If yes, add `prospectInfoId` to it (create + update). If permissive, no rule change.
- F3's `prospectInfoService` manager-read (`getProspectInfoForAgent` or equivalent) — used to populate the selector with the agent's preps. Confirm the function + shape.
- Confirm the agent's prospect-info view does NOT read the observation / would not change. (It won't, if the link lives only on the observation.)

## Schema

Add to the existing `jointCall` doc (F2):
- `prospectInfoId` (string, optional) — references `/tenants/{tid}/users/{agentId}/prospectInfo/{id}`. No reciprocal field on the prep.

No new subcollection. No uniqueness constraint (a loose 1:1 in practice; not enforced).

## Privacy (unchanged)

- The `jointCall` doc stays manager-authored, agent-excluded, rank-based read (F2). Only delta, if any: add `prospectInfoId` to the create/update allowlist (additive).
- The selector reads the agent's `prospectInfo` via the existing F3 manager-read rule (already permitted). No read-rule change.
- The `prospectInfo` prep doc is **not** modified by linking. Agent view unchanged.

## Scope

**IN**
- `prospectInfoId` on the `jointCall` doc; extend `addJointCall`/`updateJointCall` in `jointCallsService` to accept it; extend the rule's create/update allowlist if present (additive).
- In `JointCallsTab` (manager observation form): an optional **"Link to prospect prep"** selector, populated from that agent's `prospectInfo` preps (newest first). Manager picks one or none.
- Display: on the observation (list/detail), show the linked prospect's summary (name + intended date), read from the `prospectInfo` doc by id. Manager-side only.
- Tests: extend `jointCallsService` unit tests (`prospectInfoId` persists); extend the emulator rules test if the allowlist changed (`prospectInfoId` writable by author; **agent read of the jointCall still DENY**); component test for the selector. If `JointCallsTab` now imports `prospectInfoService`, mock it in `JointCallsTab.test.jsx` (the F2 CI lesson).

**OUT / DEFERRED**
- Any "completed/linked" indicator on the **agent's** prep view — out (would leak observation existence).
- F2.1 BM notification (still queued).
- A reciprocal field on the prep doc — explicitly not built (the leak-prevention rule above).

## Phases

1. **Source-verify** (above). STOP if F2's form/rule or F3's manager-read differ from this brief.
2. **Schema + rule + service.** Add `prospectInfoId`; extend allowlist if present. If the rule changed, extend the emulator test (link field writable by author; **jointCall agent-read still DENY**).
3. **UI.** Link selector in the observation form (populated from the agent's preps); linked-prospect summary on the observation (manager-side). States; Nexus tokens; 44px; light + dark.
4. **Docs (placeholders).** CONTEXT.md recently-shipped row (`#TBD`/`{TBD}`); FOLLOW_UPS.md — mark F3.1 shipped, note F2.1 still queued.
5. **Commit / push / PR.** Single branch off fresh main (`git fetch` first; expected HEAD `9737535`). If the rule changed, deploy the additive rule pre-merge (`firebase deploy --only firestore:rules`; no new index expected). Lint + build. **Run the full suite with `.env.local` moved aside** before pushing. Push, open PR via `gh`, Rule 15 verify. Do NOT merge.

**Smoke: RUN** (light — privacy unchanged):
- Manager logs an observation → links a prospect-info prep → reload → `prospectInfoId` persists AND the linked prospect summary renders on the observation. Light + dark, 390×844, 0 console errors.
- **Confirm no agent leak:** as the test agent, the prospect-info prep view is unchanged (no observation/link info), and the `jointCall` doc remains unreadable (direct read → denied — the F2 boundary, re-confirmed with the link field present).

## Acceptance criteria

- `prospectInfoId` persists on the observation; linked prospect renders manager-side; agent prep view unchanged; jointCall agent-read still denied.
- No reciprocal field on the prep; no agent-facing link indicator.
- Lint 0; build green; suite green incl. env-unset parity; smoke green.

## Post-merge

Standard sequence: sync main, capture squash SHA, fill `#TBD`/`{TBD}`, commit + push direct to main, Rule 15 verify. (Any additive rule deployed pre-merge.)
