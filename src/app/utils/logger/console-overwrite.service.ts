/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */


/* eslint-disable no-console */

import { Injectable } from '@angular/core';

export const enum ConsoleLogType {
  Debug = 'debug',
  Log = 'log',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

const nativeConsole = {
  debug: console.debug,
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

export interface ConsoleLogEvent {
  type: ConsoleLogType;
  args: any[];
}

@Injectable({
  providedIn: 'root',
})
export class ConsoleOverwiteService {
  nativeConsole = nativeConsole;

  setLogListener(fn: (ev: ConsoleLogEvent) => void) {
    this.overwriteLogFn(ConsoleLogType.Debug, fn);
    this.overwriteLogFn(ConsoleLogType.Log, fn);
    this.overwriteLogFn(ConsoleLogType.Info, fn);
    this.overwriteLogFn(ConsoleLogType.Warn, fn);
    this.overwriteLogFn(ConsoleLogType.Error, fn);
  }

  private overwriteLogFn(
    type: ConsoleLogType,
    listener: (ev: ConsoleLogEvent) => void
  ) {
    console[type] = (...args) => {
      listener({
        type,
        args,
      });
      nativeConsole[type].apply(console, args);
    };
  }
}
