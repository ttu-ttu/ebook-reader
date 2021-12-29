/**
 * @license BSD-3-Clause
 * Copyright (c) 2021, ッツ Reader Authors
 * All rights reserved.
 */

import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import StackTrace from 'stacktrace-js';
import {
  ConsoleLogType,
  ConsoleOverwiteService,
} from './console-overwrite.service';

const enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

type LogLevelType = `${LogLevel}`;

interface LogEntry {
  level: LogLevelType;
  source: 'console' | 'logger';
  args: any[];
}

@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  logHistory: LogEntry[] = [];

  logHistoryUpdate$ = new Subject<void>();

  constructor(private console: ConsoleOverwiteService) {
    console.setLogListener((ev) => {
      let level: LogLevelType;
      switch (ev.type) {
        case ConsoleLogType.Log:
          level = LogLevel.Info;
          break;
        default:
          level = ev.type;
      }

      let { args } = ev;

      if (level === LogLevel.Error) {
        args = formatArgs(args, () => this.logHistoryUpdate$.next());
      }

      this.logHistory.push({
        level,
        source: 'console',
        args,
      });
    });
  }

  debug(message: any, ...optionalParams: any[]) {
    this.print(LogLevel.Debug, message, optionalParams);
  }

  info(message: any, ...optionalParams: any[]) {
    this.print(LogLevel.Info, message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.print(LogLevel.Warn, message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.print(LogLevel.Error, message, optionalParams);
  }

  private print(level: LogLevel, message: any, optionalParams: any[]) {
    const fullArgs = [message].concat(optionalParams);
    this.logHistory.push({
      level,
      source: 'logger',
      args:
        level === LogLevel.Error
          ? formatArgs(fullArgs, () => this.logHistoryUpdate$.next())
          : fullArgs,
    });
    this.logHistoryUpdate$.next();
    this.console.nativeConsole[level].apply(null, fullArgs);
  }
}

function formatArgs(args: any[], onResultUpdate: () => void) {
  const result = args.slice();
  for (let i = 0; i < args.length; i += 1) {
    const originalObject = args[i];
    if (originalObject instanceof Error) {
      result[i] = formatErrorAsString(originalObject);
      StackTrace.fromError(originalObject)
        .then((stackFrames) => {
          result[i] = {
            name: originalObject.name,
            message: originalObject.message,
            stack: stackFrames,
          };
          onResultUpdate();
        })
        .catch(() => {
          // Placeholder to prevent recursive catch
        });
    }
  }
  return result;
}

function formatErrorAsString(error: Error) {
  if (error.stack) {
    return error.stack;
  }

  if (error.name && error.message) {
    return `${error.name}: ${error.message}`;
  }

  return error.message || error.name;
}
