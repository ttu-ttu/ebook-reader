/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { BlobWriter, Uint8ArrayWriter, type Entry } from '@zip.js/zip.js';
import type { LoadData } from '../types';
import { getMimeTypeFromName } from '../htmlz/extract-htmlz';
import { analyzeScripts, encodePath, isScriptPath, vnElementHtml } from '$lib/data/vn';

/**
 * An ONScripter game from a zip as a book: every file under `root` is a blob, keyed by
 * its path inside the game folder. characters is the script's text, for progress.
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
  const scripts: { path: string; bytes: Uint8Array }[] = [];

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

    if (isScriptPath(path)) {
      scripts.push({ path, bytes: await entry.getData(new Uint8ArrayWriter()) });
    }
  }

  const cover = Object.keys(blobs).find(
    (path) => !path.includes('/') && /(?:cover|icon).*\.(?:jpe?g|png|webp)$/i.test(path)
  );
  const { encoding, characters } = analyzeScripts(scripts);

  return {
    title: name.replace(/\.(?:cbz|zip)$/i, ''),
    styleSheet: '',
    elementHtml: vnElementHtml({ encoding, files: Object.keys(blobs) }),
    blobs,
    coverImage: cover
      ? new Blob([blobs[cover]], { type: getMimeTypeFromName(cover) || '' })
      : undefined,
    hasThumb: !!cover,
    characters,
    lastBookModified,
    lastBookOpen: 0
  };
}

async function fetchOk(url: string) {
  const response = await fetch(url, { cache: 'no-cache' });

  if (!response.ok) throw new Error(`${decodeURI(url)}: HTTP ${response.status}`);

  return response;
}

/** Every file under a folder URL, through nginx's JSON directory listings. */
async function listFiles(base: string, prefix = ''): Promise<string[]> {
  const entries: { name: string; type: string }[] = await (
    await fetchOk(`${base}${encodePath(prefix)}`)
  ).json();
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.type === 'directory')
      files.push(...(await listFiles(base, `${prefix}${entry.name}/`)));
    else files.push(`${prefix}${entry.name}`);
  }

  return files;
}

/**
 * A game kept unpacked on the server (VN_PATH): only the file list and the script are
 * read here; the player fetches the other files when the engine opens them.
 * shortcut: the file list is taken when the game is first opened; files added to the
 * folder later are only seen after removing the game from the browser.
 */
export async function loadVnFolder(
  title: string,
  base: string,
  lastBookModified: number
): Promise<LoadData> {
  const files = await listFiles(base);
  const scripts = await Promise.all(
    files.filter(isScriptPath).map(async (path) => ({
      path,
      bytes: new Uint8Array(await (await fetchOk(`${base}${encodePath(path)}`)).arrayBuffer())
    }))
  );
  const { encoding, characters } = analyzeScripts(scripts);

  return {
    title,
    styleSheet: '',
    elementHtml: vnElementHtml({ encoding, files, base }),
    blobs: {},
    coverImage: undefined,
    hasThumb: false,
    characters,
    lastBookModified,
    lastBookOpen: 0
  };
}
