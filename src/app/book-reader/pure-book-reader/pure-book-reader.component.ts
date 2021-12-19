/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { trigger, transition, style, animate } from '@angular/animations';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ContentRect } from 'resize-observer/lib/ContentRect';
import BookmarkData from 'src/app/models/bookmark-data.model';
import ContentLoadEvent from 'src/app/models/content-load-event.model';
import Easing from 'src/app/utils/easing';

@Component({
  selector: 'app-pure-book-reader',
  templateUrl: './pure-book-reader.component.html',
  styleUrls: ['./pure-book-reader.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('headerInOut', [
      transition('void => *', [
        style({ transform: 'translate3d(0, -150%, 0)' }),
        animate(`200ms ${Easing.decelerate}`),
      ]),
      transition('* => void', [
        animate(
          `200ms ${Easing.accelerate}`,
          style({ transform: 'translate3d(0, -150%, 0)' })
        ),
      ]),
    ]),
  ],
})
export class PureBookReaderComponent {
  @Input()
  showHeader = true;

  @Input()
  bookContent!: string;

  @Input()
  exploredCharCount = 0;

  @Input()
  bookCharCount = 0;

  @Input()
  showFooter = true;

  @Input()
  bookmarkData?: BookmarkData;

  @Input()
  verticalMode = true;

  @Input()
  footerTextColor!: string;

  @Output()
  headerMouseClick = new EventEmitter<void>();

  @Output()
  headerMouseClickOutside = new EventEmitter<void>();

  @Output()
  bookmarkClick = new EventEmitter<void>();

  @Output()
  contentResize = new EventEmitter<ContentRect>();

  @Output()
  contentLoad = new EventEmitter<ContentLoadEvent>();

  @Output()
  contentReady = new EventEmitter<void>();

  @Output()
  footerClick = new EventEmitter<void>();

  @Output()
  leavingPage = new EventEmitter<void>();

  skippableMouseEvent?: MouseEvent;

  onPlaceholderHeaderClick(ev: MouseEvent) {
    this.skippableMouseEvent = ev;
    this.headerMouseClick.emit();
  }
}
