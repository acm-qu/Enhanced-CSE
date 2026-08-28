#!/usr/bin/env bash
#
# Builds one archive the cPanel host can extract and run, in a single pass:
#
#   1. sync     refresh content and images   (scripts/sync-content.sh)
#   2. build    next build --output=standalone
#   3. package  the standalone app + the image cache -> deploy.zip
#   4. record   prepend the new version to VERSIONS.md
#
# deploy.zip is self-sufficient: it carries .media-cache/ alongside server.js,
# so extracting it into the app root is the whole deployment. There used to be a
# second media-cache.tar.gz to unpack separately, and shipping a fresh bundle
# next to a stale tarball is how article images ended up 404ing.
#
# The packaging steps each exist because of a failure that reached production or
# came close to it:
#
#   - assets are copied with a trailing /. so they merge into the directory
#     Next already created, instead of nesting as public/public
#   - sharp is dropped; it is the only architecture-specific file in the bundle
#     and the host is x86_64 while builds happen on arm64
#   - the externalised-module symlinks under .next/node_modules are turned into
#     real directories, so zip/extract behaviour on the host cannot matter
#   - the source tree is pruned. Pages that read JSON through process.cwd()
#     defeat Next's output tracer and make it copy the whole project root —
#     Dockerfile, README, tests and all. Pruning is done here rather than via
#     outputFileTracingExcludes, whose globs are not anchored and will strip
#     node_modules/<pkg>/lib as readily as ./lib
#   - the image cache is appended to the finished zip rather than copied into
#     the staging directory, so it never has to survive the prune and verify
#     passes above
#
# Usage:
#   ./scripts/package-bundle.sh                        # sync, build, package, record
#   ./scripts/package-bundle.sh --notes "what changed" # skip the interactive prompt
#   ./scripts/package-bundle.sh --version 2.0.0        # set the version explicitly
#   ./scripts/package-bundle.sh --no-version           # do not touch VERSIONS.md
#   ./scripts/package-bundle.sh --skip-sync            # build from the cache as-is
#   ./scripts/package-bundle.sh --skip-build           # repackage the last build
#   ./scripts/package-bundle.sh --skip-install         # reuse the build node_modules
#   ./scripts/package-bundle.sh <build-dir> <output-zip>   # package only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Must live OUTSIDE the repo. Next infers its file-tracing root by walking up
# for a lockfile; a build directory nested in the repo makes it find the repo's
# pnpm-managed node_modules and emit a bundle whose next/react/styled-jsx are
# symlinks into .pnpm — which do not survive zip + extract, so the app dies on
# startup with MODULE_NOT_FOUND. Kept under the user cache rather than /tmp so
# node_modules is not wiped on reboot.
BUILD_DIR="${BUILD_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/enhanced-cse/build}"
CACHE_DIR="${MEDIA_CACHE_DIR:-$REPO_ROOT/.media-cache}"
OUTPUT="$REPO_ROOT/deploy.zip"
VERSIONS_FILE="$REPO_ROOT/VERSIONS.md"
LEGACY_MEDIA_ARCHIVE="$REPO_ROOT/media-cache.tar.gz"

# The format VERSIONS.md is written in, and the cap the description is held to.
MAX_NOTE_WORDS=100

SKIP_SYNC=0
SKIP_BUILD=0
SKIP_INSTALL=0
PACKAGE_ONLY=0
NO_VERSION=0
NOTES=""
VERSION=""

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
note() { printf '    %s\n' "$1"; }
# %b so embedded \n in messages render as line breaks rather than literals.
fail() { printf '\033[31merror:\033[0m %b\n' "$1" >&2; exit 1; }

# .env.local cannot be sourced: DATABASE_URL contains an unquoted & which the
# shell reads as a control operator. Pull individual keys out instead.
read_env() {
  local key="$1"
  [ -f "$REPO_ROOT/.env.local" ] || return 0
  grep -m1 "^${key}=" "$REPO_ROOT/.env.local" 2>/dev/null | cut -d= -f2- || true
}

# Two bare paths keep the original package-only contract, so anything already
# calling this with explicit arguments is unaffected.
if [ $# -ge 1 ] && [ "${1#-}" = "$1" ]; then
  [ $# -eq 2 ] || fail "usage: package-bundle.sh <build-dir> <output-zip>"
  BUILD_DIR="$1"
  OUTPUT="$2"
  PACKAGE_ONLY=1
  # Package-only is the low-level escape hatch — it repackages an existing build
  # and is not a deployment, so it records nothing.
  NO_VERSION=1
else
  while [ $# -gt 0 ]; do
    case "$1" in
      --skip-sync)    SKIP_SYNC=1; shift ;;
      --skip-build)   SKIP_BUILD=1; shift ;;
      --skip-install) SKIP_INSTALL=1; shift ;;
      --no-version)   NO_VERSION=1; shift ;;
      --notes)        NOTES="${2:?--notes needs a description}"; shift 2 ;;
      --version)      VERSION="${2:?--version needs a number like 1.4.0}"; shift 2 ;;
      --output)       OUTPUT="${2:?--output needs a path}"; shift 2 ;;
      --build-dir)    BUILD_DIR="${2:?--build-dir needs a path}"; shift 2 ;;
      -h|--help)      awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 0 ;;
      *)              fail "unknown option: $1" ;;
    esac
  done
fi

# Every later step writes to or reads from $OUTPUT from inside a subshell that
# has cd'd elsewhere, so resolve it to an absolute path once, up front.
resolve_output() {
  local dir base
  base=$(basename "$OUTPUT")
  dir=$(cd "$(dirname "$OUTPUT")" 2>/dev/null && pwd) \
    || fail "output directory does not exist: $(dirname "$OUTPUT")"
  OUTPUT="$dir/$base"
}

# ------------------------------------------------------------- 0. version
word_count() { printf '%s' "$1" | wc -w | tr -d ' '; }

# Commit subjects since VERSIONS.md was last committed — a good proxy for
# "since the last deploy", and it degrades to the last five commits when the
# file is new or has never been committed.
commits_since_last_deploy() {
  local last="" range=""
  last=$(git -C "$REPO_ROOT" log -1 --format=%H -- "$VERSIONS_FILE" 2>/dev/null || true)
  [ -n "$last" ] && range="$last..HEAD"

  if [ -n "$range" ]; then
    local out
    out=$(git -C "$REPO_ROOT" log --format="$1" "$range" 2>/dev/null || true)
    [ -n "$out" ] && { printf '%s' "$out"; return 0; }
  fi
  git -C "$REPO_ROOT" log -5 --format="$1" 2>/dev/null || true
}

# Fallback description for unattended runs: commit subjects joined into one
# line and clipped to the word cap.
autogenerated_notes() {
  local subjects
  subjects=$(commits_since_last_deploy '%s')
  [ -n "$subjects" ] || { printf 'Routine redeploy; no commit history available.'; return 0; }

  printf '%s\n' "$subjects" \
    | awk 'NF { s = s (s ? "; " : "") $0 } END { print s }' \
    | awk -v max="$MAX_NOTE_WORDS" '{
        for (i = 1; i <= NF; i++) {
          if (n >= max) { clipped = 1; break }
          printf "%s%s", (n ? " " : ""), $i
          n++
        }
      } END { if (clipped) printf "..." }'
}

# Runs before the sync and the build so a bad --notes fails in a second rather
# than after a five-minute build, and so an interactive prompt never appears at
# the end of a run the user has walked away from.
prepare_release() {
  local current="" major minor patch

  if [ -n "$VERSION" ]; then
    case "$VERSION" in
      v*) VERSION="${VERSION#v}" ;;
    esac
    printf '%s' "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' \
      || fail "--version must look like 1.4.0, got: $VERSION"
  else
    current=$(grep -m1 -E '^#*[[:space:]]*Deploy v[0-9]+\.[0-9]+\.[0-9]+' "$VERSIONS_FILE" 2>/dev/null \
      | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
    if [ -z "$current" ]; then
      VERSION="1.0.0"
    else
      IFS=. read -r major minor patch <<< "$current"
      VERSION="$major.$minor.$((patch + 1))"
    fi
  fi

  step "Recording deploy v$VERSION"
  [ -n "$current" ] && note "previous: v$current"

  if [ -n "$NOTES" ]; then
    local words
    words=$(word_count "$NOTES")
    [ "$words" -le "$MAX_NOTE_WORDS" ] \
      || fail "--notes is $words words; the cap is $MAX_NOTE_WORDS (aim for ~50)"
    note "notes: $NOTES"
    return 0
  fi

  # No terminal to prompt on (CI, a pipe, nohup) — take the commits instead of
  # hanging on a read that will never be answered.
  if [ ! -t 0 ]; then
    NOTES=$(autogenerated_notes)
    note "no --notes and no terminal — summarising commits instead:"
    note "  $NOTES"
    return 0
  fi

  local recent
  recent=$(commits_since_last_deploy '%h %s')
  if [ -n "$recent" ]; then
    note ""
    note "Commits since the last recorded deploy:"
    printf '%s\n' "$recent" | head -10 | sed 's/^/      /'
  fi

  note ""
  note "Describe this deployment in one line (~50 words, $MAX_NOTE_WORDS max)."
  note "Leave it blank to summarise the commits above."

  local reply words
  while :; do
    printf '    > '
    IFS= read -r reply || reply=""
    if [ -z "$reply" ]; then
      NOTES=$(autogenerated_notes)
      note "using: $NOTES"
      return 0
    fi
    words=$(word_count "$reply")
    if [ "$words" -le "$MAX_NOTE_WORDS" ]; then
      NOTES="$reply"
      return 0
    fi
    note "that is $words words — trim it to $MAX_NOTE_WORDS or fewer."
  done
}

# --------------------------------------------------------------- 1. sync
sync_content() {
  step "Refreshing content and images"

  local result
  result=$(mktemp)
  # shellcheck disable=SC2064
  trap "rm -f '$result'" RETURN

  # No --remote: sync and mirror run, upload is skipped. The refreshed cache
  # ships inside deploy.zip instead.
  SYNC_RESULT_FILE="$result" "$REPO_ROOT/scripts/sync-content.sh" \
    || fail "content sync failed"

  [ -s "$result" ] || { note "sync produced no result summary"; return 0; }
  # shellcheck disable=SC1090
  . "$result"

  local changed=$(( ${CONTENT_NEW:-0} + ${CONTENT_UPDATED:-0} + ${CONTENT_REMOVED:-0} + ${IMAGES_NEW:-0} ))

  step "Sync result"
  if [ "$changed" -gt 0 ]; then
    note "Content:  ${CONTENT_SUMMARY:-unknown}"
    note "Images:   +${IMAGES_NEW:-0} new (${IMAGES_BEFORE:-0} -> ${IMAGES_AFTER:-0})"
    note ""
    note "Content changed — the new images go up inside deploy.zip."
  else
    note "Media up to date — nothing new since the last sync."
    note "Content:  ${CONTENT_SUMMARY:-0 new, 0 updated}"
    note "Images:   ${IMAGES_AFTER:-0} cached, 0 new"
  fi
}

# -------------------------------------------------------------- 2. build
build_app() {
  case "$(cd "$(dirname "$BUILD_DIR")" 2>/dev/null && pwd || echo "$BUILD_DIR")/" in
    "$REPO_ROOT"/*)
      fail "build dir must be outside the repo: $BUILD_DIR\n       Next would trace against the repo's pnpm node_modules and emit a\n       bundle of .pnpm symlinks that break on extraction." ;;
  esac

  step "Syncing sources into $BUILD_DIR"
  mkdir -p "$BUILD_DIR"
  # --delete keeps deleted source files from lingering; excluded paths are
  # protected from it, so the build's node_modules and .next survive.
  rsync -a --delete \
    --exclude node_modules --exclude .next --exclude .git \
    --exclude .media-cache --exclude .build --exclude .playwright-mcp \
    --exclude '*.zip' --exclude '*.tar.gz' \
    "$REPO_ROOT/" "$BUILD_DIR/"

  # npm, never pnpm: pnpm builds node_modules out of symlinks into a .pnpm
  # store, and those do not survive zip + extract on the host — the bundle then
  # dies on startup with MODULE_NOT_FOUND.
  local lock_hash="" prev_hash=""
  if [ -f "$BUILD_DIR/package-lock.json" ]; then
    lock_hash=$(shasum -a 256 "$BUILD_DIR/package-lock.json" 2>/dev/null | cut -d' ' -f1 || true)
  fi
  [ -f "$BUILD_DIR/.npm-lock-hash" ] && prev_hash=$(cat "$BUILD_DIR/.npm-lock-hash")

  if [ "$SKIP_INSTALL" = "1" ]; then
    step "Skipping npm install (--skip-install)"
    [ -d "$BUILD_DIR/node_modules/next" ] || fail "no node_modules in $BUILD_DIR to reuse"
  elif [ -d "$BUILD_DIR/node_modules/next" ] && [ -n "$lock_hash" ] && [ "$lock_hash" = "$prev_hash" ]; then
    step "Dependencies unchanged — reusing $BUILD_DIR/node_modules"
  else
    step "Installing dependencies with npm"
    (cd "$BUILD_DIR" && npm install --no-audit --no-fund)
    [ -n "$lock_hash" ] && echo "$lock_hash" > "$BUILD_DIR/.npm-lock-hash"
  fi

  local database_url
  database_url="${DATABASE_URL:-$(read_env DATABASE_URL)}"
  # Pages with `export const revalidate` are prerendered at build time and query
  # the database directly, so this is required, not optional.
  [ -n "$database_url" ] || fail "DATABASE_URL not set and not found in .env.local"

  [ -d "$CACHE_DIR" ] || note "warning: no $CACHE_DIR — image placeholders will not be baked in"

  step "Building the standalone bundle"
  rm -rf "$BUILD_DIR/.next"
  (
    cd "$BUILD_DIR"
    BUILD_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    MEDIA_CACHE_DIR="$CACHE_DIR" \
    DATABASE_URL="$database_url" \
      npm run build
  ) || fail "next build failed"
}

# ------------------------------------------------------------ 3. package
assemble_and_zip() {
  local build_dir="$1" output="$2"
  local standalone="$build_dir/.next/standalone"

  [ -d "$standalone" ] || fail "no standalone build at $standalone"

  # Anything not listed here is repo content the tracer swept up, not runtime code.
  local keep=(.next node_modules package.json public server.js)

  step "Copying static assets and public/"
  mkdir -p "$standalone/.next/static" "$standalone/public"
  cp -r "$build_dir/.next/static/." "$standalone/.next/static/"
  cp -r "$build_dir/public/." "$standalone/public/"

  step "Removing architecture-specific binaries"
  rm -rf "$standalone/node_modules/sharp" "$standalone/node_modules/@img"

  step "Materialising externalised-module symlinks"
  if [ -d "$standalone/.next/node_modules" ]; then
    (
      cd "$standalone/.next/node_modules"
      for entry in *; do
        [ -L "$entry" ] || continue
        # -e follows the link: false means the target is already gone, and
        # replacing it with nothing would remove the module entirely.
        [ -e "$entry" ] || fail "dangling symlink: $entry -> $(readlink "$entry")"
        target=$(readlink "$entry")
        cp -RL "$target" "$entry.materialising" || fail "could not copy $target"
        rm "$entry"
        mv "$entry.materialising" "$entry"
        echo "    $entry"
      done
    )
  fi

  step "Pruning source files the tracer swept up"
  local removed=0 entry name allowed keep_it
  for entry in "$standalone"/* "$standalone"/.[!.]*; do
    [ -e "$entry" ] || continue
    name=$(basename "$entry")
    keep_it=0
    for allowed in "${keep[@]}"; do
      [ "$name" = "$allowed" ] && keep_it=1 && break
    done
    if [ "$keep_it" = "0" ]; then
      rm -rf "$entry"
      removed=$((removed + 1))
    fi
  done
  note "removed $removed entries; kept: ${keep[*]}"

  step "Verifying the bundle"

  local links native archives
  links=$(find "$standalone" -type l)
  if [ -n "$links" ]; then
    if printf '%s' "$links" | head -1 | xargs readlink 2>/dev/null | grep -q '\.pnpm'; then
      fail "bundle links into the pnpm store — it was built against the repo's\n       node_modules instead of an npm tree. Build outside the repo.\n$links"
    fi
    fail "symlinks would not survive extraction:\n$links"
  fi

  native=$(find "$standalone" -name '*.node')
  [ -z "$native" ] || fail "architecture-specific binaries present:\n$native"

  archives=$(find "$standalone" \( -name '*.zip' -o -name '*.tar.gz' \))
  [ -z "$archives" ] || fail "stray archives (a previous bundle got traced in):\n$archives"

  [ -d "$standalone/public/public" ] && fail "public/ nested inside itself"

  local required
  for required in server.js package.json .next/BUILD_ID .next/static public \
                  node_modules/next node_modules/react node_modules/react-dom node_modules/styled-jsx; do
    [ -e "$standalone/$required" ] || fail "missing from bundle: $required"
  done

  # Catches dependencies stripped down to a bare package.json — the failure mode
  # outputFileTracingExcludes produced, which only surfaces as a 500 at runtime.
  if [ -d "$standalone/.next/node_modules" ]; then
    local shim main
    for shim in "$standalone"/.next/node_modules/*; do
      [ -d "$shim" ] || continue
      main=$(node -e "
        try {
          const pkg = require('$shim/package.json');
          process.stdout.write(pkg.main || 'index.js');
        } catch { process.stdout.write(''); }
      ")
      [ -n "$main" ] || fail "$(basename "$shim") has no readable package.json"
      [ -e "$shim/$main" ] || fail "$(basename "$shim") is missing its entry point ($main) — dependency was stripped"
    done
  fi

  local pages
  pages=$(find "$standalone/.next/server/app" -name '*.html' | wc -l | tr -d ' ')
  note "$pages prerendered pages, no symlinks, no native binaries, no source tree"

  step "Writing $output"
  rm -f "$output"
  (cd "$standalone" && zip -qr "$output" .)
}

# The cache is appended to the finished zip rather than staged into the build
# directory: it is 60MB of content-hashed blobs that would otherwise be copied
# on every run and have to be excused from the prune and verify passes.
append_media_cache() {
  local output="$1"

  step "Adding the image cache to the bundle"

  if [ ! -d "$CACHE_DIR" ]; then
    note "no $CACHE_DIR — shipping without cached images"
    note "article images will 404 until scripts/sync-content.sh has run"
    return 0
  fi

  # -0 stores rather than deflates. The cached bytes are WebP, already
  # compressed: deflating them takes five times as long and saves ~0.5%.
  #
  # cd to the cache's parent, not the repo root — MEDIA_CACHE_DIR can point
  # outside the repo, and the entries must still be .media-cache/* so they land
  # beside server.js where the runtime looks for them.
  (
    cd "$(dirname "$CACHE_DIR")"
    zip -qr0 "$output" "$(basename "$CACHE_DIR")"
  ) || fail "could not add the image cache to $output"

  note "$(find "$CACHE_DIR" -name '*.bin' | wc -l | tr -d ' ') images"
}

# ------------------------------------------------------------- 4. record
write_version_entry() {
  step "Prepending v$VERSION to VERSIONS.md"

  # Same directory as the target so mv is a rename, not a cross-device copy that
  # could leave VERSIONS.md truncated if it failed halfway.
  local tmp
  tmp=$(mktemp "$REPO_ROOT/.VERSIONS.md.XXXXXX")

  {
    printf 'Deploy v%s\n%s\n' "$VERSION" "$NOTES"
    if [ -s "$VERSIONS_FILE" ]; then
      printf '\n'
      cat "$VERSIONS_FILE"
    fi
  } > "$tmp"

  mv "$tmp" "$VERSIONS_FILE"
  # mktemp creates at 0600; this file is committed, so restore normal read bits.
  chmod a+r "$VERSIONS_FILE"
  note "$NOTES"
}

# ------------------------------------------------------------------ main
resolve_output

if [ "$PACKAGE_ONLY" = "1" ]; then
  assemble_and_zip "$BUILD_DIR" "$OUTPUT"
  append_media_cache "$OUTPUT"
  step "Done"
  note "$(basename "$OUTPUT")  $(du -h "$OUTPUT" | cut -f1)"
  exit 0
fi

if [ "$NO_VERSION" = "1" ]; then
  step "Not recording a version (--no-version)"
else
  prepare_release
fi

if [ "$SKIP_SYNC" = "1" ]; then
  step "Skipping content sync (--skip-sync)"
else
  sync_content
fi

if [ "$SKIP_BUILD" = "1" ]; then
  step "Skipping build (--skip-build)"
else
  build_app
fi

assemble_and_zip "$BUILD_DIR" "$OUTPUT"
append_media_cache "$OUTPUT"

# Only after the zip exists — a run that dies during the build must not leave a
# version recorded for a deployment that was never produced.
[ "$NO_VERSION" = "1" ] || write_version_entry

# There is one artifact now. Clear the old tarball so nobody scp's a stale copy
# of it out of habit.
if [ -f "$LEGACY_MEDIA_ARCHIVE" ]; then
  rm -f "$LEGACY_MEDIA_ARCHIVE"
  note "removed the obsolete $(basename "$LEGACY_MEDIA_ARCHIVE") — deploy.zip carries the cache now"
fi

step "Done"
note "$(basename "$OUTPUT")  $(du -h "$OUTPUT" | cut -f1)  $(unzip -l "$OUTPUT" | tail -1 | awk '{print $2}') files"
[ "$NO_VERSION" = "1" ] || note "VERSIONS.md  now at v$VERSION"

cat <<EOF

    One archive, one extract:
      scp $(basename "$OUTPUT") user@host:~/

      cd ~/csewiki
      rm -rf node_modules .next server.js public package.json   # by name
      : > stderr.log
      unzip -oq ~/$(basename "$OUTPUT") -d ~/csewiki

    Then restart the app in cPanel.

    -o overwrites without prompting, and .media-cache/ is intentionally not in
    the delete list: sync-content.sh --remote can add images to the server
    between deploys, and the cache merges rather than being replaced.
EOF
