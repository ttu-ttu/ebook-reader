/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 *   All rights reserved.
 *
 *   This source code is licensed under the BSD-style license found in the
 *   LICENSE file in the root directory of this source tree.
 */

import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import ResizeObserver from 'resize-observer-polyfill';
import { combineLatest, fromEvent, merge, ReplaySubject, Subject } from 'rxjs';
import { debounceTime, filter, map, startWith, switchMap, take, takeUntil } from 'rxjs/operators';
import { BookmarkManagerService } from '../bookmark-manager.service';
import { DatabaseService } from '../database.service';
import { EbookDisplayManagerService } from '../ebook-display-manager.service';
import { OverlayCoverManagerService } from '../overlay-cover-manager.service';
import { ScrollInformationService } from '../scroll-information.service';
import { SmoothScroll } from '../utils/smooth-scroll';

const enum DeltaMode {
  DeltaPixel = 0,
  DeltaLine = 1,
  DeltaPage = 2,
}

const added = false;

@Component({
  selector: 'app-reader',
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.scss']
})
export class ReaderComponent implements OnInit, OnDestroy {

  @ViewChild('contentRef', { static: true }) contentElRef!: ElementRef<HTMLElement>;

  private observer!: ResizeObserver;
  private destroy$ = new Subject<void>();

  constructor(
    private title: Title,
    public ebookDisplayManagerService: EbookDisplayManagerService,
    private overlayCoverManagerService: OverlayCoverManagerService,
    private scrollInformationService: ScrollInformationService,
    private bookmarManagerService: BookmarkManagerService,
    private databaseService: DatabaseService,
    private route: ActivatedRoute,
    private router: Router,
    private zone: NgZone,
  ) {
  }

  ngOnInit(): void {
    if (!added) {
      document.body.appendChild(this.bookmarManagerService.el);
      document.body.appendChild(this.overlayCoverManagerService.el);
      document.body.appendChild(this.scrollInformationService.el);
    }
    this.overlayCoverManagerService.updateOverlaySize();

    this.contentElRef.nativeElement.appendChild(this.ebookDisplayManagerService.contentEl);
    this.zone.runOutsideAngular(() => {
      const wheelEventFn = SmoothScroll(document.documentElement, 4);
      fromEvent<WheelEvent>(document, 'wheel', {passive: false})
        .pipe(
          filter(() => this.ebookDisplayManagerService.allowScroll),
          takeUntil(this.destroy$),
        )
        .subscribe((ev) => {
          if (!ev.deltaY || ev.deltaX || ev.altKey || ev.shiftKey || ev.ctrlKey || ev.metaKey) {
            return;
          }

          // https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
          let scrollDistance: number;
          switch (ev.deltaMode) {
            case DeltaMode.DeltaPixel:
              scrollDistance = ev.deltaY;
              break;
            case DeltaMode.DeltaLine:
              scrollDistance = ev.deltaY * this.ebookDisplayManagerService.fontSize$.value * 1.75;
              break;
            default:
              scrollDistance = ev.deltaY * (window.innerWidth - (this.overlayCoverManagerService.borderSize * 2));
          }

          wheelEventFn(-scrollDistance);
          ev.preventDefault();
        });
      fromEvent(window, 'scroll').pipe(
        takeUntil(this.destroy$),
      ).subscribe(() => {
        this.scrollInformationService.updateScrollPercent(
          this.overlayCoverManagerService.borderSize,
          this.ebookDisplayManagerService.totalCharCount,
        );
      });
      const resizeObs$ = new ReplaySubject<void>(1);
      window.addEventListener('resize', () => {
        this.overlayCoverManagerService.updateOverlaySize();
        resizeObs$.next();
      });
      this.observer = new ResizeObserver(() => {
        resizeObs$.next();
      });
      this.observer.observe(this.contentElRef.nativeElement);
      resizeObs$.pipe(
        debounceTime(200),
        takeUntil(this.destroy$),
      ).subscribe(() => {
        this.scrollInformationService.updateParagraphPos();
        this.scrollInformationService.updateScrollPercent(
          this.overlayCoverManagerService.borderSize,
          this.ebookDisplayManagerService.totalCharCount,
        );
      });
    });

    this.ebookDisplayManagerService.contentChanged.pipe(
      takeUntil(this.destroy$),
    ).subscribe(() => {
      for (const el of this.ebookDisplayManagerService.contentEl.getElementsByTagName('a')) {
        el.href = document.location.pathname + el.hash;
      }
    });

    this.ebookDisplayManagerService.contentChanged.pipe(
      switchMap(() => {
        const elements = this.ebookDisplayManagerService.contentEl.getElementsByTagName('a');
        const elementsArray = [...elements];
        const obs$ = elementsArray.map((el) => fromEvent(el, 'click').pipe(
          map((ev) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            return el;
          }),
        ));
        return merge(...obs$);
      }),
      takeUntil(this.destroy$),
    ).subscribe((el) => {
      const targetEl = document.getElementById(el.hash.substring(1));
      if (targetEl) {
        const borderSize = this.overlayCoverManagerService.borderSize;
        if (borderSize) {
          targetEl.style.setProperty('scroll-margin-right', `${borderSize}px`);
        }
        targetEl.scrollIntoView();
      }
    });

    this.ebookDisplayManagerService.contentChanged.pipe(
      switchMap(() => {
        const elements = this.ebookDisplayManagerService.contentEl.getElementsByTagName('ruby');
        const elementsArray = [...elements];
        const obs$ = elementsArray.map((el) => fromEvent(el, 'click').pipe(
          take(1),
          map((ev) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            return el;
          }),
        ));
        return merge(...obs$);
      }),
      takeUntil(this.destroy$),
    ).subscribe((el) => {
      el.classList.add('reveal-rt');
    });

    this.ebookDisplayManagerService.contentChanged.pipe(
      switchMap(() => {
        const elements = this.ebookDisplayManagerService.contentEl.querySelectorAll('[data-ttu-spoiler-img]');
        const elementsArray = [...elements];
        const obs$ = elementsArray.map((el) => {
          const spoilerLabelEl = document.createElement('span');
          spoilerLabelEl.classList.add('spoiler-label');
          spoilerLabelEl.setAttribute('aria-hidden', 'true');
          spoilerLabelEl.innerText = 'ネタバレ';
          el.appendChild(spoilerLabelEl);
          return fromEvent(el, 'click').pipe(
            take(1),
            map((ev) => {
              ev.preventDefault();
              ev.stopImmediatePropagation();
              return [el, spoilerLabelEl];
            }),
          );
        });
        return merge(...obs$);
      }),
      takeUntil(this.destroy$),
    ).subscribe(([el, spoilerLabelEl]) => {
      el.removeChild(spoilerLabelEl);
      el.removeAttribute('data-ttu-spoiler-img');
    });

    this.ebookDisplayManagerService.contentChanged.pipe(
      switchMap(() => {
        const elements = this.ebookDisplayManagerService.contentEl.getElementsByTagName('img');
        const elementsArray = [...elements];
        const obs$ = elementsArray.flatMap((imgEl) => [
          fromEvent(imgEl, 'load'),
          fromEvent(imgEl, 'error'),
        ]);
        return merge(...obs$).pipe(
          startWith(0),
          map(() => elementsArray),
          debounceTime(1),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(async (elementsArray) => {
      if (elementsArray.every((imgEl) => imgEl.complete)) {
        this.scrollInformationService.updateParagraphPos();
        await this.bookmarManagerService.scrollToSavedPosition(
          this.overlayCoverManagerService.borderSize,
        );
        this.scrollInformationService.updateScrollPercent(
          this.overlayCoverManagerService.borderSize,
          this.ebookDisplayManagerService.totalCharCount,
        );
        this.ebookDisplayManagerService.loadingFile$.next(false);
      }
    });

    combineLatest([
      this.route.paramMap,
      this.ebookDisplayManagerService.revalidateFile.pipe(startWith(0)),
    ]).pipe(
      takeUntil(this.destroy$),
    ).subscribe(async ([paramMap]) => {
      this.ebookDisplayManagerService.loadingFile$.next(true);
      let canLoad = false;
      const identifier = paramMap.get('identifier');
      if (identifier) {
        const db = await this.databaseService.db;
        const displayData = await db.get('data', +identifier || 0);
        if (displayData) {
          canLoad = true;
          this.loadData(displayData);
        }
      }

      if (!canLoad) {
        this.ebookDisplayManagerService.loadingFile$.next(false);
        await this.router.navigate(['']);
      }
    });
  }

  ngOnDestroy() {
    this.observer.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(data: {
    id?: number;
    title: string;
    elementHtml: string;
    styleSheet: string;
    blobs: Record<string, Blob>,
  }) {
    let { elementHtml } = data;
    const {
      title,
      styleSheet,
      blobs,
    } = data;
    this.title.setTitle(title.trimEnd() + ' | ッツ Ebook Reader');
    // tslint:disable-next-line:no-non-null-assertion
    this.bookmarManagerService.identifier = data.id!;
    this.bookmarManagerService.el.hidden = true;

    const urls: Array<string> = [];

    for (const [key, value] of Object.entries(blobs)) {
      const url = URL.createObjectURL(value);
      urls.push(url);
      elementHtml = elementHtml.
        replaceAll(`data:image/gif;ttu:${key};base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==`, url).
        replaceAll(`ttu:${key}`, url);
    }

    const element = document.createElement('div');
    element.innerHTML = elementHtml;
    this.ebookDisplayManagerService.totalCharCount = this.ebookDisplayManagerService.getCharCount(element);
    this.scrollInformationService.initWatchParagraphs(element);
    this.ebookDisplayManagerService.updateContent(element, styleSheet);
    window.scrollTo(0, 0);
    setTimeout(() => {
      for (let index = 0, length = urls.length; index < length; index++) {
        URL.revokeObjectURL(urls[index]);
      }
    });
  }
}
