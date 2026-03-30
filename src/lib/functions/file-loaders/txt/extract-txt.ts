/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export default function extract(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      resolve(reader.result as string);
    });

    reader.addEventListener('error', () => {
      reject(new Error(`Error reading file ${file.name}`));
    });

    reader.readAsText(file);
  });
}
