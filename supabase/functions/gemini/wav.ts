// Áudio do Gemini TTS: PCM de 24 kHz, 16 bits, mono (CARDS.md "Áudio"). A função grava WAV com o
// cabeçalho de 44 bytes e o silêncio das pontas cortado. Sem imports: roda no Deno e no vitest.

export const TAXA = 24000;

// Abaixo disso a amostra conta como silêncio (~ -36 dBFS).
const LIMIAR = 500;
// Margem deixada antes e depois da voz, para não cortar o ataque nem o fim da última sílaba.
const MARGEM_SEGUNDOS = 0.1;

export function pcmParaWav(pcm: Uint8Array): Uint8Array {
  const wav = new Uint8Array(44 + pcm.byteLength);
  const visao = new DataView(wav.buffer);
  const texto = (i: number, s: string) => {
    for (let j = 0; j < 4; j++) wav[i + j] = s.charCodeAt(j);
  };
  texto(0, 'RIFF');
  visao.setUint32(4, 36 + pcm.byteLength, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  visao.setUint32(16, 16, true);
  visao.setUint16(20, 1, true); // PCM
  visao.setUint16(22, 1, true); // mono
  visao.setUint32(24, TAXA, true);
  visao.setUint32(28, TAXA * 2, true);
  visao.setUint16(32, 2, true);
  visao.setUint16(34, 16, true);
  texto(36, 'data');
  visao.setUint32(40, pcm.byteLength, true);
  wav.set(pcm, 44);
  return wav;
}

// O generateContent devolve PCM cru; se vier um WAV (RIFF), devolve só o bloco data.
export function extrairPcm(bytes: Uint8Array): Uint8Array {
  const id = (i: number) => String.fromCharCode(...bytes.subarray(i, i + 4));
  if (bytes.byteLength < 12 || id(0) !== 'RIFF' || id(8) !== 'WAVE') return bytes;
  const visao = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 12;
  while (i + 8 <= bytes.byteLength) {
    const tamanho = visao.getUint32(i + 4, true);
    if (id(i) === 'data') return bytes.subarray(i + 8, Math.min(i + 8 + tamanho, bytes.byteLength));
    i += 8 + tamanho + (tamanho % 2);
  }
  throw new Error('WAV sem bloco data');
}

export function cortarSilencio(pcm: Uint8Array): Uint8Array {
  const visao = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const total = Math.floor(pcm.byteLength / 2);
  const alto = (i: number) => Math.abs(visao.getInt16(i * 2, true)) > LIMIAR;
  let inicio = 0;
  while (inicio < total && !alto(inicio)) inicio++;
  if (inicio === total) return pcm;
  let fim = total - 1;
  while (!alto(fim)) fim--;
  const margem = Math.round(TAXA * MARGEM_SEGUNDOS);
  inicio = Math.max(0, inicio - margem);
  fim = Math.min(total - 1, fim + margem);
  return pcm.subarray(inicio * 2, (fim + 1) * 2);
}

export function duracaoSegundos(pcm: Uint8Array): number {
  return pcm.byteLength / 2 / TAXA;
}
