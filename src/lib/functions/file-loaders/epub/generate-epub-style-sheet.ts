/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { isOPFType, type EpubContent, type EpubOPFContent } from './types';

export default function generateEpubStyleSheet(
  data: Record<string, string | Blob>,
  contents: EpubContent | EpubOPFContent
) {
  let styleSheet = '';

  const cssFiles = (
    isOPFType(contents)
      ? contents['opf:package']['opf:manifest']['opf:item']
      : contents.package.manifest.item
  )
    .filter((item) => item['@_media-type'] === 'text/css')
    .map((item) => item['@_href']);

  if (cssFiles.length) {
    const cssPathsUnique = new Set(cssFiles);

    const combinedDirtyStyleString = Array.from(cssPathsUnique).reduce(
      (acc, mainCssFilename) => acc + (data[mainCssFilename] as string),
      ''
    );

    if (combinedDirtyStyleString) {
      styleSheet = combinedDirtyStyleString;
    }
  }
  return styleSheet;
}
