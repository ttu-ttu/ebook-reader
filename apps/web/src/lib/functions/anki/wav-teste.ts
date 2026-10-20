/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// WAV sintético no formato do Gemini TTS (24 kHz, 16 bits, mono, cabeçalho de 44 bytes), só para
// medir o .apkg antes do R5: um tom baixo com a frequência variando por arquivo.
export function wavDeTeste(segundos: number, frequencia: number): Uint8Array {
  const taxa = 24_000;
  const amostras = Math.round(segundos * taxa);
  const buffer = new ArrayBuffer(44 + amostras * 2);
  const v = new DataView(buffer);
  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(pos + i, s.charCodeAt(i));
  };

  texto(0, 'RIFF');
  v.setUint32(4, 36 + amostras * 2, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, 'data');
  v.setUint32(40, amostras * 2, true);

  for (let i = 0; i < amostras; i += 1) {
    v.setInt16(
      44 + i * 2,
      Math.round(3000 * Math.sin((2 * Math.PI * frequencia * i) / taxa)),
      true
    );
  }
  return new Uint8Array(buffer);
}
