#!/usr/bin/env python3
"""On-demand difficulty estimates for the Calibre library, with Jiten's features and a
model of our own, chimi-difficulty, trained on jiten.moe's scores (distil/). Word frequencies come from Jiten's
Yomitan frequency list (FREQUENCY_DICTIONARY).

Nothing runs until asked: the reader (or the CLI) requests difficulty for chosen books.

HTTP API (bound to localhost, proxied by nginx at /calibre/difficulty/api/):
  GET  status                       progress of the current job
  GET  kanji/ID                     kanji counts of an estimated book (for each reader's own kanji coverage)
  POST compute    {"ids": [...]}    estimate difficulty for these books ({"all": true} for all without a current estimate)
  POST cancel                       stop the running job
  POST dictionary   body: the zip    install Jiten's frequency list (jiten_freq_global.zip)
Results are written to RESULTS_PATH, which nginx serves as /calibre/difficulty.json.

CLI: service.py serve | compute ID...
"""
import gzip
import hmac
import json
import os
import shutil
import sys
import zipfile
import threading
import time
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))

LIBRARY = os.environ.get('CALIBRE_LIBRARY', '/library')
# Unpacked visual novels (catalog format 'VN'; their 'file' is relative to it).
VN_DIR = os.environ.get('VN_DIR', '/vn')
CATALOG_PATH = os.environ.get('CALIBRE_CATALOG', '/data/state/catalog/catalog.json')
STATE_DIR = os.environ.get('JITEN_STATE_DIR', '/data/state/difficulty')
# Rank-based Yomitan frequency dictionary: Jiten's list (jiten.moe/frequency-dictionaries).
FREQUENCY_DICTIONARY = os.environ.get('JITEN_FREQUENCY_DICTIONARY',
                                      os.path.join(STATE_DIR, 'frequency-dictionary.zip'))
RESULTS_PATH = os.path.join(STATE_DIR, 'difficulty.json')
MAX_DICTIONARY_BYTES = 64 * 1024 * 1024
# chimi-difficulty, trained on jiten.moe's own scores (distil/, README there): their scale directly,
# adjustment included, from Jiten's 55 features plus EXTRA_FEATURES. The -low/-high models
# are its 10th and 90th percentiles, shown as a range.
MODEL_DIR = os.path.dirname(os.path.realpath(__file__))
MODEL_PATHS = {name: os.path.join(MODEL_DIR, f'chimi-difficulty{suffix}.onnx')
               for name, suffix in (('difficulty', ''), ('low', '-low'), ('high', '-high'))}
# Added to both sides of the range so it holds 80% of books (written by distil/train.py).
with open(os.path.join(MODEL_DIR, 'chimi-difficulty-range.json'), encoding='utf-8') as _f:
    RANGE_WIDEN = json.load(_f)['widen']
# Stored with each estimate; whole-library runs redo estimates made by another model.
MODEL_VERSION = 'chimi-difficulty-1'
# Per-book kanji counts, gzipped JSON, for the reader's own coverage.
KANJI_DIR = os.path.join(STATE_DIR, 'kanji')
WORKERS = int(os.environ.get('JITEN_WORKERS', os.cpu_count() or 1))
PORT = int(os.environ.get('JITEN_PORT', '8765'))
HOST = os.environ.get('JITEN_HOST', '127.0.0.1')
# Made by the web container; nginx sends it as X-Internal-Token, so only nginx can call this service.
INTERNAL_TOKEN_FILE = os.environ.get('INTERNAL_TOKEN_FILE', '/data/state/internal-token')
ALLOW_HTTP = os.environ.get('ALLOW_HTTP_ACCOUNTS') == '1'
# Worker processes are replaced after this many books to bound their memory.
BOOKS_PER_POOL = 300


# ---------------------------------------------------------------------------
# Worker processes (one Sudachi tokenizer each)

_analyzer = None
_frequency = None
_sessions = None


def _init_worker():
    global _analyzer, _frequency, _sessions
    import warnings
    warnings.filterwarnings('ignore')
    import onnxruntime
    from features import Analyzer
    from frequency import FrequencyTable
    _analyzer = Analyzer()
    _frequency = FrequencyTable.load(FREQUENCY_DICTIONARY)
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    _sessions = {name: onnxruntime.InferenceSession(path, options) for name, path in MODEL_PATHS.items()}


def save_kanji(book_id: int, text: str):
    from collections import Counter
    from features import is_kanji
    os.makedirs(KANJI_DIR, exist_ok=True)
    path = os.path.join(KANJI_DIR, f'{book_id}.json.gz')
    with gzip.open(path + '.tmp', 'wt', encoding='utf-8') as f:
        json.dump(dict(Counter(c for c in text if is_kanji(c))), f, ensure_ascii=False, separators=(',', ':'))
    os.replace(path + '.tmp', path)


def _estimate(book: dict):
    import numpy
    from features import (EXTRA_FEATURES, FEATURE_ORDER, TOKEN_CLEAN, book_text, compute_extra_features,
                          compute_features, is_kanji, vn_text, words_for_coverage)
    ruby = {}
    if book.get('vn'):
        text = vn_text(os.path.join(VN_DIR if book['format'] == 'VN' else LIBRARY, book['file']), ruby)
    else:
        text = book_text(os.path.join(LIBRARY, book['file']), book['format'], ruby)
    characters = len(TOKEN_CLEAN.sub('', text))
    if characters < 1000:
        return book['id'], None
    analysis = _analyzer.analyse(text)
    features = compute_features(analysis, _frequency)
    extra = compute_extra_features(analysis, _frequency, ruby)
    row = numpy.array([[features[name] for name in FEATURE_ORDER] + [extra[name] for name in EXTRA_FEATURES]],
                      dtype=numpy.float32)
    scores = {name: round(min(max(float(session.run(None, {'float_input': row})[0][0][0]), 0.0), 5.0), 2)
              for name, session in _sessions.items()}
    save_kanji(book['id'], text)
    # 'adjusted' is kept for older readers; the model includes jiten.moe's adjustment.
    return book['id'], {
        'difficulty': scores['difficulty'],
        'adjusted': scores['difficulty'],
        'low': round(max(min(scores['low'], scores['difficulty']) - RANGE_WIDEN, 0.0), 2),
        'high': round(min(max(scores['high'], scores['difficulty']) + RANGE_WIDEN, 5.0), 2),
        'words95': words_for_coverage(extra) if extra['CoverageRank95'] == extra['CoverageRank95'] else None,
        'model': MODEL_VERSION,
        'characters': characters,
        'uniqueKanji': len({c for c in text if is_kanji(c)}),
        'computedAt': int(time.time() * 1000),
    }


# ---------------------------------------------------------------------------
# Jobs

def run_in_pools(books, task, cancel: threading.Event):
    """Yields (book, result or exception), using fresh worker pools per chunk.
    Books lost when a worker process dies (e.g. out of memory) are retried one at a
    time, so only a book that kills a worker on its own is reported as failed."""
    for start in range(0, len(books), BOOKS_PER_POOL):
        lost = []
        yield from _run_pool(books[start:start + BOOKS_PER_POOL], task, cancel, WORKERS, lost)
        for book in lost:
            if cancel.is_set():
                return
            lost_again = []
            yield from _run_pool([book], task, cancel, 1, lost_again)
            if lost_again:
                yield book, RuntimeError('the worker process died on this book (out of memory?)')
        if cancel.is_set():
            return


def _run_pool(books, task, cancel: threading.Event, workers: int, lost: list):
    """Yields results of one pool; books whose worker died are added to `lost`."""
    with ProcessPoolExecutor(workers, initializer=_init_worker) as pool:
        futures = [pool.submit(task, book) for book in books]
        for book, future in zip(books, futures):
            if cancel.is_set():
                for f in futures:
                    f.cancel()
                return
            try:
                yield book, future.result()
            except BrokenProcessPool:
                lost.append(book)
            except Exception as error:
                yield book, error


def load_catalog():
    with open(CATALOG_PATH, encoding='utf-8') as f:
        # Manga (CBZ/ZIP) has no text to score; visual novels have their scripts.
        return [b for b in json.load(f)['books'] if b['format'] in ('EPUB', 'HTMLZ', 'TXT') or b.get('vn')]


def load_results():
    try:
        with open(RESULTS_PATH, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'books': {}}


def save_results(results):
    tmp = RESULTS_PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(results, f, separators=(',', ':'))
    os.replace(tmp, RESULTS_PATH)



class JobRunner:
    def __init__(self):
        self.lock = threading.Lock()
        self.job = None  # {'type', 'done', 'total', 'started', 'error'}
        self.cancel = threading.Event()

    def status(self):
        with self.lock:
            job = dict(self.job) if self.job else None
        results = load_results()
        return {
            'job': job,
            'dictionary': os.path.exists(FREQUENCY_DICTIONARY),
            'results': len(results.get('books', {})),
            'noText': len(results.get('noText', [])),
            'failed': len(results.get('failed', {})),
            'workers': WORKERS,
        }

    def start(self, job_type: str, target, *args):
        with self.lock:
            if self.job and not self.job.get('finished'):
                raise RuntimeError('Another job is running')
            self.cancel.clear()
            self.job = {'type': job_type, 'done': 0, 'total': 0, 'started': int(time.time() * 1000)}
        threading.Thread(target=self._run, args=(target, args), daemon=True).start()

    def _run(self, target, args):
        try:
            target(*args)
        except Exception as error:  # reported through status
            with self.lock:
                self.job['error'] = str(error)
        with self.lock:
            self.job['finished'] = int(time.time() * 1000)
            self.job['cancelled'] = self.cancel.is_set()

    def _progress(self, done=None, total=None):
        with self.lock:
            if done is not None:
                self.job['done'] = done
            if total is not None:
                self.job['total'] = total

    def compute(self, ids):
        if not os.path.exists(FREQUENCY_DICTIONARY):
            raise RuntimeError(f'Frequency dictionary missing: {FREQUENCY_DICTIONARY}')
        catalog = load_catalog()
        results = load_results()
        wanted = set(ids or ())
        # Books with too little text (image-only manga and scans) can't be estimated, and
        # failed ones are broken files (not a zip, no container.xml), retried once the file changes.
        no_text = set(results.get('noText', []))
        failed = results.setdefault('failed', {})
        # All books: only those not tried yet or estimated by another model, or whose file changed since it failed.
        # Selected books are always recomputed.
        books = [b for b in catalog if results['books'].get(str(b['id']), {}).get('model') != MODEL_VERSION
                 and b['id'] not in no_text
                 and failed.get(str(b['id']), {}).get('size') != b['size']] \
            if ids is None else [b for b in catalog if b['id'] in wanted]
        self._progress(0, len(books))
        last_save = time.monotonic()
        done = 0
        for book, result in run_in_pools(books, _estimate, self.cancel):
            if isinstance(result, Exception):
                print(f"compute: {book['file']}: {result}", file=sys.stderr)
                failed[str(book['id'])] = {'error': str(result)[:200], 'size': book['size']}
            elif result[1]:
                results['books'][str(result[0])] = result[1]
                no_text.discard(result[0])
                failed.pop(str(result[0]), None)
            else:
                no_text.add(result[0])
                failed.pop(str(result[0]), None)
            results['noText'] = sorted(no_text)
            done += 1
            self._progress(done)
            if time.monotonic() - last_save > 10:
                save_results(results)
                last_save = time.monotonic()
        save_results(results)


runner = JobRunner()


def install_dictionary(source, length: int) -> int:
    """Checks an uploaded rank-based Yomitan frequency list and makes it the one in use
    (from the next job on); returns its number of terms."""
    from frequency import load_yomitan_ranks

    if not 0 < length <= MAX_DICTIONARY_BYTES:
        raise ValueError('The file is empty or too large')
    if runner.job and not runner.job.get('finished'):
        raise RuntimeError('Wait until the running job has finished')
    upload = FREQUENCY_DICTIONARY + '.upload'
    try:
        with open(upload, 'wb') as f:
            # Read exactly length: nginx keeps the connection open, so there is no EOF to wait for.
            remaining = length
            while remaining and (chunk := source.read(min(remaining, 1 << 20))):
                f.write(chunk)
                remaining -= len(chunk)
        if os.path.getsize(upload) != length:
            raise ValueError('Upload incomplete')
        try:
            terms = len(load_yomitan_ranks(upload))
        except (zipfile.BadZipFile, KeyError, ValueError, TypeError, AttributeError) as error:
            raise ValueError("Not Jiten's frequency list (a rank-based Yomitan dictionary zip)") from error
        if not terms:
            raise ValueError('The frequency list has no words')
        os.replace(upload, FREQUENCY_DICTIONARY)
        return terms
    finally:
        if os.path.exists(upload):
            os.remove(upload)


def from_nginx(headers) -> bool:
    """Whether the request carries nginx's internal token (none configured: refuse everything)."""
    try:
        with open(INTERNAL_TOKEN_FILE, encoding='ascii') as f:
            token = f.read().strip()
    except OSError:
        return False
    return bool(token) and hmac.compare_digest(token, headers.get('X-Internal-Token', ''))


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def _action(self):
        return self.path.rstrip('/').rsplit('/', 1)[-1]

    def do_GET(self):
        if not from_nginx(self.headers):
            return self._send(403, {'error': 'Only nginx may call this service'})
        parts = self.path.split('?')[0].strip('/').split('/')
        if parts == ['status']:
            self._send(200, runner.status())
        elif len(parts) == 2 and parts[0] == 'kanji' and parts[1].lstrip('-').isdigit():
            try:
                with open(os.path.join(KANJI_DIR, f'{int(parts[1])}.json.gz'), 'rb') as f:
                    data = f.read()
            except OSError:
                return self._send(404, {'error': 'no estimate for this book'})
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(data)
        else:
            self._send(404, {'error': 'not found'})

    def do_POST(self):
        if not from_nginx(self.headers):
            return self._send(403, {'error': 'Only nginx may call this service'})
        # nginx checks the account; this stops other sites from posting with its cookie.
        scheme = 'http' if ALLOW_HTTP and self.headers.get('X-Forwarded-Proto') == 'http' else 'https'
        if self.headers.get('Origin') != f"{scheme}://{self.headers.get('Host', '')}":
            return self._send(403, {'error': 'Request from another site'})
        if self._action() == 'dictionary':
            try:
                terms = install_dictionary(self.rfile, int(self.headers.get('Content-Length') or 0))
            except RuntimeError as error:
                return self._send(409, {'error': str(error)})
            except ValueError as error:
                return self._send(400, {'error': str(error)})
            return self._send(200, {**runner.status(), 'terms': terms})
        try:
            length = max(int(self.headers.get('Content-Length') or 0), 0)
            body = json.loads(self.rfile.read(length) or b'{}')
        except ValueError:
            return self._send(400, {'error': 'invalid JSON'})
        action = self._action()
        try:
            if action == 'compute':
                ids = None if body.get('all') else [int(i) for i in body.get('ids', [])]
                if ids is not None and not ids:
                    return self._send(400, {'error': 'no books given'})
                runner.start('compute', runner.compute, ids)
            elif action == 'cancel':
                runner.cancel.set()
            else:
                return self._send(404, {'error': 'not found'})
        except RuntimeError as error:
            return self._send(409, {'error': str(error)})
        except (AttributeError, TypeError, ValueError):
            return self._send(400, {'error': 'invalid request'})
        self._send(202, runner.status())

    def log_message(self, *args):
        pass


def main(argv):
    os.makedirs(STATE_DIR, exist_ok=True)
    command = argv[1] if len(argv) > 1 else 'serve'
    if command == 'serve':
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    elif command == 'compute':
        runner.job = {'type': 'compute'}
        runner.compute([int(i) for i in argv[2:]] or None)
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main(sys.argv)
