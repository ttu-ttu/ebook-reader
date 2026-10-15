/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  deleteOrphanVnCaches,
  decodeScript,
  decodeText,
  detectEncoding,
  findVnRoot,
  fromBase64,
  mergeVnSaves,
  newerSaveEngine,
  sameVnSaves,
  toBase64,
  newText,
  overlayLines,
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

  it('counts the text lines of a script, not its commands, readings or name tags', () => {
    const script =
      '*start\nbg "a.png",1\n吾輩は(猫/ねこ)である。@\n[名前|voice/v1.ogg]「#ffffff!z125はい!z100」\\\n;コメント';

    expect(scriptCharacters(script)).toBe('吾輩は猫であるはい'.length);
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
    expect(newText('', '名前はまだ無い。', seen, true)).toBe('');
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

  it('finds saves written by a newer engine', () => {
    const saves = {
      'save1.dat': { modified: 1, data: '', engine: 'v0.9.0' },
      'save2.dat': { modified: 1, data: '', engine: 'v0.18.1' },
      'save3.dat': { modified: 1, data: '', engine: 'v0.18.0' },
      'gloval.sav': { modified: 1, data: '' }
    };

    expect(newerSaveEngine(saves, 'v0.17.0')).toBe('v0.18.1');
    expect(newerSaveEngine(saves, 'v0.18.1')).toBeUndefined();
    expect(newerSaveEngine(saves, 'v1.0.0')).toBeUndefined();
    expect(newerSaveEngine(saves, 'unknown')).toBeUndefined();
  });

  it('round-trips bytes through base64', () => {
    const bytes = Uint8Array.from({ length: 70000 }, (_, index) => index % 256);

    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it("lays the page out in screen lines from the engine's character boxes", () => {
    // 「吾(猫/ねこ)」 then a new line with 「あ」, in Shift JIS: ruby markup has no boxes.
    const bytes = sjis('8ce1' + '28' + '944c' + '2f' + '82cb82b1' + '29' + '0a' + '82a0');
    const boxes = [0, 10, 20, 24, 3, 36, 20, 24, 12, 10, 50, 24];

    expect(overlayLines(bytes, boxes, 'sjis')).toEqual([
      { text: '吾猫', x: 10, y: 20, size: 24, pitch: 26 },
      { text: 'あ', x: 10, y: 50, size: 24, pitch: 24 }
    ]);
  });

  it('keeps vertical columns together', () => {
    // 「あい」 down one column, then 「う」 at the top of the next one to the left.
    const bytes = sjis('82a082a282a4');
    const boxes = [0, 100, 20, 24, 2, 100, 46, 24, 4, 70, 20, 24];

    expect(overlayLines(bytes, boxes, 'sjis')).toEqual([
      { text: 'あい', x: 100, y: 20, size: 24, pitch: 26, vertical: true },
      { text: 'う', x: 70, y: 20, size: 24, pitch: 24 }
    ]);
  });

  it('deletes kept game files only for games no longer in the library', async () => {
    const deleted: string[] = [];

    vi.stubGlobal('caches', {
      keys: async () => ['ttu-vn:ゲーム', 'ttu-vn:消えたゲーム', 'other:1'],
      delete: async (name: string) => deleted.push(name)
    });
    await deleteOrphanVnCaches(new Set(['ゲーム']));
    vi.unstubAllGlobals();

    expect(deleted).toEqual(['ttu-vn:消えたゲーム']);
  });
});
