#!/bin/sh
# Runs before nginx starts (official image's /docker-entrypoint.d): creates the
# data folders for PUID/PGID, runs the nginx workers as that user (they write
# the WebDAV folders the Python services also use) and renders the site config.
set -eu

PUID=${PUID:-1000}
PGID=${PGID:-1000}

group=$(awk -F: -v id="$PGID" '$3 == id { print $1; exit }' /etc/group)
if [ -z "$group" ]; then
  addgroup -g "$PGID" ebook
  group=ebook
fi
user=$(awk -F: -v id="$PUID" '$3 == id { print $1; exit }' /etc/passwd)
if [ -z "$user" ]; then
  adduser -D -H -u "$PUID" -G "$group" -s /sbin/nologin ebook
  user=ebook
fi
sed -i "s/^user .*;/user $user;/" /etc/nginx/nginx.conf
chown -R "$PUID:$PGID" /var/cache/nginx

# The services run as PUID and can't create these in a root-owned /data.
for dir in /data /data/sync /data/sync/.tmp /data/accounts /data/accounts/.tmp /data/state \
  /data/state/account /data/state/catalog /data/state/import /data/state/difficulty \
  /data/state/update; do
  mkdir -p "$dir"
  chown "$PUID:$PGID" "$dir"
done

mkdir -p /etc/nginx/ebook-reader.d
{
  # Docker's DNS, for the service names in the config.
  echo 'resolver 127.0.0.11 valid=10s ipv6=off;'
  if [ -n "${REAL_IP_FROM:-}" ]; then
    for network in $REAL_IP_FROM; do echo "set_real_ip_from $network;"; done
    echo 'real_ip_header X-Forwarded-For;'
    echo 'real_ip_recursive on;'
  fi
} > /etc/nginx/ebook-reader.d/docker.conf

case " ${TRUSTED_NETWORKS:-} " in
  *" 172."*)
    [ -n "${REAL_IP_FROM:-}" ] ||
      echo "WARNING: TRUSTED_NETWORKS includes 172.x (Docker's network) without REAL_IP_FROM: visitors through a reverse proxy on this host count as trusted." >&2 ;;
esac

rm -f /etc/nginx/conf.d/default.conf
/opt/ebook-reader/render-nginx.sh > /etc/nginx/conf.d/ebook-reader.conf
