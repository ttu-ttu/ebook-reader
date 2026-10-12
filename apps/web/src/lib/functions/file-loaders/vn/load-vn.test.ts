/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlobReader, BlobWriter, ZipWriter, configure } from '@zip.js/zip.js';
import loadCbz from '../cbz/load-cbz';
import { loadVnFolder, vnFolderSize } from './load-vn';
import { isVn, vnInfo } from '$lib/data/vn';

// jsdom has no Worker.
configure({ useWebWorkers: false });

async function zip(files: Record<string, Blob>) {
  const writer = new ZipWriter(new BlobWriter('application/zip'));

  for (const [name, data] of Object.entries(files)) {
    await writer.add(name, new BlobReader(data));
  }

  return new File([await writer.close()], 'ゲーム.zip');
}

describe('loadVn', () => {
  it('imports a zip with an ONScripter script as a game, relative to its folder', async () => {
    const script = new TextEncoder().encode('*start\n吾輩は猫である。\\\nend').map((b) => b ^ 0x84);
    const book = await loadCbz(
      await zip({
        'ゲーム/nscript.dat': new Blob([script]),
        'ゲーム/arc.nsa': new Blob(['nsa']),
        'ゲーム/bgm/01.ogg': new Blob(['ogg']),
        'ゲーム/icon.png': new Blob(['png']),
        '__MACOSX/ゲーム/._arc.nsa': new Blob(['x'])
      }),
      5
    );

    expect(book.title).toBe('ゲーム');
    expect(isVn(book)).toBe(true);
    expect(vnInfo(book)).toEqual({
      encoding: 'utf8',
      files: ['nscript.dat', 'arc.nsa', 'bgm/01.ogg', 'icon.png']
    });
    expect(book.characters).toBe(7);
    expect(book.coverImage?.type).toBe('image/png');
  });

  it('reads a server game folder through its listings, fetching only the script', async () => {
    const script = new TextEncoder().encode('吾輩は猫である。');
    const listings: Record<string, unknown> = {
      '/calibre/vn/G/': [
        { name: '0.txt', type: 'file' },
        { name: 'arc.nsa', type: 'file', size: 2000 },
        { name: 'bgm', type: 'directory' },
        { name: '.DS_Store', type: 'file' }
      ],
      '/calibre/vn/G/bgm/': [{ name: '曲.ogg', type: 'file', size: 30 }]
    };
    const fetched: string[] = [];

    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url);
      return url in listings ? new Response(JSON.stringify(listings[url])) : new Response(script);
    });

    const book = await loadVnFolder('ノベル', '/calibre/vn/G/', 1);

    expect(vnInfo(book)).toEqual({
      encoding: 'utf8',
      files: ['0.txt', 'arc.nsa', 'bgm/曲.ogg'],
      base: '/calibre/vn/G/'
    });
    expect(book.characters).toBe(7);
    expect(fetched).toEqual(['/calibre/vn/G/', '/calibre/vn/G/bgm/', '/calibre/vn/G/0.txt']);
    expect(await vnFolderSize('/calibre/vn/G/')).toBe(2030);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
