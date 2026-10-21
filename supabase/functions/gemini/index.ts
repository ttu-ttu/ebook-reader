// Edge Function gemini (ESCOPO "Cards"; ADR 0009, 0010). Única porta do app para o Gemini.
//
//   { action: 'translate', frase, antes?, depois? }  → { traducao, cache }
//   { action: 'generate', id, refazer? }              → { estado: 'gerada' | 'erro', ... }
//
// Aceita só o usuário de ALLOWED_USER_ID. Cada chamada ao Gemini conta no teto diário
// (GEMINI_TETO_DIARIO, em gemini_usage). Modelos em GEMINI_MODELOS_TEXTO e GEMINI_MODELOS_TTS
// (listas com reserva, separadas por vírgula). A chave é o secret GEMINI_API_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { comReserva, ErroGemini, lerLista, usuarioPermitido } from './modelos.ts';
import {
  chaveFrase,
  lerAudio,
  lerJson,
  nomeAudio,
  pedidoCarta,
  pedidoTraducao,
  pedidoVozFrase,
  pedidoVozPalavra,
  semHtml,
  type Uso
} from './textos.ts';
import { cortarSilencio, duracaoSegundos, extrairPcm, pcmParaWav } from './wav.ts';

const VOZ = 'Orus';
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

// Chave de serviço: a legada (SUPABASE_SERVICE_ROLE_KEY) ou a nova (SUPABASE_SECRET_KEYS, JSON).
function chaveServico() {
  const legada = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legada) return legada;
  const novas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const chave = novas.default ?? Object.values(novas)[0];
  if (!chave) throw new Error('Sem chave de serviço no ambiente da função');
  return chave as string;
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, chaveServico(), {
  auth: { persistSession: false }
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function responder(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

type Medida = { modelo: string; uso: Uso };

function criarGemini(usuario: string) {
  const chave = Deno.env.get('GEMINI_API_KEY');
  const teto = Number(Deno.env.get('GEMINI_TETO_DIARIO'));
  if (!chave) throw new Error('Secret GEMINI_API_KEY ausente');
  if (!(teto > 0)) throw new Error('Configuração GEMINI_TETO_DIARIO ausente');

  async function chamar(modelo: string, corpo: unknown) {
    const { data: total, error } = await supabase.rpc('gemini_reservar', {
      p_user: usuario,
      p_n: 1,
      p_teto: teto
    });
    if (error) throw new ErroGemini(0, `teto: ${error.message}`, true);
    if (total === null) throw new ErroGemini(429, `teto diário de ${teto} chamadas atingido`, true);

    const resposta = await fetch(`${API}/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave! },
      body: JSON.stringify(corpo)
    });
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const mensagem = json?.error?.message ?? resposta.statusText;
      throw new ErroGemini(
        resposta.status,
        `${modelo}: ${resposta.status} ${mensagem}`,
        resposta.status === 401 || resposta.status === 403
      );
    }
    return json;
  }

  return {
    async json(corpo: unknown) {
      const lista = lerLista('GEMINI_MODELOS_TEXTO', Deno.env.get('GEMINI_MODELOS_TEXTO'));
      const { valor, modelo } = await comReserva(lista, async (m) =>
        lerJson(await chamar(m, corpo))
      );
      return { dados: valor.dados, medida: { modelo, uso: valor.uso } as Medida };
    },
    async audio(corpo: unknown) {
      const lista = lerLista('GEMINI_MODELOS_TTS', Deno.env.get('GEMINI_MODELOS_TTS'));
      const { valor, modelo } = await comReserva(lista, async (m) =>
        lerAudio(await chamar(m, corpo))
      );
      const pcm = cortarSilencio(extrairPcm(valor.bytes));
      return {
        wav: pcmParaWav(pcm),
        segundos: duracaoSegundos(pcm),
        medida: { modelo, uso: valor.uso }
      };
    }
  };
}

async function traduzir(usuario: string, pedido: Record<string, unknown>) {
  const frase = typeof pedido.frase === 'string' ? pedido.frase : '';
  if (!semHtml(frase).trim()) return responder(400, { erro: 'frase vazia' });
  const chave = await chaveFrase(frase);

  const { data: cache } = await supabase
    .from('translations')
    .select('translation')
    .eq('user_id', usuario)
    .eq('sentence_sha256', chave)
    .is('deleted_at', null)
    .maybeSingle();
  if (cache) return responder(200, { traducao: cache.translation, cache: true });

  const gemini = criarGemini(usuario);
  const { dados, medida } = await gemini.json(
    pedidoTraducao({
      frase,
      antes: pedido.antes as string | undefined,
      depois: pedido.depois as string | undefined
    })
  );
  await guardarTraducao(usuario, frase, dados.traducao);
  return responder(200, { traducao: dados.traducao, cache: false, medida });
}

async function guardarTraducao(usuario: string, frase: string, traducao: string) {
  const agora = new Date().toISOString();
  const { error } = await supabase.from('translations').upsert({
    user_id: usuario,
    sentence_sha256: await chaveFrase(frase),
    sentence: semHtml(frase).trim(),
    translation: traducao,
    translated_at: agora,
    modified_at: agora,
    deleted_at: null
  });
  if (error) throw new Error(`translations: ${error.message}`);
}

async function subirAudio(usuario: string, nome: string, wav: Uint8Array) {
  const caminho = `${usuario}/${nome}`;
  const { error } = await supabase.storage
    .from('audio')
    .upload(caminho, wav, { contentType: 'audio/wav', upsert: true });
  if (error) throw new Error(`audio: ${error.message}`);
  return caminho;
}

// Gera a parte Gemini de uma Carta (ADR 0010). Só faz o que falta: num "Tentar de novo", o que já
// deu certo fica. `refazer` limpa partes antes (o "Refazer áudio" da fila).
async function gerar(usuario: string, pedido: Record<string, unknown>) {
  const id = typeof pedido.id === 'string' ? pedido.id : '';
  if (!id) return responder(400, { erro: 'id ausente' });
  const refazer = Array.isArray(pedido.refazer) ? pedido.refazer : [];

  const { data: travadas, error: erroTrava } = await supabase.rpc('gemini_travar', {
    p_user: usuario,
    p_id: id
  });
  if (erroTrava) throw new Error(`trava: ${erroTrava.message}`);
  const carta = travadas?.[0];
  if (!carta) return responder(409, { estado: 'ocupada' });

  if (refazer.includes('texto')) carta.word_meaning = carta.sentence_meaning = null;
  if (refazer.includes('audio')) carta.word_audio_path = carta.sentence_audio_path = null;

  const feito: Record<string, string | null> = {
    word_meaning: carta.word_meaning,
    sentence_meaning: carta.sentence_meaning,
    word_audio_path: carta.word_audio_path,
    sentence_audio_path: carta.sentence_audio_path
  };
  const medidas: Record<string, unknown> = {};
  let modificada = carta.modified_at;

  async function gravar(campos: Record<string, unknown>) {
    // modified_at nunca anda para trás (LWW do touch_row).
    const agora = Math.max(Date.now(), new Date(modificada).getTime() + 1);
    modificada = new Date(agora).toISOString();
    const { error } = await supabase
      .from('batch_items')
      .update({ ...campos, modified_at: modificada })
      .eq('user_id', usuario)
      .eq('id', id);
    if (error) throw new Error(`batch_items: ${error.message}`);
  }

  try {
    const gemini = criarGemini(usuario);

    if (!feito.word_meaning || !feito.sentence_meaning) {
      const { data: cache } = await supabase
        .from('translations')
        .select('translation')
        .eq('user_id', usuario)
        .eq('sentence_sha256', await chaveFrase(carta.sentence))
        .is('deleted_at', null)
        .maybeSingle();
      const { dados, medida } = await gemini.json(
        pedidoCarta({
          palavra: carta.word,
          leitura: carta.word_reading,
          frase: carta.sentence,
          antes: carta.sentence_before,
          depois: carta.sentence_after
        })
      );
      medidas.texto = medida;
      feito.word_meaning ||= dados.significado;
      feito.sentence_meaning ||= cache?.translation ?? dados.traducao;
      if (!cache) await guardarTraducao(usuario, carta.sentence, dados.traducao);
    }

    if (!feito.word_audio_path) {
      const corpo = pedidoVozPalavra(VOZ, carta.word_reading);
      const { wav, segundos, medida } = await gemini.audio(corpo);
      const nome = await nomeAudio(VOZ, corpo.contents[0].parts[0].text);
      feito.word_audio_path = await subirAudio(usuario, nome, wav);
      medidas.palavra = { ...medida, bytes: wav.byteLength, segundos };
    }

    if (!feito.sentence_audio_path) {
      const corpo = pedidoVozFrase(VOZ, carta.voice_text || carta.sentence);
      const { wav, segundos, medida } = await gemini.audio(corpo);
      const nome = await nomeAudio(VOZ, corpo.contents[0].parts[0].text);
      feito.sentence_audio_path = await subirAudio(usuario, nome, wav);
      medidas.frase = { ...medida, bytes: wav.byteLength, segundos };
    }

    await gravar({ ...feito, state: 'gerada', error_reason: null });
    return responder(200, { estado: 'gerada', campos: feito, medidas });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    await gravar({ ...feito, state: 'erro', error_reason: motivo });
    return responder(200, { estado: 'erro', motivo, campos: feito, medidas });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder(405, { erro: 'só POST' });

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: login } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
  const usuario = login.user?.id;
  if (!usuario) return responder(401, { erro: 'sem login' });
  if (!usuarioPermitido(usuario, Deno.env.get('ALLOWED_USER_ID'))) {
    return responder(403, { erro: 'usuário não permitido' });
  }

  try {
    const pedido = await req.json().catch(() => ({}));
    if (pedido.action === 'translate') return await traduzir(usuario, pedido);
    if (pedido.action === 'generate') return await gerar(usuario, pedido);
    return responder(400, { erro: 'action deve ser translate ou generate' });
  } catch (erro) {
    const status = erro instanceof ErroGemini && erro.status === 429 ? 429 : 500;
    return responder(status, { erro: erro instanceof Error ? erro.message : String(erro) });
  }
});
