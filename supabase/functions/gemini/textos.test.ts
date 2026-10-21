import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  chaveFrase,
  lerAudio,
  lerJson,
  nomeAudio,
  pedidoCarta,
  pedidoTraducao,
  pedidoVozPalavra,
  semHtml,
  trechoEmNegrito
} from './textos.ts';

describe('nomeAudio', () => {
  it('é leituras-<sha1("Orus|" + texto)[:12]>.wav (CARDS.md)', async () => {
    const esperado = createHash('sha1').update('Orus|気のせい').digest('hex').slice(0, 12);
    expect(await nomeAudio('Orus', '気のせい')).toBe(`leituras-${esperado}.wav`);
  });
});

describe('chaveFrase', () => {
  it('é o sha256 da frase sem HTML e sem espaços nas pontas', async () => {
    const esperado = createHash('sha256').update('最初は気のせいだと思った。').digest('hex');
    expect(await chaveFrase(' 最初は<b>気のせい</b>だと思った。\n')).toBe(esperado);
  });
});

describe('semHtml', () => {
  it('tira tags e entidades comuns', () => {
    expect(semHtml('最初は<b>気のせい</b>だ&nbsp;&amp;<br/>')).toBe('最初は気のせいだ &');
  });
});

describe('trechoEmNegrito', () => {
  it('devolve o trecho em <b>, ou null', () => {
    expect(trechoEmNegrito('彼は<b>行った</b>。')).toBe('行った');
    expect(trechoEmNegrito('彼は行った。')).toBeNull();
  });
});

describe('pedidoCarta', () => {
  const pedido = pedidoCarta({
    palavra: '気のせい',
    leitura: 'きのせい',
    frase: '最初は<b>気のせい</b>だと思って無視した。',
    antes: 'ドアが鳴った。',
    depois: 'でも、また鳴った。'
  });

  it('pede JSON com tradução e significado', () => {
    expect(pedido.generationConfig.responseMimeType).toBe('application/json');
    expect(pedido.generationConfig.responseSchema.required).toEqual(['traducao', 'significado']);
  });

  it('manda a frase sem HTML, a forma em que a palavra aparece e o contexto', () => {
    const texto = pedido.contents[0].parts[0].text;
    expect(texto).toContain('最初は気のせいだと思って無視した。');
    expect(texto).not.toContain('<b>');
    expect(texto).toContain('気のせい（きのせい）');
    expect(texto).toContain('ドアが鳴った。');
    expect(texto).toContain('でも、また鳴った。');
    expect(texto).toContain('português do Brasil');
  });

  it('sem contexto, não menciona as frases vizinhas', () => {
    const sem = pedidoCarta({ palavra: '方', leitura: 'かた', frase: 'あの<b>方</b>です。' });
    expect(sem.contents[0].parts[0].text).not.toContain('Frase anterior');
  });
});

describe('pedidoTraducao', () => {
  it('pede só a tradução, em JSON', () => {
    const pedido = pedidoTraducao({ frase: 'あの方です。' });
    expect(pedido.generationConfig.responseSchema.required).toEqual(['traducao']);
    expect(pedido.contents[0].parts[0].text).toContain('あの方です。');
  });
});

describe('pedidoVozPalavra', () => {
  it('manda só a leitura em kana (o TTS lê tudo o que recebe) e pede a voz Orus', () => {
    const pedido = pedidoVozPalavra('Orus', ' おおや ');
    expect(pedido.contents[0].parts[0].text).toBe('おおや');
    expect(pedido.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(pedido.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe(
      'Orus'
    );
  });
});

describe('lerJson e lerAudio', () => {
  const uso = { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 };

  it('lê o JSON do primeiro candidato e o uso de tokens', () => {
    const resposta = {
      candidates: [{ content: { parts: [{ text: '{"traducao":"Oi","significado":"x"}' }] } }],
      usageMetadata: uso
    };
    expect(lerJson(resposta)).toEqual({
      dados: { traducao: 'Oi', significado: 'x' },
      uso: { entrada: 10, saida: 5, total: 15 }
    });
  });

  it('lê o áudio em base64', () => {
    const resposta = {
      candidates: [
        { content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: 'AQID' } }] } }
      ],
      usageMetadata: uso
    };
    const { bytes } = lerAudio(resposta);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it('erra com o motivo quando não há candidato', () => {
    expect(() => lerJson({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow('SAFETY');
    expect(() => lerAudio({ candidates: [{ finishReason: 'OTHER' }] })).toThrow('OTHER');
  });
});
