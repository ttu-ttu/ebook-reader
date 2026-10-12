/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import 'fake-indexeddb/auto';
import '$lib/data/storage/storage-handler-factory';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { buildSearchIndex } from '$lib/functions/book-text/book-search';
import ReaderCompanion from './reader-companion.svelte';

describe('ReaderCompanion', () => {
  it('loads Story so far and Lorebook when their tabs are clicked', async () => {
    const target = document.createElement('div');
    const index = buildSearchIndex('<p>猫が好き。</p>');

    new ReaderCompanion({
      target,
      props: {
        tab: 'highlights',
        title: 'Tabs',
        highlights: [],
        syncError: '',
        getIndex: async () => index,
        sections: [],
        position: 3,
        bookCharacters: 6
      }
    });

    const click = async (label: string) => {
      [...target.querySelectorAll('button')].find((button) => button.title === label)!.click();
      await tick();
    };

    await click('Story so far');
    await vi.waitFor(() => expect(target.textContent).toContain('Write recap at this position'));

    await click('Lorebook');
    await vi.waitFor(() => expect(target.textContent).toContain('Read up to 0 characters'));
  });
});
