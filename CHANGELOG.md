# Changelog

chimimouryou is a fork of [ッツ Ebook Reader](https://github.com/ttu-ttu/ebook-reader);
upstream's own changes are not listed here. Add an entry under "Unreleased" for
anything a reader or a server operator would notice.

## Unreleased

### Security fixes (AUDIT.md)

- Server: the account, import and difficulty services only answer nginx, which
  sends them a secret (`X-Internal-Token`) that the web container keeps in
  `DATA_PATH/state/internal-token`; their ports are no longer an open back door
  for other processes on the host. Rebuild and restart all containers together.
- Server: the Series and Catalog tools in the admin panel are admin-only in the import
  service itself; an account with only the import permission could reach them
  through a URL nginx didn't match exactly.
- Server: the shared sync folder itself can no longer be deleted or written over
  WebDAV (one DELETE removed every book's data), and nginx's upload folder in it
  (`.tmp`) is no longer reachable. Deleting a book's own folder still works.
- Server: WebDAV MOVEs in the shared sync folder may only rename a file within its
  folder, so a MOVE can no longer write `series.json` or `metadata.json` without the
  series permission.
- Server: a damaged ZIP no longer stops the import queue for good; the file fails
  and the next one is added.
- Server: imports stop below `MIN_FREE_MB` like other uploads (uploads still in
  progress count), and a failed upload no longer leaves a partial file behind.

### Library

- Home and Store are in the top bar in place of "Library"; the logo opens Home.
- Removing a book from Home also takes it off Continue reading until it is read again
  (the shelf has a remove button too).
- The Store sidebar drops the Series and Tags filters (search still finds tags), and
  Books/Series is hidden while the Visual novels filter is on.
- Length filters count books not opened yet when they have a difficulty estimate, and
  100k–300k is split into 100k–150k, 150k–200k and 200k–300k.
- Visual novels can get difficulty estimates, from their scripts. Server: the
  difficulty container mounts `VN_PATH` at `/vn` (read-only).

### Book pages

- Clicking a book in the Store or a cover on Home opens its page instead of reading or
  selecting it: length (with reading time at your speed), progress, difficulty and kanji
  met, publisher, dates, tags and the other books of its series. "Resume" and "Read"
  open the book; a long press or right-click still selects.
- "Find details" on the page searches AniList (books, manga) or VNDB (visual novels)
  and saves the description, genres, score and optionally the cover for everyone
  (`/calibre/sync/metadata.json`). It needs the series permission, now called "Edit
  series and details". Server: the nginx template has a new location for that file.
- "Find details" can also search Jiten (novels, manga, visual novels), with its covers.
  Server: nginx proxies the searches at `/jiten/search` (Jiten's API only allows its own
  site), limited to 20 a minute per address; it needs outbound HTTPS from the web container.
- Details from VNDB replace a visual novel's folder name with its title on the page and
  in the library.

### Visual novels (ONScripter)

- Games from the server's VN folder over 10 MB offer to keep their files in the browser
  (Cache API, HTTPS only) so they start quickly next time; large files show a loading bar.
  The kept files are deleted with the game or when it is removed from Home. Game files
  are held in memory once instead of twice while they load.
- ZIPs of ONScripter games (a folder with `0.txt`, `00.txt`, `nscript.dat`…) open in a
  new player (`/v`) that runs the game in the browser (ONScripter-yuri, WebAssembly).
  Hover the game's own text to look words up with Yomitan: the player lays the page's
  text, invisible, over the characters the engine drew (clicks still go to the game).
  Choices and the system menu's items can be hovered too. The overlay follows the
  engine: it goes when the text does (new page, hidden window, menu or backlog), not on
  clicks, so clicking beside the game to close Yomitan keeps it.
  A panel below the game can show the text too (A button), with ruby as furigana.
  Import them like manga, or add them to Calibre: the catalog now lists them.
- Reading statistics, progress and "Kanji met" count the text as it is read (pages
  read before, or skipped, count once or not at all).
- Saves stay in the browser; for Calibre games they also sync per reader
  (`vnsaves.json` in the account's folder), newest copy of each save file winning.
- Games can also live unpacked in a folder of their own (`VN_PATH`, default
  `DATA_PATH/vn`, one folder per game) instead of Calibre: the catalog lists them in
  the Store, and the player fetches each file only when the game opens it, so nothing
  is downloaded whole or copied to the browser or the sync folder.
- ZIPs of games imported into the Calibre source (Library → Import, `import`
  permission) are unpacked into the visual novel folder instead of Calibre, up to 8 GB
  (Shift JIS file names are read correctly).
- Admin panel → Tools → Catalog rebuilds the catalog on demand.
- The library's Type filter has Visual novels next to Books and Manga.
- Server: nginx compresses `.wasm`.

### Fixes

- Selecting books on Home (long press or right-click) no longer jumps to the Store; the
  shelves show the selection.
- A Calibre manga opened on a device that hadn't cached it yet (already read elsewhere)
  stayed on the loading spinner instead of opening in the manga reader.

### Server

- The account service no longer has `POST /account/api/import-shared` (copying data saved
  while signed out into an account); the app stopped using it, and `STORAGE_ROOT_NAME` is
  no longer read.

### Washi & Sumi redesign

- New look and default themes: Washi (warm paper, ink text, vermilion accent, mincho
  headings) and its dark pair Sumi, also the default pair for "Follow system theme".
  A theme chosen before stays selected; every built-in theme still works, and Sepia,
  Sakura, Nord and Solarized Dark have slightly stronger muted text (WCAG AA).
- Navigation is a flat bar anchored left (ち seal, section links, actions on the
  right); phones get a bottom tab bar.
- Library: covers without card boxes, title and author below, progress only on
  started books, a 読了 seal on finished ones, difficulty as a five-segment meter
  (the number is in the tooltip); quieter filters with counts on the active group.
- Home: today's characters as the main number, the streak, an 18-week reading
  heatmap and larger Continue reading covers with a Resume button.
- Settings: one column of rows instead of cards, switches for on/off settings,
  segmented controls, bordered inputs, collapsible nav groups, search that
  highlights matching rows, a list that drills into sections on phones, a compact
  Account section and a danger zone (clearing zombie statistics now asks first).
- Theme picker is a grid of swatches; the theme editor has a live preview, new
  colours (subtle text, accent hover, focus ring, success/warning, switches,
  progress, cover shadow, difficulty 1–5, heatmap) and warns about low contrast.
  Themes made before keep working: the new colours follow their existing ones.
- Reader panels (companion, search, Ask AI, Listen, notes, selection toolbar) match
  the theme with bordered inputs; the footer shows a hairline of the book's progress.
- Visible keyboard focus everywhere, and reduced motion turns off animations.

- While signed in, the Statistics page and the Home dashboard download the account's
  statistics and reading goals for every book, not only books opened in this browser.

## v3.1.0 (2026-10-12)

### Name and icon

- The app is called Chimimouryou in the tab title, header and installed app, with
  a ち icon in place of ッツ's. "Open Repository" in bug reports links to this fork.

### Difficulty estimates

- New model inputs from the Japanese readability research: the number of common
  words needed for 90/95/98% of a book's words, moving-average type/token ratio,
  relative clauses and predicates per sentence, hiragana share, kanji outside
  常用 and above 教育漢字, and furigana (how much of the kanji has ruby, and
  katakana readings like 本気→マジ). Word origins (和語/漢語) now come from
  UniDic, homographs (事 こと/じ) are looked up by reading, and tables of
  contents, colophons and ads are left out of the text.
- Estimates show a likely range and how many common words cover 95% of the book.
- The library's gauge button is open to every reader: it shows the selected
  books' estimates and how much of their kanji you have already met while
  reading in this browser. Starting estimates still needs the `difficulty`
  permission.
- The model is now called chimi-difficulty (`chimi-difficulty*.onnx`); estimates
  made by the previous model are redone by "Run" (`MODEL_VERSION`
  `chimi-difficulty-1`).

## v3.0.0 and earlier

First public release. Compared with upstream ッツ Ebook Reader:

### Library and server

- **Calibre library as the bookshelf**, served by nginx: a catalog built from
  `metadata.db` (tags, rating, publisher, series from Calibre or guessed from
  volume numbers, unique titles), covers extracted from EPUBs that have none,
  books processed in the browser once and shared through WebDAV.
- **Adding books**: importing a file into the Calibre source queues it for
  `calibredb add`; books whose title names an existing series are offered for it.
  `assign-series.py` writes guessed series into Calibre itself.
- **Library**: Home (learner dashboard, Continue reading, My books) and Store
  (books or series) tabs; filters for reading status, difficulty, series, length,
  tags and type; series in reading order; "Make series"; "Clear progress".
- **Manga**: CBZ and image-only ZIP files, in a page-turning reader (right to
  left, left to right, vertical strip).
- **Difficulty estimates** with Jiten's features and a model distilled from
  jiten.moe's scores, computed on the server on demand, started from the admin panel's Tools tab or for books
  selected in the library. The word frequency list (`jiten_freq_global.zip`)
  can be imported there.

### Accounts and sync

- **Accounts** (no sign-up; admins add them) with an admin panel (`/admin`,
  linked from Settings → Account: accounts, permissions and server tools) and
  per-account permissions (add books, edit series, difficulty estimates). The
  first start creates `admin` with a temporary password, shown in the deploy
  output and the account service's log until it signs in.
- Admin panel tools: **Series** (puts books without a series into the series
  their titles name and merges duplicate series, after a dry run; backs up
  `metadata.db` first) and **Updates** (compares the server with GitHub's main
  branch; servers set up with `scripts/deploy.sh` update and redeploy themselves
  through `ebook-update`, `UPDATE_REPO`). The updater only installs the current
  head of main and touches the shared state folder as the containers' user, so
  a compromised container can't pick the code root builds or redirect its writes.
- Progress, statistics, reading goals, highlights, recaps and lorebooks sync per
  account; AI settings and themes sync through `settings.json`, reader settings
  separately for phones and larger screens.
- Signing in over plain HTTP is possible with `ALLOW_HTTP_ACCOUNTS=1` (off by
  default; the app warns while it is in use).

### Reader

- **Highlights and notes** (four colours), anchored by character counts and drawn
  with the CSS Custom Highlight API; Markdown export.
- **Search** in the book, furigana ignored, with kana-insensitive and regex options.
- **Ask AI** about a selection (OpenRouter, presets, English or Japanese prompts),
  **Story so far** spoiler-free recaps, a **Lorebook** of characters and places
  (SillyTavern format), an **AI voice** (ElevenLabs) that highlights the line being
  read, and **audiobooks** matched to the text by their subtitles. Default models:
  `~google/gemini-flash-latest` for Ask AI, `~deepseek/deepseek-flash-latest` for
  recaps and the lorebook. Settings → AI has a setup guide for the OpenRouter and
  ElevenLabs keys, an "About you" note added to Ask AI questions (e.g. your level)
  and an AI voice speed. Ask AI presets: Explain, Translate and Nuance.
- **Themes** for the whole app, following the system's light and dark mode, with
  a theme editor and import/export (`themes.md`).
- A settings page with sidebar sections and search.

### Running it

- **Docker**: `docker-compose.yml` (web, account, catalog; optional import and
  difficulty), images for amd64 and arm64 published on tags; `scripts/deploy.sh`
  deploys a checkout to a Proxmox container, an SSH host or the local machine.
  Upstream's reader-only image is `docker-compose.static.yml`.
- **Security**: every location except the app checks access (accounts, trusted
  networks, `PUBLIC_READS`, permissions); `TRUSTED_NETWORKS` is empty by
  default, so signed-out visitors get nothing until you list your networks; synced files are served as downloads
  only; book HTML is sanitized and a Content-Security-Policy allows only the
  site's own scripts; sign-in throttling per username and address; uploads stop
  when the disk is nearly full; security headers.
