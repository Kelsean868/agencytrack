# Brief: Graphify Repo Integration

## Objective
Wire the already-generated graphify knowledge graph into the repo: track outputs, register always-on graph usage for Claude Code, and refresh the graph once per merged PR via /post-merge. Option A (no git hook).

## Scope
- .gitignore — add graphify-out/manifest.json, graphify-out/cost.json, graphify-out/cache/
- .gitattributes — add `graphify-out/** linguist-generated=true` so PR diffs collapse graph churn
- CLAUDE.md + hook config — via `graphify claude install` (tool-generated; full diff goes in PR description)
- .claude/commands/<post-merge command file> — add graph refresh step
- graphify-out/ — initial commit of generated artifacts (graph.json, graph.html, GRAPH_REPORT.md)

## Out of scope — explicit
- Do NOT run `graphify hook install` (no git post-commit/post-checkout hooks — decided)
- No app code, rules, functions, or schema changes

## Execution
P1. Update .gitignore and .gitattributes as scoped.
P2. Run `graphify claude install` from repo root. Capture: (a) full verbatim diff of CLAUDE.md, (b) list of every file created/modified outside CLAUDE.md (hook/settings files). Both go in the PR description under "## CLAUDE.md diff — review required".
P3. Locate the post-merge slash command file in .claude/commands/. After the sync-main step and BEFORE the placeholder-fill commit is staged, insert:
    - Run: graphify update .
    - If it errors requiring an API key/backend (cluster labeling), fall back to: graphify update . --no-cluster — and note the fallback in the PR description.
    - Stage graphify-out/ so the refresh rides the existing direct-to-main fill commit.
P4. Smoke (no waiver):
    - Run `graphify update .` once; confirm it completes and `git status` shows only expected graphify-out changes.
    - Run `graphify query "formatCurrency"` — expect non-empty results.
    - With the new hook active, perform one normal Read tool call on src/ — confirm it completes without blocking.
    - PASS/FAIL each leg in the PR description.
P5. Per standard discipline: CONTEXT.md + FOLLOW_UPS.md entries with #TBD placeholders, commit all changes on branch feat/graphify-integration (PowerShell: no && chaining), push, open PR. HOLD for merge.

## Acceptance
- Ignore/attribute entries present; graphify-out tracked minus manifest/cost/cache
- CLAUDE.md diff fully disclosed in PR description
- /post-merge contains graph refresh step staged into fill commit
- All four smoke legs PASS
- No git hooks installed

## Risks
- CLAUDE.md is tool-written — human review at PR is the gate
- PreToolUse hook adds a pre-call check to CC tool usage; reversible via `graphify claude uninstall`
