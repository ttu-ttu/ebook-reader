#!/bin/bash
# Fetches the CONscripter web engine (GPL-2.0, https://github.com/blankiekun/CONscripter, a fork of
# ONScripter-yuri) from its newest GitHub release (CONSCRIPTER_TAG=<tag> picks another) into
# apps/web/static/vn/. Needs curl and 7z, or curl and Docker. The files are committed, so this only
# runs when CONscripter has a new release.
set -euo pipefail

REPO=https://github.com/blankiekun/CONscripter

here=$(cd "$(dirname "$0")" && pwd)
out=$here/../../apps/web/static/vn
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# releases/latest redirects to .../releases/tag/<tag>.
tag=${CONSCRIPTER_TAG:-$(curl -fsSLI -o /dev/null -w '%{url_effective}' "$REPO/releases/latest" | sed 's|.*/tag/||')}
[ -n "$tag" ] || { echo "No CONscripter release found" >&2; exit 1; }
curl -fsSL -o "$work/web.7z" "$REPO/releases/download/$tag/conscripter_${tag}_web.7z"

files=(conscripter_web/conscripter.js conscripter_web/conscripter.wasm)
if command -v 7z >/dev/null; then
  7z e -y -o"$work" "$work/web.7z" "${files[@]}" >/dev/null
else
  docker run --rm -i debian:13-slim bash -c \
    'apt-get -qq update >/dev/null && apt-get -qq install -y 7zip >/dev/null 2>&1 &&
     cat > /w.7z && 7z e -y -o/o /w.7z "$@" >/dev/null && tar -C /o -cf - .' _ "${files[@]}" \
    < "$work/web.7z" | tar -C "$work" -xf -
fi

# The app's overlay, choices, progress and Anki need the text hooks (CONscripter v0.9.0 and later).
grep -q onsyuriOverlay "$work/conscripter.js" || { echo "CONscripter $tag has no text hooks" >&2; exit 1; }

mkdir -p "$out"
cp "$work/conscripter.js" "$work/conscripter.wasm" "$out/"
echo "$tag" > "$out/conscripter-version.txt"
echo "Copied CONscripter $tag to $out"
