/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { animate, style, transition, trigger } from '@angular/animations';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import {
  faTimesCircle,
  faCheckCircle,
} from '@fortawesome/free-solid-svg-icons';
import { Subject } from 'rxjs';
import BookCard from 'src/app/models/book-card.model';
import Easing from 'src/app/utils/easing';

@Component({
  selector: 'app-pure-book-card-list',
  templateUrl: './pure-book-card-list.component.html',
  styleUrls: ['./pure-book-card-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('shaderInOut', [
      transition('void => *', [
        style({ opacity: 0 }),
        animate(`200ms ${Easing.decelerate}`),
      ]),
      transition('* => void', [
        animate(`100ms ${Easing.accelerate}`, style({ opacity: 0 })),
      ]),
    ]),
    trigger('actionInOut', [
      transition('void => *', [
        style({ transform: 'scale(0)' }),
        animate(`100ms ${Easing.decelerate}`),
      ]),
      transition('* => void', [
        animate(`200ms ${Easing.standard}`, style({ transform: 'scale(0)' })),
      ]),
    ]),
  ],
})
export class PureBookCardListComponent {
  @Input()
  bookCards: BookCard[] = [];

  @Input()
  currentBookId?: number;

  @Input()
  selectedBookIds = new Set<number>();

  @Output()
  bookClick = new EventEmitter<BookCard>();

  @Output()
  removeBookClick = new EventEmitter<BookCard>();

  @Output()
  vsUpdate = new EventEmitter<BookCard[]>();

  hoveringBookId$ = new Subject<number>();

  faCheckCircle = faCheckCircle;

  faTimesCircle = faTimesCircle;

  // eslint-disable-next-line class-methods-use-this
  trackByBookCard(index: number, bookCard: BookCard) {
    return bookCard.id;
  }

  onMouseEnter(bookCard: BookCard) {
    this.hoveringBookId$.next(bookCard.id);
  }

  onMouseLeave() {
    this.hoveringBookId$.next(NaN);
  }
}
