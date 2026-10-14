/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Visual novels for ONScripter (a zip of the game folder), stored like a book as manga is:
 * the game files are its blobs and elementHtml holds a marker plus the file list. They run
 * in the ONScripter-yuri engine (static/vn/), whose text hook hands each page's text to
 * the player for the text panel (Yomitan), statistics and progress. Not upstream.
 */

import type { BooksDbBookmarkData } from '$lib/data/database/books-db/versions/books-db';
import { readerDb } from '$lib/data/reader-db';
import { countTextCharacters } from '$lib/functions/get-character-count';

const marker = '<!--ttu-vn-->';

/** Script files in the order the engine looks for them (ScriptHandler::readScriptSub). */
const scriptNames = [
  '0.txt',
  '00.txt',
  'nscr_sec.dat',
  'nscript.___',
  'nscript.dat',
  'onscript.nt2',
  'onscript.nt3'
];

export type VnEncoding = 'sjis' | 'utf8';

export interface VnInfo {
  encoding: VnEncoding;
  files: string[];
  /** URL of the game's folder on the server (VN_PATH games); the files are fetched from
   * there instead of being blobs */
  base?: string;
}

export interface VnRead {
  title: string;
  /** Hashes of the page texts already counted */
  pages: string[];
  /** Characters counted, the reading position */
  characters: number;
}

export type VnLine = { text: string; ruby?: string }[];

const vnCachePrefix = 'ttu-vn:';

/** Cache API cache keeping a server game's files in this browser (the /v page asks first). */
export function vnCacheName(title: string) {
  return `${vnCachePrefix}${title}`;
}

/** Frees kept files of games no longer in the library (removed from the server or elsewhere). */
export async function deleteOrphanVnCaches(titles: Set<string>) {
  if (!('caches' in window)) return;

  const names = await caches.keys();

  await Promise.all(
    names
      .filter((name) => name.startsWith(vnCachePrefix))
      .filter((name) => !titles.has(name.slice(vnCachePrefix.length)))
      .map((name) => caches.delete(name))
  );
}

/** Frees a game's kept files, e.g. when it leaves the library or Home. */
export async function deleteVnCache(title: string) {
  if ('caches' in window) await caches.delete(vnCacheName(title));
}

/** The folder holding the game's script ('' or 'Game/'), the shallowest if several. */
export function findVnRoot(paths: string[]): string | undefined {
  const roots = paths
    .filter((path) => scriptNames.includes(path.split('/').pop()!.toLowerCase()))
    .map((path) => path.slice(0, path.lastIndexOf('/') + 1))
    .sort((a, b) => a.split('/').length - b.split('/').length);

  return roots[0];
}

export function vnElementHtml(info: VnInfo) {
  return `${marker}${JSON.stringify(info)}`;
}

export function isVn(book: { elementHtml: string }) {
  return book.elementHtml.startsWith(marker);
}

export function vnInfo(book: { elementHtml: string }): VnInfo {
  return JSON.parse(book.elementHtml.slice(marker.length));
}

/** The script as plain bytes: numbered .txt files as they are, nscript.dat XORed with 0x84. */
export function decodeScript(name: string, bytes: Uint8Array): Uint8Array | undefined {
  const lower = name.toLowerCase();

  if (/^\d+\.txt$/.test(lower)) return bytes;
  if (lower === 'nscript.dat') return bytes.map((byte) => byte ^ 0x84);

  return undefined;
}

export function detectEncoding(bytes: Uint8Array): VnEncoding {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);

    return 'utf8';
  } catch {
    return 'sjis';
  }
}

export function decodeText(bytes: Uint8Array, encoding: VnEncoding) {
  // Indents are written as a Shift JIS space even in UTF-8 games.
  return new TextDecoder(encoding === 'utf8' ? 'utf-8' : 'shift_jis')
    .decode(bytes)
    .replace(/�@?/g, '　');
}

/**
 * Encoding and text length of a game from its script files (in any order): numbered .txt
 * files concatenated, or nscript.dat. Encrypted scripts (nscr_sec.dat, onscript.nt2…)
 * can't be read here: they count as Shift JIS without text.
 */
export function analyzeScripts(scripts: { path: string; bytes: Uint8Array }[]) {
  const decoded = [...scripts]
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
    .map(({ path, bytes }) => decodeScript(path, bytes))
    .filter((bytes): bytes is Uint8Array => !!bytes);
  const script = new Uint8Array(decoded.reduce((sum, bytes) => sum + bytes.length + 1, 0));

  decoded.reduce((offset, bytes) => {
    script.set(bytes, offset);
    script[offset + bytes.length] = 0x0a;
    return offset + bytes.length + 1;
  }, 0);

  const encoding = decoded.length ? detectEncoding(script) : 'sjis';

  return {
    encoding,
    characters: Math.max(scriptCharacters(decodeText(script, encoding)), 1)
  };
}

/** Script files the engine may read: top-level files of the game folder. */
export function isScriptPath(path: string) {
  return (
    !path.includes('/') && (/^\d+\.txt$/i.test(path) || scriptNames.includes(path.toLowerCase()))
  );
}

/**
 * Characters in the script's text lines: lines starting with a non-ASCII character or a
 * name tag, as commands start with ASCII. The name tag itself (`[name|voice/file.ogg]`) and
 * colour and text size codes are left out.
 * shortcut: counts choices and Japanese string arguments too, fine for a progress bar;
 * use the engine's own parser if exact counts are needed.
 */
export function scriptCharacters(script: string) {
  return script
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:\P{ASCII}|\[)/u.test(line))
    .map((line) =>
      line.replace(/^\s*\[[^\]]*\]/, '').replace(/#[0-9a-f]{6}|!(?:sd|[sdwz]\d+)/gi, '')
    )
    .reduce((sum, line) => sum + countTextCharacters(pageText(line)), 0);
}

/** A page from the engine: lines, with ONScripter ruby `(base/reading)` split out. */
export function parseVnPage(text: string): VnLine[] {
  return text.split('\n').map((line) => {
    // Split keeps the captures: text, base, reading, text, base, reading, text…
    const pieces = line.split(/\(([^/)]*)\/([^)]*)\)/);
    const parts: VnLine = [];

    for (let index = 0; index < pieces.length; index += 3) {
      if (pieces[index]) parts.push({ text: pieces[index] });
      if (index + 1 < pieces.length)
        parts.push({ text: pieces[index + 1], ruby: pieces[index + 2] });
    }

    return parts;
  });
}

/** The page's text without ruby readings, as counted for statistics. */
export function pageText(text: string) {
  return text.replace(/\(([^/)]*)\/[^)]*\)/g, '$1');
}

/** FNV-1a, enough to recognise a page seen before. */
export function hashPage(text: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

/**
 * The text newly read when the engine shows `page` after `previous`: the engine sends
 * the whole page at every click, so only what was added counts, and pages seen before
 * (reread, loaded from a save) add nothing, nor do pages the engine has as read before
 * (`readBefore`, from its kidoku data, which also covers other devices through synced saves).
 */
export function newText(previous: string, page: string, seen: Set<string>, readBefore = false) {
  const hash = hashPage(page);

  if (seen.has(hash)) return '';

  seen.add(hash);

  if (readBefore) return '';

  const before = pageText(previous);
  const now = pageText(page);

  return now.startsWith(before) ? now.slice(before.length) : now;
}

export async function loadVnRead(title: string): Promise<VnRead> {
  return (await (await readerDb()).get('vnRead', title)) ?? { title, pages: [], characters: 0 };
}

export async function saveVnRead(read: VnRead) {
  await (await readerDb()).put('vnRead', read);
}

export function vnBookmark(dataId: number, read: number, total: number): BooksDbBookmarkData {
  return {
    dataId,
    exploredCharCount: read,
    progress: total ? Math.min(read / total, 1) : 0,
    lastBookmarkModified: Date.now()
  };
}

/** The engine's save files (save1.dat, gloval.sav…) as synced in vnsaves.json, with the CONscripter version that wrote them. */
export type VnSaves = Record<string, { modified: number; data: string; engine?: string }>;

/** The newest engine version among the saves if it is newer than `installed` (v1.2.3 tags). */
export function newerSaveEngine(saves: VnSaves, installed: string) {
  const parts = (version: string) => version.replace(/^v/, '').split('.').map(Number);
  const newer = (a: string, b: string) => {
    const [x, y] = [parts(a), parts(b)];
    const index = x.findIndex((part, i) => part !== (y[i] ?? 0));

    return index >= 0 && x[index] > (y[index] ?? 0);
  };

  if (!/^v?\d+(\.\d+)*$/.test(installed)) return undefined;

  return Object.values(saves)
    .map((file) => file.engine)
    .filter((engine): engine is string => !!engine && /^v?\d+(\.\d+)*$/.test(engine))
    .reduce<string | undefined>(
      (newest, engine) => (newer(engine, newest ?? installed) ? engine : newest),
      undefined
    );
}

/** Per file, the newer copy wins; nothing is ever deleted (the engine doesn't delete saves). */
export function mergeVnSaves(local: VnSaves, remote: VnSaves): VnSaves {
  const merged = { ...remote };

  Object.entries(local).forEach(([name, file]) => {
    if (!merged[name] || merged[name].modified < file.modified) merged[name] = file;
  });

  return merged;
}

export function sameVnSaves(a: VnSaves, b: VnSaves) {
  const names = Object.keys(a);

  return (
    names.length === Object.keys(b).length &&
    names.every((name) => b[name]?.modified === a[name].modified)
  );
}

export function toBase64(bytes: Uint8Array) {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

export function fromBase64(text: string) {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

/** A path inside a game folder as a URL path (each segment encoded). */
export function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

/** A line of the page as drawn on the game screen, in screen pixels, for hover lookups. */
export interface VnOverlayLine {
  text: string;
  x: number;
  y: number;
  /** Font size */
  size: number;
  /** Distance between characters */
  pitch: number;
}

function charLength(lead: number, encoding: VnEncoding) {
  if (encoding === 'utf8') return lead < 0x80 ? 1 : lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : 2;

  return (lead >= 0x81 && lead <= 0x9f) || (lead >= 0xe0 && lead <= 0xfc) ? 2 : 1;
}

/**
 * The page's characters grouped into screen lines, from the engine's character boxes
 * (byte offset in the page, x, y, font size; four numbers each). Ruby readings have no
 * boxes, so lines hold the base text only.
 * shortcut: one pitch per line, from its first and last character, so half-width letters
 * in a full-width line drift a little; give each run its own pitch if that matters.
 */
export function overlayLines(
  bytes: Uint8Array,
  boxes: ArrayLike<number>,
  encoding: VnEncoding
): VnOverlayLine[] {
  const lines: { text: string; x: number; y: number; size: number; last: number; count: number }[] =
    [];

  for (let index = 0; index + 3 < boxes.length; index += 4) {
    const offset = boxes[index];

    if (offset >= bytes.length) break;

    const char = decodeText(
      bytes.subarray(offset, offset + charLength(bytes[offset], encoding)),
      encoding
    );
    const [x, y, size] = [boxes[index + 1], boxes[index + 2], boxes[index + 3]];
    const line = lines[lines.length - 1];

    if (line && line.y === y && x > line.last) {
      line.text += char;
      line.last = x;
      line.count += 1;
    } else {
      lines.push({ text: char, x, y, size, last: x, count: 1 });
    }
  }

  return lines.map(({ text, x, y, size, last, count }) => ({
    text,
    x,
    y,
    size,
    pitch: count > 1 ? (last - x) / (count - 1) : size
  }));
}
