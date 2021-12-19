/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { trigger, transition, animateChild, query } from '@angular/animations';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import {
  faBug,
  faCog,
  faTimes,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { iconInOut } from 'src/app/utils/header-animations';

@Component({
  selector: 'app-book-manager-header',
  templateUrl: './book-manager-header.component.html',
  styleUrls: ['./book-manager-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('iconInOut', iconInOut),
    trigger('container', [
      transition(':enter, :leave', [query('@*', animateChild())]),
    ]),
  ],
})
export class BookManagerHeaderComponent {
  @Input()
  haveBookOpened = false;

  @Input()
  selectMode = false;

  @Input()
  selectedCount = 0;

  @Input()
  isImporting = false;

  @Output()
  selectModeChange = new EventEmitter<boolean>();

  @Output()
  deselectAllClick = new EventEmitter<void>();

  @Output()
  selectAllClick = new EventEmitter<void>();

  @Output()
  removeClick = new EventEmitter<void>();

  @Output()
  bugReportClick = new EventEmitter<void>();

  @Output()
  backToBookClick = new EventEmitter<void>();

  @Output()
  filesChange = new EventEmitter<FileList>();

  faTimes = faTimes;

  faCog = faCog;

  faTrash = faTrash;

  faBug = faBug;

  onInputChange(el: HTMLInputElement) {
    if (el.files?.length) {
      this.filesChange.emit(el.files);
    }
  }
}
