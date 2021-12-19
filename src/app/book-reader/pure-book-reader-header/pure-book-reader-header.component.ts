/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import {
  Component,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  Input,
} from '@angular/core';
import { faBookmark } from '@fortawesome/free-regular-svg-icons';
import {
  faExpand,
  faCog,
  faSignOutAlt,
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-pure-book-reader-header',
  templateUrl: './pure-book-reader-header.component.html',
  styleUrls: ['./pure-book-reader-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PureBookReaderHeaderComponent {
  @Input()
  autoScrollMultiplier = 0;

  @Input()
  showFullscreenButton = true;

  @Output()
  bookmarkClick = new EventEmitter<void>();

  @Output()
  fullscreenClick = new EventEmitter<void>();

  @Output()
  bookManagerClick = new EventEmitter<void>();

  @Output()
  leavingPage = new EventEmitter<void>();

  faBookmark = faBookmark;

  faExpand = faExpand;

  faCog = faCog;

  faSignOutAlt = faSignOutAlt;
}
