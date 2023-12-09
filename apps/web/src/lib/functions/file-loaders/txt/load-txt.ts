/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type { LoadData } from '$lib/functions/file-loaders/types';
import extractTxt from '$lib/functions/file-loaders/txt/extract-txt';
import { getFormattedElementTxt } from '$lib/functions/file-loaders/txt/generate-txt-html';

export default async function loadTxt(file: File, lastBookModified: number): Promise<LoadData> {
  const data = await extractTxt(file);
  const element = getFormattedElementTxt(data);

  return {
    title: file.name.replace(/\.txt$/, ''),
    styleSheet: '',
    elementHtml: element.innerHTML,
    blobs: {},
    coverImage: undefined,
    hasThumb: false,
    characters: 0,
    lastBookModified,
    lastBookOpen: 0
  };
}
