/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  Renderer2,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { ContentRect } from 'resize-observer/lib/ContentRect';
import {
  animationFrameScheduler,
  combineLatest,
  fromEvent,
  NEVER,
  ReplaySubject,
  Subject,
} from 'rxjs';
import {
  debounceTime,
  filter,
  map,
  observeOn,
  shareReplay,
  switchMap,
  take,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { DatabaseService } from '../database/books-db/database.service';
import { BooksDbBookData } from '../database/books-db/versions/books-db';
import BookmarkData from '../models/bookmark-data.model';
import ContentLoadEvent from '../models/content-load-event.model';
import { StoreService } from '../store.service';
import loadBookData from '../utils/book-data-loader/load-book-data';
import { WINDOW } from '../utils/dom-tokens';
import formatPageTitle from '../utils/format-page-title';
import { availableThemes } from '../utils/theme-option';
import { AutoScrollService } from './auto-scroll.service';
import { AutoScroller } from './auto-scroller';
import { BookReaderAvailableKeybind } from './book-reader-keybind';
import { BookmarkManagerService } from './bookmark-manager.service';
import CharacterStatsCalculator from './character-stats-calculator';
import ScrollStabilizer from './scroll-stabilizer';

@Component({
  selector: 'app-book-reader',
  templateUrl: './book-reader.component.html',
  styleUrls: ['./book-reader.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookReaderComponent implements OnInit, OnDestroy {
  showHeader$ = new Subject<boolean>();

  bookContent$ = new ReplaySubject<string>(1);

  contentResize$ = new Subject<ContentRect>();

  exploredCharCount$ = new Subject<number>();

  showFooter$ = this.store.pinFooter$;

  bookmarkData$ = new Subject<BookmarkData | undefined>();

  verticalMode$ = this.store.verticalMode$;

  themeOption$ = this.store.theme$.pipe(map((theme) => availableThemes[theme]));

  footerTextColor$ = this.themeOption$.pipe(map((o) => o.toolipTextFontColor));

  private bookData$ = this.route.paramMap.pipe(
    switchMap(async (paramMap) => {
      const identifierString = paramMap.get('identifier');
      if (identifierString !== null) {
        const identifier = +identifierString;
        return this.db.getData(identifier);
      }
      return undefined;
    }),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  private bookId$ = this.bookData$.pipe(
    filter((bookData): bookData is BooksDbBookData => !!bookData),
    map((bookData) => bookData.id)
  );

  private calculator$ = new ReplaySubject<CharacterStatsCalculator>(1);

  bookCharCount$ = this.calculator$.pipe(
    map((calculator) => calculator.charCount)
  );

  private readonly styleEl: HTMLStyleElement;

  private readonly encapsulationAttributeName: string;

  private readonly scrollStabilizer = new ScrollStabilizer(this.window);

  private readonly autoScroller: AutoScroller;

  private destroy$ = new Subject<void>();

  constructor(
    private db: DatabaseService,
    private store: StoreService,
    private router: Router,
    private route: ActivatedRoute,
    private bookmarkService: BookmarkManagerService,
    private cdr: ChangeDetectorRef,
    private title: Title,
    @Inject(WINDOW) private window: Window,
    @Inject(DOCUMENT) private document: Document,
    renderer: Renderer2,
    autoScrollService: AutoScrollService
  ) {
    this.styleEl = document.createElement('style');
    document.head.insertBefore(this.styleEl, document.head.firstChild);

    const el = renderer.createElement('div');
    this.encapsulationAttributeName = el.attributes[0].name;

    this.autoScroller = autoScrollService.createAutoScroller(this.destroy$);
  }

  ngOnInit(): void {
    this.bookData$
      .pipe(
        switchMap((bookData) => {
          if (bookData) {
            return loadBookData(
              bookData,
              `[${this.encapsulationAttributeName}] .book-content`,
              this.document
            ).pipe(
              map(({ htmlContent, styleSheet }) => ({
                htmlContent,
                styleSheet,
                bookData,
              }))
            );
          }
          this.router.navigate(['manage']);
          return NEVER;
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(({ htmlContent, styleSheet, bookData }) => {
        this.updateStyleSheet(styleSheet);

        this.title.setTitle(formatPageTitle(bookData.title));
        this.bookContent$.next(htmlContent);
      });

    this.initAutoHideHeaderListener();
    this.initScrollEventListener();
    this.initResizeEventListener();
    this.initKeyboardEventListener();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.document.head.removeChild(this.styleEl);
  }

  onBookmarkClick() {
    combineLatest([this.bookId$, this.calculator$])
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(([bookId, calculator]) => {
        this.saveBookmark(bookId, calculator);
      });
  }

  onContentLoad(ev: ContentLoadEvent) {
    this.verticalMode$
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe((verticalMode) => {
        const calculator = new CharacterStatsCalculator(
          ev.value,
          verticalMode,
          this.document.documentElement,
          this.document
        );
        this.calculator$.next(calculator);
        this.exploredCharCount$.next(0);
        this.bookmarkData$.next(undefined);
        this.window.scrollTo(0, 0);
      });
  }

  onContentReady() {
    this.calculator$
      .pipe(take(1), withLatestFrom(this.bookId$), takeUntil(this.destroy$))
      .subscribe(([calculator, bookId]) => {
        calculator.updateParagraphPos();
        this.bookmarkService
          .scrollToSavedPosition(bookId, calculator)
          .then((bookmarkData) => this.bookmarkData$.next(bookmarkData));
      });
  }

  private initAutoHideHeaderListener() {
    this.calculator$
      .pipe(
        tap(() => this.showHeader$.next(true)),
        debounceTime(2500),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.showHeader$.next(false);
      });
  }

  private initScrollEventListener() {
    fromEvent(this.window, 'scroll')
      .pipe(
        filter(() => {
          if (this.scrollStabilizer.stabilizing) {
            this.scrollStabilizer.stabilizing = false;
            return false;
          }
          return true;
        }),
        observeOn(animationFrameScheduler),
        withLatestFrom(this.calculator$),
        takeUntil(this.destroy$)
      )
      .subscribe(([, calculator]) => {
        const charCount = calculator.calcExploredCharCount();
        this.scrollStabilizer.latestScrollStats = {
          containerWidth: calculator.containerEl.offsetWidth,
          exploredCharCount: charCount,
        };
      });

    fromEvent(this.window, 'scroll')
      .pipe(
        observeOn(animationFrameScheduler),
        withLatestFrom(this.calculator$),
        takeUntil(this.destroy$)
      )
      .subscribe(([, calculator]) => {
        const charCount = calculator.calcExploredCharCount();
        this.exploredCharCount$.next(charCount);
      });
  }

  private initResizeEventListener() {
    this.contentResize$
      .pipe(
        observeOn(animationFrameScheduler),
        withLatestFrom(
          this.bookId$,
          this.calculator$,
          this.store.autoPositionOnResize$
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(([, bookId, calculator, autoPosition]) => {
        calculator.updateParagraphPos();

        if (autoPosition) {
          this.scrollStabilizer.onResize(
            calculator.containerEl.offsetWidth,
            calculator
          );
        }

        const charCount = calculator.calcExploredCharCount();
        this.exploredCharCount$.next(charCount);
        this.bookmarkService
          .getBookmarkBarPosition(bookId, calculator)
          .then((bookmarkData) => {
            this.bookmarkData$.next(bookmarkData);
            this.cdr.detectChanges();
          });
        this.cdr.detectChanges();
      });
  }

  private initKeyboardEventListener() {
    fromEvent<KeyboardEvent>(this.window, 'keydown')
      .pipe(
        withLatestFrom(this.bookId$, this.calculator$),
        takeUntil(this.destroy$)
      )
      .subscribe(([ev, bookId, calculator]) => {
        const bookReaderKeybindMap =
          this.store.bookReaderKeybindMap$.getValue();
        const action = bookReaderKeybindMap[ev.code];

        if (!action) {
          return;
        }

        // eslint-disable-next-line default-case
        switch (action) {
          case BookReaderAvailableKeybind.BOOKMARK:
            this.saveBookmark(bookId, calculator);
            break;
          case BookReaderAvailableKeybind.JUMP_TO_BOOKMARK:
            this.bookmarkService.scrollToSavedPosition(bookId, calculator);
            break;
          case BookReaderAvailableKeybind.NEXT_PAGE:
            this.scrollByPercent(0.9);
            break;
          case BookReaderAvailableKeybind.PREV_PAGE:
            this.scrollByPercent(-0.9);
            break;
          case BookReaderAvailableKeybind.AUTO_SCROLL_TOGGLE:
            this.autoScroller.toggle();
            break;
          case BookReaderAvailableKeybind.AUTO_SCROLL_INCREASE:
            this.autoScroller.increaseSpeedSafe();
            break;
          case BookReaderAvailableKeybind.AUTO_SCROLL_DECREASE:
            this.autoScroller.decreaseSpeedSafe();
            break;
        }

        if (this.document.activeElement instanceof HTMLElement) {
          this.document.activeElement.blur();
        }
        ev.preventDefault(); // action guaranteed
      });
  }

  private scrollByPercent(value: number) {
    let windowSize = this.window.innerHeight;
    let scrollSide: 'left' | 'top' = 'top';
    let scale = 1;

    if (this.store.isVerticalMode()) {
      windowSize = this.window.innerWidth;
      scrollSide = 'left';
      scale = -1;
    }
    const pageSize =
      windowSize - this.store.firstDimensionMargin$.getValue() * 2;
    this.window.scrollBy({
      [scrollSide]: pageSize * value * scale,
      behavior: 'smooth',
    });
  }

  private updateStyleSheet(styleSheet: string) {
    const styleNode = this.document.createTextNode(styleSheet);
    if (this.styleEl.firstChild) {
      this.styleEl.replaceChild(styleNode, this.styleEl.firstChild);
    } else {
      this.styleEl.appendChild(styleNode);
    }
  }

  private saveBookmark(bookId: number, calculator: CharacterStatsCalculator) {
    this.bookmarkService
      .saveScrollPosition(bookId, calculator)
      .then((bookmarkData) => {
        this.bookmarkData$.next(bookmarkData);
      });
  }
}
