/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { isOPFType, type EpubContent, type EpubMetadataMeta, type EpubOPFContent } from './types';

export default async function getEpubCoverImageFilename(
  blobData: Record<string, Blob>,
  contents: EpubContent | EpubOPFContent
) {
  const manifestItem = isOPFType(contents)
    ? contents['opf:package']['opf:manifest']['opf:item']
    : contents.package.manifest.item;

  const itemByProperty = manifestItem.find((item) => item['@_properties'] === 'cover-image');

  if (itemByProperty && (await coverValidated(blobData[itemByProperty['@_href']]))) {
    return itemByProperty['@_href'];
  }

  const meta = isOPFType(contents)
    ? contents['opf:package']['opf:metadata']['opf:meta']
    : contents.package.metadata.meta;
  if (!meta) return undefined;

  const coverItemId = Array.isArray(meta)
    ? meta.map((m) => getCoverItemIdFromMeta(m)).find((id) => id)
    : getCoverItemIdFromMeta(meta);

  if (!coverItemId) return undefined;

  const coverHref = manifestItem.find((item) => item['@_id'] === coverItemId)?.['@_href'];
  const isValidCover = coverHref ? await coverValidated(blobData[coverHref]) : false;

  return isValidCover ? coverHref : undefined;
}

function coverValidated(blob: Blob) {
  return new Promise((resolve) => {
    if (!blob) {
      resolve(false);
      return;
    }

    const image = new Image();

    image.addEventListener('load', () => {
      URL.revokeObjectURL(image.src);
      resolve(true);
    });

    image.addEventListener('error', () => {
      URL.revokeObjectURL(image.src);
      resolve(false);
    });

    image.src = URL.createObjectURL(blob);
  });
}

function getCoverItemIdFromMeta(meta: EpubMetadataMeta) {
  if (meta['@_name'] === 'cover') {
    return meta['@_content'];
  }
  return undefined;
}
