#!/usr/bin/env bash
#
# Turns a completed `BUILD_STANDALONE=1 next build` into deploy.zip.
#
# Every step here exists because of a failure that reached production or came
# close to it:
#
#   - assets are copied with a trailing /. so they merge into the directory
#     Next already created, instead of nesting as public/public
#   - sharp is dropped; it is the only architecture-specific file in the bundle
#     and the host is x86_64 while builds happen on arm64
#   - the externalised-module symlinks under .next/node_modules are turned into
#     real directories, so zip/extract behaviour on the host cannot matter
#   - the source tree is pruned. /api/media resolves its cache through
#     process.cwd(), which defeats Next's output tracer and makes it copy the
#     whole project root — Dockerfile, README, tests and all. Pruning is done
#     here rather than via outputFileTracingExcludes, whose globs are not
#     anchored and will strip node_modules/<pkg>/lib as readily as ./lib
#
# Usage: scripts/package-bundle.sh <build-dir> <output-zip>

set -euo pipefail

BUILD_DIR="${1:?usage: package-bundle.sh <build-dir> <output-zip>}"
OUTPUT="${2:?usage: package-bundle.sh <build-dir> <output-zip>}"

STANDALONE="$BUILD_DIR/.next/standalone"
[ -d "$STANDALONE" ] || { echo "error: no standalone build at $STANDALONE" >&2; exit 1; }

# Anything not listed here is repo content the tracer swept up, not runtime code.
KEEP=(.next node_modules package.json public server.js)

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31merror:\033[0m %s\n' "$1" >&2; exit 1; }

step "Copying static assets and public/"
mkdir -p "$STANDALONE/.next/static" "$STANDALONE/public"
cp -r "$BUILD_DIR/.next/static/." "$STANDALONE/.next/static/"
cp -r "$BUILD_DIR/public/." "$STANDALONE/public/"

step "Removing architecture-specific binaries"
rm -rf "$STANDALONE/node_modules/sharp" "$STANDALONE/node_modules/@img"

step "Materialising externalised-module symlinks"
if [ -d "$STANDALONE/.next/node_modules" ]; then
  (
    cd "$STANDALONE/.next/node_modules"
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
removed=0
for entry in "$STANDALONE"/* "$STANDALONE"/.[!.]*; do
  [ -e "$entry" ] || continue
  name=$(basename "$entry")
  keep=0
  for allowed in "${KEEP[@]}"; do
    [ "$name" = "$allowed" ] && keep=1 && break
  done
  if [ "$keep" = "0" ]; then
    rm -rf "$entry"
    removed=$((removed + 1))
  fi
done
echo "    removed $removed entries; kept: ${KEEP[*]}"

step "Verifying the bundle"

links=$(find "$STANDALONE" -type l)
[ -z "$links" ] || fail "symlinks would not survive extraction:\n$links"

native=$(find "$STANDALONE" -name '*.node')
[ -z "$native" ] || fail "architecture-specific binaries present:\n$native"

archives=$(find "$STANDALONE" \( -name '*.zip' -o -name '*.tar.gz' \))
[ -z "$archives" ] || fail "stray archives (a previous bundle got traced in):\n$archives"

[ -d "$STANDALONE/public/public" ] && fail "public/ nested inside itself"

for required in server.js package.json .next/BUILD_ID .next/static public \
                node_modules/next node_modules/react node_modules/react-dom node_modules/styled-jsx; do
  [ -e "$STANDALONE/$required" ] || fail "missing from bundle: $required"
done

# Catches dependencies stripped down to a bare package.json — the failure mode
# outputFileTracingExcludes produced, which only surfaces as a 500 at runtime.
if [ -d "$STANDALONE/.next/node_modules" ]; then
  for shim in "$STANDALONE"/.next/node_modules/*; do
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

pages=$(find "$STANDALONE/.next/server/app" -name '*.html' | wc -l | tr -d ' ')
echo "    $pages prerendered pages, no symlinks, no native binaries, no source tree"

step "Writing $OUTPUT"
rm -f "$OUTPUT"
OUTPUT_ABS=$(cd "$(dirname "$OUTPUT")" && pwd)/$(basename "$OUTPUT")
(cd "$STANDALONE" && zip -qr "$OUTPUT_ABS" .)

echo "    $(du -h "$OUTPUT_ABS" | cut -f1)  $(unzip -l "$OUTPUT_ABS" | tail -1 | awk '{print $2}') files"
