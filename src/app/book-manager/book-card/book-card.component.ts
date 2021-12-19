/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { faImage } from '@fortawesome/free-regular-svg-icons';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-book-card',
  templateUrl: './book-card.component.html',
  styleUrls: ['./book-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookCardComponent {
  @Input() imagePath?: string | Blob;

  @Input() title!: string;

  @Input() progress = 0;

  faImage = faImage;

  loadImageFail$ = new BehaviorSubject<boolean>(false);
}
