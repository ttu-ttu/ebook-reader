/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import {
  ObservableInput,
  pipe,
  combineLatest,
  ObservedValueOf,
  OperatorFunction,
} from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

function switchLatestFrom<T, O1 extends ObservableInput<any>>(
  obs1: O1
): OperatorFunction<T, [T, ObservedValueOf<O1>]>;
function switchLatestFrom<
  T,
  O1 extends ObservableInput<any>,
  O2 extends ObservableInput<any>
>(
  obs1: O1,
  obs2: O2
): OperatorFunction<T, [T, ObservedValueOf<O1>, ObservedValueOf<O2>]>;
function switchLatestFrom<T>(
  ...observables: Array<ObservableInput<any>>
): OperatorFunction<T, any> {
  return pipe(
    switchMap((v) =>
      combineLatest(observables).pipe(
        take(1),
        map((obs) => [v].concat(obs))
      )
    )
  );
}

export default switchLatestFrom;
