<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { LinhaCarta } from '$lib/data/supabase/sincronizacao/regras';
  import { geracao, salvarCarta, tirarDaFila, urlDoAudio } from '$lib/data/cartas/fila';
  import { sincronizarEmBreve } from '$lib/data/supabase/sincronizacao/iniciar';

  // Edição da carta (D1 "tela de edição"): cada campo mostra de onde vem; "Texto para a voz" e
  // "Refazer áudio" (R5); carta exportada só para leitura.

  export let carta: LinhaCarta;
  export let gerando = false;

  const dispatch = createEventDispatcher<{ voltar: void }>();

  type Campo = keyof LinhaCarta;

  const CAMPOS: { campo: Campo; rotulo: string; origem: string; japones?: boolean }[] = [
    { campo: 'word', rotulo: 'Word', origem: 'dicionário', japones: true },
    { campo: 'word_reading', rotulo: 'Word Reading', origem: 'dicionário', japones: true },
    { campo: 'word_meaning', rotulo: 'Word Meaning', origem: 'Gemini' },
    { campo: 'word_furigana', rotulo: 'Word Furigana', origem: 'JmdictFurigana', japones: true },
    { campo: 'sentence', rotulo: 'Sentence', origem: 'livro', japones: true },
    { campo: 'sentence_meaning', rotulo: 'Sentence Meaning', origem: 'Gemini' },
    {
      campo: 'sentence_furigana',
      rotulo: 'Sentence Furigana',
      origem: 'JmdictFurigana · tokenizador',
      japones: true
    },
    { campo: 'frequency', rotulo: 'Frequency', origem: 'JPDB' },
    { campo: 'notes', rotulo: 'Notes', origem: 'você' }
  ];

  let mensagem = '';
  let ocupado = false;
  let tocando: HTMLAudioElement | undefined;

  $: somenteLeitura = carta.state === 'exportada';
  $: bloqueada = somenteLeitura || gerando || carta.state === 'gerando';

  async function mudar(campo: Campo, valor: string) {
    const convertido =
      campo === 'frequency' ? (valor.trim() ? Number(valor) || null : null) : valor || null;

    carta = { ...carta, [campo]: convertido };
    await salvarCarta(carta);
    sincronizarEmBreve();
  }

  async function ouvir(caminho: string | null) {
    if (!caminho) return;

    mensagem = '';

    try {
      tocando?.pause();
      tocando = new Audio(await urlDoAudio(caminho));
      await tocando.play();
    } catch (e) {
      mensagem = `Áudio: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function executar(acao: () => Promise<unknown>) {
    ocupado = true;
    mensagem = '';

    try {
      await acao();
    } catch (e) {
      mensagem = e instanceof Error ? e.message : String(e);
    } finally {
      ocupado = false;
    }
  }

  const refazerAudio = () =>
    executar(() => geracao.refazerAudio(carta.id, { voice_text: carta.voice_text }));
  const tentarDeNovo = () => executar(() => geracao.tentarDeNovo(carta.id));
  const tirar = () =>
    executar(async () => {
      await tirarDaFila(carta);
      sincronizarEmBreve();
      dispatch('voltar');
    });
</script>

<div class="dokusho-editor">
  <header>
    <button aria-label="Voltar para a Fila" on:click={() => dispatch('voltar')}>‹</button>
    <b lang="ja">{carta.word}</b>
    <span class="dokusho-estado dokusho-estado--{carta.state}"
      >{gerando ? 'gerando' : carta.state}</span
    >
  </header>

  {#if carta.state === 'erro'}
    <div class="dokusho-editor__aviso dokusho-editor__aviso--erro">
      {carta.error_reason || 'A geração falhou.'}
      <button disabled={ocupado || !navigator.onLine} on:click={tentarDeNovo}>Tentar de novo</button
      >
    </div>
  {/if}

  {#if carta.word_audio_check === 'confira'}
    <div class="dokusho-editor__aviso">
      Confira a voz da palavra: a conferência não reconheceu a leitura. Ouça; se estiver errada,
      escreva a leitura em kana em "Texto para a voz" e refaça o áudio.
    </div>
  {/if}

  {#if somenteLeitura}
    <div class="dokusho-editor__aviso">
      Exportada. Corrigir agora é no Anki; reexportar sobrescreve o Card.
    </div>
  {/if}

  {#each CAMPOS as { campo, rotulo, origem, japones }}
    {@const valor = carta[campo]}
    <label class="dokusho-editor__campo">
      <span>{rotulo} <small>{valor === null || valor === '' ? 'vazio' : origem}</small></span>
      <textarea
        lang={japones ? 'ja' : undefined}
        readonly={bloqueada}
        value={valor ?? ''}
        rows={campo.startsWith('sentence') ? 3 : 1}
        on:change={(e) => mudar(campo, e.currentTarget.value)}
      />
    </label>
  {/each}

  <div class="dokusho-editor__audios">
    <button disabled={!carta.word_audio_path} on:click={() => ouvir(carta.word_audio_path)}>
      ▶ Palavra {carta.word_audio_check ? `(${carta.word_audio_check})` : ''}
    </button>
    <button disabled={!carta.sentence_audio_path} on:click={() => ouvir(carta.sentence_audio_path)}>
      ▶ Frase
    </button>
  </div>

  {#if !somenteLeitura}
    <section class="dokusho-editor__voz">
      <label class="dokusho-editor__campo">
        <span>Texto para a voz <small>você · opcional, em kana</small></span>
        <textarea
          lang="ja"
          rows="2"
          readonly={bloqueada}
          value={carta.voice_text ?? ''}
          on:change={(e) => mudar('voice_text', e.currentTarget.value)}
        />
      </label>
      <button
        disabled={ocupado || bloqueada || !navigator.onLine || carta.state === 'pendente'}
        on:click={refazerAudio}>Refazer áudio</button
      >
    </section>

    <button class="dokusho-editor__tirar" disabled={ocupado || bloqueada} on:click={tirar}>
      Tirar da fila
    </button>
  {/if}

  {#if mensagem}
    <p class="dokusho-editor__mensagem">{mensagem}</p>
  {/if}
</div>

<style lang="scss">
  .dokusho-editor {
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 0 10px;

      button {
        width: 40px;
        height: 40px;
        font-size: 26px;
      }

      b {
        flex: 1;
        font-size: 20px;
      }
    }
  }

  .dokusho-editor__campo {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 0;
    border-bottom: 1px solid #dce1de;

    span {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 700;
      color: #59635f;
    }

    small {
      font-weight: 500;
      padding: 2px 7px;
      border-radius: 99px;
      background: #edf0ee;
      color: #8c9591;
    }

    textarea {
      width: 100%;
      resize: vertical;
      border-radius: 10px;
      border: 1.5px solid #dce1de;
      padding: 9px 11px;
      font:
        16px/1.45 'Noto Sans JP',
        system-ui,
        sans-serif;

      &[readonly] {
        border-color: transparent;
        background: #edf0ee;
      }
    }
  }

  .dokusho-editor__aviso {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: #fbefd8;
    font-size: 14px;

    button {
      display: block;
      margin-top: 8px;
      font-weight: 700;
      padding: 6px 10px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.6);
    }
  }

  .dokusho-editor__aviso--erro {
    background: #f8e1dd;
    color: #b93a2e;
  }

  .dokusho-editor__audios {
    display: flex;
    gap: 10px;
    margin-top: 14px;

    button {
      flex: 1;
      min-height: 44px;
      border-radius: 12px;
      background: #e2e8f3;
      color: #2d4f86;
      font-weight: 700;

      &:disabled {
        opacity: 0.45;
      }
    }
  }

  .dokusho-editor__voz {
    margin-top: 18px;
    padding: 14px;
    border-radius: 14px;
    background: #fff;

    button {
      min-height: 44px;
      width: 100%;
      margin-top: 8px;
      border-radius: 12px;
      background: #2d4f86;
      color: #fff;
      font-weight: 700;

      &:disabled {
        opacity: 0.45;
      }
    }
  }

  .dokusho-editor__tirar {
    width: 100%;
    min-height: 44px;
    margin-top: 18px;
    border-radius: 12px;
    box-shadow: inset 0 0 0 1.5px #dce1de;
    font-weight: 700;
    color: #b93a2e;

    &:disabled {
      opacity: 0.45;
    }
  }

  .dokusho-editor__mensagem {
    margin-top: 12px;
    color: #b93a2e;
  }
</style>
