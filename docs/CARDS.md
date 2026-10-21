# Cards de Anki: formato

Fonte única do formato dos cards que o Dokusho exporta. Quando o formato mudar, muda aqui, uma vez só, e o app segue.

Histórico: veio do artefato "Cards de Anki: formato e gerador" (14/10/2026). Em 20/10/2026 o fluxo de cards pelas conversas do Claude (tarefa agendada de áudio, página de pedido, deck do RPG) foi abandonado e saiu deste documento; só o app gera cards. As decisões de 20/10 estão em `docs/ENTREVISTA.md` e `docs/adr/`.

## Regras que não mudam

- `MODEL_ID = 1760101001` e o nome do tipo de nota `Leituras (estilo Kaishi)`: é pelo ID que o Anki reconhece o tipo de nota, então a importação nunca mexe no tipo de nota do Kaishi.
- Prefixo de guid `leituras-igor`.
- **Deck: o que manda é o nome exato**, `日本語::1. Dokusho`. Na importação, o Anki casa o deck pelo nome, não pelo ID do arquivo (os IDs reais dos decks do Igor são outros). Um nome diferente cria um deck novo. O ID no arquivo é `1760101002`, só por consistência.
- Ordem dos decks no Anki: `1. Dokusho`, `2. Kaishi 1.5k`, `3. Old`, todos dentro de 日本語.

## Formato do card

O card é o mais parecido possível com o do Kaishi 1.5k. Os modelos de frente, verso e estilo são cópia dos do Kaishi (README de github.com/donkuri/Kaishi), com os mesmos 14 campos na mesma ordem: Word, Word Reading, Word Meaning, Word Furigana, Word Audio, Sentence, Sentence Meaning, Sentence Furigana, Sentence Audio, Notes, Pitch Accent, Pitch Accent Notes, Frequency, Picture.

- **Frente:** a palavra grande e, embaixo, a frase da leitura com a palavra em negrito azul.
- **Verso:** a palavra com furigana em cima, o significado, a frase com furigana, a tradução da frase e os dois áudios (palavra e frase).
- **Etiquetas:** `dokusho` e `dokusho::<título do livro>`, com os espaços do título trocados por `_` (o Anki não aceita espaço em etiqueta). O livro não aparece no card.
- **guid:** `guid_for("leituras-igor", palavra, leitura)`, a mesma função do genanki com dois valores. Duas Palavras com a mesma escrita e leituras diferentes (開く あく/ひらく) são notas diferentes (ADR 0006). As 14 notas antigas do deck usam o guid antigo, só pela palavra.

O que fica diferente do Kaishi: não há imagem nem pitch accent (os campos existem, mas ficam vazios), o áudio é sintético (Gemini TTS, voz Orus) e os significados são em português.

## Como preencher cada campo

Confira a leitura de cada kanji: furigana errado no card ensina errado, e um kanji lido errado pela voz também. Todos os campos ficam editáveis na carta antes da exportação.

| Campo                                     | Conteúdo                                                                                                                                   | Exemplo                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Word                                      | Forma de dicionário, escrita como no dicionário                                                                                            | `気のせい`                                                                    |
| Word Reading                              | Leitura em hiragana                                                                                                                        | `きのせい`                                                                    |
| Word Meaning                              | Significado em português, curto, no sentido da frase (Gemini)                                                                              | `impressão minha, coisa da cabeça`                                            |
| Word Furigana                             | Formato de furigana do Anki, kanji por kanji, como no Kaishi                                                                               | `気[き]のせい`, `最[さい] 初[しょ]`                                           |
| Word Audio                                | `[sound:<arquivo>.wav]`                                                                                                                    |                                                                               |
| Sentence                                  | A frase do livro, com a palavra entre `<b>` e `</b>` na forma em que está (se conjugada, o negrito cobre a forma conjugada)                | `最初は<b>気のせい</b>だと思って無視した。`                                   |
| Sentence Meaning                          | Tradução da frase em português (Gemini)                                                                                                    | `No começo achei que era impressão minha e ignorei.`                          |
| Sentence Furigana                         | A mesma frase com furigana em todos os kanji; um espaço antes de cada kanji que vem depois de kana, para o furigana ficar só sobre o kanji | `最[さい] 初[しょ]は<b>気[き]のせい</b>だと 思[おも]って 無[む] 視[し]した。` |
| Sentence Audio                            | `[sound:<arquivo>.wav]`                                                                                                                    |                                                                               |
| Notes                                     | Opcional; aparece no verso como "Note: ..."                                                                                                |                                                                               |
| Frequency                                 | Ranking do JPDB, só o número, como no Kaishi; vazio se não houver                                                                          | `319`                                                                         |
| Pitch Accent, Pitch Accent Notes, Picture | Vazios                                                                                                                                     |                                                                               |

## Áudio

- Gemini TTS, voz Orus, pela Edge Function `gemini`. Os nomes dos modelos ficam na configuração da função, com lista de reserva.
- O Gemini devolve PCM (24 kHz, 16 bits, mono); a função grava WAV (cabeçalho de 44 bytes) com o silêncio das pontas cortado. Sem conversão para MP3.
- Nome do arquivo: `leituras-<sha1("Orus|" + texto)[:12]>.wav`, o que evita colisão com a mídia do Kaishi. `texto` é o que a voz recebeu: na palavra pela dica, `palavra（leitura）`; na palavra pela kana, a leitura; na frase, a frase sem HTML ou o "Texto para a voz".
- Voz da palavra, em cadeia (R5): (1) **dica**: a voz lê a palavra escrita (`辛い`) com a leitura como dica fora do texto falado (anotação de estilo da API Interactions), o que dá o acento da palavra; (2) a **conferência**: o modelo de texto ouve o áudio e escreve em hiragana o que ouviu; se bate com a leitura, fica; (3) senão, **kana**: a voz lê só a leitura (`つらい`), com nova conferência; (4) se nem a kana bate, fica a kana com a marca **confira** (`word_audio_check`), que a fila mostra. Instrução junto do texto falado não serve (o TTS a lê em voz alta), e o kanji sozinho às vezes sai lido em chinês. A voz da frase lê a frase sem HTML. Quando a voz ainda erra (大家さん lido たいか), o campo "Texto para a voz" da carta recebe o trecho em kana (`おおやさんはすぐに濃いコーヒーを作ってくれた。`) e "Refazer áudio" gera de novo.

## Modelo do tipo de nota

Para o port em TypeScript e para o script de comparação em Python (`tools/`, com genanki), estes são os valores exatos.

```python
MODEL_ID = 1760101001
MODEL_NAME = "Leituras (estilo Kaishi)"
DECK = {"id": 1760101002, "nome": "日本語::1. Dokusho", "guid": "leituras-igor", "tag": "dokusho"}

CAMPOS = ["Word", "Word Reading", "Word Meaning", "Word Furigana", "Word Audio",
          "Sentence", "Sentence Meaning", "Sentence Furigana", "Sentence Audio",
          "Notes", "Pitch Accent", "Pitch Accent Notes", "Frequency", "Picture"]

# guid de cada nota
# genanki.guid_for(DECK["guid"], palavra, leitura)

FRENTE = """<div lang="ja">
{{Word}}
<div style='font-size: 20px;'>{{Sentence}}</div>
</div>"""

VERSO = """<div lang="ja">
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

</div>"""

ESTILO = """.card {
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
"""

# genanki.Model(MODEL_ID, MODEL_NAME, fields=[{"name": c} for c in CAMPOS],
#               templates=[{"name": "Card 1", "qfmt": FRENTE, "afmt": VERSO}], css=ESTILO)
```
