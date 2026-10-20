/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import { guidFor } from './guid';
import referencia from './genanki-referencia.json';

describe('guidFor', () => {
  it.each(referencia.guids)('bate com o genanki para $valores', async ({ valores, guid }) => {
    expect(await guidFor(...valores)).toBe(guid);
  });

  it('separa leituras diferentes da mesma escrita (ADR 0006)', async () => {
    expect(await guidFor('leituras-igor', '開く', 'あく')).not.toBe(
      await guidFor('leituras-igor', '開く', 'ひらく')
    );
  });
});
