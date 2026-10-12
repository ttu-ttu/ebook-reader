# Distilled difficulty model

`../difficulty_model_jiten_distilled.onnx` is Jiten's difficulty model retrained on
jiten.moe's own scores, so local estimates land on jiten.moe's scale. The live site
scores books with a private hosted model; the `.onnx` in Jiten's repository is the
older model and is not used there.

Inputs: the 55 features of `../features.py`, with word frequencies from Jiten's
Yomitan frequency list (`../frequency.py`), plus log characters and log unique kanji.
Target: jiten.moe's `difficultyAlgorithmic` (before reader votes).

Result (2026-10-11, 3,253 books of the library that are on jiten.moe, 5-fold
cross-validation grouped by series):

| | r | mean abs. error | bias |
|---|---|---|---|
| Jiten's original model (library frequencies) | 0.63 | 0.77 | -0.73 |
| distilled, library frequency table | 0.89 | 0.22 | -0.02 |
| distilled, Jiten's frequency list (in use) | 0.88 | 0.23 | -0.03 |

Half the books are within 0.18 of jiten.moe, 90% within 0.49.

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
   prints the comparison and writes `difficulty_model_jiten_distilled.onnx`.

Bump `MODEL_VERSION` in `../service.py` with a new model, so whole-library runs redo the
estimates.
