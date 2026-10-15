<script lang="ts">
  /**
   * Visual novel player (ONScripter games, not part of upstream): the engine runs in a
   * same-origin frame (static/vn/player.html); its text hook sends every page's text here
   * with where each character was drawn: laid invisibly over the game for Yomitan (and
   * optionally shown in a panel below it), and counted for progress and statistics. Saves of
   * Calibre games sync through vnsaves.json in the reader's sync folder.
   */
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Fa from 'svelte-fa';
  import { faArrowLeft, faBolt, faFont } from '@fortawesome/free-solid-svg-icons';
  import {
    autoReplication$,
    cacheStorageData$,
    database,
    readingGoalsMergeMode$,
    replicationSaveBehavior$,
    startDayHoursForTracker$,
    statisticsEnabled$,
    statisticsMergeMode$,
    syncTarget$
  } from '$lib/data/store';
  import { pagePath } from '$lib/data/env';
  import { logger } from '$lib/data/logger';
  import { MergeMode } from '$lib/data/merge-mode';
  import {
    decodeText,
    encodePath,
    fromBase64,
    hashPage,
    loadVnRead,
    mergeVnSaves,
    newerSaveEngine,
    newText,
    overlayLines,
    vnCacheName,
    parseVnPage,
    sameVnSaves,
    saveVnRead,
    toBase64,
    vnBookmark,
    vnInfo,
    type VnLine,
    type VnRead,
    type VnSaves
  } from '$lib/data/vn';
  import { accountReady } from '$lib/data/account';
  import { recordKanjiText } from '$lib/data/kanji-seen';
  import { countTextCharacters } from '$lib/functions/get-character-count';
  import { CalibreStorageHandler } from '$lib/data/storage/handler/calibre-handler';
  import type {
    BooksDbBookData,
    BooksDbStatistic
  } from '$lib/data/database/books-db/versions/books-db';
  import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
  import type { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
  import type { BrowserStorageHandler } from '$lib/data/storage/handler/browser-handler';
  import {
    StorageDataType,
    StorageKey,
    StorageSourceDefault
  } from '$lib/data/storage/storage-types';
  import {
    AutoReplicationType,
    ReplicationSaveBehavior
  } from '$lib/functions/replication/replication-options';
  import { replicateData } from '$lib/functions/replication/replicator';
  import { vnFolderSize } from '$lib/functions/file-loaders/vn/load-vn';
  import { formatPageTitle } from '$lib/functions/format-page-title';
  import { getDateKey } from '$lib/functions/statistic-util';
  import {
    getDefaultStatistic,
    updateStatistic
  } from '$lib/components/book-reader/book-reading-tracker/book-reading-tracker';
  import AnkiWatcher from '$lib/components/anki-watcher.svelte';
  import {
    ankiEnabled$,
    ankiSentenceField$,
    ankiVnAudio$,
    ankiVnScreenshot$,
    noteSentence,
    vnLineFor,
    type AnkiNote
  } from '$lib/data/anki';
  import { writableBooleanLocalStorageSubject } from '$lib/data/internal/writable-boolean-local-storage-subject';

  /** Time between two clicks counted as reading at most, so breaks don't count. */
  const maxSecondsPerPage = 120;
  /** The text panel below the game; hovering the game's own text works without it. */
  const showText$ = writableBooleanLocalStorageSubject()('vnTextPanel', false);
  /** Furigana drawn by the game; off, the readings are still in the overlay and text panel. */
  const furigana$ = writableBooleanLocalStorageSubject()('vnFurigana', true);
  /** The whole text at once instead of the game's text speed. */
  const instantText$ = writableBooleanLocalStorageSubject()('vnInstantText', false);
  const defaultSources: Record<string, StorageKey> = {
    [StorageSourceDefault.CALIBRE_DEFAULT]: StorageKey.CALIBRE,
    [StorageSourceDefault.GDRIVE_DEFAULT]: StorageKey.GDRIVE,
    [StorageSourceDefault.ONEDRIVE_DEFAULT]: StorageKey.ONEDRIVE
  };

  let book: BooksDbBookData | undefined;
  let frame: HTMLIFrameElement | undefined;
  let lines: VnLine[] = [];
  let ended = false;
  let read: VnRead;
  let seen = new Set<string>();
  let previousText = '';
  /** Read since the last save, for "Kanji met" */
  let unsavedText = '';
  let lastTextTime = 0;
  /** CONscripter version of this build, stamped on uploaded saves. */
  let engineVersion: string | undefined;
  /** Set when synced saves were written by a newer engine than this one. */
  let newerEngine: string | undefined;
  let statistics = new Map<string, BooksDbStatistic>();
  let changedDays = new Set<string>();
  let dirty = false;
  let local: BrowserStorageHandler;
  let external: BaseStorageHandler | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let savesQueue = Promise.resolve();
  let started = false;

  $: if (started) engineSet('Ruby', $furigana$ ? 1 : 0);
  $: if (started) engineSet('TextSpeed', $instantText$ ? 0 : -1);

  function engineSet(name: string, value: number) {
    (frame?.contentWindow as any)?.engineSet(name, value);
  }

  function handler(type: StorageKey, name?: string) {
    return getStorageHandler(
      window,
      type,
      name,
      true,
      $cacheStorageData$,
      $replicationSaveBehavior$,
      $statisticsMergeMode$,
      $readingGoalsMergeMode$
    );
  }

  /** Where this game's progress syncs, as in the book reader (Calibre always syncs). */
  async function externalHandler(data: BooksDbBookData) {
    const name =
      data.storageSource || ($autoReplication$ !== AutoReplicationType.Off ? $syncTarget$ : '');

    if (!name) return undefined;

    const type =
      defaultSources[name] ?? (await (await database.db).get('storageSource', name))?.type;

    return type ? handler(type, name) : undefined;
  }

  function context() {
    return { id: book!.id, title: book!.title, imagePath: book!.coverImage };
  }

  function syncs(direction: AutoReplicationType) {
    return (
      external &&
      (external.storageType === StorageKey.CALIBRE ||
        $autoReplication$ === direction ||
        $autoReplication$ === AutoReplicationType.All)
    );
  }

  async function load(id: number) {
    local = handler(StorageKey.BROWSER) as BrowserStorageHandler;
    local.startContext({ id, title: '' });

    const data = await local.getBook();

    if (!data) {
      goto(`${pagePath}/manage`);
      return;
    }

    book = data;
    local.startContext(context());
    data.lastBookOpen = Date.now();
    await local.updateLastRead(data);

    try {
      external = await externalHandler(data);

      if (external) {
        external.startContext(context());

        if (syncs(AutoReplicationType.Down)) {
          const error = await replicateData(
            external,
            local,
            false,
            [context()],
            [StorageDataType.PROGRESS, StorageDataType.STATISTICS]
          );

          if (error) throw new Error(error);
        }

        await external.updateLastRead(data);
      }
    } catch (error: any) {
      // Playing works offline from the browser copy; progress syncs on the next save.
      logger.warn(`Visual novel sync failed: ${error.message}`);
    }

    read = await loadVnRead(data.title);
    seen = new Set(read.pages);

    // Another device may be further along: keep the larger position.
    const bookmark = await database.getBookmark(data.id);

    read.characters = Math.max(read.characters, bookmark?.exploredCharCount || 0);
    statistics = new Map(
      (await database.getStatisticsForBook(data.title)).map((stat) => [stat.dateKey, stat])
    );
  }

  function savesUrl() {
    return book?.storageSource === StorageSourceDefault.CALIBRE_DEFAULT
      ? CalibreStorageHandler.syncFileUrl(book.title, 'vnsaves.json')
      : undefined;
  }

  async function fetchSaves(): Promise<VnSaves> {
    const url = savesUrl();

    if (!url) return {};

    await accountReady();

    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);

    return response.ok ? response.json() : {};
  }

  /** After the engine saved: merges this browser's saves into the synced ones. */
  function uploadSaves(files: Record<string, { modified: number; bytes: Uint8Array }>) {
    const url = savesUrl();

    if (!url) return;

    const local: VnSaves = Object.fromEntries(
      Object.entries(files).map(([name, file]) => [
        name,
        { modified: file.modified, data: toBase64(file.bytes), engine: engineVersion }
      ])
    );

    savesQueue = savesQueue
      .then(async () => {
        const remote = await fetchSaves();
        const merged = mergeVnSaves(local, remote);

        if (!sameVnSaves(merged, remote)) {
          const put = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged)
          });

          if (!put.ok) throw new Error(`upload failed (HTTP ${put.status})`);
        }
      })
      .catch((error) => logger.warn(`Visual novel save sync failed: ${error.message}`));
  }

  /** Games served by URL over 10 MB can be kept in the browser (Cache API, HTTPS only). */
  async function gameCache(base: string | undefined) {
    if (!base || !('caches' in window)) return undefined;

    const name = vnCacheName(book!.title);

    if (await caches.has(name)) return name;

    const size = await vnFolderSize(base).catch(() => 0);

    if (
      size <= 10 * 1024 * 1024 ||
      !confirm(
        `This game is ${size >= 1024 ** 3 ? `${(size / 1024 ** 3).toFixed(1)} GB` : `${Math.round(size / 1024 ** 2)} MB`}. Keep its files in this browser so it starts quickly next time?`
      )
    )
      return undefined;

    navigator.storage?.persist?.();
    return name;
  }

  async function start() {
    if (!book || !frame?.contentWindow) return;

    const info = vnInfo(book);
    const player = frame.contentWindow as any;

    const saves = await fetchSaves().catch((error): VnSaves => {
      // Offline: play with this browser's saves.
      logger.warn(`Visual novel save sync failed: ${error.message}`);
      return {};
    });
    engineVersion = await fetch(`${pagePath}/vn/conscripter-version.txt`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.text() : undefined))
      .then((text) => text?.trim())
      .catch(() => undefined);
    newerEngine = engineVersion && newerSaveEngine(saves, engineVersion);
    const cacheName = await gameCache(info.base);

    lastTextTime = Date.now();
    await player.startGame({
      // Server folder games are fetched by URL; imported ones are blobs.
      files: info.base
        ? Object.fromEntries(info.files.map((path) => [path, `${info.base}${encodePath(path)}`]))
        : book.blobs,
      cacheName,
      keepLines: $ankiEnabled$,
      recordLines: $ankiEnabled$ && $ankiVnAudio$,
      encoding: info.encoding,
      saveDir: `/save/${hashPage(book.title)}`,
      saves: Object.fromEntries(
        Object.entries(saves).map(([name, file]) => [
          name,
          { modified: file.modified, bytes: fromBase64(file.data) }
        ])
      ),
      onText: (bytes: Uint8Array, skipped: number, boxes: Int32Array, readBefore: number) => {
        player.showText(overlayLines(bytes, boxes, info.encoding));
        onText(decodeText(bytes, info.encoding), !!skipped, readBefore === 1);
      },
      textLines: (bytes: Uint8Array, boxes: Int32Array) =>
        overlayLines(bytes, boxes, info.encoding),
      onSave: uploadSaves,
      onExit: () => (ended = true)
    });
    started = true;
  }

  /**
   * For a note added to Anki while playing: the screen and sound of the line its sentence was
   * mined from, kept by the player as it was shown, or of the backlog it was mined from. Notes
   * from elsewhere are left alone.
   */
  async function ankiMedia(note: AnkiNote) {
    const player = frame?.contentWindow as any;
    const sentence = noteSentence(note);
    const kept = player?.ankiTexts ? vnLineFor(sentence, player.ankiTexts()) : -1;
    const shown = player?.ankiShownTexts ? vnLineFor(sentence, player.ankiShownTexts()) : -1;

    if (kept < 0 && shown < 0) {
      throw new Error(
        `card left alone, its ${$ankiSentenceField$.trim()} field isn't a line of this game's recent text or backlog`
      );
    }

    return player.ankiMedia(kept, shown, { picture: $ankiVnScreenshot$, audio: $ankiVnAudio$ });
  }

  function onText(text: string, skipped: boolean, readBefore: boolean) {
    const now = Date.now();

    lines = parseVnPage(text);

    if (!skipped) {
      const added = newText(previousText, text, seen, readBefore);
      const characters = countTextCharacters(added);
      const seconds = Math.min((now - lastTextTime) / 1000, maxSecondsPerPage);

      if (characters) {
        read.characters += characters;
        unsavedText += added;
        dirty = true;
      }

      if ($statisticsEnabled$ && (characters || seconds >= 1)) {
        const day = getDateKey($startDayHoursForTracker$, new Date(now));
        const stat = statistics.get(day) ?? getDefaultStatistic(book!.title, day);

        statistics.set(day, updateStatistic(stat, Math.round(seconds), characters, now));
        changedDays.add(day);
        dirty = true;
      }
    }

    previousText = text;
    lastTextTime = now;

    if (dirty) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 3000);
    }
  }

  async function save() {
    clearTimeout(saveTimer);

    if (!dirty || !book) return;

    dirty = false;

    const days = [...changedDays];
    const text = unsavedText;

    unsavedText = '';

    changedDays = new Set();
    await saveVnRead({ ...read, pages: [...seen] });
    await recordKanjiText(book.title, text, read.characters);
    await database.putBookmark(vnBookmark(book.id, read.characters, book.characters));

    const types = [StorageDataType.PROGRESS];

    if (days.length) {
      await database.storeStatistics(
        book.title,
        days.map((day) => statistics.get(day)!),
        ReplicationSaveBehavior.Overwrite,
        MergeMode.LOCAL
      );
      types.push(StorageDataType.STATISTICS);
    }

    if (syncs(AutoReplicationType.Up)) {
      const error = await replicateData(local, external!, false, [context()], types).catch(
        (err: any) => err.message
      );

      if (error) logger.warn(`Visual novel progress sync failed: ${error}`);
    }
  }

  async function leave() {
    await save().catch((error) => logger.warn(error.message));
    await database.deleteLastItem();
    goto(`${pagePath}/manage`);
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') save();
  }

  onMount(() => {
    load(Number($page.url.searchParams.get('id'))).catch((error) =>
      logger.error(`Error loading visual novel: ${error.message}`)
    );
  });

  onDestroy(() => {
    save();
  });
</script>

<svelte:head>
  <title>{formatPageTitle(book?.title ?? '')}</title>
</svelte:head>

<svelte:document on:visibilitychange={onVisibilityChange} />

<div class="fixed inset-0 flex flex-col bg-black">
  <div class="reader-panel flex items-center gap-3 px-3 py-1">
    <button class="p-2" title="Back to the library" aria-label="Back" on:click={leave}>
      <Fa icon={faArrowLeft} />
    </button>
    <div class="min-w-0 flex-1 truncate">{book?.title ?? ''}</div>
    <button
      class="p-2"
      title="Furigana in the game (from the next text; readings stay in the text panel)"
      aria-label="Furigana"
      aria-pressed={$furigana$}
      class:opacity-50={!$furigana$}
      on:click={() => furigana$.next(!$furigana$)}
    >
      <ruby class="text-lg">字<rt class="text-[0.55em]">じ</rt></ruby>
    </button>
    <button
      class="p-2"
      title="Show the whole text at once"
      aria-label="Instant text"
      aria-pressed={$instantText$}
      class:opacity-50={!$instantText$}
      on:click={() => instantText$.next(!$instantText$)}
    >
      <Fa icon={faBolt} />
    </button>
    <button
      class="p-2"
      title="Show the text below the game"
      aria-label="Text panel"
      aria-pressed={$showText$}
      on:click={() => showText$.next(!$showText$)}
    >
      <Fa icon={faFont} />
    </button>
  </div>

  {#if book}
    <AnkiWatcher media={ankiMedia} />
    <iframe
      bind:this={frame}
      class="min-h-0 w-full flex-1 border-0"
      src="{pagePath}/vn/player.html"
      title={book.title}
      allow="autoplay; fullscreen"
      on:load={() =>
        start().catch((error) => logger.error(`Error starting game: ${error.message}`))}
    />
  {/if}

  {#if newerEngine}
    <p class="reader-panel px-4 py-2 text-center text-sm">
      Some saves were made with a newer engine (CONscripter {newerEngine}) than this server's ({engineVersion}).
      Saves should be backward compatible, so they will most likely still load; if one doesn't, ask
      an admin to update the engine.
      <button class="app-button app-button-quiet ml-2" on:click={() => (newerEngine = undefined)}
        >Dismiss</button
      >
    </p>
  {/if}

  {#if ended}
    <p class="reader-panel px-4 py-2 text-center">The game has ended.</p>
  {:else if $showText$}
    <div class="vn-text reader-panel max-h-[30vh] overflow-y-auto px-4 py-3" lang="ja">
      {#each lines as line}
        <p>
          {#each line as part}{#if part.ruby}<ruby>{part.text}<rt>{part.ruby}</rt></ruby
              >{:else}{part.text}{/if}{/each}
        </p>
      {/each}
    </div>
  {/if}
</div>

<style>
  .vn-text {
    font-size: 1.25rem;
    line-height: 2;
  }

  .vn-text p {
    margin: 0;
    min-height: 1em;
  }
</style>
