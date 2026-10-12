# Configuration reference

Everything that can be configured, by where it is set. Most installs only touch
the first table (`.env` for `docker-compose.yml`, see [INSTALL.md](INSTALL.md)).
Per-person settings such as AI keys, the voice and the AI models are not here:
each reader enters them in Settings → AI, and they sync with their account.

## `.env` (Docker Compose)

| Variable              | Default                                                | What it does |
| --------------------- | ------------------------------------------------------ | ------------ |
| `LIBRARY_PATH`        | required                                               | The Calibre library (the folder with `metadata.db`). Mounted read-only into the web server; the catalog and import services write to it (`cover.jpg` for books without a cover, new books). |
| `DATA_PATH`           | `./data`                                               | Everything the server stores: `sync/` (shared processed books and signed-out progress), `accounts/` (per-account data, including synced AI keys), `state/` (account database, catalog, import queue, difficulty results). Back it up; keep it off shares others can read. |
| `VN_PATH`             | `DATA_PATH/vn`                                         | Visual novels: one unpacked ONScripter game per folder (the folder holding `0.txt`, `00.txt` or `nscript.dat`, or one level above it). The folder name is the title; a `cover.jpg`/`.png`/`.webp` or `icon.png` in it is the cover. Mounted read-only; served to signed-in readers at `/calibre/vn/` and listed in the catalog. The player fetches each file when the game opens it, so games aren't downloaded whole. |
| `SYNC_PATH`           | `DATA_PATH/sync`                                       | The shared sync folder, if it should live elsewhere (e.g. next to the library on a NAS); account data stays in `DATA_PATH`. |
| `PUID`, `PGID`        | `1000`                                                 | User and group the containers run as. Must be able to read the library (and write to it for covers and imports) and own `DATA_PATH`. |
| `HTTP_PORT`           | `8080`                                                 | Host port of the web server (plain HTTP). Put an HTTPS reverse proxy in front of it. |
| `PUBLIC_HTTPS_URL`    | empty                                                  | The HTTPS address, if people also use a plain-HTTP address with a different name: the HTTP page links there to sign in. Build-time (`docker compose build web` after changing). |
| `REAL_IP_FROM`        | empty                                                  | Addresses of your reverse proxy (space-separated, CIDR allowed). nginx then takes the client address from `X-Forwarded-For`, so `TRUSTED_NETWORKS` and sign-in throttling see real visitors. |
| `TRUSTED_NETWORKS`    | empty                                                  | Signed-out visitors from these networks may read the library and save to the shared sync folder (e.g. `10.0.0.0/8 192.168.0.0/16 100.64.0.0/10 fc00::/7` for LAN and Tailscale). Empty: everything needs an account. Don't add Docker's `172.16.0.0/12` (see [INSTALL.md](INSTALL.md#https)). |
| `PUBLIC_READS`        | `0`                                                    | `1`: anyone who can reach the server may browse and download the library without an account. |
| `ALLOW_HTTP_ACCOUNTS` | `0`                                                    | `1`: signing in (and so managing accounts and adding books) also works on plain HTTP, with a warning in the app. Passwords, sessions and synced settings then cross the network unencrypted. |
| `MIN_FREE_MB`         | `1024`                                                 | Uploads to the sync folders are refused while the data disk has less free space. |
| `CATALOG_INTERVAL`    | `600`                                                  | Seconds between checks of `metadata.db`; the catalog is rebuilt only when it changed. |
| `DIFFICULTY_WORKERS`  | `2`                                                    | Processes for difficulty estimates (`difficulty` profile), about 0.5-1 GB of RAM each. |
| `IMAGE_PREFIX`, `IMAGE_TAG` | `ebook-reader`, `local` | Image names: `<prefix>-{web,services,import,difficulty}:<tag>`. The defaults are built locally (`--build`); for published images use `ghcr.io/<owner>/<repository>` and a version or `latest`, then `docker compose pull`. |
| `UPDATE_REPO`         | `blankiekun/chimimouryou`                              | GitHub repository the admin panel's updater (`ebook-update`, deploy.sh installs) checks and installs from: the newest commit on `main`. |
| `COMPOSE_PROFILES`    | empty                                                  | Optional services to run: `import` (adding books to Calibre), `difficulty` (difficulty estimates), e.g. `import,difficulty`. Same as passing `--profile`. |

## Build-time settings of the app (`VITE_*`)

Read when the app is built (`pnpm build`, or the `web` image). Docker Compose
passes only `VITE_HTTPS_URL` (from `PUBLIC_HTTPS_URL`) and the version; for the
others, add them as build arguments in `docker/web.Dockerfile` or build the app
yourself.

| Variable                      | Default             | What it does |
| ----------------------------- | ------------------- | ------------ |
| `VITE_HTTPS_URL`              | the current host over HTTPS | Where the plain-HTTP page sends people to sign in. |
| `VITE_DEFAULT_STORAGE_SOURCE` | `calibre`           | Library source on first visit. Builds without the server (static hosting, `docker-compose.static.yml`) use `browser`. |
| `VITE_GDRIVE_CLIENT_ID`, `VITE_GDRIVE_CLIENT_SECRET` | empty | Google Drive sync (upstream feature); needs your own OAuth client. |
| `VITE_ONEDRIVE_CLIENT_ID`, `VITE_ONEDRIVE_CLIENT_SECRET` | empty | OneDrive sync (upstream feature). |
| `VITE_GDRIVE_*_ENDPOINT`, `VITE_GDRIVE_SCOPE`, `VITE_ONEDRIVE_*` | Google's / Microsoft's | OAuth endpoints and scopes; rarely changed. |
| `VITE_STORAGE_ROOT_NAME`      | `ttu-reader-data`   | Root folder name in synced storage. Changing it hides existing synced data; must match the services' `STORAGE_ROOT_NAME`. |
| `VITE_BASE_PATH`, `VITE_PAGE_PATH` | upstream's site, empty | Upstream's hosting paths. |
| `VITE_CLEAR_ON_RELOAD`        | off                 | Clears the console on reload (development). |

## Web server (nginx template)

`scripts/calibre/render-nginx.sh` fills in `nginx-ebook-reader.conf.template`.
The web container runs it at start with these defaults. Server-level extras (TLS, resolver,
real-IP settings) go in `/etc/nginx/ebook-reader.d/*.conf`.

| Variable                | Default (Docker)                           |
| ----------------------- | ------------------------------------------ |
| `WEB_ROOT`              | `/srv/www` (the built app)                 |
| `LIBRARY_DIR`           | `/library`                                 |
| `SYNC_DIR`              | `/data/sync`                               |
| `ACCOUNT_DATA_DIR`      | `/data/accounts`                           |
| `CATALOG_FILE`          | `/data/state/catalog/catalog.json`         |
| `DIFFICULTY_FILE`       | `/data/state/difficulty/difficulty.json`   |
| `ACCOUNT_UPSTREAM`      | `account:8766`                             |
| `IMPORT_UPSTREAM`       | `import:8767`                              |
| `DIFFICULTY_UPSTREAM`   | `difficulty:8765`                          |
| `TRUSTED_NETWORKS`, `PUBLIC_READS` | as in `.env`                    |

The web container also reads `PUID`, `PGID` and `REAL_IP_FROM` (above).

## Python services

Set by the services image (`docker/services.Dockerfile`); the defaults in the
code are the same container paths.

| Variable              | Docker value                               | Used by |
| --------------------- | ------------------------------------------ | ------- |
| `CALIBRE_LIBRARY`     | `/library`                                 | import, difficulty |
| `SHARED_SYNC_DIR`     | `/data/sync`                               | account (`import-shared`, free-space check) |
| `ACCOUNT_STATE_DIR`   | `/data/state/account` (`accounts.db`)      | account |
| `ACCOUNT_DATA_DIR`    | `/data/accounts` (must match nginx's `ACCOUNT_DATA_DIR`) | account |
| `ACCOUNT_HOST`, `ACCOUNT_PORT` | `0.0.0.0`, `8766`                 | account |
| `ALLOW_HTTP_ACCOUNTS` | `0`                                        | account, import |
| `MIN_FREE_MB`         | `1024`                                     | account |
| `STORAGE_ROOT_NAME`   | `ttu-reader-data`                          | account |
| `CATALOG_OUTPUT`      | `/data/state/catalog/catalog.json`         | import (rebuilds the catalog after adding books) |
| `CATALOG_BUILDER`     | `/usr/local/bin/build-calibre-catalog`     | import |
| `CALIBREDB`           | `calibredb`                                | import |
| `IMPORT_STATE_DIR`    | `/data/state/import` (queue, `jobs.json`)  | import |
| `IMPORT_HOST`, `IMPORT_PORT` | `0.0.0.0`, `8767`                   | import |
| `CALIBRE_WRITE_LOCK`  | `/data/state/import/calibre-write.lock`    | import, `assign-series.py` |
| `CALIBRE_BACKUP_DIR`  | `/data/state/import/backups` (last 5 `metadata.db` copies) | `assign-series.py --apply` |
| `CALIBRE_DEBUG`, `ASSIGN_SERIES` | `calibre-debug`, `/app/assign-series.py` | import (admin panel → Tools → Series) |
| `UPDATE_STATE_DIR`    | `/data/state/update` (`request.json`, `status.json`, `updater`) | account, `ebook-update` on the host |
| `CALIBRE_CATALOG`     | `/data/state/catalog/catalog.json`         | difficulty |
| `JITEN_STATE_DIR`     | `/data/state/difficulty` (results, `frequency-dictionary.zip`) | difficulty |
| `JITEN_WORKERS`       | `DIFFICULTY_WORKERS`                       | difficulty |
| `JITEN_HOST`, `JITEN_PORT` | `0.0.0.0`, `8765`                     | difficulty |

The catalog builder takes the library and the output file as arguments:
`build-calibre-catalog <library> <catalog.json>`.

## Accounts

Not configuration files but commands, in the `account` container
(`docker compose exec account ebook-account …`):

| Command | |
| ------- | - |
| `add NAME [--admin]` | Create an account (asks for a password, 8+ characters). |
| `passwd NAME` | New password; signs out its sessions. |
| `admin NAME on\|off` | Make or unmake an admin (the last admin can't be removed). |
| `permissions NAME import,series,difficulty` | What a non-admin may do besides reading (`''` for nothing). |
| `remove NAME` | Delete the account; its data folder stays. |
| `list` | Accounts, ids, creation dates and rights. |

Admins can do the same in the admin panel (Settings → Account → Open admin panel).
