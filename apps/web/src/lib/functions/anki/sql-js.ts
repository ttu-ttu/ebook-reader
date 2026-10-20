/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { SqlJsStatic } from 'sql.js';

let carregando: Promise<SqlJsStatic> | undefined;

// sql.js e o wasm (~650 KB) só são baixados na primeira exportação.
export function carregarSqlJs(): Promise<SqlJsStatic> {
  carregando ??= Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm-browser.wasm?url')
  ]).then(([sqlJs, wasm]) => sqlJs.default({ locateFile: () => wasm.default }));
  return carregando;
}
