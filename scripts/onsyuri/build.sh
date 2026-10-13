#!/bin/bash
# Builds the CONscripter web engine (GPL-2.0, https://github.com/blankiekun/CONscripter, a fork
# of ONScripter-yuri) with text-hook.patch into apps/web/static/vn/. Needs git and Docker. The built files are
# committed, so this only runs when the engine or the patch changes (e.g. a new CONscripter release).
set -euo pipefail

REPO=https://github.com/blankiekun/CONscripter.git
# The newest release tag; CONSCRIPTER_REF=<tag or commit> builds another one.
ref=${CONSCRIPTER_REF:-$(git ls-remote --tags --refs --sort=-v:refname "$REPO" 'v*' | head -n1 | sed 's|.*refs/tags/||')}
[ -n "$ref" ] || { echo "No CONscripter release tag found" >&2; exit 1; }
EMSDK_IMAGE=emscripten/emsdk:6.0.12

here=$(cd "$(dirname "$0")" && pwd)
out=$here/../../apps/web/static/vn
work=$(mktemp -d)
trap 'docker run --rm -v "$work:/w" debian:13-slim rm -rf /w/src; rm -rf "$work"' EXIT

git clone -q "$REPO" "$work/src"
git -C "$work/src" checkout -q "$ref"
git -C "$work/src" apply "$here/text-hook.patch"

docker run --rm -v "$work/src:/src" -w /src/script "$EMSDK_IMAGE" \
  bash -c 'EMSDK_HOME=/emsdk bash cross_web.sh'

mkdir -p "$out"
# CONscripter renamed the build to conscripter.*; older commits produce onsyuri.*. player.js loads onsyuri.*.
name=conscripter
[ -e "$work/src/build_web/$name.js" ] || name=onsyuri
cp "$work/src/build_web/$name.js" "$out/onsyuri.js"
cp "$work/src/build_web/$name.wasm" "$out/onsyuri.wasm"
echo "Built $out/onsyuri.js and onsyuri.wasm from CONscripter $ref"
