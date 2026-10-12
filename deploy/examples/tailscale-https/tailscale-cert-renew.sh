#!/bin/sh
# Fetch or renew the Let's Encrypt certificate for this machine's Tailscale name.
set -eu
name=$(tailscale status --json | python3 -c 'import json, sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
tailscale cert --cert-file /etc/ssl/tailscale/ebook-reader.crt --key-file /etc/ssl/tailscale/ebook-reader.key "$name"
