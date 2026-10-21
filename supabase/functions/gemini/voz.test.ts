import { describe, expect, it } from 'vitest';
import {
  estiloPalavra,
  lerAudioInteraction,
  mesmaLeitura,
  paraHiragana,
  pedidoConferencia,
  pedidoVozInteraction
} from './voz.ts';

describe('pedidoVozInteraction', () => {
  it('fala só o texto; a dica vai no speech_metadata, com a voz e sem guardar', () => {
    const pedido = pedidoVozInteraction('m', 'Orus', '辛い', estiloPalavra('辛い', 'つらい'));
    expect(pedido.model).toBe('m');
    expect(pedido.store).toBe(false);
    const item = pedido.input[0].content[0];
    expect(item.text).toBe('辛い');
    expect(item.annotations[0].type).toBe('speech_metadata');
    expect(item.annotations[0].style).toContain('つらい');
    expect(pedido.generation_config.speech_config).toEqual([{ voice: 'Orus' }]);
    expect(pedido.response_format.type).toBe('audio');
  });
});

describe('lerAudioInteraction', () => {
  const uso = { total_input_tokens: 20, total_output_tokens: 30, total_tokens: 50 };

  it('acha o áudio no passo model_output e lê o uso', () => {
    const resposta = {
      status: 'completed',
      steps: [
        { type: 'user_input', content: [{ type: 'text', text: '辛い' }] },
        { type: 'model_output', content: [{ type: 'audio', data: 'AQID' }] }
      ],
      usage: uso
    };
    const { bytes, uso: lido } = lerAudioInteraction(resposta);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
    expect(lido).toEqual({ entrada: 20, saida: 30, total: 50 });
  });

  it('erra com o status quando não há áudio', () => {
    expect(() => lerAudioInteraction({ status: 'failed', steps: [] })).toThrow('failed');
  });
});

describe('pedidoConferencia', () => {
  it('manda o WAV e pede o que foi ouvido em hiragana, em JSON', () => {
    const pedido = pedidoConferencia(new Uint8Array([1, 2, 3]));
    const partes = pedido.contents[0].parts;
    expect(partes[0].inlineData).toEqual({ mimeType: 'audio/wav', data: 'AQID' });
    expect(partes[1].text).toContain('hiragana');
    expect(pedido.generationConfig.responseSchema.required).toEqual(['ouvido']);
  });
});

describe('paraHiragana e mesmaLeitura', () => {
  it('converte katakana e tira o que não é kana', () => {
    expect(paraHiragana('ツライ。')).toBe('つらい');
    expect(paraHiragana(' あく！')).toBe('あく');
  });

  it('compara leituras, aceitando o prolongamento escrito como ー', () => {
    expect(mesmaLeitura('つらい', 'ツライ')).toBe(true);
    expect(mesmaLeitura('きょう', 'きょー')).toBe(true);
    expect(mesmaLeitura('おおや', 'おーや')).toBe(true);
    expect(mesmaLeitura('つらい', 'からい')).toBe(false);
    expect(mesmaLeitura('あく', 'ひらく')).toBe(false);
  });
});
