/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, ReplaySubject } from 'rxjs';
import { map, skip } from 'rxjs/operators';
import {
  defaultFuriganaStyle,
  FuriganaStyle,
} from 'src/app/models/furigana-style.model';
import {
  BookReaderAvailableKeybind,
  BookReaderKeybindMap,
} from './book-reader/book-reader-keybind';
import { defaultWritingMode, WritingMode } from './models/writing-mode.model';

@Injectable({
  providedIn: 'root',
})
export class StoreService {
  theme$ = createStringLocalStorageBehaviorSubject<string>(
    'theme',
    'light-theme'
  );

  multiplier$ = createNumberLocalStorageBehaviorSubject(
    'autoScrollMultiplier',
    20
  );

  fontSize$ = createNumberLocalStorageBehaviorSubject('fontSize', 20);

  fontFamilyGroupOne$ = createStringLocalStorageBehaviorSubject(
    'fontFamilyGroupOne',
    ''
  );

  fontFamilyGroupTwo$ = createStringLocalStorageBehaviorSubject(
    'fontFamilyGroupTwo',
    ''
  );

  hideSpoilerImage$ = createBooleanLocalStorageBehaviorSubject(
    'hideSpoilerImage',
    true
  );

  hideFurigana$ = createBooleanLocalStorageBehaviorSubject(
    'hideFurigana',
    false
  );

  furiganaStyle$ = createStringLocalStorageBehaviorSubject<FuriganaStyle>(
    'furiganaStyle',
    defaultFuriganaStyle
  );

  writingMode$ = createStringLocalStorageBehaviorSubject<WritingMode>(
    'writingMode',
    defaultWritingMode
  );

  verticalMode$ = this.writingMode$.pipe(
    map((writingMode) => writingMode === 'vertical-rl')
  );

  secondDimensionMaxValue$ = createNumberLocalStorageBehaviorSubject(
    'secondDimensionMaxValue',
    0
  );

  firstDimensionMargin$ = createNumberLocalStorageBehaviorSubject(
    'firstDimensionMargin',
    0
  );

  autoPositionOnResize$ = createBooleanLocalStorageBehaviorSubject(
    'autoPositionOnResize',
    true
  );

  requestPersistentStorage$ = createBooleanLocalStorageBehaviorSubject(
    'requestPersistentStorage',
    true
  );

  pinFooter$ = new BehaviorSubject(true);

  bookReaderKeybindMap$ = new BehaviorSubject<BookReaderKeybindMap>({
    KeyB: BookReaderAvailableKeybind.BOOKMARK,
    KeyR: BookReaderAvailableKeybind.JUMP_TO_BOOKMARK,
    PageDown: BookReaderAvailableKeybind.NEXT_PAGE,
    PageUp: BookReaderAvailableKeybind.PREV_PAGE,
    Space: BookReaderAvailableKeybind.AUTO_SCROLL_TOGGLE,
    KeyA: BookReaderAvailableKeybind.AUTO_SCROLL_INCREASE,
    KeyD: BookReaderAvailableKeybind.AUTO_SCROLL_DECREASE,
  });

  isImportingBooks$ = new BehaviorSubject(false);

  importBookProgress$ = new BehaviorSubject(0);

  previousUrl$ = new ReplaySubject<string>(1);

  isVerticalMode() {
    return this.writingMode$.getValue() === 'vertical-rl';
  }
}

function getStoredBooleanOrDefault(key: string, defaultVal: boolean): boolean {
  const storedVal = localStorage.getItem(key);
  return storedVal != null ? !!+storedVal : defaultVal;
}

function getStoredNumberOrDefault(key: string, defaultVal: number): number {
  const storedVal = localStorage.getItem(key);
  return storedVal != null ? +storedVal : defaultVal;
}

function getStoredStringOrDefault(key: string, defaultVal: string): string {
  const storedVal = localStorage.getItem(key);
  return storedVal ?? defaultVal;
}

function createBooleanLocalStorageBehaviorSubject(
  key: string,
  defaultVal: boolean
): BehaviorSubject<boolean> {
  const initVal = getStoredBooleanOrDefault(key, defaultVal);
  const behaviorSubject = new BehaviorSubject(initVal);
  behaviorSubject.pipe(skip(1)).subscribe((updatedVal) => {
    localStorage.setItem(key, updatedVal ? '1' : '0');
  });
  return behaviorSubject;
}

function createNumberLocalStorageBehaviorSubject(
  key: string,
  defaultVal: number
): BehaviorSubject<number> {
  const initVal = getStoredNumberOrDefault(key, defaultVal);
  const behaviorSubject = new BehaviorSubject(initVal);
  behaviorSubject.pipe(skip(1)).subscribe((updatedVal) => {
    localStorage.setItem(key, `${updatedVal}`);
  });
  return behaviorSubject;
}

function createStringLocalStorageBehaviorSubject<
  T extends string,
  U extends T = T
>(key: string, defaultVal: U): BehaviorSubject<T> {
  const initVal = getStoredStringOrDefault(key, defaultVal) as T;
  const behaviorSubject = new BehaviorSubject(initVal);
  behaviorSubject.pipe(skip(1)).subscribe((updatedVal) => {
    localStorage.setItem(key, `${updatedVal}`);
  });
  return behaviorSubject;
}
