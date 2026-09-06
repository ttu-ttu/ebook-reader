# Custom E-Reader

> A customized, browser-based e-book reader optimized for Japanese language reading, EPUBs, and popup dictionary extensions (Yomitan, etc.).

[![Deploy to GitHub Pages](https://github.com/valpr/custom-ereader/actions/workflows/pages.yml/badge.svg)](https://github.com/valpr/custom-ereader/actions/workflows/pages.yml)
[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](LICENSE)

**Live Reader:** [https://valpr.github.io/custom-ereader/](https://valpr.github.io/custom-ereader/)

This repository is a personalized fork of the excellent [ttu-ttu/ebook-reader](https://github.com/ttu-ttu/ebook-reader).

---

## Features

- **Format Support**: EPUB, HTMLZ, and Plain Text files.
- **Reading Modes**: Vertical and horizontal text layouts, paginated or continuous scrolling.
- **Immersion-Ready**: Seamless integration with dictionary extensions like Yomitan / Rikaikun.
- **Customizable Experience**: Custom fonts, themes, line spacing, margins, and furigana display options.
- **Completely Client-Side & Private**: All books, progress, and settings are stored locally in your browser via IndexedDB—no external servers required.
- **Offline Capable (PWA)**: Installable as a Progressive Web App for offline reading on desktop and mobile.
- **Reading Tracker & Statistics**: Track characters read, reading time, and reading sessions.

---

## Live Deployment

The reader is automatically built and deployed to GitHub Pages on every push to `main`:

**URL:** [https://valpr.github.io/custom-ereader/](https://valpr.github.io/custom-ereader/)

---

## Local Development

### Prerequisites

- **Node.js**: v20 or higher (v24 recommended)
- **pnpm**: v9 or higher

### Getting Started

1. **Clone the repository:**

   ```bash
   git clone https://github.com/valpr/custom-ereader.git
   cd custom-ereader
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Start the local development server:**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:5173](http://localhost:5173) in your browser.

4. **Build for production:**
   ```bash
   pnpm build
   ```
   The static production output will be generated in `apps/web/build/`.

---

## Upstream Synchronization

To pull latest improvements and fixes from upstream:

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

---

## Acknowledgements & License

- Original project and architecture by [ttu-ttu](https://github.com/ttu-ttu/ebook-reader).
- Distributed under the [BSD-3-Clause License](LICENSE).
