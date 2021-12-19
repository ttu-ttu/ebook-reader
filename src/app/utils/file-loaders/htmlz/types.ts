/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

export interface HtmlzContent {
  'index.html': string;
  'metadata.opf': string;
  'style.css': string;
  [key: string]: string | Blob;
}
