/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Entrada } from './formato';
import { ajustarSelecao, selecionar, termosDoIntervalo, type Consulta } from './busca';
import { CASOS_DEFLEXAO } from './busca.casos';
import { criarTokenizador, type Tokenizador } from './tokenizador';

// Dicionário mínimo: as formas esperadas e as partes delas (気, つく, 立つ, 止まる…), para a
// busca pelo trecho mais longo ter onde errar. A medição com o JMdict inteiro fica em
// busca.medicao.test.ts.
const PALAVRAS = [
  '気がつく|きがつく',
  '気|き',
  'つく|つく',
  '立ち止まる|たちどまる',
  '立つ|たつ',
  '止まる|とまる',
  '少女|しょうじょ',
  '振り返る|ふりかえる',
  '振る|ふる',
  '返る|かえる',
  'わかる|わかる',
  '分かる|わかる',
  '言う|いう',
  '笑う|わらう',
  '食べる|たべる',
  '何|なに',
  '知る|しる',
  '帰る|かえる',
  '話しかける|はなしかける',
  '話す|はなす',
  'かける|かける',
  '返事|へんじ',
  'する|する',
  '読み終わる|よみおわる',
  '読む|よむ',
  '終わる|おわる',
  '貸す|かす',
  'あげる|あげる',
  '窓|まど',
  '外|そと',
  '眺める|ながめる',
  '考え込む|かんがえこむ',
  '考える|かんがえる',
  '込む|こむ',
  '静か|しずか',
  '夜|よる',
  '寒い|さむい',
  '急ぐ|いそぐ',
  '家|いえ',
  '彼女|かのじょ',
  '泣き出す|なきだす',
  '泣く|なく',
  '出す|だす',
  '顔|かお',
  '本当|ほんとう',
  '美味しい|おいしい',
  'もう少し|もうすこし',
  '早い|はやい',
  '起きる|おきる',
  'よい|よい',
  '行く|いく',
  '思う|おもう',
  'やめる|やめる',
  '寝る|ねる',
  '開ける|あける',
  '明日|あした',
  '彼|かれ',
  '会う|あう',
  '手紙|てがみ',
  '書く|かく',
  '人|ひと',
  '少ない|すくない',
  '何度|なんど',
  '雨|あめ',
  '降り続く|ふりつづく',
  '降る|ふる',
  '続く|つづく',
  '黙り込む|だまりこむ',
  '黙る|だまる',
  'ドア|ドア',
  '閉まる|しまる',
  '子供|こども',
  '遊ぶ|あそぶ',
  '死ぬ|しぬ',
  '猫|ねこ',
  '埋める|うめる',
  'お茶|おちゃ',
  '茶|ちゃ',
  '飲む|のむ',
  '待つ|まつ',
  'ごめん|ごめん',
  '来る|くる',
  '昨日|きのう',
  '学校|がっこう',
  '毎日|まいにち',
  '勉強|べんきょう',
  '優しい|やさしい',
  '嬉しい|うれしい',
  '涙|なみだ',
  '出る|でる',
  '少し|すこし',
  'ずつ|ずつ',
  'それで|それで',
  'いい|いい',
  '思い出す|おもいだす',
  '振り向く|ふりむく',
  '誰|だれ',
  'いる|いる',
  '目|め',
  '覚ます|さます',
  '最初|さいしょ',
  '気のせい|きのせい',
  'せい|せい',
  '仕方がない|しかたがない',
  '仕方|しかた',
  'ない|ない',
  'しょうがない|しょうがない',
  'しょうが|しょうが',
  '当たり前|あたりまえ',
  '一人暮らし|ひとりぐらし',
  '一人|ひとり',
  '暮らし|くらし',
  '始める|はじめる',
  '先月|せんげつ',
  '引っ越す|ひっこす',
  '引く|ひく',
  '越す|こす',
  '鞄|かばん',
  '写真|しゃしん',
  '取り出す|とりだす',
  '取る|とる',
  '二人|ふたり',
  '見つめ合う|みつめあう',
  '見つめる|みつめる',
  '合う|あう',
  '言い返す|いいかえす',
  '返す|かえす',
  '聞こえる|きこえる',
  'ふり|ふり',
  '走り去る|はしりさる',
  '走る|はしる',
  '去る|さる',
  '落ち着く|おちつく',
  '落ちる|おちる',
  '着く|つく',
  '大きい|おおきい',
  '息|いき',
  '吸い込む|すいこむ',
  '吸う|すう',
  '笑顔|えがお',
  '浮かべる|うかべる',
  '首|くび',
  '傾げる|かしげる',
  '頷く|うなずく',
  '突然|とつぜん',
  'こと|こと',
  '戸惑う|とまどう',
  '慌てる|あわてる',
  '逃げ出す|にげだす',
  '逃げる|にげる',
  'とても|とても',
  '信じる|しんじる',
  '約束|やくそく',
  '忘れる|わすれる',
  'ダメ|ダメ',
  'やる|やる',
  'ならない|ならない',
  '見せる|みせる',
  'ください|ください',
  '先生|せんせい',
  '教える|おしえる',
  'くれる|くれる',
  '友達|ともだち',
  '手伝う|てつだう',
  'もらう|もらう',
  '母|はは',
  '怒る|おこる',
  '褒める|ほめる',
  'お願い|おねがい',
  '寂しい|さびしい',
  '楽しい|たのしい',
  '星|ほし',
  '美しい|うつくしい',
  '輝く|かがやく',
  'だんだん|だんだん',
  '暗い|くらい',
  'なる|なる',
  '冷たい|つめたい',
  '風|かぜ',
  '吹く|ふく',
  '懐かしい|なつかしい',
  '匂い|におい',
  '眠る|ねむる',
  '眠れる|ねむれる',
  '決して|けっして',
  '許す|ゆるす',
  '相変わらず|あいかわらず',
  '変わる|かわる',
  '元気|げんき',
  '思わず|おもわず',
  '声|こえ',
  '上げる|あげる',
  'いつの間にか|いつのまにか',
  'いつ|いつ',
  '間|ま',
  '改めて|あらためて',
  '改める|あらためる',
  'ゆっくり|ゆっくり',
  '立ち上がる|たちあがる',
  '上がる|あがる',
  '本|ほん',
  'みる|みる',
  '名前|なまえ',
  'おく|おく',
  '傘|かさ',
  '持つ|もつ',
  'くる|くる',
  '誰か|だれか',
  '呼ぶ|よぶ',
  '結局|けっきょく',
  '選ぶ|えらぶ',
  'ずっと|ずっと',
  '全然|ぜんぜん',
  '気づく|きづく',
  'いろいろ|いろいろ',
  '話|はなし',
  'すごい|すごい;すごーい|すごーい',
  '服|ふく',
  'かわいい|かわいい;カワイイ|カワイイ',
  '部屋|へや',
  '綺麗|きれい',
  'つまらない|つまらない',
  '時に|ときに',
  '時|とき',
  'は|は',
  'が|が',
  'を|を'
];

const porTermo = new Map<string, Entrada[]>();

// 'escrita|leitura', com ';' entre as formas de uma mesma entrada.
PALAVRAS.forEach((palavra, seq) => {
  const formas = palavra.split(';').map((forma) => {
    const [e, l] = forma.split('|');

    return { e, l };
  });
  const entrada: Entrada = { id: seq, seq, formas, sentidos: [] };

  for (const termo of new Set(formas.flatMap(({ e, l }) => [e, l]))) {
    porTermo.set(termo, [...(porTermo.get(termo) ?? []), entrada]);
  }
});

const consultas: string[] = [];
const consultar: Consulta = async (termo) => {
  consultas.push(termo);
  return porTermo.get(termo) ?? [];
};

let tokenizador: Tokenizador;

beforeAll(async () => {
  const caminho = createRequire(import.meta.url).resolve(
    'lindera-wasm-ipadic/lindera_wasm_ipadic_bg.wasm'
  );
  tokenizador = await criarTokenizador(readFileSync(caminho));
});

async function tocar(frase: string, toque: string) {
  const pedacos = tokenizador.tokenizar(frase);

  return { pedacos, selecao: await selecionar(consultar, pedacos, frase.indexOf(toque)) };
}

describe('deflexão pelo tokenizador (ADR 0005)', () => {
  it.each(CASOS_DEFLEXAO)('$frase · $toque → $termo', async ({ frase, toque, termo, selecao }) => {
    const { selecao: achada } = await tocar(frase, toque);

    expect(achada?.termo).toBe(termo);
    expect(achada?.entradas.length).toBeGreaterThan(0);
    if (selecao) expect(achada?.texto).toBe(selecao);
  });

  it('tem ao menos 100 formas', () => {
    expect(CASOS_DEFLEXAO.length).toBeGreaterThanOrEqual(100);
  });
});

describe('seleção híbrida (ADR 0003)', () => {
  it('o toque no meio da palavra começa no começo do pedaço', async () => {
    const frase = '彼はふと気がついた。';
    const { selecao } = await tocar(frase, 'がつ');

    // O IPADIC tem 気がつい como um pedaço só: tocar em が começa em 気.
    expect(selecao).toMatchObject({ inicio: frase.indexOf('気'), termo: '気がつく' });
  });

  it('o toque no segundo pedaço começa nele (as setas não mexem no começo)', async () => {
    const frase = '先月引っ越したばかりだ。';
    const { selecao } = await tocar(frase, '月');

    expect(selecao?.inicio).toBeLessThanOrEqual(frase.indexOf('月'));
  });

  it('pontuação e espaço não selecionam', async () => {
    const frase = '「わかった」と言った。';
    const pedacos = tokenizador.tokenizar(frase);

    expect(await selecionar(consultar, pedacos, frase.indexOf('「'))).toBeNull();
    expect(await selecionar(consultar, pedacos, frase.indexOf('。'))).toBeNull();
    expect(await selecionar(consultar, pedacos, frase.length + 3)).toBeNull();
  });

  it('a seleção não atravessa pontuação', async () => {
    const { selecao } = await tocar('気、がつく', '気');

    expect(selecao?.termo).toBe('気');
  });

  it('palavra fora do dicionário fica selecionada sem entradas', async () => {
    const { selecao } = await tocar('桐生は笑った。', '桐生');

    expect(selecao).toMatchObject({ texto: '桐生', termo: '桐生', entradas: [] });
  });

  it('partícula abre com a marca de gramática', async () => {
    const { selecao } = await tocar('彼は笑った。', 'は');

    expect(selecao).toMatchObject({ termo: 'は', gramatica: true });
  });

  it('as setas encurtam e alongam pela lista de pedaços', async () => {
    const { pedacos, selecao } = await tocar('最初は気のせいだと思った。', '気');

    expect(selecao?.termo).toBe('気のせい');

    const curta = await ajustarSelecao(consultar, pedacos, selecao!, -1);

    expect(curta.texto).toBe('気の');
    expect(curta.entradas).toEqual([]);

    const maisCurta = await ajustarSelecao(consultar, pedacos, curta, -1);

    expect(maisCurta).toMatchObject({ texto: '気', termo: '気' });
    expect(await ajustarSelecao(consultar, pedacos, maisCurta, -1)).toBe(maisCurta);

    const longa = await ajustarSelecao(consultar, pedacos, selecao!, 1);

    expect(longa.texto).toBe('気のせいだ');
  });

  it('a seleção mostra a forma conjugada e consulta a de dicionário', async () => {
    const { selecao } = await tocar('立ち止まった少女は振り返らなかった。', '立ち');

    expect(selecao).toMatchObject({ texto: '立ち止まった', termo: '立ち止まる' });
  });
});

describe('termos do intervalo', () => {
  it('pedaços inteiros + forma de dicionário do último, depois a superfície e as reservas', () => {
    const pedacos = tokenizador.tokenizar('彼に会えるかな');
    const i = pedacos.findIndex((p) => p.superficie === '会える');

    expect(termosDoIntervalo(pedacos, i, i)).toEqual(['会える', '会う']);
  });

  it('reservas: alongamento, っ final e katakana', () => {
    const pedacos = tokenizador.tokenizar('すごーい');
    const termos = termosDoIntervalo(pedacos, 0, pedacos.length - 1);

    expect(termos).toContain('すごい');
    expect(termosDoIntervalo(tokenizador.tokenizar('カワイイ'), 0, 0)).toContain('かわいい');
  });

  it('a consulta do toque é curta (poucas idas ao dicionário)', async () => {
    consultas.length = 0;
    await tocar('窓の外を眺めながら考え込んでいた。', '考え');
    expect(consultas.length).toBeLessThanOrEqual(20);
  });
});
