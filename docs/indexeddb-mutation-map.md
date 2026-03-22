# IndexedDB Mutation Map (Web App)

Last updated: 2026-03-22

This document inventories every place in `apps/web` where IndexedDB rows are inserted, updated, or deleted (including clear operations and mutating reads), so debugging cache/data drift is easier.

## Scope

- Runtime row mutations in:
  - `apps/web/src/lib/data/database/anki-cache-db/anki-cache.service.ts`
  - `apps/web/src/lib/functions/anki/color-book-content.ts`
  - `apps/web/src/lib/data/yomitan/yomitan.ts`
  - `apps/web/src/lib/data/database/books-db/database.service.ts`
  - direct DB writes in storage handlers
- Schema/migration mutations in:
  - `apps/web/src/lib/data/database/anki-cache-db/factory.ts`
  - `apps/web/src/lib/data/database/books-db/factory.ts`
  - `apps/web/src/lib/data/database/books-db/versions/v2/upgrade.ts`

## 1) Anki Cache DB (`anki-cache`)

Stores: `wordData`, `tokenize`, `lemmatize`, `termEntries`, `documentTokenCounts`.

### 1.1 Central mutator API (`anki-cache.service.ts`)

| Method                   | Store(s)              | Operation                                |
| ------------------------ | --------------------- | ---------------------------------------- |
| `deleteWordData`         | `wordData`            | `delete`                                 |
| `setWordData`            | `wordData`            | `put`                                    |
| `setWordDataBatch`       | `wordData`            | batched `put`                            |
| `setTokens`              | `tokenize`            | `put`                                    |
| `setLemmas`              | `lemmatize`           | `put`; `delete` when lemma list is empty |
| `setLemmasBatch`         | `lemmatize`           | batched `put`                            |
| `setTermEntries`         | `termEntries`         | `put`                                    |
| `setDocumentTokenCounts` | `documentTokenCounts` | `put`                                    |
| `clearAllCaches`         | all cache stores      | `clear` all                              |

### 1.2 Mutating reads (delete-on-expiry/invalid payload)

These methods are reads that can still delete rows:

| Method                   | Store(s)              | Deletion condition                                  |
| ------------------------ | --------------------- | --------------------------------------------------- |
| `getTokens`              | `tokenize`            | entry TTL expired                                   |
| `getLemmas`              | `lemmatize`           | entry TTL expired or normalized lemma list is empty |
| `getLemmasBatch`         | `lemmatize`           | entry TTL expired or normalized lemma list is empty |
| `getTermEntries`         | `termEntries`         | entry TTL expired                                   |
| `getDocumentTokenCounts` | `documentTokenCounts` | entry TTL expired                                   |

Note: `wordData` no longer auto-deletes on read.

### 1.3 Runtime call sites that mutate `anki-cache`

#### `color-book-content.ts`

- `setDocumentTokenCounts`:
  - `analyzeDocumentText` (token-count snapshot)
  - `preTokenizeDocument` (token-count bootstrap snapshot)
- `setWordDataBatch`:
  - `warmCache` (bulk population from Anki decks)
- `setWordData`:
  - `_refreshTokenWordDataFromAnki` (hover/refresh update path)
  - `_resolveTokenWordData` (persist token alias when resolved via lemma candidates)
  - `_resolveTokenAnalysisData` (populate missing analysis fields for resolved tokens)
- `setTokens`:
  - `_getOrFetchTokens` (cache tokenize result)
- `setLemmas`:
  - `_getOrFetchLemmas`
  - `_resolveTokenWordData` (merged lemma enrichment persistence)
- `clearAllCaches`:
  - `clearCache()`

#### `yomitan.ts`

- `setLemmasBatch`:
  - `tokenize()` persists token -> lemma/lemmaReading map from `/tokenize`.
- `setTermEntries`:
  - `getTermEntries()` persists full `termEntries` API payload.

### 1.4 Full cache wipe triggers

`BookContentColoring.clearCache()` is called when:

- `setColorMode(...)`
- `setDesiredRetention(...)`
- `setMatureThreshold(...)`

And those are triggered by reactive settings updates in:

- `apps/web/src/lib/components/book-reader/book-reader.svelte`

## 2) Books DB (`books`)

Primary runtime mutator surface: `apps/web/src/lib/data/database/books-db/database.service.ts`.

### 2.1 Method-level mutation matrix

| Method                                | Store(s)                                                                                       | Operation                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `setFirstBookRead`                    | `statistic`, `lastModified`                                                                    | `put`, `put`                                         |
| `upsertData`                          | `data`                                                                                         | `put` (update) or `add` (insert)                     |
| `putBookmark`                         | `bookmark`                                                                                     | `put`                                                |
| `putAudioBook`                        | `audioBook`                                                                                    | `put`                                                |
| `putSubtitleData`                     | `subtitle`                                                                                     | `put`                                                |
| `putLastItem`                         | `lastItem`                                                                                     | `put`                                                |
| `deleteLastItem`                      | `lastItem`                                                                                     | `delete`                                             |
| `deleteSingleData` (via `deleteData`) | `lastItem`, `bookmark`, `statistic`, `lastModified`, `audioBook`, `subtitle`, `handle`, `data` | conditional `delete` across related rows             |
| `saveStorageSource`                   | `storageSource`                                                                                | optional rename `delete`; then `put` or `add`        |
| `deleteStorageSource`                 | `storageSource`                                                                                | `delete`                                             |
| `storeStatistics`                     | `statistic`, `lastModified`                                                                    | optional range `delete`; multiple `put`; final `put` |
| `updateStatistic`                     | `statistic`                                                                                    | `put`                                                |
| `deleteStatistics`                    | `statistic`, `lastModified`                                                                    | per-entry `delete`                                   |
| `deleteStatisticEntries`              | `statistic`, `lastModified`                                                                    | date/full-range `delete`; last-modified `put`        |
| `updateReadingGoals`                  | `readingGoal`                                                                                  | per-entry `delete`; per-entry `put`                  |
| `storeReadingGoals`                   | `readingGoal`                                                                                  | `clear`; then multiple `put`                         |
| `deleteReadingGoal`                   | `readingGoal`                                                                                  | single `delete` or full `clear`                      |

### 2.2 Known runtime callers

- Reader page:
  - `apps/web/src/routes/b/+page.svelte` (`setFirstBookRead`, `storeStatistics`, `putBookmark`, `deleteLastItem`)
- Manage page:
  - `apps/web/src/routes/manage/+page.svelte` (`putLastItem`, `deleteStatisticEntries`)
- Storage sync/import/export paths:
  - `apps/web/src/lib/data/storage/handler/browser-handler.ts` (`upsertData`, `putBookmark`, `storeStatistics`, `storeReadingGoals`, `putAudioBook`, `putSubtitleData`, `deleteData`)
- Settings UI:
  - storage source + reading goals components call corresponding `DatabaseService` mutators.

## 3) Direct IndexedDB Writes Outside `DatabaseService`

These mutate IndexedDB directly (without going through `DatabaseService` wrappers):

- `apps/web/src/lib/data/storage/handler/browser-handler.ts`
  - `updateLastRead`: `db.put('data', book)`
- `apps/web/src/lib/data/storage/storage-oauth-manager.ts`
  - refresh token persistence: `db.put('storageSource', ...)`

## 4) Schema/Migration-Level Mutations

### 4.1 Anki cache DB schema

- `apps/web/src/lib/data/database/anki-cache-db/factory.ts`
  - creates stores by version (`tokenize`, `lemmatize`, `termEntries`, `wordData`, `documentTokenCounts`)
  - v6 deletes legacy stores (`tokenColor`, `tokenCardIds`)

### 4.2 Books DB schema

- `apps/web/src/lib/data/database/books-db/factory.ts`
  - creates stores/indexes based on old version branches

- `apps/web/src/lib/data/database/books-db/versions/v2/upgrade.ts`
  - migrates old KV rows into:
    - `data` via `add`
    - `bookmark` via `put`
    - `lastItem` via `put`
  - deletes old object stores: `keyvaluepairs`, `local-forage-detect-blob-support`

## 5) Debugging Notes

- If data seems to “disappear,” separate:
  - runtime row mutation paths (sections 1–3)
  - schema upgrade behavior (section 4)
- For Anki cache specifically:
  - `wordData` is now stable on read (no auto-delete-on-read)
  - `lemmatize` now stores `lemmas` and `lemmaReadings` separately (no mixed list)
  - lookup selection is script-aware:
    - kanji token surface: kanji lemmas only
    - reading token surface: reading lemmas can be used
  - token resolution now coerces numeric-string `cardIds` (legacy rows) into numbers before status resolution; this avoids false `uncollected` results when rows exist but IDs are string-typed
  - token resolution now reconciles direct token rows with lemma rows and keeps the highest-priority status (instead of stopping at the direct token row); this avoids under-coloring when both `surface` and `lemma` exist in `wordData`
  - stale `wordData` does **not** trigger automatic background Anki refresh on read
  - token panel analysis is now gated by a one-time `wordData` priming step (`runWarmCacheRefreshFlow`) before `analyzeDocumentText`; this ensures the panel runs only after warm-cache `wordData` population completes for the session
  - hover refresh updates `wordData` rows in place and does not delete token rows as part of fallback checks
  - new-card detection in refresh/analysis now relies on metric payloads (`prop:r`/`prop:s`) only; there is no fallback `findCards(... is:new)` probe in this path
  - Anki refresh/deletion is explicit via warm cache refresh paths
  - `tokenize`/`lemmatize`/`termEntries`/`documentTokenCounts` still have TTL-based delete-on-read behavior.
