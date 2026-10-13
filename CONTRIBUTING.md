# Contributing

How to change this fork. See `ARCHITECTURE.md` for how the pieces fit together,
`docs/INSTALL.md` for running it and `CLAUDE.md` for a dense map of the code.

## Ground rules

- Avoid editing upstream files when a new file will do, so merging upstream
  (`git fetch upstream && git merge upstream/main`) stays easy.
- New modules start with the license header ESLint requires, then a short
  comment saying what the module is for and "Not part of upstream":

  ```ts
  /**
   * @license BSD-3-Clause
   * Copyright (c) 2026, ッツ Reader Authors
   * All rights reserved.
   */

  /**
   * What this module does and why. Not part of upstream.
   */
  ```

- Svelte 4 syntax (`export let`, `$:`, stores with `$`), not runes. RxJS
  `BehaviorSubject` stores for settings (`writable*LocalStorageSubject`).
- Colours come from theme CSS variables (`var(--surface-strong-color)`,
  `var(--reader-panel-bg)`, …), never fixed values.
- Commit messages: `fix: …`, `feat: …`, `refactor: …`, `test: …`, `docs: …`,
  `style: …`. One logical change per commit; bug fixes don't include refactors.
- Add a line to `CHANGELOG.md` for anything a user or the server would notice.
- Never put API keys, passwords or other secrets in the repository, in shared
  sync files (`/calibre/sync/`), in URLs or in log/error messages
  (`redactSecret` in `data/ai-settings.ts`).

## Commands

Front end (Node 24; pnpm 10 comes from `packageManager` via `corepack enable`):

```sh
pnpm install
cd apps/web && pnpm test && pnpm check   # Vitest; svelte-check (30 known errors)
cd ../.. && npx eslint .                 # clean
cd apps/web && pnpm dev                  # dev server; the server side needs the Docker stack
```

Without Node on the machine, run the same in a container from the repository root:

```sh
docker run --rm -e HUSKY=0 -v "$PWD":/src -w /src node:24-slim sh -c \
  'corepack enable && pnpm install --frozen-lockfile && cd apps/web && pnpm svelte-kit sync && pnpm test && pnpm check'
```

Python tests (catalog builder, account and import services, frequency list):

```sh
python3 -m unittest discover -s scripts/calibre/tests
```

Run the whole thing: `docker compose up -d --build` (see `docs/INSTALL.md`).
Restarting the stack stops a running difficulty job; check
`/calibre/difficulty/api/status` first.

## CI and releases

- `.github/workflows/ci.yml` runs on every push and pull request: ESLint, unit
  tests and a production build of the front end; the Python tests and an nginx
  config render; the compose files and a build of all four images.
- `.github/workflows/release.yml` publishes the images for amd64 and arm64 to
  GitHub's container registry when a version tag is pushed:

  ```sh
  git tag v1.2.0 && git push origin v1.2.0
  ```

  gives `ghcr.io/<owner>/<repository>-{web,services,import,difficulty}` tagged
  `1.2.0`, `1.2` and `latest` (pre-releases like `v1.2.0-rc1` don't move
  `latest`). Add a `CHANGELOG.md` heading for the version first. The first
  publish creates private packages: make them public in the repository's
  Packages settings.
- Check workflow changes with `actionlint` (e.g. `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint .github/workflows/*.yml`).

## Testing expectations

- Unit tests sit next to the module (`foo.ts` → `foo.test.ts`) and use Vitest with
  jsdom. Python tests live in `scripts/calibre/tests/` and use `unittest`.
- A bug fix comes with a test that fails before the fix.
- Before refactoring code without tests, add tests that pin its current behaviour.
- Svelte compiles with `immutable: true`: a store or variable only updates when
  it gets a new object, so `set = new Set([...set, x])`, not `set.add(x)`.
- Patterns to copy:
  - Components: mount with `new Component({ target, props })`, click, then
    `vi.waitFor` (see `reader-companion.test.ts`). Modules reading
    `window.matchMedia` need a stub (see `account-settings-sync.test.ts`).
  - IndexedDB: `import 'fake-indexeddb/auto'` (see `annotations.test.ts`).
  - Network: `vi.stubGlobal('fetch', vi.fn(...))` and assert on what was sent
    (see `account-settings-sync.test.ts`, `tts.test.ts`).
  - Signed-in state: `vi.mock('$lib/data/account', …)` with a hoisted user.
  - The storage handlers import each other: import
    `$lib/data/storage/storage-handler-factory` before a handler, or mock
    `calibre-handler` (see `calibre-handler.test.ts`).
- `pnpm check` has 30 errors that predate the fork; only new ones matter.
- Reader changes also need a manual check with a book open (paginated and
  continuous modes), since the reader page has no automated tests.

## Adding things

**A setting** - add a store with `writable*LocalStorageSubject` (in
`data/store.ts`, or `data/ai-settings.ts` for AI), a control in the relevant
`components/settings/` component inside a `SettingsItemGroup` (so search finds
it), and, to sync it with accounts, the store in `sharedSettings` or
`readerSettings` in `data/account-settings-sync.ts`. A secret also goes in
`secretSettings`, so it is removed when the account changes.

**A reader feature** - put the logic in `lib/data/` or `lib/functions/` as plain
TypeScript with tests, the UI in `components/book-reader/`, and keep the glue in
`routes/b/+page.svelte` small. Positions are character counts
(`text-positions.ts`), never DOM offsets.

**A per-reader file for Calibre books** - either a prefix in
`CalibreStorageHandler.isPersonalFile` (synced like progress), or a file of its
own through `CalibreStorageHandler.syncFileUrl(title, name)` (like
`annotations.json`).

**A server endpoint** - add a route to the service's `ROUTES` (accounts) or
`do_GET`/`do_POST` (difficulty), proxy it in `nginx-ebook-reader.conf.template` if it
needs a new location (with an `auth_request` check; new `${…}` placeholders go in
`render-nginx.sh`'s list), add a test in `scripts/calibre/tests/`, and rebuild the
stack. Account POST routes get the HTTPS and Origin checks automatically.

**A configuration option** - read it from the environment in the service (or
`render-nginx.sh` for nginx), pass it through `docker-compose.yml`, document it in
`.env.example` and `docs/CONFIGURATION.md`, and keep the default safe.

## Example: a typical change

Adding a "Copy" button to the Ask AI answer:

1. `git switch -c copy-button && git status` - a branch, starting clean.
2. If the logic is more than a line, add it to a module in `lib/data/` or
   `lib/functions/` with a test.
3. Add the button in `components/book-reader/ask-ai-panel.svelte`, styled with
   theme variables.
4. Run `pnpm test`, `pnpm check` (still 30 errors) and `npx eslint .` (clean).
5. Rebuild and restart the stack, then open a book on the HTTPS address, select
   text, ask, and try the button. Check `/version.txt`.
6. Add a `CHANGELOG.md` line and commit: `feat: copy button for Ask AI answers`.
