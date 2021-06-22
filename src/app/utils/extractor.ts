/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 *   All rights reserved.
 *
 *   This source code is licensed under the BSD-style license found in the
 *   LICENSE file in the root directory of this source tree.
 */

import * as zip from '@zip.js/zip.js';
import * as parser from 'fast-xml-parser';
import path from 'path-browserify';
import { UAParser } from 'ua-parser-js';
import { EpubContents } from './epub-types';

const parseResult = new UAParser(window.navigator.userAgent).getResult();
const isKiwiBrowser = parseResult.os.name === 'Android' && parseResult.browser.name === 'Chrome';
zip.configure({
  useWebWorkers: !isKiwiBrowser,
});

export class HtmlzExtractor {

  async extract(blob: Blob) {
    const reader = new zip.ZipReader(new zip.BlobReader(blob));
    // get all entries from the zip
    const entries = await reader.getEntries();

    const result: Record<string, string | Blob> = {};
    if (entries.length) {
      await Promise.all(
        entries.map(async (entry) => {
          if (entry.getData && !entry.directory) {
            let value: string | Blob;
            switch (entry.filename) {
              case 'index.html':
              case 'metadata.opf':
              case 'style.css':
                value = await entry.getData(new zip.TextWriter());
                break;
              default: {
                value = await entry.getData(new zip.BlobWriter(getMimeTypeFromName(entry.filename)));
              }
            }
            result[entry.filename] = value;
          }
        }),
      );
    }

    // close the ZipReader
    await reader.close();
    return result;
  }

}

export class EpubExtractor {

  async extract(blob: Blob) {
    const reader = new zip.ZipReader(new zip.BlobReader(blob));
    // get all entries from the zip
    const entries = await reader.getEntries();

    const result: Record<string, string | Blob> = {};
    let contentsDirectory = '';
    let contents!: EpubContents;
    if (entries.length) {
      const fileMap = entries.reduce<Record<string, zip.Entry>>((acc, cur) => {
        acc[cur.filename] = cur;
        return acc;
      }, {});

      // tslint:disable-next-line:no-non-null-assertion
      const containerXml = await fileMap['META-INF/container.xml'].getData!(new zip.TextWriter());
      const container = parser.parse(containerXml, {
        ignoreAttributes: false,
      });
      const rootFiles = container.container.rootfiles.rootfile;
      const rootFile = Array.isArray(rootFiles) ? rootFiles[0] : rootFiles;

      const contentOpfFilename = rootFile['@_full-path'];
      // tslint:disable-next-line:no-non-null-assertion
      const contentsXml = await fileMap[contentOpfFilename].getData!(new zip.TextWriter());
      result[contentOpfFilename] = contentsXml;

      contentsDirectory = path.dirname(contentOpfFilename);

      contents = parser.parse(contentsXml, {
        ignoreAttributes: false,
      });

      await Promise.all(
        contents.package.manifest.item.map(async (item) => {
          const fileRelativePath = item['@_href'];
          const entry = fileMap[path.join(contentsDirectory, fileRelativePath)];
          if (entry.getData && !entry.directory) {
            let value: string | Blob;
            const mediaType: string = item['@_media-type'];
            if (mediaType.startsWith('image/')) {
              value = await entry.getData(new zip.BlobWriter(mediaType));
            } else {
              value = await entry.getData(new zip.TextWriter());
            }
            result[fileRelativePath] = value;
          }
        })
      );
    }

    await reader.close();
    return {
      contentsDirectory,
      contents,
      result,
    };
  }

}


function getMimeTypeFromName(filename: string): string | undefined {
  // image/gif, image/png, image/jpeg, image/bmp, image/webp
  const regexResult = /.*\.([^.]+)$/.exec(filename);
  if (regexResult) {
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
