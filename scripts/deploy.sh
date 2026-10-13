#!/bin/bash
# Deploy the current working tree (including uncommitted changes) to a server
# and (re)start the Docker stack there. Settings come from local/ (gitignored):
#
#   local/deploy.env                   where to deploy (see deploy/deploy.env.example)
#   local/env                          the stack's settings (.env.example)
#   local/docker-compose.override.yml  optional, e.g. deploy/examples/tailscale-https
#
# On the server: the source goes to /opt/ebook-reader, the settings to
# /etc/ebook-reader, and ebook-compose / ebook-account / ebook-update to
# /usr/local/bin (ebook-update's systemd units are installed when DATA_PATH is
# absolute, for updates from the admin panel). Images are built there; the
# running stack is only replaced if every image builds, and the previous images
# stay tagged :previous.
# Restarting the stack stops a running difficulty job.
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
LOCAL="${DEPLOY_CONFIG:-$REPO_ROOT/local}"
VERSION="$(git -C "$REPO_ROOT" describe --tags --always --long --dirty)"

if [ ! -f "$LOCAL/deploy.env" ] || [ ! -f "$LOCAL/env" ]; then
  echo "Missing $LOCAL/deploy.env or $LOCAL/env: copy deploy/deploy.env.example and .env.example there." >&2
  exit 1
fi
# shellcheck source=/dev/null
. "$LOCAL/deploy.env"
: "${TARGET:?set TARGET in $LOCAL/deploy.env}"

# Runs a command on the server as root; stdin is passed through.
run() {
  case "$TARGET" in
    pct:*) sudo pct exec "${TARGET#pct:}" -- "$@" ;;
    # SSH_OPTIONS is split into words on purpose; the command is quoted here and run there.
    # shellcheck disable=SC2029,SC2086
    ssh:*) ssh ${SSH_OPTIONS:-} "${TARGET#ssh:}" "${REMOTE_SUDO:-} $(printf '%q ' "$@")" ;;
    local) if [ "$(id -u)" = 0 ]; then "$@"; else sudo "$@"; fi ;;
    *) echo "Unknown TARGET '$TARGET' (pct:<id>, ssh:<user@host> or local)" >&2; exit 1 ;;
  esac
}

# Copies a local file to the server: put <file> <destination> <mode>.
put() {
  run sh -c 'cat > "$1" && chmod "$2" "$1"' sh "$2" "$3" < "$1"
}

echo "Deploying ${VERSION} to ${TARGET}..."

tar -C "$REPO_ROOT" \
  --exclude=.git --exclude=node_modules --exclude=build --exclude=.svelte-kit \
  --exclude=./local --exclude=./CLAUDE.local.md --exclude=apps/web/.env.local \
  --exclude=./.env --exclude=./data \
  -czf - . \
  | run bash -c 'set -euo pipefail; rm -rf /opt/ebook-reader && mkdir -p /opt/ebook-reader && tar -C /opt/ebook-reader -xzf -'

run install -d -m 755 /etc/ebook-reader
put "$LOCAL/env" /etc/ebook-reader/env 600
if [ -f "$LOCAL/docker-compose.override.yml" ]; then
  put "$LOCAL/docker-compose.override.yml" /etc/ebook-reader/docker-compose.override.yml 644
else
  run rm -f /etc/ebook-reader/docker-compose.override.yml
fi
for command in ebook-compose ebook-account ebook-update; do
  put "$REPO_ROOT/deploy/server/$command" "/usr/local/bin/$command" 755
done

# shellcheck disable=SC2016 # expands on the server
run env LANG=C.UTF-8 VERSION="$VERSION" bash -c '
  set -euo pipefail
  compose=/usr/local/bin/ebook-compose
  for image in $($compose config --images | sort -u); do
    docker image tag "$image" "${image%:*}:previous" 2>/dev/null || true
  done
  $compose build --quiet
  $compose up -d --remove-orphans
  docker image prune -f >/dev/null
  if [ -d /run/systemd/system ]; then
    /usr/local/bin/ebook-update install || echo "Updates from the admin panel stay off (see above)"
  fi
'

# The first admin account and its temporary password, until it has signed in.
run /usr/local/bin/ebook-account initial-admin || true

echo "Deployed ${VERSION}${SITE_URL:+ -> $SITE_URL} (previous images tagged :previous)"
