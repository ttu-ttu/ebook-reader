/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import path from 'path-browserify';
import type { EpubContent } from './types';
import type { Section } from '../../../data/database/books-db/versions/v3/books-db-v3';
import buildDummyBookImage from '../utils/build-dummy-book-image';
import clearAllBadImageRef from '../utils/clear-all-bad-image-ref';
import fixXHtmlHref from '../utils/fix-xhtml-href';
import { getCharacterCount } from '$lib/functions/get-character-count';
import { getParagraphNodes } from '../../../components/book-reader/get-paragraph-nodes';

export const prependValue = 'ttu-';

export default function generateEpubHtml(
  data: Record<string, string | Blob>,
  contents: EpubContent,
  document: Document
) {
  let tocData = { type: 3, content: '' };
  let navKey = '';

  const itemIdToHtmlRef = contents.package.manifest.item.reduce<Record<string, string>>(
    (acc, item) => {
      if (item['@_media-type'] === 'application/xhtml+xml') {
        acc[item['@_id']] = item['@_href'];

        if (item['@_properties'] === 'nav') {
          navKey = item['@_href'];
        }
      }
      return acc;
    },
    {}
  );

  const blobLocations = Object.entries(data).reduce<string[]>((acc, [key, value]) => {
    const isV2Toc = key.endsWith('.ncx') && !tocData.content;

    if (isV2Toc || navKey === key) {
      tocData = {
        type: isV2Toc ? 2 : 3,
        content: value as string
      };
    }

    if (value instanceof Blob) {
      acc.push(key);
    }
    return acc;
  }, []);

  const parser = new DOMParser();
  const itemRefs = Array.isArray(contents.package.spine.itemref)
    ? contents.package.spine.itemref
    : [contents.package.spine.itemref];
  const sectionData: Section[] = [];
  const result = document.createElement('div');

  let mainChapters: Section[] = [];
  let firstChapterMatchIndex = -1;

  if (tocData.type && tocData.content) {
    const parsedToc = parser.parseFromString(tocData.content, 'text/html');

    if (tocData.type === 3) {
      mainChapters = [...parsedToc.querySelectorAll('nav[epub\\:type="toc"] a')].map((elm) => {
        const anchor = elm as HTMLAnchorElement;

        return { reference: anchor.href, charactersWeight: 1, label: anchor.innerText };
      });
    } else {
      mainChapters = [...parsedToc.querySelectorAll('navPoint')].map((elm) => {
        const navLabel = elm.querySelector('navLabel text') as HTMLElement;
        const contentElm = elm.querySelector('content') as HTMLElement;

        return {
          reference: contentElm.getAttribute('src') as string,
          charactersWeight: 1,
          label: navLabel.innerText
        };
      });
    }
  }

  if (mainChapters.length) {
    firstChapterMatchIndex = itemRefs.findIndex((ref) =>
      mainChapters[0].reference.includes(itemIdToHtmlRef[ref['@_idref']])
    );

    if (firstChapterMatchIndex > 0) {
      mainChapters.unshift({
        reference: itemIdToHtmlRef[itemRefs[0]['@_idref']],
        charactersWeight: 1,
        label: 'Preface',
        startCharacter: 0
      });
    }
  }

  let currentMainChapter = mainChapters[0];
  let currentMainChapterId = currentMainChapter
    ? `${prependValue}${itemRefs[firstChapterMatchIndex]['@_idref']}`
    : '';
  let currentMainChapterIndex = 0;
  let previousCharacterCount = 0;
  let currentCharCount = 0;

  itemRefs.forEach((item) => {
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

    currentCharCount += countForElement(childDiv);

    const mainChapterIndex = mainChapters.findIndex((chapter) =>
      chapter.reference.includes(htmlHref)
    );
    const mainChapter = mainChapterIndex > -1 ? mainChapters[mainChapterIndex] : undefined;
    const characters = currentCharCount - previousCharacterCount;

    if (mainChapter) {
      currentMainChapter = mainChapter;
      currentMainChapterIndex = sectionData.length;
      currentMainChapterId = `${prependValue}${itemIdRef}`;

      sectionData.push({
        reference: currentMainChapterId,
        charactersWeight: characters || 1,
        label: currentMainChapter.label,
        startCharacter: previousCharacterCount,
        characters: characters - (mainChapterIndex ? 0 : 1)
      });
    } else if (currentMainChapter) {
      (sectionData[currentMainChapterIndex].characters as number) += characters;

      sectionData.push({
        reference: `${prependValue}${itemIdRef}`,
        charactersWeight: characters || 1,
        parentChapter: currentMainChapterId
      });
    }

    previousCharacterCount = currentCharCount;
  });

  clearAllBadImageRef(result);
  fixXHtmlHref(result);
  flattenAnchorHref(result);

  return {
    element: result,
    sections: sectionData.filter((item: Section) => item.reference.startsWith(prependValue))
  };
}

function countForElement(containerEl: Node) {
  const paragraphs = getParagraphNodes(containerEl);

  let characterCount = 0;

  paragraphs.forEach((node) => {
    characterCount += getCharacterCount(node);
  });

  return characterCount;
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
