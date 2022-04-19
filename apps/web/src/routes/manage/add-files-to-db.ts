/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import { concat, defer, from, map, mergeMap, throwError } from 'rxjs';
import type { DatabaseService } from '$lib/data/database/books-db/database.service';
import loadEpub from '$lib/functions/file-loaders/epub/load-epub';
import loadHtmlz from '$lib/functions/file-loaders/htmlz/load-htmlz';
import { mapIncludeError } from '$lib/functions/rxjs/map-include-error';
import { scanCombine } from '$lib/functions/rxjs/scan-combine';
import { ErrorWithCode } from '$lib/functions/error-with-code';

const supportedExtRegex = /\.(?:htmlz|epub)$/;

export const enum ImportBookErrorCode {
  EMPTY_FILE_LIST
}

export function addFilesToDb(
  fileList: FileList | File[],
  requestPersistentStorage: boolean,
  storage: Pick<StorageManager, 'persist'>,
  db: DatabaseService,
  document: Document
) {
  const files = Array.from(fileList).filter((f) => supportedExtRegex.test(f.name));

  if (!files.length) {
    return throwError(
      () => new ErrorWithCode('File must be HTMLZ or EPUB', ImportBookErrorCode.EMPTY_FILE_LIST)
    );
  }

  const addFilesToDb$ = addFilesToDbPure(files, db, document).pipe(
    map((progress) => ({
      progress,
      total: files.length
    }))
  );

  if (requestPersistentStorage) {
    return from(storage.persist()).pipe(mergeMap(() => addFilesToDb$));
  }

  return addFilesToDb$;
}

function addFilesToDbPure(files: File[], db: DatabaseService, document: Document) {
  const addFileToDbFn = addFileToDb(db, document);
  return concat(...files.map(addFileToDbFn).map(mapIncludeError())).pipe(scanCombine());
}

function addFileToDb(db: DatabaseService, document: Document) {
  return (file: File) => {
    const loadFn = file.name.endsWith('.epub') ? loadEpub : loadHtmlz;
    return from(defer(() => loadFn(file, document))).pipe(
      mergeMap((storeData) => db.upsertData(storeData))
    );
  };
}
