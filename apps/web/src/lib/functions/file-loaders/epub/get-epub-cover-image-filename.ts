/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import type { EpubContent, EpubMetadataMeta } from './types';

export default function getEpubCoverImageFilename(contents: EpubContent) {
  const itemByProperty = contents.package.manifest.item.find(
    (item) => item['@_properties'] === 'cover-image'
  );
  if (itemByProperty) {
    return itemByProperty['@_href'];
  }

  const { meta } = contents.package.metadata;
  if (!meta) return undefined;

  const coverItemId = Array.isArray(meta)
    ? meta.map((m) => getCoverItemIdFromMeta(m)).find((id) => id)
    : getCoverItemIdFromMeta(meta);

  if (!coverItemId) return undefined;

  return contents.package.manifest.item.find((item) => item['@_id'] === coverItemId)?.['@_href'];
}

function getCoverItemIdFromMeta(meta: EpubMetadataMeta) {
  if (meta['@_name'] === 'cover') {
    return meta['@_content'];
  }
  return undefined;
}
