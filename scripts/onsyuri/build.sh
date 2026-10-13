#!/bin/bash
# Builds the CONscripter web engine (GPL-2.0, https://github.com/blankiekun/CONscripter, a fork
# of ONScripter-yuri) with text-hook.patch into apps/web/static/vn/. Needs git and Docker. The built files are
# committed, so this only runs when the engine or the patch changes.
set -euo pipefail

ONSYURI_COMMIT=08f744b31cc1907b66a15f0402e62321a131ed81
EMSDK_IMAGE=emscripten/emsdk:6.0.12

here=$(cd "$(dirname "$0")" && pwd)
out=$here/../../apps/web/static/vn
work=$(mktemp -d)
trap 'docker run --rm -v "$work:/w" debian:13-slim rm -rf /w/src; rm -rf "$work"' EXIT

git clone -q https://github.com/blankiekun/CONscripter.git "$work/src"
git -C "$work/src" checkout -q "$ONSYURI_COMMIT"
git -C "$work/src" apply "$here/text-hook.patch"

docker run --rm -v "$work/src:/src" -w /src/script "$EMSDK_IMAGE" \
  bash -c 'EMSDK_HOME=/emsdk bash cross_web.sh'

mkdir -p "$out"
cp "$work/src/build_web/onsyuri.js" "$work/src/build_web/onsyuri.wasm" "$out/"
echo "Built $out/onsyuri.js and onsyuri.wasm"
