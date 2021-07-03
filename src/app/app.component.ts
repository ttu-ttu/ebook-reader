/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, NgZone, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { faBookmark } from '@fortawesome/free-regular-svg-icons/faBookmark';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { faFileMedical } from '@fortawesome/free-solid-svg-icons/faFileMedical';
import { faFolderPlus } from '@fortawesome/free-solid-svg-icons/faFolderPlus';
import { faSyncAlt } from '@fortawesome/free-solid-svg-icons/faSyncAlt';
import * as parser from 'fast-xml-parser';
import { IDBPDatabase } from 'idb';
import { fromEvent, of } from 'rxjs';
import { filter, map, shareReplay, switchMap, take, withLatestFrom } from 'rxjs/operators';
import { AutoScrollerService } from './auto-scroller.service';
import { BookmarkManagerService } from './bookmark-manager.service';
import { BooksDb, DatabaseService } from './database.service';
import { EbookDisplayManagerService } from './ebook-display-manager.service';
import { OverlayCoverManagerService } from './overlay-cover-manager.service';
import { ScrollInformationService } from './scroll-information.service';
import { ThemeManagerService } from './theme-manager.service';
import parseCss from './utils/css-parser';
import stringifyCss from './utils/css-stringify';
import { EpubExtractor, HtmlzExtractor } from './utils/extractor';
import { getFormattedElementEpub, getFormattedElementHtmlz } from './utils/html-fixer';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  visible$ = this.router.events.pipe(
    filter((event) => event instanceof NavigationEnd),
    switchMap(() => {
      if (this.route.firstChild) {
        return this.route.firstChild.paramMap.pipe(
          map((paramMap) => paramMap.has('identifier'))
        );
      }
      return of(false);
    }),
    shareReplay(1),
  );
  loadingDb = true;
  isMobileDevice = this.isMobile();
  dropZoneLabel = this.isMobileDevice ?
    'Select supported Files (.htmlz or .epub) to continue.' :
    'Drop or select a single file (.htmlz or .epub) or a folder that contains those files to continue';
  dropzoneHighlight = false;
  showSettingsDialog = false;
  faFileMedical = faFileMedical;
  faFolderPlus = faFolderPlus;
  faCog = faCog;
  faBookmark = faBookmark;
  faSyncAlt = faSyncAlt;
  isUpdateAvailable = false;
  filePattern = /\.(?:htmlz|epub)$/;

  constructor(
    public autoScrollerService: AutoScrollerService,
    public bookmarManagerService: BookmarkManagerService,
    public ebookDisplayManagerService: EbookDisplayManagerService,
    private overlayCoverManagerService: OverlayCoverManagerService,
    private scrollInformationService: ScrollInformationService,
    private themeManagerService: ThemeManagerService,
    private databaseService: DatabaseService,
    private router: Router,
    private route: ActivatedRoute,
    private zone: NgZone,
    updates: SwUpdate,
  ) {
    updates.available.subscribe(() => {
      this.isUpdateAvailable = true;
    });
  }

  ngOnInit(): void {
    fromEvent<DragEvent>(document.body, 'dragenter').subscribe((ev) => this.onDragEnter(ev));
    fromEvent<DragEvent>(document.body, 'dragover').subscribe((ev) => this.onDragOver(ev));
    fromEvent<DragEvent>(document.body, 'dragend').subscribe((ev) => this.onDragEnd(ev));
    fromEvent<DragEvent>(document.body, 'drop').pipe(
      withLatestFrom(this.ebookDisplayManagerService.loadingFiles$)).subscribe(([ev, loadingFiles$]) => {
        ev.preventDefault();
        if (!loadingFiles$) {
          this.onDrop(ev);
        }
      });
    fromEvent<KeyboardEvent>(window, 'keydown').pipe(
      withLatestFrom(this.ebookDisplayManagerService.loadingFile$, this.visible$),
    ).subscribe(([ev, loadingFile, visible]) => {
      if (!loadingFile && visible) {
        switch (ev.code) {
          case 'Escape':
            this.setShowSettingsDialog(false);
            break;
          case 'Space':
            this.autoScrollerService.toggle();
            ev.preventDefault();
            break;
          case 'KeyA':
            this.autoScrollerService.increaseSpeed();
            break;
          case 'KeyD':
            this.autoScrollerService.decreaseSpeed();
            break;
          case 'KeyB':
            this.bookmarManagerService.saveScrollPosition();
            break;
          case 'PageDown':
            window.scrollBy({
              left: (window.innerWidth - (this.overlayCoverManagerService.borderSize * 2)) * -.9,
              behavior: 'smooth',
            });
            break;
          case 'PageUp':
            window.scrollBy({
              left: (window.innerWidth - (this.overlayCoverManagerService.borderSize * 2)) * .9,
              behavior: 'smooth',
            });
            break;
        }
      }
    });

    this.databaseService.db.then((db) => {
      this.visible$.pipe(
        take(1),
      ).subscribe(async (visible) => {
        if (!visible) {
          const lastItem = await db.get('lastItem', 0);
          if (lastItem) {
            this.ebookDisplayManagerService.loadingFile$.next(true); // otherwise may get NG0100 (if modified while init ReaderComponent)
            await this.router.navigate(['b', lastItem.dataId]);
          }
        }
        this.loadingDb = false;
      });
    });
  }

  isMobile() {
    let isMobileDevice = false;
    if ('maxTouchPoints' in window.navigator as any) {
      isMobileDevice = 0 < window.navigator.maxTouchPoints;
    } else if ('msMaxTouchPoints' in window.navigator as any) {
      isMobileDevice = 0 < window.navigator.msMaxTouchPoints;
    } else {
      const mQ = window.matchMedia?.('(pointer:coarse)');
      if (mQ?.media === '(pointer:coarse)') {
        isMobileDevice = !!mQ.matches;
      } else if ('orientation' in window) {
        isMobileDevice = true;
      } else {
        const UA = window.navigator.userAgent;
        isMobileDevice = (
          /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(UA) ||
          /\b(Android|Windows Phone|iPad|iPod)\b/i.test(UA)
        );
      }
    }
    return isMobileDevice;
  }

  onInputChange(el: HTMLInputElement) {
    if (el.files?.length) {
      const validFiles = Array.from(el.files).filter((file) => this.filePattern.test(file.name));

      if (validFiles.length) {
        this.onFileChange(validFiles);
      } else {
        alert('Only .htmlz and .epub Files are supported');
      }
    }
  }

  setShowSettingsDialog(b: boolean) {
    this.showSettingsDialog = b;
    this.ebookDisplayManagerService.allowScroll = !b;
    if (b) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.removeProperty('overflow');
    }
  }

  onDrop(ev: DragEvent) {
    this.dropzoneHighlight = false;

    if (!ev?.dataTransfer?.items) {
      return;
    }

    const items = [];

    for (const item of ev.dataTransfer.items) {
      if ('file' !== item.kind) {
        continue;
      }

      items.push(item.webkitGetAsEntry());
    }

    if (items.length) {
      this.handleDropResult(items);
    }
  }

  async handleDropResult(items: any[]) {
    const addFilesFromDirectory = async (entry: any, fileMap: Map<string, File>): Promise<void> => {
      if (entry.isDirectory) {
        const dirReader = entry.createReader();

        const entries = await new Promise<any>(async (resolve) => {
          const allEntries = [];
          let dirEntries = await new Promise<any>((innerResolve) => dirReader.readEntries(innerResolve)).catch(() => []);

          while (dirEntries.length) {
            allEntries.push(...dirEntries);
            dirEntries = await new Promise<any>((innerResolve) => dirReader.readEntries(innerResolve)).catch(() => []);
          }
          resolve(allEntries);
        }).catch(() => []);
        for (let index = 0, length = entries.length; index < length; index++) {
          await addFilesFromDirectory(entries[index], fileMap).catch(() => { });
        }
      } else {
        const file = await new Promise<File>((resolve) => entry.file(resolve)).catch(() => { });

        if (file && this.filePattern.test(file.name)) {
          fileMap.set(file.name, file);
        }
      }
    };

    const files = new Map<string, File>();

    for (let index = 0, length = items.length; index < length; index++) {
      const entry = items[index];

      if (entry.isDirectory) {
        await addFilesFromDirectory(entry, files);
      } else if (this.filePattern.test(entry.name)) {

        const file = await new Promise<File>((resolve) => entry.file(resolve)).catch(() => { });
        if (file) {
          files.set(file.name, file);
        }
      }
    }

    if (!files.size) {
      return alert('Only .htmlz and .epub Files are supported');
    }

    this.onFileChange(Array.from(files.values()));
  }

  onDragEnter(ev: DragEvent) {
    ev.preventDefault();
    this.dropzoneHighlight = true;
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.dropzoneHighlight = true;
  }

  onDragEnd(ev: DragEvent) {
    ev.preventDefault();
    this.dropzoneHighlight = false;
  }

  private async onFileChange(files: Array<File>) {
    const multiFiles = 1 < files.length;

    let dataId = 0;
    let importFailures = 0;

    this.autoScrollerService.stop();

    if (!multiFiles) {
      this.ebookDisplayManagerService.loadingFile$.next(true);
    }

    const db = await this.databaseService.db.catch(() => {
      if (!multiFiles) {
        this.ebookDisplayManagerService.loadingFile$.next(false);
      }
      return undefined;
    });

    if (!db) {
      return alert('Failure accessing Database');
    }

    for (let index = 0, length = files.length; index < length; index++) {
      const file = files[index];

      if (multiFiles) {
        this.ebookDisplayManagerService.loadingFiles$.next({
          title: file.name,
          progress: `${Math.round(index / length * 100)}%`
        });
      }

      const lastDataId = await this.storeFileInDB(db, file);

      if (lastDataId) {
        dataId = lastDataId;
      } else {
        importFailures++;
      }
    }

    if (importFailures) {
      alert(`${importFailures} Import(s) failed`);
    }

    if (multiFiles) {
      this.ebookDisplayManagerService.loadingFiles$.next(undefined);
    }

    if (!dataId) {
      if (!multiFiles) {
        this.ebookDisplayManagerService.loadingFile$.next(false);
      }

      return;
    }

    void db.put('lastItem', {
      dataId,
    }, 0).catch(() => { });
    await this.zone.run(async () => {
      this.ebookDisplayManagerService.loadingFile$.next(true);
      const changedIdentifier = await this.router.navigate(['b', dataId]);
      if (!changedIdentifier) {
        this.ebookDisplayManagerService.revalidateFile.next();
      }
    }).catch(() => this.ebookDisplayManagerService.loadingFile$.next(false));
  }

  private storeFileInDB(db: IDBPDatabase<BooksDb>, file: File): Promise<number | undefined> {
    return this.zone.runOutsideAngular(async () => {
      try {
        const storeData = file.name.endsWith('.epub') ? await processEpub(file) : await processHtmlz(file);
        let dataId: number;
        {
          const tx = db.transaction('data', 'readwrite');
          const store = tx.store;
          const oldId = await store.index('title').getKey(storeData.title);

          if (oldId) {
            dataId = await store.put({
              ...storeData,
              id: oldId,
            });
          } else {
            dataId = await store.add(storeData);
          }
          await tx.done;
          return dataId;
        }
      } catch (ex) {
        console.error(`${file.name}: ${ex.message}`);
        return undefined;
      }
    });
  }
}

const htmlzExtractor = new HtmlzExtractor();
async function processHtmlz(file: File) {
  const data = await htmlzExtractor.extract(file);
  const element = getFormattedElementHtmlz(data);
  const metadata = parser.parse(data['metadata.opf'] as string)?.package?.metadata;
  const displayData = {
    title: file.name,
    styleSheet: fixStyleString(data['style.css'] as string),
  };
  if (metadata && metadata['dc:title']) {
    displayData.title = metadata['dc:title'];
  }
  const blobData = Object.entries(data)
    .filter((d): d is [string, Blob] => d[1] instanceof Blob)
    .reduce<Record<string, Blob>>((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});
  const blobDataWithoutCoverImage = {
    ...blobData,
  };
  delete blobDataWithoutCoverImage['cover.jpg'];
  const storeData: BooksDb['data']['value'] = {
    ...displayData,
    elementHtml: element.innerHTML,
    blobs: blobDataWithoutCoverImage,
    coverImage: blobData['cover.jpg'],
  };
  return storeData;
}

const epubExtractor = new EpubExtractor();
async function processEpub(file: File) {
  const {
    contents,
    result: data,
  } = await epubExtractor.extract(file);
  const element = getFormattedElementEpub(data, contents);

  let styleSheet = '';

  const cssFiles = contents.package.manifest.item
    .filter((item) => item['@_media-type'] === 'text/css')
    .map((item) => item['@_href']);

  if (cssFiles.length) {
    const cssPathsUnique = new Set(cssFiles);

    let combinedDirtyStyleString = '';
    for (const mainCssFilename of cssPathsUnique) {
      combinedDirtyStyleString += data[mainCssFilename] as string;
    }

    if (combinedDirtyStyleString) {
      styleSheet = fixStyleString(combinedDirtyStyleString);
    }
  }
  const displayData = {
    title: file.name,
    styleSheet,
  };

  const metadata = contents.package.metadata;
  if (metadata) {
    const dcTitle = metadata['dc:title'];
    if (typeof dcTitle === 'string') {
      displayData.title = dcTitle;
    } else if (dcTitle && dcTitle['#text']) {
      displayData.title = dcTitle['#text'];
    }
  }
  const blobData = Object.entries(data)
    .filter((d): d is [string, Blob] => d[1] instanceof Blob)
    .reduce<Record<string, Blob>>((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});

  let coverImageFilename = 'cover.jpeg';

  const coverDataItem = contents.package.manifest.item
    .find((item) => item['@_id'] === 'cover' && item['@_media-type'].startsWith('image/'));
  if (coverDataItem) {
    coverImageFilename = coverDataItem['@_href'];
  }

  const storeData: BooksDb['data']['value'] = {
    ...displayData,
    elementHtml: element.innerHTML,
    blobs: blobData,
    coverImage: blobData[coverImageFilename],
  };
  return storeData;
}

function fixStyleString(styleString: string): string {
  const cssAst = parseCss(styleString);

  let newRules: {
    type: string;
    selectors?: string[];
    declarations?: any[];
  }[] = [];
  if (cssAst.stylesheet.rules) {
    for (const rule of cssAst.stylesheet.rules) {
      if (rule.type === 'rule') {
        newRules.push(rule);
      }
    }
  }

  newRules = newRules
    .filter((rule) => rule.selectors
      ? !rule.selectors.includes('html') && !rule.selectors.includes('body')
      : true);

  if (cssAst.stylesheet.rules) {
    for (const rule of newRules) {
      if (rule.declarations) {
        const newDeclarations: { [key: string]: string } = {};
        let hasLineBreakDefined: boolean | undefined;
        for (const declaration of rule.declarations) {
          if (declaration.type === 'declaration') {
            {
              const regexResult = /(?:(?:-epub-)|(?:-webkit-))(.+)/i.exec(declaration.property);
              if (regexResult) {
                newDeclarations[regexResult[1]] = declaration.value;
              }
            }

            if (declaration.property === 'font-family') {
              let newValue: string = declaration.value;
              if (newValue.includes('sans-serif')) {
                newValue = `var(--font-family-sans-serif,"Noto Sans JP",${newValue})`;
              } else if (newValue.includes('serif')) {
                newValue = `var(--font-family-serif,"Noto Serif JP",${newValue})`;
              }
              newDeclarations[declaration.property] = newValue;
            }

            if (/(?:(?:-epub-)|(?:-webkit-))?word-break$/i.exec(declaration.property) && declaration.value === 'break-all') {
              if (hasLineBreakDefined === undefined) {
                hasLineBreakDefined = rule.declarations.some((d) => d.type === 'declaration' && d.property === 'line-break');
              }
              if (!hasLineBreakDefined && !newDeclarations['line-break']) {
                // to allow breaks one long string of periods
                newDeclarations['line-break'] = 'loose';
              }
            }
          }
        }
        for (const [property, value] of Object.entries(newDeclarations)) {
          rule.declarations.push({
            type: 'declaration',
            property,
            value,
          });
        }
      }
    }
  }

  return stringifyCss({
    stylesheet: {
      rules: newRules,
    },
    type: 'stylesheet',
  });
}
