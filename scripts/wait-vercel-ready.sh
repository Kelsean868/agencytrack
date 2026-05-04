#!/usr/bin/env bash
# wait-vercel-ready.sh — wait for the Vercel preview deployment of a specific commit SHA to reach SUCCESS.
#
# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ STATUS — preview path PRODUCTION-VERIFIED, production path RETIRED.          │
# │                                                                              │
# │ --target preview:    self-verified successfully across 4 commits              │
# │                      (PR 1 106d093, PR 14 2c94aba, PR 14 a349cdc, plus       │
# │                      this PR's own self-test). Use freely for post-push      │
# │                      preview verification.                                   │
# │                                                                              │
# │ --target production: 3 consecutive failures on real-use scenarios:           │
# │                      - PR 1 post-merge (fd189a9): hung on PR-scoped query    │
# │                        because PR HEAD never advances past the last branch   │
# │                        commit after merge.                                   │
# │                      - PR 14 first attempt: same issue (pre-fix).            │
# │                      - PR 14 post-merge (83e54ad): /statuses fallback        │
# │                        regex `\{[^{}]*"context":"Vercel"[^{}]*\}` cannot     │
# │                        span the nested `creator: {...}` field that the      │
# │                        endpoint returns, so state extraction silently        │
# │                        returns empty and the helper polls until timeout.     │
# │                                                                              │
# │ Three strikes is enough. The production path now hard-errors immediately     │
# │ instead of polling. Production deploy verification is MANUAL via the         │
# │ Vercel dashboard at https://vercel.com/<team>/agencytrack until someone      │
# │ replaces this script with `vercel inspect <url> --wait` (officially          │
# │ maintained by Vercel, bypasses our custom GitHub-API plumbing entirely —     │
# │ requires Vercel CLI auth setup).                                             │
# │                                                                              │
# │ DO NOT re-attempt fixes to the production path here. If automation becomes   │
# │ worth the Vercel CLI auth setup, replace this whole script.                  │
# └─────────────────────────────────────────────────────────────────────────────┘
#
# Usage:
#   scripts/wait-vercel-ready.sh <commit-sha> [--target preview] [--pr <number>]
#
# --target preview is the only supported mode. Queries the PR's statusCheckRollup.
# Requires --pr. Distinguishes BUILDING / SUCCESS / ERROR / FAILURE / MISSING,
# hard-stops at 300 s, prints last-known URL on every failure mode.
# Sleep schedule: first check at 60 s, then every 20 s, max 13 iterations.
# Exits 0 with the preview URL on stdout when SUCCESS.
# Exits non-zero on ERROR/CANCELED/timeout/parse-failure.
#
# Uses gh's embedded jq (--jq) — does not require a standalone jq binary.

set -u

EXPECTED_SHA="${1:-}"; shift || true
PR_NUMBER=""
TARGET="preview"
REPO="Kelsean868/agencytrack"

while [ $# -gt 0 ]; do
  case "$1" in
    --target)  TARGET="${2:-preview}"; shift 2 ;;
    --pr)      PR_NUMBER="${2:-}"; shift 2 ;;
    --repo)    REPO="${2:-}"; shift 2 ;;
    *)         shift ;;
  esac
done

# ── Hard-error on retired --target production ──────────────────────────────
# See the STATUS banner at the top of this file for context. The production
# polling path failed three consecutive real-use scenarios; rather than
# letting it run and silently time out (the previous failure mode),
# hard-error immediately and direct the caller to the manual fallback.
if [ "$TARGET" = "production" ]; then
  cat >&2 <<'EOF'
ERROR: --target production is retired.

The production polling path hung on three consecutive real-use scenarios
(see STATUS banner at the top of scripts/wait-vercel-ready.sh for details).

Production deploy verification is now MANUAL via the Vercel dashboard:
  https://vercel.com/<your-team>/agencytrack

If you want to automate this, replace this whole script with:
  vercel inspect <url> --wait

(Officially maintained by Vercel; requires Vercel CLI auth setup.)
EOF
  exit 7
fi

# Backward-compatible: positional arg after SHA was historically PR_NUMBER.
if [ -z "$PR_NUMBER" ] && [ "$TARGET" = "preview" ]; then
  PR_NUMBER="13"
fi

HARD_TIMEOUT=300
FIRST_DELAY=60
INTERVAL=20
MAX_ITERS=13

if [ -z "$EXPECTED_SHA" ]; then
  echo "ERROR: missing commit SHA" >&2
  echo "usage: $0 <commit-sha> [--target preview|production] [--pr <number>] [--repo <owner/repo>]" >&2
  exit 2
fi

if [ "$TARGET" = "preview" ] && [ -z "$PR_NUMBER" ]; then
  echo "ERROR: --target preview requires --pr <number>" >&2
  exit 2
fi

start_ts=$(date +%s)
last_url=""
last_state="(none)"
last_head=""
last_raw=""

elapsed() { echo $(( $(date +%s) - start_ts )); }

# ── Preview lookup: query the PR's statusCheckRollup ─────────────────────────
fetch_preview() {
  local raw rc
  raw=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json headRefOid,statusCheckRollup 2>&1)
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "FETCH_ERROR"
    echo ""
    echo ""
    echo "$raw"
    return 1
  fi

  local head state url vercel_block
  head=$(echo "$raw" | grep -oE '"headRefOid":"[a-f0-9]+"' | head -1 | sed 's/.*"headRefOid":"\([a-f0-9]*\)".*/\1/')
  vercel_block=$(echo "$raw" | grep -oE '\{[^{}]*"context":"Vercel"[^{}]*\}' | head -1)

  if [ -z "$vercel_block" ]; then
    state="MISSING"
    url=""
  else
    state=$(echo "$vercel_block" | grep -oE '"state":"[A-Z_]+"' | head -1 | sed 's/.*"state":"\([A-Z_]*\)".*/\1/')
    url=$(echo "$vercel_block"   | grep -oE '"targetUrl":"[^"]*"' | head -1 | sed 's/.*"targetUrl":"\([^"]*\)".*/\1/')
  fi

  echo "$head"
  echo "$state"
  echo "$url"
  echo "$raw"
  return 0
}

# Production lookup intentionally removed — see retirement banner at the top.
# The production --target is now blocked at argument parsing and never reaches
# this point.

handle_check() {
  local result head state url raw
  result=$(fetch_preview)
  head=$(echo "$result"  | sed -n '1p')
  state=$(echo "$result" | sed -n '2p')
  url=$(echo "$result"   | sed -n '3p')
  raw=$(echo "$result"   | sed -n '4,$p')

  last_state="$state"
  last_head="$head"
  [ -n "$url" ] && last_url="$url"
  last_raw="$raw"

  case "$state" in
    "FETCH_ERROR")
      echo "ERR fetch failure at t=$(elapsed)s" >&2
      echo "raw: $raw" >&2
      exit 3
      ;;
    "MISSING")
      echo "INFO t=$(elapsed)s — no Vercel preview check yet for ${EXPECTED_SHA:0:9} (still propagating)"
      return 1
      ;;
  esac

  # Verify PR HEAD matches expected SHA before trusting state.
  if [ -n "$head" ]; then
    if [ "${head:0:${#EXPECTED_SHA}}" != "$EXPECTED_SHA" ] && [ "${EXPECTED_SHA:0:${#head}}" != "$head" ]; then
      echo "INFO t=$(elapsed)s — PR HEAD is ${head:0:9}, expected ${EXPECTED_SHA:0:9} (waiting for matching push)"
      return 1
    fi
  fi

  case "$state" in
    "SUCCESS"|"success")
      echo "READY at t=$(elapsed)s — sha=${head:0:9} url=$url"
      printf '%s\n' "$url"
      exit 0
      ;;
    "PENDING"|"EXPECTED"|"in_progress"|"queued"|"")
      echo "INFO t=$(elapsed)s — building (state=$state) url=$url"
      return 1
      ;;
    "ERROR"|"FAILURE"|"failure"|"cancelled")
      echo "ERR t=$(elapsed)s — deployment failed (state=$state) url=$url" >&2
      echo "raw: $raw" >&2
      exit 4
      ;;
    *)
      echo "ERR t=$(elapsed)s — unrecognized state '$state' url=$url" >&2
      echo "raw: $raw" >&2
      exit 5
      ;;
  esac
}

cleanup_on_timeout() {
  echo "TIMEOUT at t=$(elapsed)s — last_state=$last_state last_head=${last_head:0:9} last_url=$last_url" >&2
  echo "raw: $last_raw" >&2
  exit 6
}

echo "INFO waiting ${FIRST_DELAY}s before first check (target=preview expected_sha=${EXPECTED_SHA:0:9})"
sleep $FIRST_DELAY
handle_check || true

iter=1
while [ $iter -lt $MAX_ITERS ]; do
  if [ "$(elapsed)" -ge $HARD_TIMEOUT ]; then
    cleanup_on_timeout
  fi
  sleep $INTERVAL
  handle_check || true
  iter=$((iter + 1))
done

cleanup_on_timeout
