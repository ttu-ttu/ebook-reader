/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { ReplaySubject, Subject, Observable, SchedulerLike } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

export default class ResettableSubject<T> extends Subject<T> {
  reset: () => void;

  constructor(
    bufferSize: number,
    windowTime?: number,
    scheduler?: SchedulerLike
  ) {
    super();
    const values = resettableFactory(
      () => new ReplaySubject<T>(bufferSize, windowTime, scheduler)
    );

    (Object.keys(values.subject) as (keyof typeof values.subject)[]).forEach(
      (key) => {
        this[key] = values.subject[key];
      }
    );

    (
      Object.keys(values.observable) as (keyof typeof values.observable)[]
    ).forEach((key) => {
      // @ts-expect-error
      this[key] = values.observable[key];
    });

    this.reset = values.reset;
  }
}

// https://stackoverflow.com/a/51147023
function resettableFactory<T>(factory: () => Subject<T>): {
  observable: Observable<T>;
  reset(): void;
  subject: Subject<T>;
} {
  const resetter = new Subject<any>();
  const source = new Subject<T>();
  let destination = factory();
  let subscription = source.subscribe(destination);
  return {
    observable: resetter.asObservable().pipe(
      startWith(null),
      switchMap(() => destination)
    ),
    reset: () => {
      subscription.unsubscribe();
      destination = factory();
      subscription = source.subscribe(destination);
      resetter.next();
    },
    subject: source,
  };
}
