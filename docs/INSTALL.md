# Installing with Docker

Runs the reader with a Calibre library on any Linux server with Docker and the
Compose plugin. For the reader alone (books stored in the browser, no server
features) use `docker compose -f docker-compose.static.yml up -d` instead.

## What runs

| Service      | Image target | What it does                                                  |
| ------------ | ------------ | ------------------------------------------------------------- |
| `web`        | web          | nginx: the app, book files, WebDAV sync, access checks        |
| `account`    | base         | accounts, sign-in, permissions (Python standard library)      |
| `catalog`    | base         | rebuilds `catalog.json` from `metadata.db`, extracts covers   |
| `import`     | import       | optional (`--profile import`): adds uploaded books to Calibre |
| `difficulty` | difficulty   | optional (`--profile difficulty`): difficulty estimates       |

`import` installs Calibre and `difficulty` installs Sudachi and ONNX Runtime,
so both images are large; leave them out unless you want those features.

## Setup

```sh
git clone <this repository> ebook-reader && cd ebook-reader
cp .env.example .env        # set LIBRARY_PATH, PUID/PGID, HTTP_PORT
docker compose up -d --build
docker compose exec account ebook-account initial-admin
```

The first start creates the admin account `admin` with a temporary password;
`ebook-account initial-admin` (or `docker compose logs account`) shows it until
that account has signed in. Change it in Settings → Account afterwards.

- `LIBRARY_PATH` is the Calibre library folder (the one with `metadata.db`).
  `PUID`/`PGID` must be able to read it; the catalog also writes `cover.jpg`
  into book folders that have no cover, and the import profile adds books.
- Everything the server stores is in `DATA_PATH` (default `./data`):
  `sync/` (shared processed books and signed-out progress), `accounts/`
  (each account's progress, highlights and settings, including AI API keys),
  `state/` (account database, catalog, import queue, difficulty results).
  Back up `DATA_PATH`. Keep it off shares other machines can read.
- Open `http://<server>:HTTP_PORT/`. The library shows the Calibre catalog
  after the first catalog run (a minute or so; large libraries take longer
  the first time because of cover extraction).

## HTTPS

Signing in, offline mode and installing the app need HTTPS. The stack only
serves HTTP; put one of these in front of `HTTP_PORT`:

- **Caddy** (automatic Let's Encrypt certificate):

  ```
  books.example.com {
    reverse_proxy 127.0.0.1:8080
  }
  ```

- **Traefik / Nginx Proxy Manager**: proxy the host to `HTTP_PORT`; keep the
  `Host` header and send `X-Forwarded-Proto` and `X-Forwarded-For` (both do by default).
- **Tailscale**: `tailscale serve --bg 8080` on the server gives
  `https://<machine>.<tailnet>.ts.net` inside your tailnet. Or let nginx use a
  Tailscale certificate itself:
  [deploy/examples/tailscale-https](../deploy/examples/tailscale-https/README.md).

Then set in `.env`:

- `REAL_IP_FROM`: the proxy's address as nginx sees it (for a proxy on the
  same host, Docker's gateway, e.g. `172.16.0.0/12`). Without it every visitor
  appears to come from the proxy. That is safe with the default
  `TRUSTED_NETWORKS` (Docker's range isn't in it, so everyone just needs an
  account), but sign-in throttling then counts all visitors as one address.
- `PUBLIC_HTTPS_URL` if people also use a plain-HTTP address with a different
  name; the HTTP page links there to sign in. Rebuild with `docker compose build web`.

## Accounts and permissions

Signing in needs HTTPS. On a home network without it you can set
`ALLOW_HTTP_ACCOUNTS=1`: sign-in, the admin panel and adding books then also
work on the plain-HTTP address, with a warning in the app, but passwords,
sessions and synced settings (including AI API keys) cross the network
unencrypted. Leave it off if anyone else can see the network.

There is no sign-up. Admins add accounts in the admin panel (Settings → Account → Open admin
panel), or with `docker compose exec account ebook-account ...`
(`add NAME [--admin]`, `passwd NAME`, `remove NAME`, `admin NAME on|off`,
`permissions NAME import,series,difficulty`, `list`).

| Who                                    | May                                                                  |
| -------------------------------------- | -------------------------------------------------------------------- |
| anyone who can reach the server        | load the app; with `PUBLIC_READS=1` also browse and download books   |
| signed out, from `TRUSTED_NETWORKS`    | read the library, open books, save progress in the shared folder    |
| any account                            | the above from anywhere, plus its own synced progress and settings  |
| permission `import` / `series` / `difficulty` | add books to Calibre / change series for everyone / start estimates |
| admin                                  | everything, and manage accounts and permissions                      |

`TRUSTED_NETWORKS` defaults to the usual home ranges (`10.0.0.0/8`,
`192.168.0.0/16`, Tailscale's `100.64.0.0/10`). Set it empty to require an
account for everything, e.g. when the server is reachable from the internet.
Don't add `172.16.0.0/12`: that is Docker's own network, so a reverse proxy on
the same host would make every visitor trusted (the web container warns).

Give `import` only to people you trust: it runs Calibre on their uploads.

### Built-in protections

- Files in the sync folders are served as downloads, never as pages.
- Book HTML is parsed without running anything and cleaned of scripts and
  event handlers; a Content-Security-Policy only allows the app's own scripts.
- Sign-in throttling counts per username and address, so strangers can't lock
  you out; uploads stop when the data disk has less than `MIN_FREE_MB` free.
- Security headers (HSTS behind HTTPS, nosniff, framing, referrer).

## Deploying from a checkout

To develop on one machine and run the stack on another, `scripts/deploy.sh`
copies the working tree to the server, builds there and restarts the stack
(the running stack stays if a build fails; the previous images are kept as
`:previous`). Put your settings in `local/` (gitignored):

- `local/deploy.env` from `deploy/deploy.env.example`: the target, a Proxmox
  container (`pct:<id>`), an SSH host (`ssh:root@host`) or this machine (`local`);
- `local/env` from `.env.example`;
- optionally `local/docker-compose.override.yml`, e.g.
  [deploy/examples/tailscale-https](../deploy/examples/tailscale-https/README.md).

On the server the source goes to `/opt/ebook-reader` and the settings to
`/etc/ebook-reader`; `ebook-compose` (= `docker compose` for the stack),
`ebook-account`, `jiten-difficulty-import` and `ebook-update` are installed in
`/usr/local/bin`. The end of the output shows the first admin's temporary
password until that account has signed in.
Roll back with
`for i in $(ebook-compose config --images); do docker image tag "${i%:*}:previous" "$i"; done; ebook-compose up -d`.

## Updating

Servers set up with `scripts/deploy.sh` (systemd, an absolute `DATA_PATH`) can
update from the admin panel: Tools → Updates compares the server with the main
branch of `UPDATE_REPO` on GitHub, and "Update" makes `ebook-update` (a systemd
path unit installed by the deploy) download that commit, rebuild the images and
restart the stack. A failed build keeps the running version; the previous images
stay tagged `:previous`. Its log: `journalctl -u ebook-update`.

Otherwise:

```sh
git pull && docker compose up -d --build
```

Or use published images instead of building (no Node or Calibre download on the
server, amd64 and arm64): set `IMAGE_PREFIX=ghcr.io/<owner>/<repository>` and
`IMAGE_TAG` to a release (or `latest`) in `.env`, then

```sh
docker compose pull && docker compose up -d
```

## Difficulty estimates

The `difficulty` profile needs Jiten's word frequency list: download
`jiten_freq_global.zip` from https://jiten.moe/frequency-dictionaries and save
it as `DATA_PATH/state/difficulty/frequency-dictionary.zip`.

## Difficulty estimates on a faster computer

See `scripts/calibre/jiten/README-offline.md`. Copy its `output/` folder into
`DATA_PATH` (e.g. `data/difficulty-import/`), then:

```sh
docker compose exec difficulty /opt/venv/bin/python /app/jiten/service.py import /data/difficulty-import
```
