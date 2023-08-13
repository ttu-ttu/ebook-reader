/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

export interface EpubMetadataMeta {
  '@_name': string;
  '@_content': string;
}

export interface EpubManifestItem {
  '@_href': string;
  '@_id': string;
  '@_media-type': string;
  '@_properties'?: string;
  '@_fallback'?: string;
}

export interface EpubSpineItemRef {
  '@_idref': string;
}

export interface EpubContent {
  package: {
    metadata: {
      'dc:title':
        | string
        | {
            '#text': string;
          };
      meta?: EpubMetadataMeta | EpubMetadataMeta[];
    };
    manifest: {
      item: EpubManifestItem[];
    };
    spine: {
      itemref: EpubSpineItemRef[];
    };
  };
}
