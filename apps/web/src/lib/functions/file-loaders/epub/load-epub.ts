/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
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
  const { contents, result: data } = await extractEpub(file);
  const result = generateEpubHtml(data, contents, document);

  const displayData = {
    title: file.name,
    hasThumb: true,
    styleSheet: generateEpubStyleSheet(data, contents)
  };

  const metadata = isOPFType(contents)
    ? contents['opf:package']['opf:metadata']
    : contents.package.metadata;

  if (metadata) {
    const dcTitle = metadata['dc:title'];
    if (typeof dcTitle === 'string') {
      displayData.title = dcTitle;
    } else if (dcTitle && dcTitle['#text']) {
      displayData.title = dcTitle['#text'];
    }
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
