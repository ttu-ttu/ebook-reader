/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { EpubContent, EpubMetadataMeta } from './types';

export default function getEpubCoverImageFilename(contents: EpubContent) {
  for (const item of contents.package.manifest.item) {
    if (item['@_properties'] === 'cover-image') {
      return item['@_href'];
    }
  }

  const { meta } = contents.package.metadata;
  if (meta) {
    let coverItemId: string | undefined;
    if (Array.isArray(meta)) {
      for (const m of meta) {
        coverItemId = getCoverItemIdFromMeta(m);
        if (coverItemId) {
          break;
        }
      }
    } else {
      coverItemId = getCoverItemIdFromMeta(meta);
    }

    if (coverItemId) {
      for (const item of contents.package.manifest.item) {
        if (item['@_id'] === coverItemId) {
          return item['@_href'];
        }
      }
    }
  }

  return undefined;
}

function getCoverItemIdFromMeta(meta: EpubMetadataMeta) {
  if (meta['@_name'] === 'cover') {
    return meta['@_content'];
  }
  return undefined;
}
