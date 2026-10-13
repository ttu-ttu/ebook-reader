# chimimouryou

A self-hosted Japanese e-book reader for your Calibre library: a fork of
[ッツ Ebook Reader](https://github.com/ttu-ttu/ebook-reader) that turns
the browser-based Japanese e-book reader into a reader for your own server: point
it at a Calibre library and everyone in the house reads from it, with accounts,
synced progress and highlights, and tools for language learners. The reader
itself, and its Yomitan support, are upstream's (see [Using the reader](#using-the-reader)).

![Reading 坊っちゃん in vertical text, with a highlight and the selection toolbar](assets/readme/screenshots/reader.png)

| Library                                                       | AI settings                                                       | Phone                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ![Library with the Store tab](assets/readme/screenshots/store.png) | ![Settings → AI](assets/readme/screenshots/settings.png) | <img src="assets/readme/screenshots/phone-store.png" alt="Library on a phone" width="200"> |

<sub>Books shown: public-domain texts from [青空文庫](https://www.aozora.gr.jp/).</sub>

**What it adds**

- **Your Calibre library** as the bookshelf: covers (extracted from EPUBs that
  have none), series (Calibre's or guessed from volume numbers), tags, a
  Home/Store layout with "Continue reading", filters and sorting. Books open
  straight from the server; adding a file puts it into Calibre.
- **Accounts** with an admin panel and per-account permissions; progress,
  statistics, highlights and settings sync across devices.
- **Highlights and notes**, full-text search (ignoring furigana), and a reader
  companion with your highlights.
- **AI helpers** with your own keys: Ask AI about a selection, "Story so far"
  spoiler-free recaps, a lorebook of characters and places, and an AI voice that
  reads aloud with the current line highlighted. Audiobooks with subtitles follow
  the text too.
- **Manga** (CBZ/ZIP) in a page-turning reader.
- **Visual novels** for ONScripter, played in the browser (a WebAssembly build of
  ONScripter-yuri) with their text laid over the game for Yomitan, an optional
  text panel below it, and the text counted in progress, reading statistics and
  kanji met. Games come as ZIPs or unpacked folders on the server (`VN_PATH`);
  importing a game ZIP unpacks it there. Saves sync across devices, big games can
  be kept offline, and the library shows VNDB details and difficulty estimates
  from the script. Games for other engines can often be converted with
  [conscripter-convert](https://github.com/blankiekun/conscripter-convert).
- **Difficulty estimates** with [Jiten](https://github.com/Sirush/Jiten)'s
  features and a model trained on jiten.moe's scores, computed on your server.
- **App-wide themes** that follow the system's light and dark mode.

## Setup

You need [Docker](https://docs.docker.com/get-docker/) with the Compose plugin
(Docker Desktop on Windows and macOS). Prebuilt images exist for amd64 and arm64.

**1. Get it**

```sh
git clone https://github.com/blankiekun/chimimouryou && cd chimimouryou
cp .env.example .env
```

In `.env`, set:

```sh
IMAGE_PREFIX=ghcr.io/blankiekun/chimimouryou   # prebuilt images, nothing to compile
IMAGE_TAG=latest
COMPOSE_PROFILES=import                        # add books from the app
PUID=1000                                      # your `id -u` and `id -g` (Linux)
PGID=1000
```

**2. Choose a library**

- **An existing Calibre library**: point at the folder that holds `metadata.db`
  (quote paths with spaces):

  ```sh
  LIBRARY_PATH="/home/you/Calibre Library"
  ```

  The server adds a `cover.jpg` to book folders without one, and books you add
  in the app go into Calibre. Back the library up first, and close Calibre
  while you add books from the app.

- **A new, empty library**: set `LIBRARY_PATH=./library`, then create it:

  ```sh
  mkdir library
  docker compose run --rm --no-deps import calibredb --with-library /library list
  ```

  After you sign in, add books with Import in the library or by dropping files
  on it. The library is a normal Calibre library, so Calibre can open it later.

**3. Choose how you reach it**

- **Just this computer** (a laptop or desktop): sign in over plain HTTP. The
  port is only open to this machine, so passwords never cross a network.

  ```sh
  HTTP_PORT=127.0.0.1:8080
  ALLOW_HTTP_ACCOUNTS=1
  ```

  Open <http://localhost:8080>.

- **A server** (home server, VPS) for several people or devices: keep
  `ALLOW_HTTP_ACCOUNTS=0` and put HTTPS in front. With
  [Caddy](https://caddyserver.com/) on the same machine (it gets the certificate
  itself), set

  ```sh
  HTTP_PORT=127.0.0.1:8080
  REAL_IP_FROM=172.16.0.0/12      # Docker's network: Caddy's requests come from there
  ```

  and add this to the Caddyfile:

  ```
  books.example.com {
    reverse_proxy 127.0.0.1:8080
  }
  ```

  Open `https://books.example.com`. No domain? `tailscale serve --bg 8080`
  gives an HTTPS address inside your tailnet. Other proxies:
  [docs/INSTALL.md](docs/INSTALL.md#https).

**4. Start it and sign in**

```sh
docker compose up -d
docker compose exec account ebook-account initial-admin
```

The second command shows the password of the first account, `admin`. Sign in
(person icon at the top right), and change the password in Settings → Account.
There is no sign-up: add the other readers in Settings → Account → Admin panel.
The library fills in about a minute after the first start (longer for a big
library, while covers are extracted).

Update with `git pull && docker compose pull && docker compose up -d`. The
[install guide](docs/INSTALL.md) has the rest: trusted networks (reading without
signing in), permissions, backups, difficulty estimates and building the images
yourself.

**Documentation**

- [docs/INSTALL.md](docs/INSTALL.md): installing, HTTPS, accounts, who may do what
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md): every setting
- [ARCHITECTURE.md](ARCHITECTURE.md): how it works; [CONTRIBUTING.md](CONTRIBUTING.md): changing it
- [docs/QA.md](docs/QA.md): test plan; [CHANGELOG.md](CHANGELOG.md); [themes.md](themes.md): writing themes
- Prebuilt images: `ghcr.io/blankiekun/chimimouryou-{web,services,import,difficulty}` (see INSTALL.md, "Updating")

**Credits**: [ッツ Ebook Reader](https://github.com/ttu-ttu/ebook-reader) by
ッツ Reader Authors (BSD 3-Clause, see [LICENSE](LICENSE)), from which this fork
derives; [Jiten](https://github.com/Sirush/Jiten) for the difficulty features and
deconjugation rules (Apache-2.0, see [NOTICE](NOTICE)). chimimouryou is not
affiliated with or endorsed by either project.

## Using the reader

The reader is upstream's [ッツ Ebook Reader](https://github.com/ttu-ttu/ebook-reader)
(EPUB, HTMLZ and plain text; continuous or paginated, vertical or horizontal; works
with Yomitan and other dictionary extensions). Upstream's
[README](https://github.com/ttu-ttu/ebook-reader#readme) has the full reference:
the reading tracker, statistics, import/export merge modes and setting up your own
GDrive or OneDrive credentials (not needed with the Calibre library).

Click or tap the top of the page to open the reader header:

| Control                                              | Description                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| ![Icon](assets/readme/control-toc.svg)               | Table of contents                                                   |
| ![Icon](assets/readme/control-bookmark.svg)          | Bookmark the current position (<kbd>b</kbd>)                        |
| ![Icon](assets/readme/control-bookmark-scroll.svg)   | Return to the bookmark (<kbd>r</kbd>)                               |
| ![Image](assets/readme/book-scroll-speed.png)        | Auto-scroll speed (<kbd>a</kbd>/<kbd>d</kbd>)                       |
| ![Icon](assets/readme/control-finish.svg)            | Mark the book as finished                                           |
| ![Icon](assets/readme/control-reading-point.svg)     | Pick a custom reading point (<kbd>t</kbd>)                          |
| ![Icon](assets/readme/control-fullscreen.svg)        | Fullscreen (<kbd>F11</kbd>)                                         |
| ![Icon](assets/readme/control-reader-statistics.svg) | Statistics for this book                                            |
| ![Icon](assets/readme/control-jump.svg)              | Jump to a character position                                        |
| ![Icon](assets/readme/control-image-gallery.svg)     | Image gallery                                                       |
| ![Icon](assets/readme/control-settings.svg)          | Settings                                                            |
| ![Icon](assets/readme/control-manager.svg)           | Library                                                             |

The footer shows the reading tracker
(![Icon](assets/readme/control-reader-timer-paused.svg) paused: double-tap to
start, tap for its menu) and the progress
(![Image](assets/readme/book-progress.png), C = chapter, T = book; tap to copy).
Progress counts Japanese characters only, without Latin letters or punctuation.

**Desktop keys** (physical positions, so the same keys on any layout):

| Key                                     | Action                                                   |
| --------------------------------------- | -------------------------------------------------------- |
| <kbd>Space</kbd>                        | Toggle auto-scroll (continuous mode)                     |
| <kbd>a</kbd> / <kbd>d</kbd>             | Auto-scroll faster/slower; paginated: next/previous page |
| <kbd>PageDown</kbd> / <kbd>PageUp</kbd> | Next/previous page                                       |
| <kbd>n</kbd> / <kbd>m</kbd>             | Next/previous chapter                                    |
| <kbd>b</kbd> / <kbd>r</kbd>             | Bookmark / return to bookmark                            |
| <kbd>t</kbd>                            | Custom reading point                                     |
| <kbd>p</kbd> / <kbd>f</kbd>             | Toggle the reading tracker / its freeze position         |
| <kbd>Ctrl</kbd>+<kbd>F</kbd>            | Search the book                                          |

Good to know:

- EPUBs that render wrongly (e.g. unclosed links swallowing the text) may import
  correctly with Settings → Data → "Epub Import Fixes" set to standard or extended.
- Plain-text books are titled after the file name and split into paragraphs at
  。？！」）.
- Books read from the Calibre library come back from the server, but other
  browser data (settings without an account, books imported only into the browser)
  lives in the browser's storage, which the browser may clear when the disk fills
  up. Settings → Data shows whether storage is persistent.
