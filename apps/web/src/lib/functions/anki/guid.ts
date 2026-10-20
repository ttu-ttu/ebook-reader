/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// Port do genanki.guid_for (0.13.1): SHA-256 dos valores unidos por "__", 8 primeiros bytes em base91.
const BASE91 =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';

export async function guidFor(...valores: (string | number)[]): Promise<string> {
  const texto = valores.map(String).join('__');
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  );

  let n = 0n;
  for (const byte of hash.subarray(0, 8)) {
    n = (n << 8n) + BigInt(byte);
  }

  let guid = '';
  const base = BigInt(BASE91.length);
  while (n > 0n) {
    guid = BASE91[Number(n % base)] + guid;
    n /= base;
  }
  return guid;
}
