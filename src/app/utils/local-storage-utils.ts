/**
 * @licence
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BehaviorSubject } from "rxjs";
import { skip } from "rxjs/operators";

export function getStoredBooleanOrDefault(key: string, defaultVal: boolean): boolean {
  const storedVal = localStorage.getItem(key);
  return storedVal != null ? !!(+storedVal) : defaultVal;
}

export function getStoredNumberOrDefault(key: string, defaultVal: number): number {
  const storedVal = localStorage.getItem(key);
  return storedVal != null ? +storedVal : defaultVal;
}

export function createBooleanLocalStorageBehaviorSubject(key: string, defaultVal: boolean): BehaviorSubject<boolean> {
  const initVal = getStoredBooleanOrDefault(key, defaultVal);
  const behaviorSubject = new BehaviorSubject<boolean>(initVal);
  behaviorSubject.pipe(
    skip(1),
  ).subscribe((updatedVal) => {
    localStorage.setItem(key, updatedVal ? '1' : '0');
  });
  return behaviorSubject;
}

export function createNumberLocalStorageBehaviorSubject(key: string, defaultVal: number): BehaviorSubject<number> {
  const initVal = getStoredNumberOrDefault(key, defaultVal);
  const behaviorSubject = new BehaviorSubject<number>(initVal);
  behaviorSubject.pipe(
    skip(1),
  ).subscribe((updatedVal) => {
    localStorage.setItem(key, `${updatedVal}`);
  });
  return behaviorSubject;
}
