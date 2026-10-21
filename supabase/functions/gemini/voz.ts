// Voz da palavra com a leitura como dica fora do texto falado (API Interactions, anotação
// speech_metadata) e conferência da leitura pelo modelo de texto ouvindo o áudio (R5). Sem imports:
// roda no Deno e no vitest.

import type { Uso } from './textos.ts';

export function estiloPalavra(palavra: string, leitura: string) {
  return (
    `A single Japanese word, 「${palavra}」, read as 「${leitura}」, with its natural standard ` +
    'Tokyo pitch accent. Clear, calm, dictionary-style.'
  );
}

export function pedidoVozInteraction(modelo: string, voz: string, texto: string, estilo: string) {
  return {
    model: modelo,
    store: false,
    input: [
      {
        type: 'user_input',
        content: [
          { type: 'text', text: texto, annotations: [{ type: 'speech_metadata', style: estilo }] }
        ]
      }
    ],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice: voz }] }
  };
}

type Interaction = {
  status?: string;
  steps?: { type?: string; content?: { type?: string; data?: string }[] }[];
  usage?: { total_input_tokens?: number; total_output_tokens?: number; total_tokens?: number };
};

function base64ParaBytes(dados: string) {
  return Uint8Array.from(atob(dados), (c) => c.charCodeAt(0));
}

export function lerAudioInteraction(resposta: Interaction): { bytes: Uint8Array; uso: Uso } {
  const audio = resposta.steps
    ?.filter((p) => p.type === 'model_output')
    .flatMap((p) => p.content ?? [])
    .find((c) => c.type === 'audio' && c.data);
  if (!audio?.data) throw new Error(`Interaction sem áudio (status ${resposta.status})`);
  const u = resposta.usage ?? {};
  return {
    bytes: base64ParaBytes(audio.data),
    uso: {
      entrada: u.total_input_tokens ?? 0,
      saida: u.total_output_tokens ?? 0,
      total: u.total_tokens ?? 0
    }
  };
}

function bytesParaBase64(bytes: Uint8Array) {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

// O modelo de texto ouve o WAV e escreve a leitura; não recebe a leitura esperada, para não ser
// induzido a concordar.
export function pedidoConferencia(wav: Uint8Array) {
  return {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: bytesParaBase64(wav) } },
          {
            text:
              'O áudio tem uma palavra japonesa dita sozinha. Escreva exatamente o que foi ' +
              'pronunciado, só em hiragana (sem kanji), sem pontuação.'
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { ouvido: { type: 'STRING', description: 'A pronúncia em hiragana' } },
        required: ['ouvido']
      }
    }
  };
}

export function paraHiragana(texto: string) {
  return texto
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[^ぁ-ゖー]/g, '');
}

// Vogal de cada kana, para ler o ー como a vogal anterior (きょー = きょう, おーや = おおや).
const VOGAIS: [string, string][] = [
  ['あかさたなはまやらわがざだばぱぁゃ', 'あ'],
  ['いきしちにひみりぎじぢびぴぃ', 'い'],
  ['うくすつぬふむゆるぐずづぶぷぅゅ', 'う'],
  ['えけせてねへめれげぜでべぺぇ', 'え'],
  ['おこそとのほもよろをごぞどぼぽぉょ', 'o']
];

function longasComoVogal(kana: string) {
  let saida = '';
  for (const c of kana) {
    if (c !== 'ー') {
      saida += c;
      continue;
    }
    const anterior = saida.at(-1) ?? '';
    const vogal = VOGAIS.find(([grupo]) => grupo.includes(anterior))?.[1];
    // お longo se escreve tanto おう quanto おお: os dois batem com o ー.
    saida += vogal === 'o' ? '*' : (vogal ?? '');
  }
  return saida;
}

export function mesmaLeitura(esperada: string, ouvida: string) {
  const a = longasComoVogal(paraHiragana(esperada));
  const b = longasComoVogal(paraHiragana(ouvida));
  if (a.length !== b.length) return false;
  return [...a].every(
    (c, i) =>
      c === b[i] || (c === '*' && 'うお'.includes(b[i])) || (b[i] === '*' && 'うお'.includes(c))
  );
}
