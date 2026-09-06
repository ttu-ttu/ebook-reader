# Custom E-Reader

> A customized, browser-based e-book reader optimized for Japanese language reading, EPUBs, and popup dictionary extensions (Yomitan, etc.).

[![Deploy to GitHub Pages](https://github.com/valpr/custom-ereader/actions/workflows/pages.yml/badge.svg)](https://github.com/valpr/custom-ereader/actions/workflows/pages.yml)
[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](LICENSE)

**Live Reader:** [https://valpr.github.io/custom-ereader/](https://valpr.github.io/custom-ereader/)

This repository is a personalized fork of the excellent [ttu-ttu/ebook-reader](https://github.com/ttu-ttu/ebook-reader).

---

## Why Does This Exist?

1. **Keep Improving ttu-reader**: While the original [ttu-reader](https://github.com/ttu-ttu/ebook-reader) is an outstanding reading platform, upstream updates have slowed down. This fork provides active maintenance, modern dependency updates, and rapid development for new capabilities.
2. **Open & Hackable for the Community**: Kept completely open-source so anyone in the Japanese learning and reading immersion community can benefit from these enhancements, borrow features, or fork and adapt it for their own workflows.
3. **Better Daily Reading Experience**: Purpose-built to solve real-world friction points during long reading sessions—such as multi-bookmarking, accidental scroll fling/glitch recovery, faster navigation, and robust sync across devices.

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

## Changelog: Changes from Base ttu-reader

This fork extends the upstream [ttu-ttu/ebook-reader](https://github.com/ttu-ttu/ebook-reader) with several major features and enhancements:

### 🔖 Multi-Bookmark & Annotation System

_Base ttu-reader only supported a single reading bookmark representing your current progress. This fork introduces a comprehensive multi-bookmark system:_

- **Multiple Named Bookmarks**: Create and manage unlimited bookmarks per book without overwriting your current reading position.
- **Smart Auto-Naming**: Automatically suggests bookmark titles using the active chapter name and character progress percentage (e.g., `Chapter 3 (42%)`), with full support for custom labels and personal notes.
- **Color Tagging**: Assign one of 6 distinct color tags (`Red`, `Blue`, `Green`, `Amber`, `Purple`, `Pink`) to categorize bookmarks (favorite passages, vocabulary, plot points, etc.).
- **Slide-Out Bookmark Drawer**: A dedicated drawer panel (matching the Table of Contents UI/UX) to view, sort by progress, jump to, edit, or delete bookmarks.
- **Visual Margin Indicators**: Colored bookmark ribbon icons appear directly in the text margin at the exact bookmarked position in both paginated and continuous modes (fully compatible with horizontal and vertical Japanese text layouts). Clicking an indicator scrolls directly to that point.
- **In-Place Bookmark Editing**: Modify bookmark labels, color tags, and notes directly from the bookmark manager drawer.
- **Rolling Autosave History & Glitch Recovery**: Automatically captures rolling position checkpoints when pausing on a page for 3 seconds (keeping the latest 10, configurable up to 20). If an accidental gesture, trackpad bug, or browser layout fling causes unexpected rapid scrolling, users can simply open the Bookmarks Manager, switch to the **Autosaves** tab, and jump right back to where they were.
- **Glitch Jump Protection**: Detects abnormal position jumps (>2,000 characters within 1.5s) and immediately preserves the pre-jump reading location so users never lose their place.
- **One-Click Promotion ("Keep")**: Any rolling autosave checkpoint can be converted into a permanent bookmark with a single click.
- **Keyboard Shortcuts**:
  - `Shift + B`: Quick-create a bookmark at current reading position.
  - `Shift + R`: Toggle open/close the bookmark drawer panel.
  - `Shift + N`: Jump forward to the next bookmark in the book.
  - `Shift + P`: Jump backward to the previous bookmark in the book.

### 🔄 Multi-Device Sync, Export & Backup Integration

- **ZIP Backup & Restore**: Full support for exporting and importing user bookmarks inside `.zip` backups (`userBookmarks_...json`).
- **Cloud & Filesystem Sync**: Seamless two-way replication across Google Drive, Microsoft OneDrive, and local filesystem directory handles (`fs`).
- **Smart Merging & Conflict Resolution**: Merges bookmarks across devices without overwriting newer annotations (preserves the most recently modified version per bookmark).
- **Auto-Replication**: Automatically triggers background cloud/filesystem sync whenever bookmarks are created, modified, or removed.
- **Export Selection UI**: Added a dedicated "User Bookmarks" checkbox in the export modal, enabled by default in export preferences.

### 🚀 CI/CD & Deployment

- **Automated GitHub Pages Deployment**: Fully automated build and deploy workflow via GitHub Actions (`pages.yml`).
- **Configurable Base Path**: Native support for subpath hosting (`svelte.config.js` with `BASE_PATH`) and automated `.nojekyll` inclusion.

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
