#!/bin/bash
# Builds the CONscripter web engine (GPL-2.0, https://github.com/blankiekun/CONscripter, a fork
# of ONScripter-yuri) with text-hook.patch into apps/web/static/vn/. Needs git and Docker. The built files are
# committed, so this only runs when the engine or the patch changes.
set -euo pipefail

ONSYURI_COMMIT=d65a3b40efbf557d95bfd3075b25307c0374720b
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
# CONscripter renamed the build to conscripter.*; older commits produce onsyuri.*. player.js loads onsyuri.*.
name=conscripter
[ -e "$work/src/build_web/$name.js" ] || name=onsyuri
cp "$work/src/build_web/$name.js" "$out/onsyuri.js"
cp "$work/src/build_web/$name.wasm" "$out/onsyuri.wasm"
echo "Built $out/onsyuri.js and onsyuri.wasm"
