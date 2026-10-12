/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Highlights and notes, stored per book title in the browser (IndexedDB).
 * Books from the Calibre source also sync them to the server as
 * annotations.json in the book's sync folder (the account's own folder while
 * signed in). Not part of upstream.
 */

import { BehaviorSubject } from 'rxjs';
import { accountReady, currentAccount } from '$lib/data/account';
import { CalibreStorageHandler } from '$lib/data/storage/handler/calibre-handler';
import { logger } from '$lib/data/logger';
import { readerDb as db } from '$lib/data/reader-db';

export const highlightColors = ['yellow', 'green', 'blue', 'pink'] as const;

export type HighlightColor = (typeof highlightColors)[number];

export interface Highlight {
  id: string;
  /** Character counts before the first and after the last highlighted character */
  start: number;
  end: number;
  text: string;
  note: string;
  color: HighlightColor;
  chapter: string;
  created: number;
  modified: number;
  /** Kept as a tombstone so the deletion syncs */
  deleted?: boolean;
}

export interface BookAnnotations {
  title: string;
  highlights: Highlight[];
  /**
   * Account id the cached highlights belong to ('' signed out). Only set for
   * synced books; records saved before this field existed have none.
   */
  account?: string;
}

const annotationsFileName = 'annotations.json';

/** Newer edit wins per highlight; tombstones win over older edits. */
export function mergeHighlights(local: Highlight[], remote: Highlight[]) {
  const merged = new Map<string, Highlight>();

  [...local, ...remote].forEach((highlight) => {
    const existing = merged.get(highlight.id);

    if (!existing || highlight.modified > existing.modified) {
      merged.set(highlight.id, highlight);
    }
  });

  return [...merged.values()].sort((a, b) => a.start - b.start || a.created - b.created);
}

function sameHighlights(a: Highlight[], b: Highlight[]) {
  if (a.length !== b.length) {
    return false;
  }

  const modified = new Map(a.map((h) => [h.id, h.modified]));

  return b.every((h) => modified.get(h.id) === h.modified);
}

function newId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Annotations of the book open in the reader. */
export class AnnotationsController {
  /** All highlights including deleted ones */
  private all: Highlight[] = [];

  private syncTimer: ReturnType<typeof setTimeout> | undefined;

  /** Syncs run one after another, so one can't upload without the other's merge. */
  private syncQueue = Promise.resolve();

  readonly highlights$ = new BehaviorSubject<Highlight[]>([]);

  readonly syncError$ = new BehaviorSubject('');

  constructor(
    readonly title: string,
    private readonly syncWithCalibre: boolean
  ) {}

  async load() {
    const stored = await (await db()).get('annotations', this.title);

    // The browser cache is shared by everyone who signs in here. Highlights cached
    // under another sign-in state must not be merged (and uploaded) into this one;
    // they are safe on that account's server. Old records without an owner are kept.
    const owner = this.syncWithCalibre ? await this.owner() : undefined;
    const ownedByOther =
      owner !== undefined && stored?.account !== undefined && stored.account !== owner;

    this.setAll(ownedByOther ? [] : stored?.highlights || []);

    if (this.syncWithCalibre) {
      await this.sync();
    }
  }

  add(highlight: Omit<Highlight, 'id' | 'created' | 'modified'>) {
    const now = Date.now();
    const created: Highlight = { ...highlight, id: newId(), created: now, modified: now };

    this.setAll(mergeHighlights(this.all, [created]));
    this.persist();

    return created;
  }

  update(id: string, changes: Partial<Pick<Highlight, 'note' | 'color'>>) {
    this.setAll(
      this.all.map((h) => (h.id === id ? { ...h, ...changes, modified: Date.now() } : h))
    );
    this.persist();
  }

  remove(id: string) {
    this.setAll(
      this.all.map((h) =>
        h.id === id ? { ...h, note: '', text: '', deleted: true, modified: Date.now() } : h
      )
    );
    this.persist();
  }

  async flush() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = undefined;
      await this.sync();
    }
  }

  private setAll(highlights: Highlight[]) {
    this.all = highlights;
    this.highlights$.next(highlights.filter((h) => !h.deleted));
  }

  private async owner() {
    await accountReady();

    return currentAccount()?.id ?? '';
  }

  private async save(highlights: Highlight[]) {
    const owner = this.syncWithCalibre ? await this.owner() : undefined;

    await (await db()).put('annotations', { title: this.title, highlights, account: owner });
  }

  private persist() {
    this.save(this.all).catch((error) =>
      logger.error(`Saving highlights failed: ${error.message}`)
    );

    if (this.syncWithCalibre) {
      clearTimeout(this.syncTimer);
      this.syncTimer = setTimeout(() => {
        this.syncTimer = undefined;
        this.sync();
      }, 2000);
    }
  }

  private sync() {
    this.syncQueue = this.syncQueue.then(() => this.syncOnce());

    return this.syncQueue;
  }

  /** Merges with the server copy and uploads the result if it differs. */
  private async syncOnce() {
    await accountReady();

    const url = CalibreStorageHandler.syncFileUrl(this.title, annotationsFileName);

    try {
      const response = await fetch(url, { cache: 'no-store' });

      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }

      const remote: Highlight[] = response.ok ? (await response.json()).highlights || [] : [];
      const merged = mergeHighlights(this.all, remote);

      if (!sameHighlights(merged, this.all)) {
        this.setAll(merged);
        await this.save(merged);
      }

      if (!sameHighlights(merged, remote)) {
        const upload = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: this.title, highlights: merged })
        });

        if (!upload.ok) {
          throw new Error(`upload failed (HTTP ${upload.status})`);
        }
      }

      this.syncError$.next('');
    } catch (error: any) {
      const message = `Highlight sync failed: ${error.message}`;

      logger.warn(message);
      this.syncError$.next(message);
    }
  }
}

export function highlightsToMarkdown(title: string, highlights: Highlight[]) {
  const lines = [`# ${title}`, ''];
  let chapter: string | undefined;

  highlights.forEach((highlight) => {
    if (highlight.chapter !== chapter) {
      chapter = highlight.chapter;

      if (chapter) {
        lines.push(`## ${chapter}`, '');
      }
    }

    lines.push(`> ${highlight.text.replace(/\n/g, '\n> ')}`, '');

    if (highlight.note) {
      lines.push(highlight.note, '');
    }
  });

  return lines.join('\n');
}
