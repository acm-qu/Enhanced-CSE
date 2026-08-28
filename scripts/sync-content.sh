#!/usr/bin/env bash
#
# Publishes new content to the cPanel deployment.
#
# The production host cannot reach blogs.qu.edu.qa — WordPress accepts
# connections from the QU network but resets them for the server's datacenter
# IP. That host serves both the REST API (article text) and the image files, so
# neither the content sync nor image fetching can run on the server.
#
# Both therefore run from a machine on a network QU accepts. Article text lands
# in Neon, which the server can read directly; image bytes have no shared
# location, so the cache is rsynced across.
#
#   1. sync    WordPress -> Neon          (needs a locally running app)
#   2. mirror  download new images        -> .media-cache/
#   3. upload  rsync the cache delta      -> server
#
# The server needs no restart and no redeploy: article routes set
# dynamicParams = true, so new slugs render from Neon on demand, and list pages
# refresh on their own via revalidate.
#
# Usage:
#   ./scripts/sync-content.sh                      # sync + mirror, no upload
#   ./scripts/sync-content.sh --remote quhosting@your-server.com
#   DEPLOY_REMOTE=quhosting@host ./scripts/sync-content.sh
#   ./scripts/sync-content.sh --skip-sync          # skip the WordPress pull
#   ./scripts/sync-content.sh --dry-run            # show what would upload
#
# Step 3 only runs when a remote is configured; without one the refreshed cache
# is left on disk for package-bundle.sh to ship inside deploy.zip.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CACHE_DIR="${MEDIA_CACHE_DIR:-$REPO_ROOT/.media-cache}"
REMOTE="${DEPLOY_REMOTE:-}"
REMOTE_PATH="${DEPLOY_REMOTE_PATH:-csewiki/.media-cache/}"
SKIP_SYNC=0
SKIP_UPLOAD=0
DRY_RUN=0
STARTED_SERVER=0
SERVER_PID=""
SYNC_SUMMARY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --remote)       REMOTE="${2:-}"; shift 2 ;;
    --remote-path)  REMOTE_PATH="${2:-}"; shift 2 ;;
    --skip-sync)    SKIP_SYNC=1; shift ;;
    --skip-upload)  SKIP_UPLOAD=1; shift ;;
    --dry-run)      DRY_RUN=1; shift ;;
    -h|--help)      awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 0 ;;
    *)              echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31merror:\033[0m %s\n' "$1" >&2; exit 1; }

# .env.local cannot be sourced: DATABASE_URL contains an unquoted & which the
# shell reads as a control operator. Pull individual keys out instead.
read_env() {
  local key="$1"
  [ -f .env.local ] || return 0
  grep -m1 "^${key}=" .env.local 2>/dev/null | cut -d= -f2- || true
}

cleanup() {
  if [ "$STARTED_SERVER" = "1" ] && [ -n "$SERVER_PID" ]; then
    step "Stopping the local server we started (pid $SERVER_PID)"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

DATABASE_URL="${DATABASE_URL:-$(read_env DATABASE_URL)}"
[ -n "$DATABASE_URL" ] || fail "DATABASE_URL not set and not found in .env.local"
export DATABASE_URL

BASE_URL="${SYNC_BASE_URL:-$(read_env SYNC_BASE_URL)}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

# With no target configured the sync and mirror still run; only the upload is
# skipped. Syncing locally is useful on its own — package-bundle.sh calls this
# to refresh content before a build, and the resulting cache ships inside
# deploy.zip rather than over rsync.
if [ "$SKIP_UPLOAD" = "0" ] && [ -z "$REMOTE" ]; then
  SKIP_UPLOAD=1
  NO_REMOTE_CONFIGURED=1
else
  NO_REMOTE_CONFIGURED=0
fi

# ---------------------------------------------------------------- 1. sync
if [ "$SKIP_SYNC" = "1" ]; then
  step "Skipping WordPress sync (--skip-sync)"
else
  SYNC_SECRET="${SYNC_SECRET:-$(read_env SYNC_SECRET)}"
  [ -n "$SYNC_SECRET" ] || fail "SYNC_SECRET not set and not found in .env.local"
  export SYNC_SECRET

  if curl -sf -o /dev/null --max-time 5 "$BASE_URL/api/health" 2>/dev/null; then
    step "Using the app already running at $BASE_URL"
  else
    step "Starting a local dev server (sync needs a running app)"
    npm run dev > /tmp/sync-content-server.log 2>&1 &
    SERVER_PID=$!
    STARTED_SERVER=1

    printf '    waiting for %s ' "$BASE_URL"
    for _ in $(seq 1 60); do
      if curl -sf -o /dev/null --max-time 3 "$BASE_URL/api/health" 2>/dev/null; then
        printf ' ready\n'
        break
      fi
      if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        printf '\n'
        tail -20 /tmp/sync-content-server.log >&2
        fail "dev server exited during startup (see /tmp/sync-content-server.log)"
      fi
      printf '.'
      sleep 2
    done

    curl -sf -o /dev/null --max-time 5 "$BASE_URL/api/health" 2>/dev/null \
      || fail "server never became ready (see /tmp/sync-content-server.log)"
  fi

  step "Syncing WordPress content into the database"
  # pipefail is set, so a failing sync still aborts the script despite the tee.
  npm run sync:now 2>&1 | tee /tmp/sync-content-run.log
  SYNC_SUMMARY=$(grep -m1 -E '^\[sync\] [0-9]+ new,' /tmp/sync-content-run.log | sed 's/^\[sync\] //' || true)
fi

# -------------------------------------------------------------- 2. mirror
step "Mirroring article images into $CACHE_DIR"
BEFORE=0
[ -d "$CACHE_DIR" ] && BEFORE=$(find "$CACHE_DIR" -name '*.bin' | wc -l | tr -d ' ')

MEDIA_CACHE_DIR="$CACHE_DIR" node scripts/mirror-media.mjs

AFTER=$(find "$CACHE_DIR" -name '*.bin' 2>/dev/null | wc -l | tr -d ' ')
echo "    cached images: $BEFORE -> $AFTER (+$((AFTER - BEFORE)))"

[ "$AFTER" -gt 0 ] || fail "image cache is empty — refusing to upload"

# -------------------------------------------------------------- 3. upload
UPLOAD_NOTE=""

if [ "$SKIP_UPLOAD" = "1" ]; then
  if [ "${NO_REMOTE_CONFIGURED:-0}" = "1" ]; then
    step "No upload target configured — cache left on disk"
    echo "    Pass --remote user@host or set DEPLOY_REMOTE to rsync it to the server."
  else
    step "Skipping upload (--skip-upload)"
  fi
  UPLOAD_NOTE="not uploaded, cache is at $CACHE_DIR"
else
  RSYNC_FLAGS=(-av --human-readable)
  if [ "$DRY_RUN" = "1" ]; then
    RSYNC_FLAGS+=(--dry-run)
    step "Upload preview (--dry-run, nothing will be written)"
  else
    step "Uploading new cache entries to $REMOTE:$REMOTE_PATH"
  fi

  # Trailing slashes on both sides: copy the contents of .media-cache into the
  # remote .media-cache, never nesting one inside the other.
  rsync "${RSYNC_FLAGS[@]}" "$CACHE_DIR/" "$REMOTE:$REMOTE_PATH"

  if [ "$DRY_RUN" = "1" ]; then
    UPLOAD_NOTE="dry run only, nothing written to $REMOTE"
  else
    UPLOAD_NOTE="uploaded to $REMOTE"
  fi
fi

# ------------------------------------------------------------- 4. summary
step "Summary"
if [ -n "$SYNC_SUMMARY" ]; then
  echo "    Content:  $SYNC_SUMMARY"
else
  echo "    Content:  not synced (--skip-sync)"
fi
echo "    Images:   $AFTER cached, $((AFTER - BEFORE)) new this run — $UPLOAD_NOTE"

# Machine-readable result for callers (package-bundle.sh) that need to report
# whether anything actually changed. Parsing our own stdout would be brittle.
if [ -n "${SYNC_RESULT_FILE:-}" ]; then
  field() { echo "$SYNC_SUMMARY" | grep -oE "[0-9]+ $1" | grep -oE '^[0-9]+' || echo 0; }
  {
    echo "SYNC_RAN=$([ "$SKIP_SYNC" = "1" ] && echo 0 || echo 1)"
    echo "CONTENT_SUMMARY='${SYNC_SUMMARY//\'/}'"
    echo "CONTENT_NEW=$(field new)"
    echo "CONTENT_UPDATED=$(field updated)"
    echo "CONTENT_REMOVED=$(field removed)"
    echo "IMAGES_BEFORE=$BEFORE"
    echo "IMAGES_AFTER=$AFTER"
    echo "IMAGES_NEW=$((AFTER - BEFORE))"
  } > "$SYNC_RESULT_FILE"
fi

if [ "$DRY_RUN" = "1" ] || [ "$SKIP_UPLOAD" = "1" ]; then
  exit 0
fi

cat <<EOF

    No restart or redeploy needed. New articles render from the database on
    first request; list pages refresh within the revalidate window (8h).

    Verify one image on the server:
      curl -s -D - -o /dev/null '<site>/api/media?url=<encoded-image-url>' | grep -i x-media-cache
    Expect: x-media-cache: HIT
EOF
