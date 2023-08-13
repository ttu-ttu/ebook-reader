/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type { EpubContent, EpubMetadataMeta } from './types';

export default async function getEpubCoverImageFilename(
  blobData: Record<string, Blob>,
  contents: EpubContent
) {
  const itemByProperty = contents.package.manifest.item.find(
    (item) => item['@_properties'] === 'cover-image'
  );

  if (itemByProperty && (await coverValidated(blobData[itemByProperty['@_href']]))) {
    return itemByProperty['@_href'];
  }

  const { meta } = contents.package.metadata;
  if (!meta) return undefined;

  const coverItemId = Array.isArray(meta)
    ? meta.map((m) => getCoverItemIdFromMeta(m)).find((id) => id)
    : getCoverItemIdFromMeta(meta);

  if (!coverItemId) return undefined;

  const coverHref = contents.package.manifest.item.find((item) => item['@_id'] === coverItemId)?.[
    '@_href'
  ];
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
