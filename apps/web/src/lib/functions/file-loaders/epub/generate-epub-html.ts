/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { isOPFType, type EpubContent, type EpubOPFContent } from './types';
import type { Section } from '../../../data/database/books-db/versions/v3/books-db-v3';
import buildDummyBookImage from '../utils/build-dummy-book-image';
import clearAllBadImageRef from '../utils/clear-all-bad-image-ref';
import fixXHtmlHref from '../utils/fix-xhtml-href';
import { getCharacterCount } from '$lib/functions/get-character-count';
import { getParagraphNodes } from '../../../components/book-reader/get-paragraph-nodes';
import path from 'path-browserify';

export const prependValue = 'ttu-';

export default function generateEpubHtml(
  data: Record<string, string | Blob>,
  contents: EpubContent | EpubOPFContent,
  document: Document
) {
  const fallbackData = new Map<string, string>();

  let tocData = { type: 3, content: '' };
  let navKey = '';

  const itemIdToHtmlRef = (
    isOPFType(contents)
      ? contents['opf:package']['opf:manifest']['opf:item']
      : contents.package.manifest.item
  ).reduce<Record<string, string>>((acc, item) => {
    if (item['@_fallback']) {
      fallbackData.set(item['@_id'], item['@_fallback']);
    }

    if (item['@_media-type'] === 'application/xhtml+xml' || item['@_media-type'] === 'text/html') {
      acc[item['@_id']] = item['@_href'];

      if (item['@_properties'] === 'nav') {
        navKey = item['@_href'];
      }
    }
    return acc;
  }, {});

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
  const spineItemRef = isOPFType(contents)
    ? contents['opf:package']['opf:spine']['opf:itemref']
    : contents.package.spine.itemref;
  const itemRefs = Array.isArray(spineItemRef) ? spineItemRef : [spineItemRef];
  const sectionData: Section[] = [];
  const result = document.createElement('div');

  let mainChapters: Section[] = [];
  let firstChapterMatchIndex = -1;

  if (tocData.type && tocData.content) {
    let parsedToc = parser.parseFromString(tocData.content, 'text/html');

    if (tocData.type === 3) {
      let navTocElement = parsedToc.querySelector('nav[epub\\:type="toc"],nav#toc');

      if (!navTocElement) {
        parsedToc = parser.parseFromString(tocData.content, 'text/xml');
      }

      navTocElement = parsedToc.querySelector('nav[epub\\:type="toc"],nav#toc');

      if (navTocElement) {
        mainChapters = [...navTocElement.querySelectorAll('a')].map((elm) => {
          const anchor = elm as HTMLAnchorElement;

          return { reference: anchor.href, charactersWeight: 1, label: anchor.innerText };
        });
      }
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
      mainChapters[0].reference.includes(itemIdToHtmlRef[ref['@_idref'].split('/').pop() || ''])
    );

    if (firstChapterMatchIndex !== 0) {
      const firstRef = itemRefs[0]['@_idref'];
      const firstHTMLRef = itemIdToHtmlRef[firstRef];
      const fallbackRef = fallbackData.get(firstRef);
      const reference = firstHTMLRef || (fallbackRef ? itemIdToHtmlRef[fallbackRef] : firstHTMLRef);

      mainChapters.unshift({
        reference,
        charactersWeight: 1,
        label: 'Preface',
        startCharacter: 0
      });
    }
  }

  let currentMainChapter = mainChapters[0];
  let currentMainChapterId = currentMainChapter ? `${prependValue}${itemRefs[0]['@_idref']}` : '';
  let currentMainChapterIndex = 0;
  let previousCharacterCount = 0;
  let currentCharCount = 0;

  itemRefs.forEach((item) => {
    let itemIdRef = item['@_idref'];
    let htmlHref = itemIdToHtmlRef[itemIdRef];

    if (!htmlHref && fallbackData.has(itemIdRef)) {
      itemIdRef = fallbackData.get(itemIdRef) as string;
      htmlHref = itemIdToHtmlRef[itemIdRef];
    }

    let parsedContent = parser.parseFromString(data[htmlHref] as string, 'text/html');
    let body = parsedContent.body;

    if (!body?.childNodes?.length) {
      parsedContent = parser.parseFromString(data[htmlHref] as string, 'text/xml');
      body = parsedContent.querySelector('body'); // XMLDocument doesn't seem to have the body property

      if (!body?.childNodes?.length) {
        throw new Error('Unable to find valid body content while parsing EPUB');
      }
    }

    const htmlClass = parsedContent.querySelector('html')?.className || '';
    const bodyId = body.id || '';
    const bodyClass = body.className || '';
    let innerHtml = body.innerHTML || '';

    blobLocations.forEach((blobLocation) => {
      innerHtml = innerHtml.replaceAll(
        relative(htmlHref, blobLocation),
        buildDummyBookImage(blobLocation)
      );
    });

    const childBodyDiv = document.createElement('div');
    childBodyDiv.className = `ttu-book-body-wrapper ${bodyClass}`;
    if (bodyId) {
      childBodyDiv.id = bodyId;
    }
    childBodyDiv.innerHTML = innerHtml;

    const childHtmlDiv = document.createElement('div');
    childHtmlDiv.className = `ttu-book-html-wrapper ${htmlClass}`;
    childHtmlDiv.appendChild(childBodyDiv);

    const childWrapperDiv = document.createElement('div');
    childWrapperDiv.id = `${prependValue}${itemIdRef}`;
    childWrapperDiv.appendChild(childHtmlDiv);

    result.appendChild(childWrapperDiv);

    currentCharCount += countForElement(childWrapperDiv);

    const mainChapterIndex = mainChapters.findIndex((chapter) =>
      chapter.reference.includes(htmlHref.split('/').pop() || '')
    );
    const mainChapter = mainChapterIndex > -1 ? mainChapters[mainChapterIndex] : undefined;
    const characters = currentCharCount - previousCharacterCount;

    if (mainChapter) {
      const oldMainChapterIndex = currentMainChapterIndex;

      currentMainChapter = mainChapter;
      currentMainChapterIndex = sectionData.length;
      currentMainChapterId = `${prependValue}${itemIdRef}`;

      sectionData.push({
        reference: currentMainChapterId,
        charactersWeight: characters || 1,
        label: currentMainChapter.label,
        startCharacter: currentMainChapterIndex
          ? (sectionData[oldMainChapterIndex].startCharacter as number) +
            (sectionData[oldMainChapterIndex].characters as number)
          : 0,
        characters
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
    characters: currentCharCount,
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
