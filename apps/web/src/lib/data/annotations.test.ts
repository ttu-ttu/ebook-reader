/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The real handler pulls in every storage source (and their circular imports).
vi.mock('$lib/data/storage/handler/calibre-handler', () => ({
  CalibreStorageHandler: { syncFileUrl: (title: string, name: string) => `/sync/${title}/${name}` }
}));

const account = vi.hoisted(() => ({ user: null as { id: string; username: string } | null }));

vi.mock('$lib/data/account', () => ({
  accountReady: async () => account.user,
  currentAccount: () => account.user
}));

import { readerDb } from '$lib/data/reader-db';
import {
  AnnotationsController,
  highlightsToMarkdown,
  mergeHighlights,
  type Highlight
} from './annotations';

function highlight(id: string, modified: number, props: Partial<Highlight> = {}): Highlight {
  return {
    id,
    start: 0,
    end: 1,
    text: id,
    note: '',
    color: 'yellow',
    chapter: '',
    created: 0,
    modified,
    ...props
  };
}

describe('mergeHighlights', () => {
  it('keeps the newest edit of each highlight and sorts by position', () => {
    const merged = mergeHighlights(
      [highlight('a', 1, { note: 'old', start: 5 }), highlight('b', 1)],
      [highlight('a', 2, { note: 'new', start: 5 }), highlight('c', 1, { start: 2 })]
    );

    expect(merged.map((h) => h.id)).toEqual(['b', 'c', 'a']);
    expect(merged[2].note).toBe('new');
  });

  it('lets a newer tombstone win', () => {
    const [merged] = mergeHighlights([highlight('a', 1)], [highlight('a', 2, { deleted: true })]);

    expect(merged.deleted).toBe(true);
  });
});

describe('highlightsToMarkdown', () => {
  it('groups by chapter and quotes text', () => {
    expect(
      highlightsToMarkdown('Book', [
        highlight('x', 0, { text: '一行\n二行', chapter: 'C1', note: 'メモ' })
      ])
    ).toBe('# Book\n\n## C1\n\n> 一行\n> 二行\n\nメモ\n');
  });
});

describe('AnnotationsController account scoping', () => {
  const uploads: { url: string; body: string }[] = [];

  function mockServer(remote: Highlight[]) {
    uploads.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          uploads.push({ url, body: String(init.body) });
          return new Response('', { status: 201 });
        }
        return remote.length
          ? new Response(JSON.stringify({ highlights: remote }))
          : new Response('', { status: 404 });
      })
    );
  }

  async function storeLocally(title: string, highlights: Highlight[], owner?: string) {
    await (await readerDb()).put('annotations', { title, highlights, account: owner });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    account.user = null;
  });

  it("doesn't upload another account's cached highlights after switching accounts", async () => {
    await storeLocally('Book A', [highlight('private', 1, { note: 'secret' })], 'alice');
    account.user = { id: 'bob', username: 'bob' };
    mockServer([]);

    const controller = new AnnotationsController('Book A', true);

    await controller.load();

    expect(controller.highlights$.getValue()).toEqual([]);
    expect(uploads.map((u) => u.body).join()).not.toContain('secret');
  });

  it("doesn't upload an account's highlights to the shared folder after signing out", async () => {
    await storeLocally('Book B', [highlight('private', 1, { note: 'secret' })], 'alice');
    mockServer([]);

    const controller = new AnnotationsController('Book B', true);

    await controller.load();

    expect(uploads.map((u) => u.body).join()).not.toContain('secret');
  });

  it('keeps and syncs highlights cached by the same account', async () => {
    await storeLocally('Book C', [highlight('mine', 1)], 'alice');
    account.user = { id: 'alice', username: 'alice' };
    mockServer([]);

    const controller = new AnnotationsController('Book C', true);

    await controller.load();

    expect(controller.highlights$.getValue().map((h) => h.id)).toEqual(['mine']);
    expect(uploads).toHaveLength(1);
  });

  it('keeps highlights of books that only live in this browser', async () => {
    await storeLocally('Local book', [highlight('local', 1)], 'alice');
    mockServer([]);

    const controller = new AnnotationsController('Local book', false);

    await controller.load();

    expect(controller.highlights$.getValue().map((h) => h.id)).toEqual(['local']);
  });
});
