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
import { setPluginEnabled } from '$lib/plugins';
import ReaderCompanion from './reader-companion.svelte';

describe('ReaderCompanion', () => {
  it('loads Story so far and Lorebook when their tabs are clicked', async () => {
    const target = document.createElement('div');
    const index = buildSearchIndex('<p>猫が好き。</p>');

    setPluginEnabled('ai', true);
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

  it('leaves out the tabs of a plugin that is switched off', async () => {
    const target = document.createElement('div');

    setPluginEnabled('ai', false);

    new ReaderCompanion({
      target,
      props: {
        tab: 'highlights',
        title: 'Off',
        highlights: [],
        syncError: '',
        getIndex: async () => buildSearchIndex(''),
        sections: [],
        position: 0,
        bookCharacters: 0
      }
    });
    await tick();

    expect(
      [...target.querySelectorAll('[role=tab]')].map((tab) => tab.getAttribute('title'))
    ).toEqual(['Highlights']);
  });
});
