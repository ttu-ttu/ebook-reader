/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BlobWriter, Uint8ArrayWriter, type Entry } from '@zip.js/zip.js';
import type { LoadData } from '../types';
import { getMimeTypeFromName } from '../htmlz/extract-htmlz';
import {
  decodeScript,
  decodeText,
  detectEncoding,
  scriptCharacters,
  vnElementHtml
} from '$lib/data/vn';

/**
 * An ONScripter game folder as a book: every file under `root` is a blob, keyed by its
 * path inside the game folder. characters is the script's text, for progress.
 * shortcut: holds the whole game in memory while importing (like manga); stream entries
 * into IndexedDB one by one if large games fail to import on phones.
 */
export default async function loadVn(
  name: string,
  entries: Entry[],
  root: string,
  lastBookModified: number
): Promise<LoadData> {
  const blobs: Record<string, Blob> = {};
  const decoded: Uint8Array[] = [];

  for (const entry of entries) {
    const path = entry.filename.slice(root.length);

    if (
      entry.directory ||
      !entry.getData ||
      !entry.filename.startsWith(root) ||
      entry.filename.includes('__MACOSX/') ||
      path.split('/').pop()!.startsWith('.')
    ) {
      continue;
    }

    blobs[path] = await entry.getData(new BlobWriter());
  }

  const scripts = entries
    .filter((entry) => entry.getData && entry.filename.startsWith(root))
    .map((entry) => ({ entry, path: entry.filename.slice(root.length) }))
    .filter(({ path }) => blobs[path] && !path.includes('/'))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

  for (const { entry, path } of scripts) {
    const bytes = decodeScript(path, await entry.getData!(new Uint8ArrayWriter()));

    if (bytes) decoded.push(bytes, Uint8Array.of(0x0a));
  }

  const script = new Uint8Array(decoded.reduce((sum, bytes) => sum + bytes.length, 0));

  decoded.reduce((offset, bytes) => (script.set(bytes, offset), offset + bytes.length), 0);
  // Encrypted scripts (nscr_sec.dat, onscript.nt2…) can't be read here: assume Shift JIS.
  const encoding = decoded.length ? detectEncoding(script) : 'sjis';
  const cover = Object.keys(blobs).find(
    (path) => !path.includes('/') && /(?:cover|icon).*\.(?:jpe?g|png|webp)$/i.test(path)
  );

  return {
    title: name.replace(/\.(?:cbz|zip)$/i, ''),
    styleSheet: '',
    elementHtml: vnElementHtml({ encoding, files: Object.keys(blobs) }),
    blobs,
    coverImage: cover
      ? new Blob([blobs[cover]], { type: getMimeTypeFromName(cover) || '' })
      : undefined,
    hasThumb: !!cover,
    characters: Math.max(scriptCharacters(decodeText(script, encoding)), 1),
    lastBookModified,
    lastBookOpen: 0
  };
}
