/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import {
  decodeScript,
  decodeText,
  detectEncoding,
  findVnRoot,
  fromBase64,
  mergeVnSaves,
  sameVnSaves,
  toBase64,
  newText,
  parseVnPage,
  scriptCharacters
} from './vn';

const sjis = (hex: string) => Uint8Array.from(hex.match(/../g)!.map((byte) => parseInt(byte, 16)));

describe('vn', () => {
  it('finds the game folder by its script, the shallowest first', () => {
    expect(findVnRoot(['Game/arc.nsa', 'Game/0.txt', 'Game/extra/0.txt'])).toBe('Game/');
    expect(findVnRoot(['NSCRIPT.DAT', 'arc.nsa'])).toBe('');
    expect(findVnRoot(['page1.jpg', 'page2.jpg'])).toBeUndefined();
  });

  it('decodes nscript.dat and detects the encoding', () => {
    const script = new TextEncoder().encode('こんにちは');

    expect(
      decodeScript(
        'nscript.dat',
        script.map((byte) => byte ^ 0x84)
      )
    ).toEqual(script);
    expect(decodeScript('nscr_sec.dat', script)).toBeUndefined();
    expect(detectEncoding(script)).toBe('utf8');
    // 「あ」 in Shift JIS is not valid UTF-8.
    expect(detectEncoding(sjis('82a0'))).toBe('sjis');
    expect(decodeText(sjis('82a08140'), 'sjis')).toBe('あ　');
  });

  it('counts the text lines of a script, not its commands or readings', () => {
    const script = '*start\nbg "a.png",1\n吾輩は(猫/ねこ)である。@\n[名前]「はい」\\\n;コメント';

    expect(scriptCharacters(script)).toBe('吾輩は猫である名前はい'.length);
  });

  it('splits ruby out of a page', () => {
    expect(parseVnPage('吾輩は(猫/ねこ)だ\n次')).toEqual([
      [{ text: '吾輩は' }, { text: '猫', ruby: 'ねこ' }, { text: 'だ' }],
      [{ text: '次' }]
    ]);
  });

  it('counts only what each click added, and nothing for pages seen before', () => {
    const seen = new Set<string>();

    expect(newText('', '吾輩は猫である。', seen)).toBe('吾輩は猫である。');
    expect(newText('吾輩は猫である。', '吾輩は猫である。名前はまだ無い。', seen)).toBe(
      '名前はまだ無い。'
    );
    expect(newText('', '吾輩は猫である。', seen)).toBe('');
    expect(newText('', '(猫/ねこ)', seen)).toBe('猫');
  });

  it('merges save files, the newer copy of each winning', () => {
    const local = {
      'save1.dat': { modified: 5, data: 'b' },
      'save2.dat': { modified: 1, data: 'l' }
    };
    const remote = {
      'save1.dat': { modified: 3, data: 'a' },
      'gloval.sav': { modified: 2, data: 'g' }
    };
    const merged = mergeVnSaves(local, remote);

    expect(merged).toEqual({ ...remote, ...local });
    expect(sameVnSaves(merged, remote)).toBe(false);
    expect(sameVnSaves(mergeVnSaves(remote, remote), remote)).toBe(true);
  });

  it('round-trips bytes through base64', () => {
    const bytes = Uint8Array.from({ length: 70000 }, (_, index) => index % 256);

    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
