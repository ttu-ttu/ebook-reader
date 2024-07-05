/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

const enum LoggingLevel {
  ERROR = 3,
  WARN = 4,
  INFO = 6,
  DEBUG = 7
}

const nativeConsole: Record<LoggingLevel, Console['log']> = {
  [LoggingLevel.ERROR]: console.error,
  [LoggingLevel.WARN]: console.warn,
  [LoggingLevel.INFO]: console.info,
  [LoggingLevel.DEBUG]: console.debug
};

interface LoggingEntry {
  level: LoggingLevel;
  args: any[];
}

let logHistory: LoggingEntry[] = [];

function print(level: LoggingLevel) {
  return (message: any, ...optionalParams: any[]) => {
    const fullArgs = [message].concat(optionalParams);
    logHistory.push({
      level,
      args: formatArgs(fullArgs)
    });
    nativeConsole[level].apply(null, fullArgs);
  };
}

export const logger = {
  get history() {
    return Array.from(logHistory);
  },
  get errorCount() {
    return logHistory.filter((log) => log.level === LoggingLevel.ERROR).length;
  },
  error: print(LoggingLevel.ERROR),
  warn: print(LoggingLevel.WARN),
  info: print(LoggingLevel.INFO),
  debug: print(LoggingLevel.DEBUG),
  clearHistory: () => {
    logHistory = [];
  }
};

function formatArgs(args: any[]) {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return {
        name: arg.name,
        message: arg.message,
        stack: arg.stack
      };
    }
    if (typeof arg === 'object') {
      return JSON.parse(JSON.stringify(arg));
    }
    return arg;
  });
}
