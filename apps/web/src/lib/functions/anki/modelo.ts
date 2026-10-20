/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// Tipo de nota e deck do Dokusho. Valores exatos de docs/CARDS.md (fonte única); não mudar os IDs.

export const MODEL_ID = 1760101001;
export const MODEL_NAME = 'Leituras (estilo Kaishi)';
export const DECK = {
  id: 1760101002,
  nome: '日本語::1. Dokusho',
  guid: 'leituras-igor',
  tag: 'dokusho'
} as const;

export const CAMPOS = [
  'Word',
  'Word Reading',
  'Word Meaning',
  'Word Furigana',
  'Word Audio',
  'Sentence',
  'Sentence Meaning',
  'Sentence Furigana',
  'Sentence Audio',
  'Notes',
  'Pitch Accent',
  'Pitch Accent Notes',
  'Frequency',
  'Picture'
] as const;

export type Campo = (typeof CAMPOS)[number];
export type CamposCarta = Partial<Record<Campo, string>> & Pick<Record<Campo, string>, 'Word'>;

export const FRENTE = `<div lang="ja">
{{Word}}
<div style='font-size: 20px;'>{{Sentence}}</div>
</div>`;

export const VERSO = `<div lang="ja">
{{furigana:Word Furigana}}

<!-- This part enables pitch accent.

{{#Pitch Accent}}
	<br><div style='font-size: 24px'>{{Pitch Accent}}</div>
{{/Pitch Accent}}

-->

<div style='font-size: 25px; padding-bottom:20px'>{{Word Meaning}}</div>
<div style='font-size: 25px;'>{{furigana:Sentence Furigana}}</div>
<div style='font-size: 25px; padding-bottom:10px'>{{Sentence Meaning}}</div>

{{Word Audio}}
{{Sentence Audio}}
<br>
{{Picture}}

{{#Notes}}
	<br>
	<div style="font-size: 20px; padding-top:12px">Note: {{Notes}}</div>
{{/Notes}}

<!-- This part enables pitch accent notes.

{{#Pitch Accent Notes}}
<div style="font-size: 20px; width: fit-content; max-width:40vw; margin: auto">
	<details><summary>Pitch Accent Notes</summary>
		<br>{{Pitch Accent Notes}}
	</details>
</div>
{{/Pitch Accent Notes}}

-->

</div>`;

export const ESTILO = `.card {
 font-family: "ヒラギノ角ゴ Pro W3", "Hiragino Kaku Gothic Pro", "Noto Sans JP", Osaka, "メイリオ", Meiryo, "ＭＳ Ｐゴシック", "MS PGothic", "MS UI Gothic", sans-serif;
 font-size: 44px;
 text-align: center;
}

img {
max-width: 300px;
max-height: 250px;
}

.mobile img {
max-width: 50vw;
}

/* This part defines the bold color. */
b{color: #5586cd}
`;

export function etiquetasDoLivro(titulo: string): string[] {
  return [DECK.tag, `${DECK.tag}::${titulo.trim().replace(/\s+/g, '_')}`];
}

const LATEX_PRE =
  '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n' +
  '\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n' +
  '\\begin{document}\n';

// Model.to_json do genanki. "req": a frente tem conteúdo com Word ou Sentence (calculado pelo genanki).
export function modeloJson(timestamp: number, deckId: number = DECK.id) {
  return {
    css: ESTILO,
    did: deckId,
    flds: CAMPOS.map((name, ord) => ({
      name,
      ord,
      font: 'Liberation Sans',
      media: [],
      rtl: false,
      size: 20,
      sticky: false
    })),
    id: String(MODEL_ID),
    latexPost: '\\end{document}',
    latexPre: LATEX_PRE,
    latexsvg: false,
    mod: Math.floor(timestamp),
    name: MODEL_NAME,
    req: [[0, 'any', [0, 5]]],
    sortf: 0,
    tags: [],
    tmpls: [
      {
        name: 'Card 1',
        qfmt: FRENTE,
        afmt: VERSO,
        ord: 0,
        bafmt: '',
        bqfmt: '',
        bfont: '',
        bsize: 0,
        did: null
      }
    ],
    type: 0,
    usn: -1,
    vers: []
  };
}

export interface DeckAnki {
  id: number;
  nome: string;
}

// Deck.to_json do genanki.
export function deckJson(deck: DeckAnki = DECK) {
  return {
    collapsed: false,
    conf: 1,
    desc: '',
    dyn: 0,
    extendNew: 0,
    extendRev: 50,
    id: deck.id,
    lrnToday: [163, 2],
    mod: 1425278051,
    name: deck.nome,
    newToday: [163, 2],
    revToday: [163, 0],
    timeToday: [163, 23598],
    usn: -1
  };
}
