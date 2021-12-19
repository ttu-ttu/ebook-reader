/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { parse } from 'fast-xml-parser';
import { LoadData } from '../types';
import reduceObjToBlobs from '../utils/reduce-obj-to-blobs';
import extractHtmlz from './extract-htmlz';
import { getFormattedElementHtmlz } from './generate-htmlz-html';
import getHtmlzCoverImageFilename from './get-htmlz-cover-image-filename';

export default async function loadHtmlz(
  file: File,
  document: Document
): Promise<LoadData> {
  const data = await extractHtmlz(file);
  const element = getFormattedElementHtmlz(data, document);
  const metadata = parse(data['metadata.opf'])?.package?.metadata;

  const displayData = {
    title: file.name,
    hasThumb: true,
    styleSheet: data['style.css'],
  };
  if (metadata && metadata['dc:title']) {
    displayData.title = metadata['dc:title'];
  }
  const blobData = reduceObjToBlobs(data);
  const coverImageFilename = getHtmlzCoverImageFilename();
  let coverImage: Blob | undefined;

  if (coverImageFilename) {
    coverImage = blobData[coverImageFilename];
    delete blobData[coverImageFilename];
  }

  return {
    ...displayData,
    elementHtml: element.innerHTML,
    blobs: blobData,
    coverImage,
  };
}
