/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { LoadData } from '../types';
import extractEpub from './extract-epub';
import generateEpubHtml from './generate-epub-html';
import generateEpubStyleSheet from './generate-epub-style-sheet';
import getEpubCoverImageFilename from './get-epub-cover-image-filename';
import { isOPFType } from './types';
import reduceObjToBlobs from '../utils/reduce-obj-to-blobs';

export default async function loadEpub(
  file: File,
  document: Document,
  lastBookModified: number
): Promise<LoadData> {
  const { contents, result: data, contentsDirectory } = await extractEpub(file);
  const result = generateEpubHtml(data, contents, document, contentsDirectory);

  const displayData = {
    title: file.name,
    language: '',
    hasThumb: true,
    styleSheet: generateEpubStyleSheet(data, contents)
  };

  const metadata = isOPFType(contents)
    ? contents['opf:package']['opf:metadata']
    : contents.package.metadata;

  if (metadata) {
    const languageValues = Array.isArray(metadata['dc:language'])
      ? metadata['dc:language']
      : [metadata['dc:language']];
    const titleValues = Array.isArray(metadata['dc:title'])
      ? metadata['dc:title']
      : [metadata['dc:title']];

    for (const dcTitle of titleValues) {
      if (typeof dcTitle === 'string') {
        displayData.title = dcTitle;
        break;
      } else if (dcTitle && dcTitle['#text']) {
        displayData.title = dcTitle['#text'];
        break;
      }
    }

    displayData.language =
      languageValues.reduce((languages, dcLanguage) => {
        try {
          if (typeof dcLanguage === 'string') {
            languages.push(...Intl.getCanonicalLocales(dcLanguage.trim()));
          } else if (dcLanguage && dcLanguage['#text']) {
            languages.push(...Intl.getCanonicalLocales(dcLanguage.trim()));
          }
        } catch (_) {
          //no-op
        }

        return languages;
      }, [])?.[0] || '';
  }

  if (!displayData.language) {
    displayData.language = 'ja';
    console.warn(`no language data found for ${file.name} - fallback to ja`);
  }

  const blobData = reduceObjToBlobs(data);
  const coverImageFilename = await getEpubCoverImageFilename(blobData, contents);
  let coverImage: Blob | undefined;

  if (coverImageFilename) {
    coverImage = blobData[coverImageFilename];
  }

  return {
    ...displayData,
    elementHtml: result.element.innerHTML,
    blobs: blobData,
    coverImage,
    characters: result.characters,
    sections: result.sections,
    lastBookModified,
    lastBookOpen: 0
  };
}
