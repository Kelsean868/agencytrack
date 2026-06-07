# Brief: Graphify a11y-archive exclusion + report regeneration

## Context
Diagnostic confirmed graph is legitimate (0 duplicate IDs; 13,127 = 7,465 code + 5,662 semantic). Two follow-ups: (a) verification/a11y/*.json archives produce ~270 junk key-nodes and grow with every axe run; (b) GRAPH_REPORT.md predates the full semantic merge and current clustering.

## Scope
- `.graphifyignore` (new, repo root):
  ```
  # graphify's own output (defense-in-depth; CLI already self-excludes)
  graphify-out/
  # axe scan archives — structured key-noise, grows per scan
  verification/a11y/
  ```
- `graphify-out/` — refreshed graph + regenerated GRAPH_REPORT.md

## Decisions locked
- Use `.graphifyignore` (not a CLI flag) so exclusion persists for all future `graphify update .` runs
- `--force` flag on the first update after adding `.graphifyignore` to trigger intentional shrink
- Fixed-point check required before PR open (P4 must be +0/+0)

## Execution

**P1.** Create `.graphifyignore` at repo root as scoped above.

**P2.** Run: `graphify update . --force`
- Record node/edge counts before and after. Expect ~270-node drop, code-type only.

**P3.** Regenerate clustering + report against the cleaned graph: run `/graphify . --cluster-only` (or equivalent `graphify update . --cluster-only` if supported).
- Label the top communities in-session (no API key; accept "Community N" for the long tail).
- Confirm GRAPH_REPORT.md is rewritten and its header stats match P2's final counts.

**P4.** Fixed-point check: run `graphify update .` once more — require +0 nodes / +0 edges. FAIL the dispatch if nonzero.

**P5.** Smoke: `graphify query "formatCurrency"` — must return non-empty. Record PASS/FAIL in PR description.

**P6.** Standard discipline: CONTEXT.md + FOLLOW_UPS.md placeholders, commit on branch `chore/graphify-noise-exclusion`, push, open PR. HOLD for merge.

## Acceptance criteria
- `.graphifyignore` present with both exclusions
- a11y key-nodes (`violations` / `byRule` / `nodes` / `impact` label families sourced from `verification/a11y/`) absent from `graph.json`
- `GRAPH_REPORT.md` header reflects final post-exclusion counts
- Fixed-point check +0/+0 — post-merge invariant preserved
- Post-merge fill on THIS PR reports its `graphify update .` delta explicitly (expect ~0)

## Risks
- `--force` is the documented path for intentional shrink; fixed-point check (P4) guards the post-merge invariant
- Report/community relabeling causes cosmetic diff churn in `graphify-out/` — collapsed by `linguist-generated` in `.gitattributes`
