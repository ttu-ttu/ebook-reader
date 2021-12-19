/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { ContentRect } from 'resize-observer/lib/ContentRect';
import {
  animationFrameScheduler,
  combineLatest,
  fromEvent,
  merge,
  Observable,
  of,
  race,
  Subject,
} from 'rxjs';
import {
  map,
  observeOn,
  share,
  startWith,
  switchMap,
  take,
  takeUntil,
} from 'rxjs/operators';
import ContentLoadEvent from 'src/app/models/content-load-event.model';
import {
  defaultFuriganaStyle,
  FuriganaStyle,
} from 'src/app/models/furigana-style.model';
import { WINDOW } from 'src/app/utils/dom-tokens';
import outsideZone from 'src/app/utils/rxjs/outside-zone';
import HorizontalMouseWheelMimic from './horizontal-scroll';

@Component({
  selector: 'app-pure-book-content',
  templateUrl: './pure-book-content.component.html',
  styleUrls: ['./pure-book-content.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PureBookContentComponent implements OnInit, OnDestroy, OnChanges {
  @Input()
  htmlContent!: string;

  @Input()
  verticalMode = true;

  @Input()
  fontColor = '';

  @Input()
  backgroundColor = '';

  @Input()
  hintFuriganaFontColor = '';

  @Input()
  hintFuriganaShadowColor = '';

  @Input()
  fontSize = 16;

  @Input()
  fontFamilyGroupOne = '';

  @Input()
  fontFamilyGroupTwo = '';

  @Input()
  hideSpoilerImage = false;

  @Input()
  hideFurigana = false;

  @Input()
  furiganaStyle = defaultFuriganaStyle;

  @Input()
  secondDimensionMaxValue = 0;

  @Input()
  firstDimensionMargin = 0;

  /**
   * Requires ChangeDetectorRef.detectChanges
   */
  @Output()
  contentResize = new EventEmitter<ContentRect>();

  @Output()
  contentLoad = new EventEmitter<ContentLoadEvent>();

  @Output()
  contentReady = new EventEmitter<void>();

  @Output()
  imageLoadingStateChange = new EventEmitter<boolean>();

  @ViewChild('content', { static: true })
  contentRef!: ElementRef<HTMLElement>;

  FuriganaStyle = FuriganaStyle;

  private verticalModeChange$ = new Subject<void>();

  private backgroundColorChange$ = new Subject<void>();

  private firstDimensionMarginChange$ = new Subject<void>();

  private contentEl$ = this.contentLoad.pipe(map(({ value }) => value));

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(WINDOW) private window: Window,
    @Inject(DOCUMENT) private document: Document,
    private zone: NgZone
  ) {}

  ngOnInit() {
    this.initVerticalModeListener();
    this.initBackgroundColorListener();
    this.initFirstDimensionMarginListener();
    this.initContainerRectListener();
    this.initHorizontalWheelListener();
    this.initAnchorTagListener();
    this.initRubyTagListener();
    this.initSpoilerImageListener();
    this.initImageStateListener();

    this.initDimensionVarsUpdater();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.verticalMode) {
      this.verticalModeChange$.next();
    }
    if (changes.backgroundColor) {
      this.backgroundColorChange$.next();
    }
    if (changes.htmlContent) {
      const containerEl = this.contentRef.nativeElement;
      const htmlContent = changes.htmlContent.currentValue;
      containerEl.innerHTML = htmlContent;
      this.contentLoad.emit({ value: containerEl, reflects: htmlContent });
    }
  }

  private initContainerRectListener() {
    const contentEl = this.contentRef.nativeElement;
    const observer$ = new Observable(() => {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === contentEl) {
            this.contentResize.emit(entry.contentRect);
          }
        }
      });

      observer.observe(contentEl);
      return () => {
        observer.disconnect();
      };
    });

    // Doesn't trigger change detection regardless of runOutsideAngular, might as well call it manually
    observer$
      .pipe(outsideZone(this.zone), takeUntil(this.destroy$))
      .subscribe();
  }

  private initHorizontalWheelListener() {
    const horizontalMouseWheel = new HorizontalMouseWheelMimic(
      this.window,
      this.document.documentElement,
      4
    );
    fromEvent<WheelEvent>(this.document, 'wheel', { passive: false })
      .pipe(takeUntil(this.destroy$))
      .subscribe((ev) => {
        if (this.verticalMode) {
          horizontalMouseWheel.onWheel(ev, this.fontSize);
        }
      });
  }

  private initAnchorTagListener() {
    const anchorTags$ = this.contentEl$.pipe(
      map((containerEl) => Array.from(containerEl.getElementsByTagName('a'))),
      share()
    );

    anchorTags$.pipe(takeUntil(this.destroy$)).subscribe((anchorTags) => {
      for (const el of anchorTags) {
        el.href = this.document.location.pathname + el.hash;
      }
    });

    anchorTags$
      .pipe(
        switchMap((anchorTags) => {
          const obs$ = anchorTags.map((el) =>
            fromEvent(el, 'click').pipe(
              map((ev) => {
                ev.preventDefault();
                ev.stopImmediatePropagation();
                return el;
              })
            )
          );
          return merge(...obs$);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((el) => {
        const targetEl = this.document.getElementById(el.hash.substring(1));
        if (targetEl) {
          targetEl.scrollIntoView();
        }
      });
  }

  private initRubyTagListener() {
    this.contentEl$
      .pipe(
        switchMap((contentEl) => {
          const elements = contentEl.getElementsByTagName('ruby');
          const elementsArray = [...elements];
          const obs$ = elementsArray.map((el) =>
            fromEvent(el, 'click').pipe(
              take(1),
              map((ev) => {
                ev.preventDefault();
                ev.stopImmediatePropagation();
                return el;
              })
            )
          );
          return merge(...obs$);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((el) => {
        el.classList.add('reveal-rt');
      });
  }

  private initSpoilerImageListener() {
    this.contentEl$
      .pipe(
        switchMap((contentEl) => {
          const elements = Array.from(
            contentEl.querySelectorAll('[data-ttu-spoiler-img]')
          );
          const obs$ = elements.map((el) => {
            const spoilerLabelEl = this.document.createElement('span');
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
              })
            );
          });
          return merge(...obs$);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(([el, spoilerLabelEl]) => {
        el.removeChild(spoilerLabelEl);
        el.removeAttribute('data-ttu-spoiler-img');
      });
  }

  private initVerticalModeListener() {
    const verticalRlClass = 'writing-vertical-rl';

    const { classList } = this.document.documentElement;
    this.verticalModeChange$
      .pipe(
        startWith(0),
        observeOn(animationFrameScheduler),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          if (this.verticalMode) {
            classList.add(verticalRlClass);
          } else {
            classList.remove(verticalRlClass);
          }
        },
        complete: () => {
          classList.remove(verticalRlClass);
        },
      });
  }

  private initBackgroundColorListener() {
    const { style } = this.document.body;
    const styleName = 'background-color';
    this.backgroundColorChange$
      .pipe(
        startWith(0),
        observeOn(animationFrameScheduler),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          style.setProperty(styleName, this.backgroundColor);
        },
        complete: () => {
          style.removeProperty(styleName);
        },
      });
  }

  private initFirstDimensionMarginListener() {
    const parentEl = this.document.body;

    const initBorderEl = () => {
      const el = this.document.createElement('div');
      el.style.position = 'fixed';
      parentEl.appendChild(el);
      return el;
    };
    const updateBorderEl = (el: HTMLElement, isStartEl: boolean) => {
      const { style } = el;
      style.backgroundColor = this.backgroundColor;

      let fullLengthDimension = 'width';
      let modifyingDimension = 'height';
      let boundSide = isStartEl ? 'top' : 'bottom';

      if (this.verticalMode) {
        fullLengthDimension = 'height';
        modifyingDimension = 'width';
        boundSide = isStartEl ? 'left' : 'right';
      }

      style.setProperty(fullLengthDimension, '100%');
      style.setProperty(modifyingDimension, `${this.firstDimensionMargin}px`);
      style.setProperty(boundSide, '0px');
    };

    const startEl = initBorderEl();
    const endEl = initBorderEl();

    combineLatest([
      this.firstDimensionMarginChange$,
      this.backgroundColorChange$,
      this.verticalModeChange$,
    ])
      .pipe(
        startWith(0),
        observeOn(animationFrameScheduler),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          updateBorderEl(startEl, true);
          updateBorderEl(endEl, false);
        },
        complete: () => {
          parentEl.removeChild(startEl);
          parentEl.removeChild(endEl);
        },
      });
  }

  private initImageStateListener() {
    this.contentEl$
      .pipe(
        switchMap((contentEl) => {
          const elements = Array.from(contentEl.getElementsByTagName('img'));
          const obsArray = elements.map((imgEl) => {
            if (imgEl.complete) {
              return of(1);
            }
            return race(fromEvent(imgEl, 'load'), fromEvent(imgEl, 'error'));
          });

          if (obsArray.length > 0) {
            this.imageLoadingStateChange.emit(true);
            return combineLatest(obsArray);
          }
          return of(1);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.imageLoadingStateChange.emit(false);
        this.contentReady.emit();
      });
  }

  private initDimensionVarsUpdater() {
    const containerEl = this.contentRef.nativeElement;
    this.contentResize
      .pipe(observeOn(animationFrameScheduler), takeUntil(this.destroy$))
      .subscribe((rect) => {
        containerEl.style.setProperty(
          '--book-content-child-height',
          `${rect.height}px`
        );
      });
  }
}
