// Teste do R5 (temporário): compara três vozes da palavra pela ação voz-teste da função gemini.
//   kanji: a voz lê a palavra escrita (辛い)
//   dica:  lê a palavra escrita, com a leitura como dica fora do texto falado (API Interactions)
//   kana:  lê só a leitura (つらい)
// Cada áudio passa pela conferência (o modelo de texto escreve em hiragana o que ouviu).
// Uso (na raiz): node tools/comparar-vozes.ts [pasta]   (padrão: dicts/r5)
// 20 palavras: 11 de leitura ambígua e 9 que só o acento separa. Pede e-mail e senha no terminal;
// grava <pasta>/vozes-<data-hora>/relatorio.html com os WAV (preços de <pasta>/precos.json).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { argv, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

const raiz = join(import.meta.dirname, '..');
const doApp = createRequire(join(raiz, 'apps/web/package.json'));
const { createClient } = await import(pathToFileURL(doApp.resolve('@supabase/supabase-js')).href);

const env = Object.fromEntries(
  readFileSync(join(raiz, 'apps/web/.env'), 'utf8')
    .split(/\r?\n/)
    .map((linha) => linha.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
    .filter((m) => m)
    .map((m) => [m![1], m![2].replace(/^["']|["']$/g, '')])
);

const pasta = join(raiz, argv[2] ?? 'dicts/r5');
const PARES_DE_ACENTO = [
  ['橋', 'はし'],
  ['箸', 'はし'],
  ['端', 'はし'],
  ['雨', 'あめ'],
  ['飴', 'あめ'],
  ['神', 'かみ'],
  ['紙', 'かみ'],
  ['柿', 'かき'],
  ['牡蠣', 'かき']
];
// Palavras do livro do R5 com mais de uma leitura possível.
const AMBIGUAS = [
  ['方', 'ほう'],
  ['上手い', 'うまい'],
  ['下手', 'へた'],
  ['今日', 'きょう'],
  ['一日', 'いちにち'],
  ['明日', 'あした'],
  ['辛い', 'つらい'],
  ['開く', 'あく'],
  ['風', 'ふう'],
  ['色', 'いろ'],
  ['何度', 'なんど']
];
const palavras = [...AMBIGUAS, ...PARES_DE_ACENTO] as [string, string][];
const precos: Record<string, { entrada: number; saida: number }> = existsSync(
  join(pasta, 'precos.json')
)
  ? JSON.parse(readFileSync(join(pasta, 'precos.json'), 'utf8'))
  : {};

async function perguntar(texto: string, oculto = false) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  if (oculto) {
    // Não ecoa a senha.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (s.startsWith(texto)) stdout.write(texto);
    };
  }
  const resposta = await rl.question(texto);
  rl.close();
  if (oculto) stdout.write('\n');
  return resposta.trim();
}

const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});
const email = await perguntar('E-mail: ');
const senha = await perguntar('Senha: ', true);
const { error: erroLogin } = await supabase.auth.signInWithPassword({ email, password: senha });
if (erroLogin) throw erroLogin;

const saida = join(pasta, 'vozes-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
mkdirSync(saida, { recursive: true });

const VARIANTES = ['kanji', 'dica', 'kana'] as const;
type Uso = { entrada: number; total: number };
type Medida = { modelo: string; uso: Uso };
type Voz = {
  wav?: string;
  arquivo?: string;
  segundos?: number;
  medida?: Medida;
  medidaConferencia?: Medida;
  ouvido?: string;
  confere?: boolean;
  erro?: string;
};
const custo = (m?: Medida) => {
  const p = m && precos[m.modelo];
  return p ? (m.uso.entrada * p.entrada + (m.uso.total - m.uso.entrada) * p.saida) / 1e6 : 0;
};

const linhas: { palavra: string; leitura: string; vozes: Record<string, Voz> }[] = [];
for (const [i, [palavra, leitura]] of palavras.entries()) {
  const { data, error } = await supabase.functions.invoke('gemini', {
    body: { action: 'voz-teste', palavra, leitura }
  });
  if (error) {
    let corpo = error.message;
    try {
      corpo = JSON.stringify(await error.context?.json());
    } catch {
      // fica a mensagem do supabase-js
    }
    console.log(`${i + 1}/${palavras.length} ${palavra}: erro ${corpo}`);
    if (linhas.length === 0) break;
    continue;
  }
  const vozes: Record<string, Voz> = data;
  for (const nome of VARIANTES) {
    const voz = vozes[nome];
    if (voz?.wav) {
      voz.arquivo = `${String(i + 1).padStart(2, '0')}-${nome}.wav`;
      writeFileSync(join(saida, voz.arquivo), Buffer.from(voz.wav, 'base64'));
      delete voz.wav;
    }
  }
  linhas.push({ palavra, leitura, vozes });
  console.log(
    `${i + 1}/${palavras.length} ${palavra} ${leitura}: ` +
      VARIANTES.map((n) => {
        const v = vozes[n];
        return v?.erro
          ? `${n} ERRO (${v.erro})`
          : `${n} ${v?.confere ? 'ok' : 'ouviu ' + v?.ouvido}`;
      }).join(' | ')
  );
}

writeFileSync(join(saida, 'medidas.json'), JSON.stringify(linhas, null, 1));

const html = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const celula = (v?: Voz) =>
  !v || v.erro
    ? `<td class="erro">${html(v?.erro ?? 'sem resposta')}</td>`
    : `<td><audio controls preload="none" src="${v.arquivo}"></audio><br>` +
      `<span class="${v.confere ? 'ok' : 'erro'}">${v.confere ? '✓' : '✗'} ${html(v.ouvido)}</span>` +
      ` · ${v.segundos?.toFixed(1)} s</td>`;
const resumo = VARIANTES.map((n) => {
  const vs = linhas.map((l) => l.vozes[n]).filter((v) => v && !v.erro);
  const certos = vs.filter((v) => v.confere).length;
  const segundos = vs.reduce((s, v) => s + (v.segundos ?? 0), 0) / (vs.length || 1);
  const preco =
    vs.reduce((s, v) => s + custo(v.medida) + custo(v.medidaConferencia), 0) / (vs.length || 1);
  const modelos = [...new Set(vs.map((v) => v.medida?.modelo))].join(', ');
  return `<li><b>${n}</b>: conferência ${certos}/${vs.length} (erros: ${linhas.length - vs.length}); ${segundos.toFixed(1)} s; US$ ${preco.toFixed(5)} por palavra com a conferência; ${html(modelos)}</li>`;
}).join('\n');
const nCartas = palavras.length - PARES_DE_ACENTO.length;
const tabela = linhas
  .map(
    (l, i) =>
      (i === nCartas ? '<tr><th colspan="5">Pares que só o acento separa</th></tr>' : '') +
      `<tr><td>${i + 1}</td><td class="ja"><b>${html(l.palavra)}</b><br>${html(l.leitura)}</td>` +
      VARIANTES.map((n) => celula(l.vozes[n])).join('') +
      '</tr>'
  )
  .join('\n');
writeFileSync(
  join(saida, 'relatorio.html'),
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>R5 · vozes da palavra</title>
<style>
body{font-family:system-ui,sans-serif;margin:16px;line-height:1.4}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ccc;padding:6px;vertical-align:top;text-align:left}
.ja{font-family:"Noto Sans JP","Meiryo",sans-serif;font-size:1.2em}.ok{color:#080}.erro{color:#c00}
audio{width:150px}
</style>
<h1>R5 · voz da palavra em três variantes</h1>
<p>kanji: lê a palavra escrita · dica: a palavra escrita com a leitura como dica fora do texto falado · kana: só a leitura.
✓/✗ é a conferência: o modelo de texto ouviu o áudio e escreveu em hiragana. Ela confere a leitura, não o acento: o acento é com o seu ouvido.</p>
<ul>${resumo}</ul>
<table><tr><th>#</th><th>Palavra</th><th>kanji</th><th>dica</th><th>kana</th></tr>
${tabela}
</table></html>`
);

console.log(`\nRelatório: ${join(saida, 'relatorio.html')}`);
