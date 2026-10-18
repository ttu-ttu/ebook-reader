# Changelog

chimimouryou is a fork of [ッツ Ebook Reader](https://github.com/ttu-ttu/ebook-reader);
upstream's own changes are not listed here. Add an entry under "Unreleased" for
anything a reader or a server operator would notice.

## Unreleased

### Library

- Deleting books in the Calibre library (select mode → Delete) now removes them from the
  library for admins, after a confirmation: books go to Calibre's recycle bin
  (`calibredb remove`), visual novel folders are deleted, and the catalog is rebuilt
  (`POST /calibre/import/api/remove`, admins only). For other accounts, Delete still
  removes only the synced data. The import service empties Calibre's recycle bin of books
  deleted more than 14 days ago once a day (Calibre itself only does so when the library
  is opened).

### Manga

- The manga reader works more like Mihon: pinch, double tap or Ctrl+wheel to zoom, and drag
  a zoomed page around; swipes drag the page along with the finger; scale types (fit screen,
  width, height, original size, smart fit); two-page spreads on screens wider than tall (the
  cover and wide pages stand alone, Shift fixes pairs that are off by one); and a settings
  sheet (gear in the menu) for these, the background (black, gray, white or matched to the
  page), double tap to zoom, keeping the screen on and the page number. Full screen is in the
  menu. The next few pages are decoded ahead, so turning is instant.

### Visual novels

- Game sound no longer hiccups in Firefox (CONscripter v0.25.1 queues its audio ahead instead
  of filling it at the last moment on a busy page).

## v3.6.0 (2026-10-15)

### Visual novels

- Anki mining checks that a new card's sentence is from the game: the player keeps the last
  500 lines with their voice files (the newest 30 also with their screenshot and sound), and
  the card gets those of the line its Sentence field came from, even when the line has moved
  on by the time the card is noticed. Backlogs can be mined too, the built-in one and
  script-drawn ones: the card gets the line's voice and its screenshot from when it was shown,
  or the backlog's screen for older lines. Cards whose sentence isn't from the game (mined in
  another tab, for example) are left alone.

## v3.5.0 (2026-10-15)

### Visual novels

- Vertical text (e.g. Muramasa) is laid out as columns in the Yomitan overlay
  (`writing-mode: vertical-rl`), so lookups span several characters and the popup opens
  beside the column instead of over it.
- Synced saves (`vnsaves.json`) record the CONscripter version that wrote them. Opening a
  game whose saves come from a newer engine than the server's shows a notice: saves should
  be backward compatible, but an admin can update the engine if one doesn't load.
- CONscripter v0.23.0, which renames its web interface from ONScripter-yuri's `onsyuri*`
  names to `cons*` (`consText`, `g_cons_module`, `cons()`…); the player uses the new names,
  so it needs v0.23.0 or later, and `scripts/conscripter/build.sh` (and the admin panel's
  engine install) refuses older releases. Servers on v3.4.0 or older refuse v0.23.0 the
  same way, so update chimimouryou to get the new engine. Also new in the engine: sprite
  motions keep moving during a screen effect, arrows turn in vertical text, `openurl`,
  `strspoutline`, and global variables (unlocks) are saved at any wait, so auto mode
  keeps them.
- CONscripter v0.19.0. Anki cards get the line's voice file instead of a live recording
  (also for backlog pages; voices inside `.nsa` archives are still recorded), text the game
  has as read before (its kidoku data, also from other devices) no longer counts again,
  Yomitan's scan keys stop auto mode, and the header has toggles for the game's furigana
  and instant text.

### Documentation

- The README has a Features section with new screenshots (Home, Store, a book's page,
  search, highlights, Ask AI, manga, themes, the admin panel) instead of the reader controls
  reference, which stays in upstream's README.
- ARCHITECTURE, CONTRIBUTING, CONFIGURATION and QA brought up to date (plugins,
  Audiobookshelf, Anki, Whisper, offline reading, the book page, visual novel settings).

### Fixes

- Admin panel → Tools → Visual novel engine showed the old version after an install (the
  browser's offline copy answered the version check) and offered to install it again.

## v3.4.0 (2026-10-13)

### Updates

- A page left open across an update reloads itself once when it can no longer load parts
  of the old version, instead of showing a network error until a hard reload.
- Offline, or away from the server's network: the library lists the books already
  downloaded to the browser (with a note and a retry link, retried by itself when the
  connection returns) instead of an error and an empty library, and those books open
  from the browser copy instead of failing to load. Progress made meanwhile uploads
  once the server can be reached again.
- Books on Home (My books and Continue reading, not visual novels) are downloaded to the
  browser in the background while the library is open, so they can be read offline
  without opening them first.

### Visual novels

- Game files kept in the browser for games no longer in the library (removed from the
  server's folder, or deleted on another device) are deleted when the library loads.
- A game's length and difficulty estimate no longer count the name and voice tags at the
  start of lines (`[name|voice/v123.ogg]`) or colour and text size codes; voiced games
  were counted up to half again too long. Games processed before keep their old length
  until processed again; estimate them again for the difficulty.

## v3.3.0 (2026-10-13)

### Setup

- The README starts with a setup guide: a new or an existing Calibre library, on your own
  computer (HTTP sign-in on localhost) or on a server behind HTTPS.
- Signed out where the library needs an account, the library asks you to sign in instead
  of showing "Calibre catalog unavailable (HTTP 401)" and switching to browser storage.
- The plain-HTTP warning in Settings → Account is not shown on localhost, where nothing
  crosses a network.
- The Browser library source is gone from server builds (only the reader-only static build
  has it); a saved Browser choice moves to Calibre. Books stay cached in the browser as
  before.

### Visual novel engine updates

- Admin panel → Tools → Visual novel engine can install a new CONscripter release: the
  server's updater downloads it and rebuilds only the web container. App updates keep an
  engine installed this way when it is newer than the one in the commit.
- Server: `admin/update` also takes `{"engine": "<tag>"}` (only CONscripter's latest
  release is installed).

### Visual novel lookups in backlogs

- Yomitan works in visual novel backlogs: the engine's own and those a game's script draws
  (CONscripter 0.12.0 sends the text of `strsp` sprites whenever the game waits for input),
  and in script menus drawn the same way.
- The text box can be scanned again right after closing a backlog or menu that hid the text
  window, instead of only after the next click.

### Whisper subtitles

- The audiobook and Audiobookshelf players can make their own subtitles: Whisper runs in
  the browser (WebGPU when available, much slower without) and the result is matched to
  the book like a loaded SRT, and can be downloaded. The model (Base, Small or Large v3
  Turbo) downloads once from Hugging Face. Keep the tab open while it works.
- Server: nginx serves `.mjs` files as JavaScript (Whisper's runtime needs it).

## v3.2.0 (2026-10-13)

### Plugins

- Settings → General → Plugins switches optional features on or off for your account;
  every plugin starts off. The AI tools (Ask AI, Story so far, Lorebook, the AI voice
  and the ElevenLabs fallback for Anki cards) are now the "AI tools" plugin: switch it
  on to get them back; while off, their buttons, tabs and settings are hidden.
- New Audiobookshelf plugin: Listen → Audiobookshelf finds the book's audiobook on
  your Audiobookshelf server and streams it, keeping the listening position there
  (a single file out of a folder of several books keeps it in the browser). Books are
  matched by series name and volume, so titles with tags like (MFブックス) and
  audiobooks stored as one folder of volumes are found. With subtitles (an SRT or VTT
  stored next to the audio in Audiobookshelf, or loaded with the CC button) the line
  being read is highlighted, as in the audiobook mode. Sign in
  under Settings → Audiobookshelf. Server: set `AUDIOBOOKSHELF_URL`; nginx forwards
  only Audiobookshelf's API and sign-in, at `/audiobookshelf/`, to signed-in readers.

### Updates

- Admin panel → Tools → Updates has two channels: Stable (the default) updates to
  the latest release, Bleeding edge to the newest commit on main. Server: the
  updater accepts either; deploy.sh's `version.txt` now always names the commit.

### Visual novel engine

- The visual novel player runs CONscripter v0.10.0, taken from its own web release
  (`scripts/conscripter/build.sh` downloads the latest one; our text hook is now part of
  CONscripter). Admin panel → Tools → Visual novel engine shows the installed and the
  latest release.

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
- Difficulty: uploading the frequency list no longer hangs until nginx times out
  with a 504.
- Accounts: when another account (or nobody) uses the browser, the previous reader's
  progress, statistics and reading goals for Calibre books are removed from it, so
  they are no longer shown to or synced into the next account. They come back from
  the server at the next sign-in.
- Accounts: AI keys typed while signed out are removed when an account signs in,
  instead of being saved to that account.
- Reader: the page only loads images from the server and the cover sites "Find
  details" uses, and fonts and stylesheets from the server, so a book's CSS can no
  longer reach outside hosts.
- Reader: a recap or lorebook update saved while its sync was fetching the server
  copy is no longer overwritten by that sync.
- Server: the sign-in rate limit can no longer be skipped with a trailing slash
  (`/account/api/login/`).
- Server: nginx only believes `X-Forwarded-Proto` from the addresses in
  `REAL_IP_FROM`. **Upgrading:** behind a reverse proxy that terminates HTTPS, set
  `REAL_IP_FROM` (docs/INSTALL.md → HTTPS) or signing in stops working.
- Difficulty: estimate, cancel and frequency list requests must come from the
  reader's own page (Origin check), like imports. Restart the stack with the new
  compose file (the difficulty service now reads `ALLOW_HTTP_ACCOUNTS`).

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

### Anki mining

- Settings → Anki: with AnkiConnect, cards you add (e.g. with Yomitan) while a book or
  visual novel is open get media: for books the sentence cut from the book's audiobook
  (or, optionally, read by the AI voice when there is none or it lacks the sentence), for visual novels a screenshot and the game's sound since
  your last click. Fields already filled are left alone. Add the site's address to
  AnkiConnect's `webCorsOriginList`.

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
