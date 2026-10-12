# Distilled difficulty model

`../difficulty_model_jiten_distilled.onnx` is Jiten's difficulty model retrained on
jiten.moe's own scores, so local estimates land on jiten.moe's scale. The live site
scores books with a private hosted model; the `.onnx` in Jiten's repository is the
older model and is not used there.

Inputs: the 55 features of `../features.py`, with word frequencies from Jiten's
Yomitan frequency list (`../frequency.py`), plus `EXTRA_FEATURES`, which are not Jiten's:

| Input | What it measures | Source |
|---|---|---|
| `LogCharacters`, `LogUniqueKanji` | length, kanji range | |
| `CoverageRank90/95/98` | how many of the most common words cover 90/95/98% of the book's words (log) | known-word thresholds: 95-96% for Japanese learners (小森・三國・近藤 2004), 95/98% (Laufer & Ravenhorst-Kalovski 2010) |
| `Mattr` | moving-average type/token ratio, 500 words | Covington & McFall 2010 (plain TTR mostly measures length) |
| `LineSentenceLength` | characters per sentence, line breaks ending sentences | light novels' lines often lack 。 |
| `PredicatesPerSentence`, `HiraganaRatio` | clause load, hiragana share | 柴崎・原 2010 (12-grade readability formula) |
| `RelativeClausesPerSentence` | a verb or auxiliary in 連体形 right before a noun (昨日買った本) | Japanese relative clauses have no marker word |
| `NonJoyoKanjiShare`, `UpperJoyoKanjiShare` | kanji outside 常用, and 常用 above 教育漢字 | `../kanji-grades.json` (KANJIDIC2) |
| `RubyKanjiShare`, `RubyKatakanaShare` | kanji under furigana (総ルビ = children's books), katakana readings (本気→マジ) | measured before the furigana is removed |

Jiten's own features got two fixes as well: word origins (和語/漢語/外来語, for the
jReadability score) come from UniDic (`../goshu.json.gz`) instead of guessing from the
script (手紙 and 仕事 are wago, 場所 mixed), and homographs are looked up by reading
(事: こと is common, じ rare). Tables of contents, colophons and ads are left out of
the text. `make_tables.py` builds both tables (needs fugashi and unidic-lite).

Target: jiten.moe's `difficultyAlgorithmic` (before reader votes). The `_low`/`_high`
models are its 10th and 90th percentiles; quantile boosting is overconfident on unseen
books (62% inside), so the service widens both sides by `difficulty_model_range.json`
(conformalized quantile regression, Romano et al. 2019), which brings it to 80%.

Result (2026-10-11, 3,253 books of the library that are on jiten.moe, 5-fold
cross-validation grouped by series):

| | r | mean abs. error | RMSE | bias |
|---|---|---|---|---|
| Jiten's original model (library frequencies) | 0.63 | 0.77 | | -0.73 |
| Jiten's features + length, unique kanji (previous) | 0.88 | 0.23 | 0.30 | -0.03 |
| plus `EXTRA_FEATURES` (in use) | 0.90 | 0.22 | 0.28 | -0.02 |

Half the books are within 0.17 of jiten.moe, 90% within 0.46. The range is 0.74 wide on
average. The gain is small because jiten.moe's score itself barely uses these signals
(unique kanji and the spread of word frequencies carry most of it): the model can only
copy jiten.moe more closely. `validate_speed.py` checks estimates against how fast
readers actually read, once statistics cover enough books.

## Rebuilding

Run from one working folder (the scripts use relative paths). Jiten allows its public
API for personal projects and small-scale research, not bulk downloading
(https://jiten.moe/guides/api-and-scraping): fetch only what the library needs, slowly.

1. `curl -o jiten-data/novels.json https://api.jiten.moe/api/media-deck/get-media-decks-by-type/4`
   (all novel works, one request) and `jiten-data/catalog.json` from `/calibre/catalog.json`.
2. `python3 match.py`: works whose title or series matches the library.
3. `python3 fetch.py`: volume scores of matched series, at most 75 requests a minute
   (anonymous limit 120), resumable, stops after 5 errors in a row.
4. `python3 labels.py`: pairs books with scores (`books.json`, `labels.json`).
5. Where the library is readable and `jiten/requirements.txt` is installed (the
   `difficulty` image has it in `/opt/venv`), with `jiten/` (this folder's parent),
   `books.json`, `labels.json` and `frequency-dictionary.zip` (Jiten's list) next to
   `extract.py`: `CALIBRE_LIBRARY=<library> python extract.py 4` (about 135 books a
   minute on 5 cores).
6. `train.py` with scikit-learn and skl2onnx (a separate venv, e.g. `/opt/jiten-train`):
   prints the comparison and writes the three `difficulty_model_jiten_distilled*.onnx`
   and `difficulty_model_range.json`; copy them to `..`.

Bump `MODEL_VERSION` in `../service.py` with a new model, so whole-library runs redo the
estimates.
