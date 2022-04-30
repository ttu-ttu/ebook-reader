/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import path from 'path-browserify';
import buildDummyBookImage from '../utils/build-dummy-book-image';
import clearAllBadImageRef from '../utils/clear-all-bad-image-ref';
import fixXHtmlHref from '../utils/fix-xhtml-href';
import type { EpubContent } from './types';

const prependValue = 'ttu-';

export default function generateEpubHtml(
  data: Record<string, string | Blob>,
  contents: EpubContent,
  document: Document
) {
  const itemIdToHtmlRef = contents.package.manifest.item.reduce<Record<string, string>>(
    (acc, item) => {
      if (item['@_media-type'] === 'application/xhtml+xml') {
        acc[item['@_id']] = item['@_href'];
      }
      return acc;
    },
    {}
  );

  const blobLocations = Object.entries(data).reduce<string[]>((acc, [key, value]) => {
    if (value instanceof Blob) {
      acc.push(key);
    }
    return acc;
  }, []);

  const result = document.createElement('div');
  contents.package.spine.itemref.forEach((item) => {
    const itemIdRef = item['@_idref'];
    const htmlHref = itemIdToHtmlRef[itemIdRef];

    const regexResult = /.*<body(?:[^>]*id="(?<id>.+?)")*[^>]*>(?<body>(.|\s)+)<\/body>.*/.exec(
      data[htmlHref] as string
    )!;

    const bodyId = regexResult?.groups?.id || '';
    let innerHtml = regexResult?.groups?.body || '';

    blobLocations.forEach((blobLocation) => {
      innerHtml = innerHtml.replaceAll(
        relative(htmlHref, blobLocation),
        buildDummyBookImage(blobLocation)
      );
    });
    const childDiv = document.createElement('div');
    childDiv.innerHTML = innerHtml;
    childDiv.id = `${prependValue}${itemIdRef}`;

    if (bodyId) {
      const anchorHelper = document.createElement('span');
      anchorHelper.id = bodyId;
      childDiv.prepend(anchorHelper);
    }

    result.appendChild(childDiv);
  });

  clearAllBadImageRef(result);
  fixXHtmlHref(result);
  flattenAnchorHref(result);

  return result;
}

function flattenAnchorHref(el: HTMLElement) {
  Array.from(el.getElementsByTagName('a')).forEach((tag) => {
    const oldHref = tag.getAttribute('href');
    if (!oldHref) return;
    tag.setAttribute('href', `#${oldHref.replace(/.+#/, '')}`);
  });
}

/**
 * Replicates https://nodejs.org/api/path.html#path_path_relative_from_to
 */
function relative(fromPath: string, toPath: string): string {
  const fromDirName = path.dirname(fromPath);
  const toDirName = path.dirname(toPath);
  const toFilename = path.basename(toPath);

  if (fromDirName === toDirName) {
    return toFilename;
  }

  const fromParts = fromDirName === '.' ? [] : fromDirName.split('/');
  const toParts = toDirName === '.' ? [] : toDirName.split('/');

  if (fromParts.length >= toParts.length) {
    for (let i = 0; i < fromParts.length; i += 1) {
      if (fromParts[i] !== toParts[i]) {
        return path.join(
          '../'.repeat(fromParts.length - i) + toParts.slice(i).join('/'),
          toFilename
        );
      }
    }
  }
  for (let i = 0; i < fromParts.length; i += 1) {
    if (fromParts[i] !== toParts[i]) {
      return path.join('../'.repeat(fromParts.length - i) + toParts.slice(i).join('/'), toFilename);
    }
  }

  return path.join(toParts.slice(fromParts.length - toParts.length).join('/'), toFilename);
}
