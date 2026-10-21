// Pedidos ao Gemini (generateContent) e leitura das respostas; nomes dos áudios e chave do cache de
// traduções. Sem imports: roda no Deno e no vitest. Os modelos não aparecem aqui (configuração).

export type Uso = { entrada: number; saida: number; total: number };

type Resposta = {
  candidates?: {
    content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

async function hex(algoritmo: 'SHA-1' | 'SHA-256', texto: string) {
  const resumo = await crypto.subtle.digest(algoritmo, new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(resumo), (b) => b.toString(16).padStart(2, '0')).join('');
}

// CARDS.md: leituras-<sha1(voz|texto)[:12]>.wav, que não colide com a mídia do Kaishi.
export async function nomeAudio(voz: string, texto: string) {
  return `leituras-${(await hex('SHA-1', `${voz}|${texto}`)).slice(0, 12)}.wav`;
}

// Chave da tabela translations: sha256 da frase sem HTML.
export function chaveFrase(frase: string) {
  return hex('SHA-256', semHtml(frase).trim());
}

export function semHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

export function trechoEmNegrito(html: string) {
  const achado = html.match(/<b>(.*?)<\/b>/);
  return achado ? semHtml(achado[1]) : null;
}

function contexto(antes?: string | null, depois?: string | null) {
  const linhas = [];
  if (antes) linhas.push(`Frase anterior (só contexto, não traduzir): ${semHtml(antes)}`);
  if (depois) linhas.push(`Frase seguinte (só contexto, não traduzir): ${semHtml(depois)}`);
  return linhas.length ? `\n${linhas.join('\n')}` : '';
}

function pedidoJson(texto: string, campos: Record<string, string>) {
  return {
    contents: [{ role: 'user', parts: [{ text: texto }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: Object.fromEntries(
          Object.entries(campos).map(([nome, descricao]) => [
            nome,
            { type: 'STRING', description: descricao }
          ])
        ),
        required: Object.keys(campos)
      }
    }
  };
}

const TRADUCAO =
  'Tradução da frase para o português do Brasil, natural mas próxima da estrutura do japonês. ' +
  'Só a frase, sem as frases de contexto.';

// Um pedido de texto por carta: tradução da frase e significado da palavra (ADR 0009).
export function pedidoCarta(carta: {
  palavra: string;
  leitura: string;
  frase: string;
  antes?: string | null;
  depois?: string | null;
}) {
  const forma = trechoEmNegrito(carta.frase);
  const texto = [
    'Você ajuda um brasileiro que estuda japonês lendo livros.',
    `Frase: ${semHtml(carta.frase).trim()}` + contexto(carta.antes, carta.depois),
    `Palavra: ${carta.palavra}（${carta.leitura}）` +
      (forma && forma !== carta.palavra ? `, que aparece na frase como 「${forma}」` : ''),
    'Responda em JSON, em português do Brasil, com a tradução da frase e o significado da palavra.'
  ].join('\n');
  return pedidoJson(texto, {
    traducao: TRADUCAO,
    significado:
      'Significado curto da palavra em português do Brasil, no sentido em que ela aparece nesta ' +
      'frase (não a lista de acepções): de uma a quatro palavras, no máximo duas variantes ' +
      'separadas por vírgula, sem a leitura e sem explicação. Verbo no infinitivo.'
  });
}

// Tradução da frase pedida na leitura (painel).
export function pedidoTraducao(pedido: {
  frase: string;
  antes?: string | null;
  depois?: string | null;
}) {
  const texto = [
    'Você ajuda um brasileiro que estuda japonês lendo livros.',
    `Frase: ${semHtml(pedido.frase).trim()}` + contexto(pedido.antes, pedido.depois),
    'Responda em JSON, em português do Brasil, com a tradução da frase.'
  ].join('\n');
  return pedidoJson(texto, { traducao: TRADUCAO });
}

function pedidoVoz(voz: string, texto: string) {
  return {
    contents: [{ role: 'user', parts: [{ text: texto }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } }
    }
  };
}

// A voz da palavra lê só a leitura em kana (CARDS.md "Áudio"): o TTS 3.8 lê em voz alta qualquer
// instrução que vá junto (R5), e a kana fixa a pronúncia (辛い つらい, 開く あく, 風 ふう).
export function pedidoVozPalavra(voz: string, leitura: string) {
  return pedidoVoz(voz, leitura.trim());
}

// A frase vai sem HTML; o "Texto para a voz" (em kana) a substitui quando preenchido.
export function pedidoVozFrase(voz: string, texto: string) {
  return pedidoVoz(voz, semHtml(texto).trim());
}

function primeiraParte(resposta: Resposta) {
  const candidato = resposta.candidates?.[0];
  const parte = candidato?.content?.parts?.[0];
  if (!parte) {
    const motivo =
      resposta.promptFeedback?.blockReason ?? candidato?.finishReason ?? 'resposta vazia';
    throw new Error(`Gemini sem resposta: ${motivo}`);
  }
  return parte;
}

function uso(resposta: Resposta): Uso {
  const u = resposta.usageMetadata ?? {};
  return {
    entrada: u.promptTokenCount ?? 0,
    saida: u.candidatesTokenCount ?? 0,
    total: u.totalTokenCount ?? 0
  };
}

export function lerJson(resposta: Resposta) {
  const texto = primeiraParte(resposta).text;
  if (!texto) throw new Error('Gemini sem texto');
  return { dados: JSON.parse(texto) as Record<string, string>, uso: uso(resposta) };
}

export function lerAudio(resposta: Resposta) {
  const dados = primeiraParte(resposta).inlineData?.data;
  if (!dados) throw new Error('Gemini sem áudio');
  const binario = atob(dados);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return { bytes, uso: uso(resposta) };
}
