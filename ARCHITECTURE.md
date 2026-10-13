# Architecture

This describes the parts this fork adds and how they connect to upstream's
ッツ Ebook Reader. Upstream's own design is only covered where the fork depends
on it. Running it: [docs/INSTALL.md](docs/INSTALL.md); every setting:
[docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Overview

```
Browser (static SvelteKit app, apps/web)
 ├─ IndexedDB: books, bookmarks, statistics (upstream "books" DB)
 │             highlights, recaps, lorebooks, audiobooks, kanji seen (ttu-annotations, data/reader-db.ts)
 ├─ localStorage: settings, API keys, theme, settings-sync change times
 └─ fetch ─────────────────────────────────────────────┐
                                                        ▼
nginx: the `web` container (scripts/calibre/nginx-ebook-reader.conf.template)
 ├─ /                       static build (the app)
 ├─ /calibre/catalog.json   ← `catalog` container (build-catalog.py), DATA_PATH/state/catalog
 ├─ /calibre/library/…      book files + cover.jpg, read-only (Calibre library)
 ├─ /calibre/sync/…         shared WebDAV, DATA_PATH/sync: processed books, covers, signed-out data
 ├─ /account/api/…          → `account` container (account:8766)
 ├─ /account/sync/…         per-account WebDAV (auth_request), DATA_PATH/accounts/<id>
 ├─ /calibre/import/api/…   → `import` container (import:8767, optional), writes the library
 └─ /calibre/difficulty/…   → `difficulty` container (difficulty:8765, optional)

Every location except the app itself is checked by auth_request against the
account service: reads need an account, a trusted network (TRUSTED_NETWORKS) or
PUBLIC_READS; writes to /calibre/sync/ need an account or a trusted network;
/calibre/import/, difficulty jobs and series.json need an admin or the import/
difficulty/series permission (auth/shared/writes, auth/import,
auth/difficulty/writes, auth/series/writes).

Browser → https://openrouter.ai directly (Ask AI, Story so far, Lorebook)
Browser → https://api.elevenlabs.io directly (AI voice)
```

There is no application server: the app is static, and nginx's WebDAV module is
the storage API. The Python services are small HTTP servers behind nginx, each
in its own container (bound to localhost with a host-network setup such as
`deploy/examples/tailscale-https`). Accounts
and the catalog use only the standard library (plus Pillow for covers); import
needs Calibre, difficulty needs Sudachi and ONNX Runtime.

## Frontend modules (apps/web/src/lib)

| Area           | Files                                                                                                                                                                                           | Notes                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Calibre source | `data/calibre.ts`, `data/storage/handler/calibre-handler.ts`                                                                                                                                    | A storage handler like upstream's GDrive/OneDrive ones, backed by the catalog plus WebDAV. |
| Accounts       | `data/account.ts`, `data/account-settings-sync.ts`, `components/settings/settings-{account,admin}.svelte`                                                                                        | Session check, sign-in, settings sync to `settings.json`, admin panel and permissions.     |
| Book safety    | `functions/file-loaders/utils/sanitize-book-html.ts`, `svelte.config.js` (`kit.csp`)                                                                                                            | Book HTML parsed inert and cleaned; CSP allows only the site's own scripts.                |
| Manga          | `data/manga.ts`, `functions/file-loaders/cbz/load-cbz.ts`, `routes/m/+page.svelte`                                                                                                              | CBZ/ZIP as ordinary book records; page index as the bookmark.                              |
| Visual novels  | `data/vn.ts`, `functions/file-loaders/vn/load-vn.ts`, `routes/v/+page.svelte`, `static/vn/` (engine + `player.js`), `scripts/conscripter/`                                                   | ONScripter games as book records (zip blobs, or a `VN_PATH` folder fetched file by file); a patched engine in an iframe sends each page's text. |
| Highlights     | `data/annotations.ts`, `functions/book-text/text-positions.ts`, `functions/book-text/css-highlights.ts`, `components/book-reader/{selection-toolbar,highlight-editor,annotations-panel}.svelte` | Anchored by character counts, drawn with the CSS Custom Highlight API.                     |
| Search         | `functions/book-text/book-search.ts`, `components/book-reader/book-search-panel.svelte`                                                                                                         | Paragraph index without furigana; results are character counts.                            |
| AI             | `data/ai-settings.ts`, `data/ask-ai.ts`, `data/recap.ts`, `components/book-reader/{ask-ai-panel,recap-panel}.svelte`                                                                            | OpenRouter chat completions, streamed.                                                     |
| Listen         | `data/tts.ts`, `data/tts-audio-cache.ts`, `data/audiobook.ts`, `functions/tts/extract-reading-text.ts`, `functions/audiobook/subtitles.ts`, `components/book-reader/{listen-panel,tts-player,audiobook-player}.svelte` | AI voice from ElevenLabs with timestamps; audiobooks matched to the text by their subtitles. |
| Lorebook       | `data/lorebook.ts`, `components/book-reader/{lorebook-panel,reader-companion}.svelte` | Incremental from `processedUpTo`; recap model. |
| Home tab       | `data/library-home.ts`, `data/learner-stats.ts`, `data/kanji-seen.ts`, `components/book-card/{learner-dashboard,series-results}.svelte` | Home/Store tabs, learner stats, series "Add all". |
| Themes         | `data/theme/*`, `components/theme/theme-style.svelte`, `components/settings/settings-theme*.svelte`                                                                                             | Every colour is a CSS variable (`theme-tokens.ts`); see `themes.md`.                       |
| Library        | `components/book-card/library-{sort,filters}.ts`, `continue-reading-shelf.svelte`, `difficulty-*.svelte`                                                                                        | Sorting, filters, series and difficulty.                                                   |
| Settings page  | `routes/settings/+page.svelte`, `components/settings/settings-sections.ts`                                                                                                                      | Sidebar sections; search over `SettingsItemGroup`s.                                        |
| Reader page    | `routes/b/+page.svelte`                                                                                                                                                                         | Upstream's reader plus the glue for all reader extras.                                     |

## Data flow

### Opening a Calibre book

1. The library lists `catalog.json` merged with the folders in `/calibre/sync/`
   (and `/account/sync/` while signed in): `CalibreStorageHandler.getBookList`.
2. On first open, `prepareBookForReading` downloads the EPUB/HTMLZ/TXT from
   `/calibre/library/`, processes it in the browser with upstream's loaders,
   uploads the processed `bookdata_*.zip` and cover to `/calibre/sync/<root>/<title>/`
   and caches the book in IndexedDB.
3. Later opens use the IndexedDB copy unless the server's `bookdata_*` is newer
   (`getBook`).
4. Progress and statistics sync like upstream's cloud sources. For Calibre books
   sync is always on, regardless of the auto-replication setting.

Upstream stores metadata in **file names**, so most updates are a rename
(WebDAV `MOVE`): `bookdata_<exporter>_<db>_<characters>_<lastModified>_<lastOpen>.zip`,
`progress_<exporter>_<db>_<lastBookmarkModified>_<progress>.json`, and so on
(`BaseStorageHandler.getBookMetadata`/`getProgressMetadata`).

### Shared vs. per-account files

While signed in, `isPersonalFile` (`progress_*`, `statistics_*`, reading goals),
`annotations.json`, `recaps.json` and `lorebook.json` (`data/extras-sync.ts`) go to
`/account/sync/` with the same folder layout; book data
and covers stay in the shared `/calibre/sync/`. `useAccountFolder` is refreshed in
`ensureTitle`, which every storage operation calls first.

Browser caches are scoped to the account too:

- Highlights of synced books record their owner in IndexedDB; a cache from another
  sign-in state is ignored (`AnnotationsController.load`).
- Settings sync records the owning account in localStorage
  (`accountSettingsOwner`); API keys and change times are dropped on sign-out,
  session expiry or an account switch (`releasePreviousOwner`).

### Settings sync

`settings.json` holds `values` and per-key `modified` times. On each sync the
newer side wins per key; settings set before signing in are uploaded if the
account lacks them. Reader settings are stored as `reader.<phone|desktop>.<key>`
so phones and larger screens keep separate styles. Syncs are queued so they
never overlap; changes upload after 1.5 s or when the tab is hidden.

### Highlights

A highlight is `{ start, end }` in character counts, the same counting as
bookmarks (`get-character-count.ts`), so it survives re-rendering, font changes
and pagination. `getTextSegments` maps counts to DOM text nodes;
`BookmarkManager.getRenderedStartCount()` gives the offset of the rendered
section in paginated mode. `annotations.json` is merged per highlight (newest
`modified` wins; deletions are kept as tombstones).

### Server services

- **Catalog** (`build-catalog.py`, every `CATALOG_INTERVAL` seconds when
  `metadata.db` changed): reads a _copy_ of `metadata.db`, picks the best format
  per book, lists manga archives, extracts missing covers into the library (as
  the library owner), infers series from volume numbers, and makes titles unique.
- **Accounts** (`account/service.py`): scrypt passwords, throttled sign-in,
  sessions in SQLite, admins and per-account permissions, the `auth_request`
  answers (with `X-Account-Id`) for every protected location, and a free-disk
  guard for uploads.
- **Import** (`import/service.py`): a queue that adds uploaded files to Calibre
  with `calibredb add`, one at a time, then rebuilds the catalog; the only writer
  of `metadata.db`.
- **Difficulty** (`jiten/service.py`): on demand only; worker pools run Sudachi,
  Jiten's features plus our own (`EXTRA_FEATURES`) and the chimi-difficulty ONNX models
  (estimate and 10-90% range); results in `state/difficulty/difficulty.json`,
  each book's kanji counts in `state/difficulty/kanji/` (`GET kanji/ID`, for each
  reader's own kanji coverage, compared in the browser with the kanji they met).

## Key design decisions

| Decision                                                              | Why                                                                                                                                                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static app + nginx WebDAV, no app server                              | Upstream is a static app with GDrive/OneDrive sync; WebDAV with the same folder layout lets the Calibre source reuse upstream's sync code almost unchanged.                                   |
| Books are processed in the browser, then uploaded                     | Upstream's loaders run in the browser; processing once and sharing `bookdata_*` avoids re-processing on every device.                                                                         |
| Character-count anchors for highlights, CSS Highlight API for drawing | Counts are already how bookmarks work, and they don't change with layout. Wrapping text in `<mark>` would change the DOM that pagination and counting depend on.                              |
| Python standard library services                                      | Nothing to install or update for accounts and the catalog; the attack surface is small.                                                                                                        |
| Account data in `DATA_PATH`, apart from the library                   | Libraries often sit on shared storage that other machines or containers mount; account folders hold `settings.json` with API keys.                                                            |
| API keys in the browser, synced per account                           | The AI features call providers from the browser; there is no server to hold the keys. Keys never go to the shared folder, are removed when the account changes, and only cross the network unencrypted if `ALLOW_HTTP_ACCOUNTS` is on. |
| Docker as the only install path                                       | The access rules are the security boundary; one install keeps one copy of them, tested in CI.                                                                                                  |
| Sanitizer plus CSP for book HTML                                      | Book HTML can come from any writer of the shared folder; cleaning it stops script, the CSP catches anything the cleaner misses.                                                                |
| Catalog titles made unique                                            | Upstream identifies books by title (folder names), so duplicate Calibre titles would share progress.                                                                                          |

## Known limitations and tech debt

- **Title-based identity.** If a second book with the same title is added to
  Calibre, the first one is renamed to `Title (Author)` and its synced data stays
  under the old folder name (orphaned). Fixing it means keying folders by Calibre
  id plus a migration.
- **Trusted networks write the shared folder.** Signed-out readers from
  `TRUSTED_NETWORKS` can change any book's shared data (needed so they can open
  books); set it empty when that isn't wanted.
- **No quotas.** Any account can fill the disk up to `MIN_FREE_MB`.
- **Book CSS is applied as-is.** It can restyle the page, though not run script.
- **No built-in backups.** Back up `DATA_PATH` (and the Calibre library).
- **`routes/b/+page.svelte`** holds about 300 lines of highlight, search and
  selection glue inline; it is the most fragile file to change.
- **Ask AI context** clones the book DOM up to the selection to get the text
  before it, which is slow on very long books in continuous mode.
- **svelte-check** reports 30 errors that predate the fork (Svelte 4/5 types,
  `dialog-template.svelte`, FS Access types). ESLint's Svelte config only matches
  root-level files, so `.svelte` files are not linted (upstream config).
- Read aloud starts from the beginning of the paragraph containing the position.
- The AI voice highlight is per phrase (split at 。、 and quotes), from
  ElevenLabs' character timestamps; if they don't line up with the text, the
  whole chunk is highlighted.
- Audiobooks, lorebooks and kanji seen are per browser (not synced). Highlighting
  the line being read walks the rendered text on every line change, which costs
  more in continuous mode on very long books.
