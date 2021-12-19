/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { faUpload } from '@fortawesome/free-solid-svg-icons';
import binarySearch from 'src/app/utils/binary-search';
import BookCard from '../../models/book-card.model';

@Component({
  selector: 'app-pure-book-manager',
  templateUrl: './pure-book-manager.component.html',
  styleUrls: ['./pure-book-manager.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PureBookManagerComponent implements OnChanges {
  @Input()
  bookIds: number[] = [];

  @Input()
  currentBookId?: number;

  @Input()
  isLoading = false;

  @Input()
  isImporting = false;

  @Output()
  openBookClick = new EventEmitter<BookCard>();

  @Output()
  addBookClick = new EventEmitter<void>();

  @Output()
  addDirectoryClick = new EventEmitter<void>();

  @Output()
  removeClick = new EventEmitter<number[]>();

  @Output()
  bugReportClick = new EventEmitter<void>();

  @Output()
  filesChange = new EventEmitter<FileList | File[]>();

  selectedBookIds = new Set<number>();

  selectMode = false;

  faUpload = faUpload;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes.bookIds) {
      const bookIds: PureBookManagerComponent['bookIds'] =
        changes.bookIds.currentValue;
      const newSelectedIds = new Set<number>();

      for (const selectedId of this.selectedBookIds) {
        if (binarySearch(bookIds, selectedId) !== -1) {
          newSelectedIds.add(selectedId);
        }
      }

      this.selectedBookIds = newSelectedIds;
      this.selectMode = newSelectedIds.size > 0;
      this.cdr.markForCheck();
    }
  }

  onBookClick(bookCard: BookCard) {
    if (this.selectMode) {
      const bookId = bookCard.id;
      const selectedBookIds = new Set(this.selectedBookIds);
      if (selectedBookIds.has(bookId)) {
        selectedBookIds.delete(bookId);
      } else {
        selectedBookIds.add(bookId);
      }
      this.selectedBookIds = selectedBookIds;
      this.cdr.markForCheck();
    } else {
      this.openBookClick.emit(bookCard);
    }
  }

  onRemoveClick() {
    this.removeClick.emit(Array.from(this.selectedBookIds));
  }

  onSelectAllClick() {
    this.selectedBookIds = new Set(this.bookIds);
    this.cdr.markForCheck();
  }

  onDeselectAllClick() {
    this.selectMode = false;
    this.selectedBookIds = new Set();
    this.cdr.markForCheck();
  }

  onInputChange(el: HTMLInputElement) {
    if (el.files?.length) {
      this.filesChange.emit(el.files);
    }
  }

  @HostListener('dragenter', ['$event'])
  @HostListener('dragover', ['$event'])
  @HostListener('dragend', ['$event'])
  onDragEvents(ev: DragEvent) {
    ev.preventDefault();
  }

  @HostListener('drop', ['$event'])
  async onDrop(ev: DragEvent) {
    ev.preventDefault();
    if (this.isImporting) {
      return;
    }

    if (!ev.dataTransfer?.items) {
      return;
    }

    const items = Array.from(ev.dataTransfer.items)
      .filter((i) => i.kind === 'file')
      .map((i) => i.webkitGetAsEntry())
      .filter((i): i is FileSystemEntry => !!i);

    if (!items.length) {
      return;
    }

    const nestedFiles = await Promise.all(items.map((i) => getEntryFiles(i)));

    this.filesChange.emit(nestedFiles.flat());
  }
}

async function getEntryFiles(entry: FileSystemEntry): Promise<File[]> {
  if (isDirectory(entry)) {
    const dirReader = entry.createReader();

    const entries = await getDirectoryEntries(dirReader);
    const nestedFiles = await Promise.all(entries.map((e) => getEntryFiles(e)));
    return nestedFiles.flat();
  }
  const file = await new Promise<File>((resolve, reject) => {
    (entry as FileSystemFileEntry).file(resolve, reject);
  });

  return [file];
}

async function getDirectoryEntries(
  dirReader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  const dirEntries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
    dirReader.readEntries(resolve, reject);
  });

  if (!dirEntries.length) {
    return [];
  }

  const childEntries = await getDirectoryEntries(dirReader);
  return dirEntries.concat(childEntries);
}

function isDirectory(
  entry: FileSystemEntry
): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}
