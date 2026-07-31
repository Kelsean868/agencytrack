# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone. This repo is `Kelsean868/agencytrack`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

Native GitHub sub-issues and native issue dependencies are both **confirmed enabled** on this repo (verified 2026-07-31 — `sub_issues_summary` and `issue_dependencies_summary` both return on existing issues). The body-convention fallbacks below therefore do **not** apply; use the native paths.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.

## Project-specific constraints

Verified against the shipped skill bodies in `mattpocock-skills@1.2.0` on 2026-07-31. Each constraint below cites the line it reconciles, so a version bump can be re-checked against the same anchors.

### `task` tickets never merge or deploy

`task` tickets are the one Wayfinder type that *does* rather than decides. Any `task` ticket whose work is a merge, a `firebase deploy`, or a production data mutation is **HITL only** — see CLAUDE.md § Methodology Rule 19 (CC never merges or deploys). The agent may prepare and stage such work and hand the human a precise checklist, but never executes it.

### The map's exit is a brief, not an issue

`/to-spec` step 3 publishes the spec **as a tracker issue** with the `ready-for-agent` label. That is the wrong destination for this repo: Rule 10 requires the brief as a markdown file in `docs/briefs/`, landed by its own docs PR before dispatch.

Invoke `/to-spec` on the completed map for its **synthesis and template** — Problem / Solution / User Stories / Implementation Decisions / Testing Decisions / Out of Scope — but direct its output to `docs/briefs/<slug>-kickoff.md`. Do not let it create an issue. Its step 2 (confirm test seams with the user before writing) is a real HITL gate; keep it.

The full exit path from a completed map:

```
map complete → /to-spec → docs/briefs/<slug>-kickoff.md → /land-brief → /dispatch → PR → smoke → human merge → /post-merge
```

### Skip `/to-tickets`

Two reasons, both structural:

1. **Granularity is already covered.** `/to-tickets` emits one tracker issue per vertical slice. A vertical slice and a kickoff brief are the same unit here — one demoable slice, one fresh context window, one branch, one PR (§ Single-branch PR rule). Running both writes the work down twice.
2. **It blanket-labels.** It applies `ready-for-agent` to every ticket unconditionally, on the reasoning that the tickets are "agent-grabbable by construction". That is false on this repo: a slice touching `firestore.rules`, Cloud Functions, or anything money-affecting is human-merge regardless of how well specified it is. See `docs/agents/triage-labels.md` § Not the same as green-channel / human-merge.

If a map's destination genuinely needs several sequential briefs, split it by drafting several briefs — not by generating tickets.

### Never `/implement` on this repo

`/implement` is a thin path: `/tdd`, typecheck, run the suite, `/code-review`, then commit to the current branch. It has no scope-lock, no Phase 5 stop, no bot-reviewer disposition (Rule 21), no smoke, no PR-ready HEAD SHA report (Rule 20), and opens no PR — it commits directly to whatever branch is checked out.

`/dispatch` covers this ground with the methodology intact. Use it instead, always.

### Prototypes must not touch production Firebase

`/prototype`'s UI branch generates throwaway routes on a feature branch. **Feature-branch Vercel previews build against PRODUCTION Firebase (`agencytrack-2a610`)** — see CLAUDE.md § Workflow. A prototype route opened on a preview and signed into with a production account reads and writes the live tenant.

Prototype code feels disposable, which is exactly why this slips. The rule is unchanged and absolute: **never run a mutating flow against a feature-branch preview.** Run prototypes locally (`npm run dev`), or build with `--mode staging` and confirm the bundle carries `agencytrack-staging` and zero `agencytrack-2a610` before serving.

Second, smaller: the UI branch produces "several radically different variations" by design. That is exploration, not design intent. Canonical design intent remains the `docs/design-system/screens-v2/` mockups — a prototype never becomes a port target.
