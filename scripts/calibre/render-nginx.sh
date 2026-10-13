#!/bin/sh
# Prints nginx-ebook-reader.conf.template with the settings below filled in.
# Defaults are the Docker layout (the web container runs it at start).
set -eu

: "${WEB_ROOT:=/srv/www}"
: "${LIBRARY_DIR:=/library}"
: "${VN_DIR:=/vn}"
: "${SYNC_DIR:=/data/sync}"
: "${ACCOUNT_DATA_DIR:=/data/accounts}"
: "${CATALOG_FILE:=/data/state/catalog/catalog.json}"
: "${DIFFICULTY_FILE:=/data/state/difficulty/difficulty.json}"
: "${ACCOUNT_UPSTREAM:=account:8766}"
: "${IMPORT_UPSTREAM:=import:8767}"
: "${DIFFICULTY_UPSTREAM:=difficulty:8765}"
# Signed-out readers from these networks may read the library and write the
# shared sync folder; empty (the default) = always require an account. Never
# 172.16.0.0/12: that is Docker's own range, where a reverse proxy on the same
# host connects from, so every internet visitor would count as trusted.
: "${TRUSTED_NETWORKS:=}"
# 1 = anyone who can reach the server may read the library without signing in.
: "${PUBLIC_READS:=0}"
case "$PUBLIC_READS" in 0|1) ;; *) echo "PUBLIC_READS must be 0 or 1" >&2; exit 1 ;; esac

# The secret nginx sends the services (X-Internal-Token), made by the web container.
: "${INTERNAL_TOKEN_FILE:=/data/state/internal-token}"
INTERNAL_TOKEN=$(cat "$INTERNAL_TOKEN_FILE" 2>/dev/null || true)
case "$INTERNAL_TOKEN" in
  '') echo "WARNING: no $INTERNAL_TOKEN_FILE: the services will refuse every request" >&2 ;;
  *[!0-9a-f]*) echo "$INTERNAL_TOKEN_FILE must hold hex digits only" >&2; exit 1 ;;
esac

TRUSTED_NETWORKS_GEO=$(for network in $TRUSTED_NETWORKS; do printf '  %s 1;\n' "$network"; done)

export WEB_ROOT LIBRARY_DIR VN_DIR SYNC_DIR ACCOUNT_DATA_DIR CATALOG_FILE DIFFICULTY_FILE \
  ACCOUNT_UPSTREAM IMPORT_UPSTREAM DIFFICULTY_UPSTREAM TRUSTED_NETWORKS_GEO PUBLIC_READS INTERNAL_TOKEN

# Only these names: the template's own nginx variables ($host, ...) stay as they are.
envsubst '${WEB_ROOT} ${LIBRARY_DIR} ${VN_DIR} ${SYNC_DIR} ${ACCOUNT_DATA_DIR} ${CATALOG_FILE} ${DIFFICULTY_FILE} ${ACCOUNT_UPSTREAM} ${IMPORT_UPSTREAM} ${DIFFICULTY_UPSTREAM} ${TRUSTED_NETWORKS_GEO} ${PUBLIC_READS} ${INTERNAL_TOKEN}' \
  < "$(dirname "$0")/nginx-ebook-reader.conf.template"
