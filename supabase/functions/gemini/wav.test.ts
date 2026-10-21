import { describe, expect, it } from 'vitest';
import { cortarSilencio, duracaoSegundos, extrairPcm, pcmParaWav, TAXA } from './wav.ts';

function pcm(amostras: number[]): Uint8Array {
  const bytes = new Uint8Array(amostras.length * 2);
  const visao = new DataView(bytes.buffer);
  amostras.forEach((a, i) => visao.setInt16(i * 2, a, true));
  return bytes;
}

function amostras(bytes: Uint8Array): number[] {
  const visao = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: bytes.byteLength / 2 }, (_, i) => visao.getInt16(i * 2, true));
}

describe('pcmParaWav', () => {
  it('escreve o cabeçalho de 44 bytes de 24 kHz, 16 bits, mono', () => {
    const wav = pcmParaWav(pcm([1, -1, 300]));
    const visao = new DataView(wav.buffer);
    const texto = (i: number) => String.fromCharCode(...wav.slice(i, i + 4));
    expect(wav.byteLength).toBe(44 + 6);
    expect(texto(0)).toBe('RIFF');
    expect(visao.getUint32(4, true)).toBe(36 + 6);
    expect(texto(8)).toBe('WAVE');
    expect(texto(12)).toBe('fmt ');
    expect(visao.getUint32(16, true)).toBe(16);
    expect(visao.getUint16(20, true)).toBe(1);
    expect(visao.getUint16(22, true)).toBe(1);
    expect(visao.getUint32(24, true)).toBe(TAXA);
    expect(visao.getUint32(28, true)).toBe(TAXA * 2);
    expect(visao.getUint16(32, true)).toBe(2);
    expect(visao.getUint16(34, true)).toBe(16);
    expect(texto(36)).toBe('data');
    expect(visao.getUint32(40, true)).toBe(6);
    expect(amostras(wav.slice(44))).toEqual([1, -1, 300]);
  });
});

describe('extrairPcm', () => {
  it('devolve PCM cru como está', () => {
    const cru = pcm([5, 6, 7]);
    expect(extrairPcm(cru)).toEqual(cru);
  });

  it('tira o cabeçalho de um WAV, mesmo com blocos extras antes de data', () => {
    const wav = pcmParaWav(pcm([5, 6, 7]));
    expect(amostras(extrairPcm(wav))).toEqual([5, 6, 7]);

    // WAV com um bloco LIST entre fmt e data.
    const lista = new Uint8Array([...new TextEncoder().encode('LIST'), 4, 0, 0, 0, 1, 2, 3, 4]);
    const comLista = new Uint8Array([...wav.slice(0, 36), ...lista, ...wav.slice(36)]);
    expect(amostras(extrairPcm(comLista))).toEqual([5, 6, 7]);
  });
});

describe('cortarSilencio', () => {
  const margem = TAXA / 10; // 100 ms

  it('corta as pontas e deixa 100 ms de margem', () => {
    const silencio = Array(TAXA).fill(3); // 1 s de quase silêncio
    const voz = Array(TAXA / 2).fill(4000);
    const cortado = amostras(cortarSilencio(pcm([...silencio, ...voz, ...silencio])));
    expect(cortado.length).toBe(voz.length + 2 * margem);
    expect(cortado[margem]).toBe(4000);
    expect(cortado[margem - 1]).toBe(3);
  });

  it('não passa das pontas quando a voz começa logo', () => {
    const voz = Array(100).fill(-4000);
    const cortado = amostras(cortarSilencio(pcm([...voz, ...Array(TAXA).fill(0)])));
    expect(cortado.length).toBe(100 + margem);
  });

  it('não corta nada num áudio todo em silêncio', () => {
    const tudo = pcm(Array(1000).fill(0));
    expect(cortarSilencio(tudo)).toEqual(tudo);
  });
});

describe('duracaoSegundos', () => {
  it('conta o PCM de 24 kHz, 16 bits', () => {
    expect(duracaoSegundos(new Uint8Array(TAXA * 2 * 3))).toBe(3);
  });
});
