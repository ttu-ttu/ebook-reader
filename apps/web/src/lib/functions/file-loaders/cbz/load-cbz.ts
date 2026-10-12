/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js';
import type { LoadData } from '../types';
import initZipSettings from '../utils/init-zip-settings';
import { getMimeTypeFromName } from '../htmlz/extract-htmlz';
import { mangaElementHtml, sortPages } from '$lib/data/manga';

initZipSettings();

/** Manga as a book: the pages are its blobs, in reading order in elementHtml. */
export default async function loadCbz(file: File, lastBookModified: number): Promise<LoadData> {
  const reader = new ZipReader(new BlobReader(file));
  const entries = (await reader.getEntries()).filter(
    (entry) =>
      !entry.directory &&
      entry.getData &&
      getMimeTypeFromName(entry.filename) &&
      !entry.filename.includes('__MACOSX/') &&
      !entry.filename.split('/').pop()!.startsWith('.')
  );
  const blobs: Record<string, Blob> = {};

  for (const entry of entries) {
    blobs[entry.filename] = await entry.getData!(
      new BlobWriter(getMimeTypeFromName(entry.filename))
    );
  }

  await reader.close();

  const pages = sortPages(Object.keys(blobs));

  if (!pages.length) {
    throw new Error(`${file.name} contains no images`);
  }

  return {
    title: file.name.replace(/\.(?:cbz|zip)$/i, ''),
    styleSheet: '',
    elementHtml: mangaElementHtml(pages),
    blobs,
    coverImage: blobs[pages[0]],
    hasThumb: true,
    characters: pages.length,
    lastBookModified,
    lastBookOpen: 0
  };
}
