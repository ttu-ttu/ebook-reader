# Changelog

chimimouryou is a fork of [ッツ Ebook Reader](https://github.com/ttu-ttu/ebook-reader);
upstream's own changes are not listed here. Add an entry under "Unreleased" for
anything a reader or a server operator would notice.

## Unreleased

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
  through `ebook-update`, `UPDATE_REPO`).
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
  networks, `PUBLIC_READS`, permissions); synced files are served as downloads
  only; book HTML is sanitized and a Content-Security-Policy allows only the
  site's own scripts; sign-in throttling per username and address; uploads stop
  when the disk is nearly full; security headers.
