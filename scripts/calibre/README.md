# Server side

Everything that runs next to the static app: the nginx configuration, the
catalog builder and the Python services. With Docker (the usual way) they run
from `docker-compose.yml`, see [docs/INSTALL.md](../../docs/INSTALL.md); every
setting is in [docs/CONFIGURATION.md](../../docs/CONFIGURATION.md).

| Path | What it is |
| ---- | ---------- |
| `nginx-ebook-reader.conf.template`, `render-nginx.sh` | The site: app, Calibre files, WebDAV sync folders, access checks (`auth_request`). `render-nginx.sh` fills in paths and service addresses when the web container starts. |
| `build-catalog.py` | Builds `catalog.json` from a copy of Calibre's `metadata.db`: best format per book, manga archives, tags, rating, publisher, series (Calibre's or inferred from volume numbers), unique titles, and `cover.jpg` extracted from EPUBs without a Calibre cover. Runs as the library owner. |
| `account/` | Accounts, sessions, admins and permissions, and the `auth_request` answers for every protected location (Python standard library; security notes at the top of `service.py`). `ebook-account` is its command line. |
| `import/` | Queue that adds uploaded books to Calibre with `calibredb add`, one at a time, then rebuilds the catalog. The only writer of `metadata.db`. |
| `jiten/` | Difficulty estimates with [Jiten](https://github.com/Sirush/Jiten)'s features (Apache-2.0, see `jiten/LICENSE`): `deconjugator.json` is Jiten's; `features.py` and `deconjugator.py` port its feature extraction to Python with Sudachi; `difficulty_model_jiten_distilled.onnx` is retrained on jiten.moe's scores (`jiten/distil/`). Needs Jiten's frequency list (`jiten_freq_global.zip`) as `frequency-dictionary.zip` in its state folder. Runs only when started (admin panel → Tools, or for books selected in the library). |
| `assign-series.py` | Writes inferred series into Calibre itself (dry run unless `--apply`; run with `calibre-debug -e`, command in the docstring). |
| `tests/` | `python3 -m unittest discover -s scripts/calibre/tests` from the repository root (standard library only). |

The AI features (Ask AI, Story so far, Lorebook, AI voice) call OpenRouter and
ElevenLabs directly from the browser, with keys each reader enters in
Settings → AI; nothing on the server is involved.

## Who may do what

nginx asks the account service before serving anything but the app itself:

- **Read** the library, catalog and shared sync folder: an account, a trusted
  network (`TRUSTED_NETWORKS`), or anyone with `PUBLIC_READS=1`.
- **Write** the shared sync folder (opening a book for the first time uploads it
  processed): an account, or a signed-out reader from a trusted network.
- **Add books to Calibre, change series for everyone, start difficulty jobs**:
  admins, or accounts with the `import`, `series` or `difficulty` permission
  (Settings → Account → User permissions, or `ebook-account permissions NAME …`).
- **Own reading data** (`/account/sync/`): only that account.

Signing in needs HTTPS unless `ALLOW_HTTP_ACCOUNTS=1`. There is no sign-up:
admins add accounts in Settings → Account, or with
`ebook-account add NAME [--admin]` (asks for a password of at least 8
characters); create the first admin on the server.
