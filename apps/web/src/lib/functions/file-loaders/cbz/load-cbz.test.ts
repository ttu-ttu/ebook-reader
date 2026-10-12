/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { BlobReader, BlobWriter, TextReader, ZipWriter, configure } from '@zip.js/zip.js';
import loadCbz from './load-cbz';

// jsdom has no Worker.
configure({ useWebWorkers: false });
import { mangaPages } from '$lib/data/manga';

async function cbz(names: string[]) {
  const writer = new ZipWriter(new BlobWriter('application/zip'));

  for (const name of names) {
    if (name.endsWith('/')) {
      await writer.add(name, null, { directory: true });
    } else {
      await writer.add(name, new BlobReader(new Blob([name])));
    }
  }

  await writer.add('ComicInfo.xml', new TextReader('<ComicInfo/>'));

  return new File([await writer.close()], '漫画 1.cbz');
}

describe('loadCbz', () => {
  it('keeps only page images, in reading order', async () => {
    const book = await loadCbz(
      await cbz(['ch1/', 'ch1/10.jpg', 'ch1/2.png', '__MACOSX/ch1/._2.png', 'ch1/1.webp']),
      5
    );

    expect(book.title).toBe('漫画 1');
    expect(mangaPages(book)).toEqual(['ch1/1.webp', 'ch1/2.png', 'ch1/10.jpg']);
    expect(Object.keys(book.blobs)).toHaveLength(3);
    expect(book.characters).toBe(3);
    expect(book.coverImage).toBe(book.blobs['ch1/1.webp']);
  });

  it('rejects archives without images', async () => {
    await expect(loadCbz(await cbz(['book.epub']), 0)).rejects.toThrow('no images');
  });
});
