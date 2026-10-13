# Audit: bugs, security and code health

Audited commit `121bbafc` (2026-10-12). No source files were changed.
Where a finding says "Confirmed live", it was reproduced on the throwaway test stack (port 8090, its own data); the production stack was not touched.

## 1. Executive summary

**Overall risk: Medium.** Passwords, sessions, cookies, CSRF checks, book-HTML sanitizing and secret handling hold up well. The weak spot is the authorization layer that lives only in the nginx template. Exact-match `location =` blocks and a regex on the `Destination` header are bypassable, and nothing tests that layer. Every serious issue needs a signed-in account (accounts are created by an admin) or a trusted-network address; none is reachable by an anonymous visitor.

Top 5:
1. **A-01 (High):** an account with only `import` can run the admin-only Series (`--apply` rewrites `metadata.db`) and Catalog tools by adding `;x` to the URL.
2. **A-02 (High):** any signed-in account, even one with no permissions, can recursively DELETE folders in the shared `/calibre/sync/`, including the root: every book's processed data, `series.json` and `metadata.json`.
3. **A-03 (Medium):** the nginx regex that protects `series.json`/`metadata.json` from MOVE is bypassed with a trailing `?` in `Destination`.
4. **A-04 (Medium):** one corrupt game ZIP kills the import worker thread; the queue then stalls for good, including after every restart.
5. **A-05 (Medium):** import uploads (up to 8 GB each) have no free-space check and can fill the disk that holds `accounts.db`.

## 2. Findings table

| ID | Severity | Category | Location | Summary | Status |
|---|---|---|---|---|---|
| A-01 | High | AuthZ | `nginx-ebook-reader.conf.template:100-140`, `import/service.py:386-394` | `import` users reach the admin-only `/series` and `/catalog` with `;x` | Open |
| A-02 | High | AuthZ / data loss | `nginx-ebook-reader.conf.template:312-319` | Any account can DELETE whole collections in the shared sync folder | Open |
| A-03 | Medium | AuthZ | `nginx-ebook-reader.conf.template:315` | MOVE onto `series.json`/`metadata.json` bypasses the `series` permission | Open |
| A-04 | Medium | DoS / bug | `import/service.py:205`, `:297` | `zlib.error`/`EOFError` from a bad ZIP kills the worker; the queue stalls | Open |
| A-05 | Medium | DoS | `import/service.py:425-447` | No free-space check on import uploads; partial files left on error | Open |
| A-06 | Medium | Bug | `jiten/service.py:287` | Dictionary upload reads until EOF: hangs, user gets a 504 | Open |
| A-07 | Medium | Data exposure | `routes/b/+page.svelte:1587,1780`, `browser-handler.ts` | Progress/statistics of one account leak into another on a shared browser | Open |
| A-08 | Low | Secrets | `account-settings-sync.ts:348-361` | AI keys typed while signed out are adopted by the next account | Open |
| A-09 | Low | Web / CSS injection | `style-sheet-renderer.svelte`, `svelte.config.js` | Book CSS (writable by any account via sync) styles the whole page | Open |
| A-10 | Low | Race | `extras-sync.ts:125-140` | Recap/lorebook sync can overwrite a local write made during its fetch | Open |
| A-11 | Low | AuthN | `nginx-ebook-reader.conf.template:154`, `account/service.py:774` | `/account/api/login/` skips nginx's `limit_req` | Open |
| A-12 | Low | Config | `nginx-ebook-reader.conf.template:27` | Client `X-Forwarded-Proto: https` is trusted from anyone | Open |
| A-13 | Low | AuthZ (local) | `import/service.py:352`, `jiten/service.py`, tailscale override | Services trust `X-Account-Id`; host-local processes bypass all checks | Open |
| A-14 | Low | CSRF | `jiten/service.py:336` | Difficulty POSTs have no Origin check (import has one) | Open |
| A-15 | Low | Race | `account/service.py:378` | Last-admin check and update are not atomic | Open |
| A-16 | Low | Race | `build-catalog.py:366` | `metadata.db` copied without the Calibre write lock (needs verification) | Open |
| A-17 | Low | DoS | `build-catalog.py:209-245`, `jiten/frequency.py:15,21` | Unbounded `archive.read()` of ZIP members (needs verification) | Open |
| A-18 | Low | Dependencies | `apps/web/package.json` | Svelte 4 runtime is end-of-life; 69 dev-tooling advisories | Open |
| A-19 | Info | Misc | various | Small items, listed in section 3 | Open |
| H-01 | — | Code health | nginx template, `tests/` | The authorization layer (nginx) has no tests at all | Open |

## 3. Detailed findings

### A-01 — Import-only accounts can run the admin Series and Catalog tools (High)
**Severity:** High, because it crosses the admin boundary and writes `metadata.db` for the whole library. It is recoverable from `state/import/backups/`.

**Location:** `scripts/calibre/nginx-ebook-reader.conf.template:100-140`, `scripts/calibre/import/service.py:386-394`

**Evidence:** the admin check exists only as exact-match locations:
```nginx
location /calibre/import/api/ {          # needs `import`
  auth_request /_account_import;
  rewrite ^/calibre/import/api/(.*)$ /$1 break;
location = /calibre/import/api/series {  # needs admin
  auth_request /_account_admin;
```
The service routes on the parsed path, which drops `;params`:
```python
url = urlparse(self.path)
if url.path == '/series':
    return self.handle_api(self.series)
```
`/calibre/import/api/series;x` doesn't match `location =`, falls into the prefix block (`import` only), is rewritten to `/series;x`, and `urlparse('/series;x').path == '/series'`. `series()`/`catalog()` only check that `X-Account-Id` is non-empty.

**Impact:** an import-only user can run `assign-series.py --apply` (rewrites series on thousands of books) and force 30-minute full catalog rebuilds at will.

**Reproduction (Confirmed live, dry run):** with `reader` given only `import` on the test stack, `POST /calibre/import/api/series` with `{"apply":false}` → **403**, and `POST /calibre/import/api/series;x` → **200** `{"assigned": 2, ...}`. The permission was removed again afterwards.

**Fix:** enforce admin in the service, not only in nginx. Also match the raw path:
```nginx
# in location /calibre/import/api/
auth_request_set $account_admin $upstream_http_x_account_admin;
proxy_set_header X-Account-Admin $account_admin;
```
```python
path = self.path.split('?', 1)[0]          # no urlparse: keep ';' so '/series;x' is a 404
if path == '/series':
    self.require_admin()                     # X-Account-Admin == '1', set by the auth response
```
The account service's `auth` response would need to send `X-Account-Admin`.

**Confidence:** Confirmed.

### A-02 — Any account can recursively delete the shared sync folder (High)
**Severity:** High, because a user with no permissions can destroy data shared by every reader. That includes `series.json` and `metadata.json`, which have no backup.

**Location:** `scripts/calibre/nginx-ebook-reader.conf.template:312-319`
```nginx
location /calibre/sync/ {
  auth_request /_account_shared;
  ...
  dav_methods PUT DELETE MKCOL MOVE;
```
**Trace:** `DELETE /calibre/sync/<folder>/` (or `/calibre/sync/` itself) is a collection DELETE. nginx's dav module removes the tree recursively. `/_account_shared` allows writes for any signed-in account, and for signed-out clients on `TRUSTED_NETWORKS`.

**Impact:**
- With one request, any account can wipe all processed book data, signed-out readers' progress, reader-made series and fetched metadata.
- Every book then has to be re-processed on its next open.

**Reproduction (Confirmed live on a folder I created; the root DELETE was not run):**
1. As `reader` (no permissions), `PUT /calibre/sync/audit-tmp2/a.json` → 201.
2. `DELETE /calibre/sync/audit-tmp2/` → **204**.
3. A GET of the file → 404.

**Fix:** refuse DELETE on collections. The client deletes files (and book folders when removing a book). Check which DELETEs `calibre-handler.ts` really sends, then at minimum:
```nginx
location = /calibre/sync/ { limit_except GET HEAD { deny all; } ... }
```
If the client never deletes folders, also refuse URIs ending in `/` for DELETE: `if ($request_method = DELETE) { set $d D; } if ($uri ~ /$) { set $d "${d}S"; } if ($d = DS) { return 403; }`.

**Confidence:** Confirmed for subfolders. Likely for the root, since it's the same location and code path.

### A-03 — MOVE bypasses the `series` permission on `series.json` / `metadata.json` (Medium)
**Severity:** Medium: it hits the integrity of library-wide shared data, it needs an account, and no secrets are involved.

**Location:** `scripts/calibre/nginx-ebook-reader.conf.template:315`
```nginx
if ($http_destination ~* "/(series|metadata)(\.|%2e)json$") { return 403; }
```
**Trace:** the regex looks at the raw header. nginx's dav module strips `?query` from the destination and percent-decodes it before mapping it with `alias`. So `series.json?` (and `%73eries.json`) pass the regex but land on `series.json`.

**Impact:** any account replaces the reader-made series or the shared book metadata (descriptions, cover URLs) that everyone sees.

**Reproduction (Confirmed live; the test stack was restored afterwards):**
1. As `reader`, `PUT /calibre/sync/audit-tmp/evil.json` → 201.
2. A direct `PUT /calibre/sync/series.json` → 403, and `MOVE` with `Destination: …/calibre/sync/series.json` → 403.
3. `MOVE` with `Destination: …/calibre/sync/series.json?` → **204**, and `series.json` then contained `{"audit":"poc"}`.

**Fix:** validate the destination in the account service instead of a regex:
```nginx
location = /_account_shared { ... proxy_set_header X-Destination $http_destination; }
```
```python
dest = posixpath.normpath(unquote(urlsplit(destination).path))
if dest in ('/calibre/sync/series.json', '/calibre/sync/metadata.json'): deny unless 'series'
```
Simpler alternative: allow MOVE only when the source and destination are in the same book folder, which is the only MOVE the client makes (`calibre-handler.ts`).

**Confidence:** Confirmed.

### A-04 — A corrupt game ZIP kills the import worker; the queue stalls for good (Medium)
**Severity:** Medium: it needs the `import` permission, but it stops all imports for everyone, across restarts, until someone edits `jobs.json`.

**Location:** `scripts/calibre/import/service.py:205` and `:297`
```python
except (OSError, zipfile.BadZipFile, RuntimeError) as error:   # add_vn
...
except (OSError, subprocess.SubprocessError) as error:         # worker()
```
**Trace:**
1. `is_vn_zip` reads only the central directory, so a ZIP with a corrupt deflate stream is queued.
2. `archive.open(info)` + `copyfileobj` raises `zlib.error`, or `EOFError` when the stream is truncated. Neither handler catches it, so the worker thread dies.
3. The job stays `adding`; `load_jobs` (`:99`) turns it back into `queued` on restart, and as the oldest job it kills the worker again.

`rebuild_catalog`'s `TimeoutExpired` (`:253`) escapes the worker loop the same way.

**Reproduction:** confirmed locally with a scratch script. A ZIP holding `0.txt` with a flipped byte in the compressed data gave `worker alive: False`, `{'bad': 'adding', 'good': 'queued'}`.

**Fix:**
```python
# add_vn
except (OSError, zipfile.BadZipFile, RuntimeError, zlib.error, EOFError) as error:
# worker(): never let one job end the thread
except Exception as error:  # noqa: BLE001
    traceback.print_exc(); update = {'state': 'failed', 'error': 'Could not add this file'}
```
Also wrap the `finish_batch`/`rebuild_catalog` part of the loop.

**Confidence:** Confirmed (local reproduction).

### A-05 — Import uploads have no free-space check (Medium)
**Severity:** Medium: one `import` user can fill the disk that also holds `accounts.db` and the per-account sync data.

**Location:** `scripts/calibre/import/service.py:425-447`. The upload is streamed to `state/import/queue/` after checking only the size limits (`MAX_VN_BYTES = 8 GiB`, `:59`) and the per-account count. The count includes only finished uploads, so concurrent uploads all pass it. The only `disk_usage` check is in `add_vn` (`:197`), after the upload. An `OSError` during `f.write` leaves the partial file in place and sends no response.

**Impact:**
- `DATA_PATH` fills up, so the account database, WebDAV writes and job state fail.
- CLAUDE.md promises "uploads stop below `MIN_FREE_MB`", which is not true for this path.

**Fix:**
```python
if shutil.disk_usage(queue_dir()).free - length < MIN_FREE_BYTES:
    raise ApiError(507, 'Not enough free space on the server')
try:
    ... write loop ...
except OSError:
    os.remove(path); raise ApiError(507, 'Could not store the file')
```
Count in-progress uploads too, by registering the job as `uploading` before writing.

**Confidence:** Confirmed (code reading).

### A-06 — Frequency-dictionary upload hangs and returns 504 (Medium)
**Severity:** Medium: an admin feature that looks broken to the user, though the data is fine.

**Location:** `scripts/calibre/jiten/service.py:287`
```python
shutil.copyfileobj(source, f, length)   # 3rd arg is the buffer size, not a byte limit
```
**Trace:** this reads `rfile` until EOF. nginx keeps the upstream connection open while it waits for the response, so EOF only comes when `proxy_read_timeout` closes it. The browser then gets a 504 (`difficulty-panel.svelte:84`), and the install finishes afterwards with a `BrokenPipeError` on the reply. `tests/test_frequency.py:69` passes a `BytesIO`, which reaches EOF, so the test misses this.

**Reproduction:** confirmed locally with a socket client that sends the body and waits. The client timed out, and the file was installed only after the client closed the connection.

**Fix:** reuse the bounded loop from `import/service.py:441`:
```python
remaining = length
while remaining and (chunk := source.read(min(remaining, 1 << 20))):
    f.write(chunk); remaining -= len(chunk)
```
**Confidence:** Confirmed (local reproduction; not run against nginx).

### A-07 — Progress and statistics cross accounts on a shared browser (Medium)
**Severity:** Medium: one person's private reading history is shown to, and uploaded into, another account. The code already treats the shared browser as a threat for highlights, recaps and keys.

**Location:**
- `apps/web/src/routes/b/+page.svelte:1587` and `:1780`: `replicateData` copies progress, statistics and reading goals between the Calibre handler and the browser database.
- `lib/data/storage/handler/browser-handler.ts`: `saveProgress`/`saveStatistics` store no account.
- `lib/data/statistics-sync.ts`: pulls an account's statistics for every book into the browser DB.
- `lib/data/store.ts`: `statisticsMergeMode$` defaults to MERGE.
- `releasePreviousOwner` (`account-settings-sync.ts:348`) clears only the AI keys.

**Impact:** after A signs out and B signs in on the same browser:
- the Home dashboard and Statistics page show A's reading;
- when B opens a book A read, A's local statistics are merged with B's and uploaded to B's `/account/sync/`;
- A's newer bookmark wins over B's (NewOnly) and is saved as B's position.

**Reproduction (not run):**
1. Sign in as A on the test stack, read a book for a few minutes, sign out.
2. Sign in as B and open the same book.
3. Check B's position and B's `progress_*`/`statistics_*` files.

**Fix:** when the owner changes (in `releasePreviousOwner`), delete the browser's progress, statistics and reading goals for Calibre-source books; they come back from the server. Alternatively, tag those records with the account and filter them, as `annotations.ts` does.

**Confidence:** Likely (traced in code, not reproduced).

### A-08 — AI keys entered while signed out are adopted by the next account (Low)
**Severity:** Low: it needs a shared browser and a guest who typed a key.

**Location:** `apps/web/src/lib/data/account-settings-sync.ts:348-361`. `if (owner && owner !== user?.id)` clears nothing when there is no recorded owner. The sync then uploads local-only values (`:283-288`). The comment at `:345` says this adoption is deliberate, for settings saved before owners were recorded.

**Impact:** a guest's OpenRouter or ElevenLabs key is saved in B's `settings.json` and billed for B's use, or the reverse.

**Fix:** that migration has already run for existing installs. Now, on sign-in with no owner, clear the `secretSettings` instead of adopting them.

**Confidence:** Confirmed (code reading).

### A-09 — Book CSS applies to the whole page, and the bookdata it comes from is writable by any account (Low)
**Severity:** Low: script stays blocked by the CSP, so the result is defacement, phishing overlays or tracking beacons, not code execution.

**Location:**
- `apps/web/src/lib/components/style-sheet-renderer.svelte:4-10`: `$bookData$.styleSheet` goes unscoped into a `<style>` in `<head>`.
- `sanitize-book-html.ts` keeps `<style>`, `style=` and https links.
- The CSP in `svelte.config.js` has no `img-src`, `style-src` or `font-src`.

Any account can overwrite a title's `bookdata_*` in `/calibre/sync/` (see A-02's location).

**Impact:**
- A `position:fixed` "session expired, sign in here" overlay that links off-site.
- `url()`/`@import` beacons that leak each reader's IP and reading times to an outside host.

**Fix:**
- Prefix book selectors with the book container and drop `@import` and `position:fixed`.
- Add `img-src 'self' blob: data: https://s4.anilist.co https://t.vndb.org https://cdn.jiten.moe` plus `font-src`/`style-src` limits to the CSP.

**Confidence:** Confirmed (upstream behaves the same; what's new is the shared, cross-account writable source).

### A-10 — Recap/lorebook sync can lose a local write made during its fetch (Low)
**Severity:** Low: a narrow window, but it loses paid-for AI output.

**Location:** `apps/web/src/lib/data/extras-sync.ts:125-140`
```ts
const stored = (await db.get(spec.store, title)) as T | undefined;
const response = await fetch(url, { cache: 'no-store' });   // local writes can land here
const merged = spec.merge(title, local, remote);
await db.put(spec.store, { ...merged, account: owner } as never);
```
**Impact:** a recap or a background lorebook update saved while the fetch is in flight is overwritten by a merge based on the stale copy. For the lorebook, `processedUpTo` also goes back.

**Fix:** re-read the record after the fetch and merge with that: `const current = await db.get(...); spec.merge(title, current, remote)`.

**Confidence:** Likely (code reading).

### A-11 — `/account/api/login/` skips the nginx rate limit (Low)
**Severity:** Low: the service's own per-user, per-IP and per-user-after-50 throttles still apply.

**Location:** `nginx-ebook-reader.conf.template:154` (`location = /account/api/login` with `limit_req`) and `account/service.py:774` (`self.path.split('?')[0].strip('/')`). With a trailing slash, the request goes through the general `/account/api/` location without `limit_req`, and `strip('/')` still routes it to login.

**Fix:** `location ~ ^/account/api/login/?$`, or stop stripping the trailing slash in `dispatch`.

**Confidence:** Confirmed (code reading).

### A-12 — `X-Forwarded-Proto` is trusted from any client (Low)
**Severity:** Low: a browser can't set this header, so only a client that chooses to send its own password over plain HTTP benefits.

**Location:** `nginx-ebook-reader.conf.template:27`: `map $http_x_forwarded_proto $forwarded_proto { default $scheme; https https; }`. The account service uses it to enforce "sign-in only over HTTPS".

**Fix:** use the header only when `$realip_remote_addr` is in `REAL_IP_FROM`, and `$scheme` otherwise.

**Confidence:** Confirmed (code reading).

### A-13 — The services trust `X-Account-Id`; local processes bypass every check (Low)
**Severity:** Low: it can't be reached from the network, only from the host or the Docker network.

**Location:**
- `import/service.py:352` accepts any non-empty `X-Account-Id`.
- `jiten/service.py` has no auth of its own.
- The services bind `0.0.0.0` (`services.Dockerfile`).
- `deploy/examples/tailscale-https/docker-compose.override.yml:20-26` publishes `127.0.0.1:8765-8767` on the host.

**Impact:** any process on the host, or any compromised container in the stack (catalog, difficulty and import parse untrusted files), can run admin series `--apply`, imports and difficulty jobs by forging headers.

**Fix:** a shared secret from the environment that nginx sets (`proxy_set_header X-Internal-Auth ${INTERNAL_TOKEN}`) and the services check with `hmac.compare_digest`.

**Confidence:** Confirmed (code reading).

### A-14 — The difficulty service has no Origin check (Low)
**Severity:** Low: the SameSite=Strict cookie already blocks cross-site requests. Only same-site pages (another port on the same host, such as a test stack) can send it.

**Location:** `scripts/calibre/jiten/service.py:336` (`do_POST`: `compute`, `cancel`, `dictionary`). `import/service.py` has `same_origin()`; this service doesn't.

**Fix:** copy `same_origin()` into this service and call it in `do_POST`.

**Confidence:** Likely.

### A-15 — Last-admin check is not atomic (Low)
**Location:** `scripts/calibre/account/service.py:378`. The `SELECT COUNT(*) … is_admin = 1` runs in `db.query`, separately from the following update. Two admins demoting or removing each other at once can leave zero admins. Recover with `ebook-account admin NAME on`.

**Fix:** run the count and the update in one `db.transaction`.

**Confidence:** Confirmed (code reading).

### A-16 — The catalog copies `metadata.db` without Calibre's write lock (Low)
**Location:** `scripts/calibre/build-catalog.py:366`, `shutil.copyfile(db_path, db_copy)`. The import queue and `assign-series.py` hold `calibre-write.lock` while writing; the catalog timer doesn't. A copy taken mid-write can be torn: the build aborts or catalogs a half-written state. The next run repairs it.

**Fix:** take a shared `flock` on `CALIBRE_WRITE_LOCK` around the copy, or use `sqlite3.connect(db_path).backup(...)`.

**Confidence:** Needs verification. Check `PRAGMA journal_mode` on the library, and whether builds ever log `DatabaseError`.

### A-17 — Unbounded ZIP member reads outside worker processes (Low)
**Location:** `scripts/calibre/build-catalog.py:209-245` (container.xml, OPF and cover pages are read without a size cap; only cover images have `MAX_COVER_BYTES`) and `jiten/frequency.py:15,21` (dictionary members, read in the HTTP process). A deflate bomb could exhaust the catalog builder's or the difficulty service's memory; the latter would kill a running job.

**Fix:** `if archive.getinfo(name).file_size > 16 << 20: skip` before each `read`.

**Confidence:** Needs verification. Check whether `calibredb add` already rejects such an EPUB. The dictionary path needs `difficulty` permission.

### A-18 — Dependencies (Low)
- **Runtime:** `svelte 4.2.20`. Svelte 4 is end-of-life, and the client-side advisory CVE-2026-42573 (DOM-clobbering XSS) is fixed only in 5.55.7. *Needs verification* that it affects 4.x at all. The other Svelte advisories are SSR-only, and this app serves prerendered static files. The `devalue` advisories come via `@sveltejs/kit`, which this static build doesn't use to parse untrusted data.
- **Dev/build only (not shipped):** the critical advisories are in vitest/tinypool (CVE-2026-47429, -104848, -104849; UI server not used) and `@babel/traverse` (CVE-2023-45133, via `eslint-plugin-rxjs`). The high ones are in brace-expansion, minimatch, picomatch, flatted, rollup (CVE-2026-27606), vite and immutable (via sass). Build input is the repository itself, so the practical risk is low. Running `pnpm update` for vitest/vite/eslint would clear most of them.
- **Python:** `jiten/requirements.txt` pins exact versions; base packages come from Debian trixie apt. `pip-audit` isn't installed, so it wasn't run.
- **CI:** actions are pinned to version tags, not commit SHAs (Info). No workflow exposes secrets to pull requests (`ci.yml` uses none; `release.yml` runs on tags only).

### A-19 — Info
- `nginx-ebook-reader.conf.template:375` `location ~ /404(\.html)?$ { internal; }` beats every prefix location, so sync or VN files named `404`/`404.html` can't be fetched.
- `GET /account/api/config` is public and says `initialAdmin: true` on a new, unclaimed server. The password itself is random (96 bits).
- `jiten/service.py:320`: `'²'.lstrip('-').isdigit()` is True but `int()` raises, so the request gets no response (logged traceback only).
- `import/service.py:323`: `TimeoutExpired` from the series run escapes, so the request gets no response; the busy lock is released.
- `jiten/features.py` `vn_text` never closes its `ZipFile` (worker processes, recycled).
- `vn_games` ids are CRC32 of the folder name; a collision would silently drop a game.
- Mutation-XSS hardening: book HTML is sanitized in an inert document, serialized and re-parsed live. This is safe today because every page, including the 404 fallback, carries the hash-only `script-src` meta CSP (checked on the test stack). Keep it that way.
- `ebook-update`: a failed `compose build` can leave some images retagged with the new version while the old code runs. Running containers are unaffected; the next manual `up -d` mixes versions. Needs verification.
- CLAUDE.md says the `pnpm check` baseline is 30 errors; it is now 28.

### H-01 — Code health: the authorization layer is untested
A-01, A-02, A-03 and A-11 all come from the same gap. The permission model lives in nginx `location` blocks, and no test renders the template and sends requests through it. The Python tests call the services directly, behind the boundary. The cheapest guard is a CI job that runs the `web` + `account` + `import` images with a seeded test account and curls the boundary cases:
- `;x` suffixes;
- trailing slashes;
- `Destination` with `?` and percent-encoding;
- collection DELETE.

Also, `tests/test_frequency.py:69` uses an in-memory stream, which hid A-06; tests for upload handlers should use a socket-like stream that doesn't close.

## 4. Tool output summary

| Check | Result |
|---|---|---|
| `python3 -m unittest discover -s scripts/calibre/tests` | 79 tests, OK (one `ResourceWarning`: unclosed socket in a test) |
| `pnpm test` (Vitest) | 35 files, 163 tests passed |
| `npx eslint .` | clean |
| `pnpm check` (svelte-check) | 28 errors, 1 warning (pre-existing; baseline documented as 30) |
| `pnpm audit` | 69 advisories: 4 critical, 29 high, 30 moderate, 6 low; all in dev/build tooling except Svelte/devalue (A-18) |
| `pip-audit` | not installed; not run |
| git history secret scan (`sk-or-`, AWS keys, private keys) | only test fixtures (`sk-or-alice`, `sk-or-secret`) |

The front-end checks ran on a fresh `git archive HEAD` in the scratch directory `/opt/ebook-reader-dev`, not on the live tree.

## 5. Not covered
- **Production stack:** nothing was sent to it. Live checks used the test stack only (A-01 as a dry run; A-02 and A-03 on files created for the test; everything restored).
- **A-07 and A-10:** not reproduced in a browser; this would need two accounts and a real book on the test stack.
- **Collection DELETE of the sync root:** not executed (A-02), since it would wipe the test stack's processed books.
- **Calibre's own EPUB parsing, the ONScripter WebAssembly engine** (`static/vn/onsyuri.*`) and its exposure to game data.
- **Upstream ttu code:** loaders, GDrive/OneDrive handlers and replication internals were reviewed only where the fork's features touch them.
- **`scripts/deploy.sh`:** quoting only skimmed (operator-run, not an input boundary).
- **Host and infrastructure:** Proxmox, Tailscale ACLs, backups.
