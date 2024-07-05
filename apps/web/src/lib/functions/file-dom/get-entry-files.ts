/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

export async function getEntryFiles(entry: FileSystemEntry): Promise<File[]> {
  if (isDirectory(entry)) {
    const dirReader = entry.createReader();

    const entries = await getDirectoryEntries(dirReader);
    const nestedFiles = await Promise.all(entries.map((e) => getEntryFiles(e)));
    return nestedFiles.flat();
  }
  const file = await new Promise<File>((resolve, reject) => {
    (entry as FileSystemFileEntry).file(resolve, reject);
  });

  return [file];
}

async function getDirectoryEntries(
  dirReader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  const dirEntries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
    dirReader.readEntries(resolve, reject);
  });

  if (!dirEntries.length) {
    return [];
  }

  const childEntries = await getDirectoryEntries(dirReader);
  return dirEntries.concat(childEntries);
}

function isDirectory(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}
