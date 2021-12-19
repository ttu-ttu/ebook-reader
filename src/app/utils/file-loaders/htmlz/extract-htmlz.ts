/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { BlobReader, BlobWriter, TextWriter, ZipReader } from '@zip.js/zip.js';
import initZipSettings from '../utils/init-zip-settings';
import { HtmlzContent } from './types';

initZipSettings();

export default async function extract(blob: Blob) {
  const reader = new ZipReader(new BlobReader(blob));
  // get all entries from the zip
  const entries = await reader.getEntries();

  const result: HtmlzContent = {
    'index.html': '',
    'metadata.opf': '',
    'style.css': '',
  };
  if (entries.length) {
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.getData && !entry.directory) {
          let value: string | Blob;
          switch (entry.filename) {
            case 'index.html':
            case 'metadata.opf':
            case 'style.css':
              value = await entry.getData(new TextWriter());
              break;
            default: {
              value = await entry.getData(
                new BlobWriter(getMimeTypeFromName(entry.filename))
              );
            }
          }
          result[entry.filename] = value;
        }
      })
    );
  }

  await reader.close();
  return result;
}

function getMimeTypeFromName(filename: string): string | undefined {
  // image/gif, image/png, image/jpeg, image/bmp, image/webp
  const regexResult = /.*\.([^.]+)$/.exec(filename);
  if (regexResult) {
    // eslint-disable-next-line default-case
    switch (regexResult[1].toLowerCase()) {
      case 'gif':
        return 'image/gif';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
      case 'jfif':
      case 'jfi':
        return 'image/jpeg';
      case 'bmp':
        return 'image/bmp';
      case 'webp':
        return 'image/webp';
    }
  }
  return undefined;
}
