# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ッツ Ebook Reader is a web-based Japanese e-book reader built with SvelteKit that supports HTMLZ, Plain Text, and EPUB files. The application is designed for Japanese language learners and provides dictionary extension support (like Yomitan), reading statistics tracking, and data synchronization across devices via cloud storage (GDrive, OneDrive) or local filesystem.

**Hosted at**: https://reader.ttsu.app

## Technology Stack

- **Framework**: SvelteKit 2 with Svelte 4
- **Build Tool**: Vite
- **Styling**: TailwindCSS + SCSS
- **State Management**: RxJS with custom Svelte store wrappers
- **Database**: IndexedDB via `idb` library
- **File Processing**: fast-xml-parser, @zip.js/zip.js
- **Icons**: FontAwesome
- **Language**: TypeScript (strict mode)

## Common Development Commands

### Development

```bash
# Start dev server (from root)
pnpm dev

# Start dev server (from apps/web)
cd apps/web && pnpm dev
```

### Building

```bash
# Build production (from root)
pnpm build

# Build production (from apps/web)
cd apps/web && pnpm build
```

### Type Checking

```bash
# Check types
cd apps/web && pnpm check:types

# Svelte type checking
cd apps/web && pnpm check

# Watch mode for Svelte checking
cd apps/web && pnpm check:watch
```

### Linting & Formatting

```bash
# Lint (from root)
pnpm lint

# Check linting without fixing (from root)
pnpm check

# Format code (from root)
pnpm format

# Check formatting (from root)
pnpm check:pretty
```

### Testing Individual Components

```bash
# Run dev server and navigate to specific routes:
# - /manage - Book manager
# - /b/{id} - Book reader
# - /settings - Settings
# - /statistics - Reading statistics
# - /auth - OAuth callback handler
```

## Architecture

### Monorepo Structure

- `apps/web/` - Main SvelteKit application
- Root level contains shared tooling configs (ESLint, Prettier, Husky)

### Core Directory Structure

```
apps/web/src/
├── lib/
│   ├── components/          # Svelte components
│   │   ├── book-reader/     # Main reader UI and logic
│   │   ├── book-card/       # Book manager cards
│   │   ├── settings/        # Settings UI
│   │   └── statistics/      # Statistics visualizations
│   ├── data/                # State management and data types
│   │   ├── database/        # IndexedDB schema and operations
│   │   │   └── books-db/    # Main database (version 6)
│   │   ├── storage/         # Cloud storage handlers
│   │   │   ├── handler/     # GDrive, OneDrive, Filesystem implementations
│   │   │   └── storage-oauth-manager.ts
│   │   └── store.ts         # Global RxJS state stores
│   └── functions/           # Utility functions
│       ├── file-loaders/    # EPUB, HTMLZ, TXT parsers
│       ├── replication/     # Data sync logic
│       └── rxjs/            # RxJS operators
├── routes/                  # SvelteKit routes
│   ├── +layout.svelte       # Root layout
│   ├── +page.svelte         # Landing page (redirects)
│   ├── b/                   # Book reader route
│   ├── manage/              # Book manager
│   ├── settings/            # Settings page
│   ├── statistics/          # Statistics page
│   └── auth/                # OAuth callback
└── service-worker.ts        # PWA service worker
```

### State Management Pattern

The application uses a custom reactive state system combining RxJS BehaviorSubjects with Svelte stores:

- **`store.ts`** - Central state definition using custom `writable*LocalStorageSubject` functions
- State is persisted to localStorage automatically
- Components subscribe to observables using `$` syntax
- Examples: `theme$`, `fontSize$`, `hideFurigana$`, `writingMode$`

### Database Architecture

**IndexedDB Schema (v6)** via `factory.ts`:

- `data` - Book content and metadata (key: `id`)
- `bookmark` - Reading progress per book (key: `dataId`)
- `statistic` - Daily reading stats (composite key: `['title', 'dateKey']`)
- `readingGoal` - Reading goals (key: `goalStartDate`)
- `storageSource` - Cloud storage credentials (encrypted)
- `lastModified` - Sync timestamps
- `audioBook` - Audiobook positions (ttu-whispersync integration)
- `subtitle` - Subtitle data
- `handle` - File system access handles

Database service is exposed via `DatabaseService` class in `database.service.ts`.

### File Loading System

Book files are processed through format-specific loaders in `lib/functions/file-loaders/`:

- **EPUB**: XML parsing, spine ordering, TOC extraction
- **HTMLZ**: ZIP extraction, HTML processing
- **TXT**: Paragraph segmentation by Japanese punctuation (。？！」）)

All loaders generate normalized HTML output that the reader component can display.

### Storage Sync Architecture

Multi-source data replication system in `lib/data/storage/`:

1. **Storage Sources**: Browser DB, GDrive, OneDrive, Filesystem API
2. **OAuth Manager** (`storage-oauth-manager.ts`): Handles token refresh and authentication
3. **Replication** (`lib/functions/replication/`): Conflict resolution with merge modes
4. **Security**: Encrypted credentials stored locally, password-protected storage sources

Data types synced: Book content, bookmarks, statistics, reading goals, audiobook positions.

### Reading Statistics System

Located in `lib/components/statistics/`:

- **Heatmap** visualization of daily reading activity
- **Summary** tables with aggregation by day/week/month
- **Reading Goals** with configurable frequency (daily/weekly/monthly)
- **Tracker** in reader captures time and character count with idle detection

Statistics stored per book+date in IndexedDB, with min/max reading speed tracking.

### Component Patterns

- Components use Svelte 4 syntax
- Reactive statements with `$:` for derived state
- Custom stores subscribe with `$store` syntax
- Event dispatching via `createEventDispatcher()`
- Popover/dialog components use `popover.ts` positioning logic
- Ripple effects via `ripple.svelte` component

### Keybind System

Keybinds use physical keyboard locations (KeyboardEvent.code):

- Book reader: `book-reader-keybind.ts` (space, a/d, b, r, t, p, f, n/m, PageUp/Down)
- Statistics: `statistics-tab-keybind.ts` (t, a)
- Image gallery: `book-reader-image-gallery`

## Important Implementation Details

### Character Counting

Japanese character counting excludes Latin letters and punctuation. Used for progress tracking and statistics. Implementation in `get-character-count.ts`.

### Furigana Handling

Controlled by `furiganaStyle$` store with modes: Full, Partial, Toggle. Rendering logic in reader components.

### Text Segmentation (TXT files)

Paragraphs split by Japanese punctuation: `。？！` and closing brackets `」）`. Sections created around 10,000 characters each.

### Image Blur System

`BlurMode` enum controls spoiler image handling:

- `NEVER`, `ALWAYS`, `AFTER_TOC`
- Unidirectional from reader to gallery

### Storage Security

External storage credentials are encrypted with user-provided passwords. Password manager integration uses `PasswordCredentials API` when available.

### Service Worker

Caches book assets and custom fonts. Custom fonts may require tab refresh on first load.

### Reading Tracker

- Auto-pause on idle, window resize, menu open, chapter change
- Freeze position for rereading without affecting stats
- 10-second persistence interval
- Min/max speed tracking (not rollback-aware)

## Environment Variables

For local development or self-hosting (`.env.local` in `apps/web/`):

```bash
VITE_STORAGE_ROOT_NAME="ttu-reader-data"
VITE_GDRIVE_CLIENT_ID="..."
VITE_GDRIVE_CLIENT_SECRET="..."
VITE_GDRIVE_AUTH_ENDPOINT="https://accounts.google.com/o/oauth2/v2/auth"
VITE_GDRIVE_TOKEN_ENDPOINT="https://oauth2.googleapis.com/token"
VITE_GDRIVE_REFRESH_ENDPOINT="https://oauth2.googleapis.com/token"
VITE_GDRIVE_REVOKE_ENDPOINT="https://oauth2.googleapis.com/revoke"
VITE_GDRIVE_SCOPE="https://www.googleapis.com/auth/drive.file"
VITE_ONEDRIVE_CLIENT_ID="..."
VITE_ONEDRIVE_CLIENT_SECRET="..."
VITE_ONEDRIVE_AUTH_ENDPOINT="https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize"
VITE_ONEDRIVE_TOKEN_ENDPOINT="https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
VITE_ONEDRIVE_DISCOVERY="https://login.microsoftonline.com/consumers/v2.0/.well-known/openid-configuration"
VITE_ONEDRIVE_SCOPE="files.readwrite"
```

## Git Workflow

- Main branch: Auto-deploys to Cloudflare Pages on commits starting with `feat:`, `fix:`, or `perf:`
- Commitlint enforces conventional commits
- Husky + lint-staged runs ESLint and Prettier on pre-commit
- Current feature branch: `feature/color-words-by-anki-interval`

## Code Style

- ESLint config in `eslint.config.js` (flat config)
- Prettier with Svelte and Tailwind plugins
- TypeScript strict mode enabled
- File headers include BSD-3-Clause license
- Immutable Svelte compiler mode

## Testing Considerations

- No formal test suite currently
- Manual testing via dev server
- IndexedDB uses real browser storage (consider `fake-indexeddb` for tests)
- Service worker requires HTTPS or localhost

## Performance Notes

- Pagination mode more performant than continuous for large books
- Vertical writing mode (traditional Japanese) is default
- Auto-scroll uses requestAnimationFrame for smooth rendering
- Statistics calculations can be expensive with large date ranges
- IndexedDB operations are async - use proper loading states
