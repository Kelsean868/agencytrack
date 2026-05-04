#!/usr/bin/env bash
# wait-vercel-ready.sh — wait for the Vercel deployment of a specific commit SHA to reach SUCCESS.
#
# Usage:
#   scripts/wait-vercel-ready.sh <commit-sha> [--target preview|production] [--pr <number>]
#
# Two lookup modes:
#   --target preview     (default) — queries the PR's statusCheckRollup. Requires --pr.
#                                    Use immediately after pushing to a PR branch.
#   --target production  — queries the commit's check-runs directly via gh api.
#                          Not PR-scoped, works for any branch including main.
#                          Use after merge to wait for the production deploy.
#
# Distinguishes BUILDING / SUCCESS / ERROR / FAILURE / MISSING. Hard-stops at 300 s,
# prints last-known URL on every failure mode.
#
# Sleep schedule: first check at 60 s, then every 20 s, max 13 iterations.
# Exits 0 with the preview/production URL on stdout when SUCCESS.
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

# ── Production lookup: query the commit's check-runs directly ────────────────
fetch_production() {
  # check-runs covers Vercel's modern reporting (CheckRun objects on commits).
  # Falls back to the older /statuses endpoint if check-runs returns nothing for Vercel.
  local raw rc
  raw=$(gh api "repos/${REPO}/commits/${EXPECTED_SHA}/check-runs?per_page=50" 2>&1)
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "FETCH_ERROR"
    echo ""
    echo ""
    echo "$raw"
    return 1
  fi

  # Find the most recent Vercel check-run. Names that Vercel uses:
  #   "Vercel"  — primary deploy check (legacy)
  #   "Vercel – <project>" — newer naming for project-scoped checks
  # We grep by name containing "Vercel" and skip "Vercel Preview Comments".
  local vercel_block
  vercel_block=$(echo "$raw" | grep -oE '\{[^{}]*"name":"Vercel[^"]*"[^{}]*\}' | grep -v 'Preview Comments' | tail -1)

  local state url
  if [ -z "$vercel_block" ]; then
    # Fallback: try the legacy commit-statuses endpoint.
    raw=$(gh api "repos/${REPO}/commits/${EXPECTED_SHA}/statuses?per_page=50" 2>&1)
    rc=$?
    if [ $rc -ne 0 ]; then
      echo "FETCH_ERROR"
      echo ""
      echo ""
      echo "$raw"
      return 1
    fi
    vercel_block=$(echo "$raw" | grep -oE '\{[^{}]*"context":"Vercel"[^{}]*\}' | head -1)
    if [ -z "$vercel_block" ]; then
      echo "MISSING"
      echo ""
      echo "$raw"
      return 0
    fi
    state=$(echo "$vercel_block" | grep -oE '"state":"[a-z_]+"' | head -1 | sed 's/.*"state":"\([a-z_]*\)".*/\1/')
    url=$(echo "$vercel_block"   | grep -oE '"target_url":"[^"]*"' | head -1 | sed 's/.*"target_url":"\([^"]*\)".*/\1/')
    # Map status states (lowercase) to check-run conclusions for downstream uniformity.
    case "$state" in
      "success")  state="success" ;;
      "pending")  state="in_progress" ;;
      "failure")  state="failure" ;;
      "error")    state="failure" ;;
      *)          state="$state" ;;
    esac
  else
    # check-run JSON: status (in_progress/queued/completed) + conclusion (success/failure/neutral/cancelled/timed_out)
    local status conclusion
    status=$(echo "$vercel_block"     | grep -oE '"status":"[a-z_]+"' | head -1 | sed 's/.*"status":"\([a-z_]*\)".*/\1/')
    conclusion=$(echo "$vercel_block" | grep -oE '"conclusion":"[a-z_]*"' | head -1 | sed 's/.*"conclusion":"\([a-z_]*\)".*/\1/')
    url=$(echo "$vercel_block"        | grep -oE '"details_url":"[^"]*"' | head -1 | sed 's/.*"details_url":"\([^"]*\)".*/\1/')
    if [ "$status" = "completed" ]; then
      case "$conclusion" in
        "success")               state="success" ;;
        "failure"|"timed_out")   state="failure" ;;
        "cancelled")             state="cancelled" ;;
        *)                       state="$conclusion" ;;
      esac
    else
      state="in_progress"
    fi
  fi

  echo "$EXPECTED_SHA"
  echo "$state"
  echo "$url"
  echo "$raw"
  return 0
}

handle_check() {
  local result head state url raw
  if [ "$TARGET" = "production" ]; then
    result=$(fetch_production)
  else
    result=$(fetch_preview)
  fi
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
      echo "INFO t=$(elapsed)s — no Vercel ${TARGET} check yet for ${EXPECTED_SHA:0:9} (still propagating)"
      return 1
      ;;
  esac

  # Preview-only: verify PR HEAD matches expected SHA before trusting state.
  if [ "$TARGET" = "preview" ] && [ -n "$head" ]; then
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

echo "INFO waiting ${FIRST_DELAY}s before first check (target=$TARGET expected_sha=${EXPECTED_SHA:0:9})"
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
