/**
 * @license BSD-3-Clause
 * Copyright (c) 2025, ッツ Reader Authors
 * All rights reserved.
 */

import { getEntryFiles } from './get-entry-files';

export async function getDropEventFiles(ev: DragEvent) {
  if (!ev.dataTransfer?.items) {
    return [];
  }

  const items = Array.from(ev.dataTransfer.items)
    .filter((i) => i.kind === 'file')
    .map((i) => i.webkitGetAsEntry())
    .filter((i): i is FileSystemEntry => !!i);

  if (!items.length) {
    return [];
  }

  const nestedFiles = await Promise.all(items.map((i) => getEntryFiles(i)));
  return nestedFiles.flat();
}
