/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface EpubManifestItem {
  '@_href': string;
  '@_id': string;
  '@_media-type': string;
}

export interface EpubSpineItemRef {
  '@_idref': string;
}

export interface EpubContents {
  package: {
    metadata: {
      'dc:title': string | {
        '#text': string;
      };
    };
    manifest: {
      item: EpubManifestItem[];
    };
    spine: {
      itemref: EpubSpineItemRef[];
    }
  };
}
