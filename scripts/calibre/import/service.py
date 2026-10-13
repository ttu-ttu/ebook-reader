#!/usr/bin/env python3
"""Import queue: adds uploaded books to the Calibre library, one at a time.

Runs as the library owner (the import container) on port 8767 behind nginx at
/calibre/import/api/. nginx only passes requests from accounts with the import
permission (auth_request to the account service) and sets X-Account-Id.
This is the only writer of metadata.db, so uploads from several readers are
queued and added by a single worker with `calibredb add`, then the catalog is
rebuilt so the books show up in the library.

  POST add?name=<file name>   body: the file   -> {"job": {...}}
  GET  jobs?ids=a,b                            -> {"jobs": [...]} (own jobs only)
  POST series   {"apply": bool}                -> assign-series.py's plan (admins
       only: X-Account-Admin from the auth response): books without a series put into series, duplicate
       series merged; with apply, metadata.db is backed up, written and the
       catalog rebuilt
  POST catalog                                 -> {"books": n} after a full catalog
       rebuild (admins only)

A ZIP holding an ONScripter game (a script such as 0.txt or nscript.dat) is not
added to Calibre: the worker unpacks its game folder into VN_DIR, named after the
uploaded file, where the catalog lists it as a visual novel.

Job states: queued, adding, added (calibreId, title), duplicate, failed (error).
Standard library only. Not part of upstream.
"""
import fcntl
import hmac
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

LIBRARY = os.environ.get('CALIBRE_LIBRARY', '/library')
STATE_DIR = os.environ.get('IMPORT_STATE_DIR', '/data/state/import')
CALIBREDB = os.environ.get('CALIBREDB', 'calibredb')
CATALOG_BUILDER = os.environ.get('CATALOG_BUILDER', '/usr/local/bin/build-calibre-catalog')
CATALOG_OUTPUT = os.environ.get('CATALOG_OUTPUT', '/data/state/catalog/catalog.json')
# Shared with assign-series.py, so only one of them writes metadata.db at a time.
WRITE_LOCK = os.path.join(STATE_DIR, 'calibre-write.lock')
PORT = int(os.environ.get('IMPORT_PORT', '8767'))
HOST = os.environ.get('IMPORT_HOST', '127.0.0.1')
# Same switch as the account service: uploads from plain-HTTP pages too.
ALLOW_HTTP = os.environ.get('ALLOW_HTTP_ACCOUNTS') == '1'
# Made by the web container; nginx sends it as X-Internal-Token, so only nginx can call this service.
INTERNAL_TOKEN_FILE = os.environ.get('INTERNAL_TOKEN_FILE', '/data/state/internal-token')

FORMATS = ('epub', 'htmlz', 'txt', 'cbz', 'zip')
# Manga: queued as .cbz, since Calibre would unpack a .zip looking for a book inside.
MANGA_FORMATS = ('cbz', 'zip')
PAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')
MAX_BYTES = 300 * 1024 * 1024
# Games are much larger than books; ZIP uploads may be this large if they hold one.
MAX_VN_BYTES = 8 * 1024 * 1024 * 1024
VN_DIR = os.environ.get('VN_DIR', '/vn')
# ONScripter scripts, as in build-catalog.py and lib/data/vn.ts.
VN_SCRIPTS = ('0.txt', '00.txt', 'nscr_sec.dat', 'nscript.___', 'nscript.dat', 'onscript.nt2', 'onscript.nt3')
# Kept free when unpacking a game.
MIN_FREE_BYTES = int(os.environ.get('MIN_FREE_MB', '1024')) * 1024 * 1024
MAX_PENDING_PER_ACCOUNT = 100
# Finished jobs are kept this long so the uploader can read the outcome.
KEEP_FINISHED_SECONDS = 7 * 24 * 3600
ADD_TIMEOUT_SECONDS = 600
CALIBRE_DEBUG = os.environ.get('CALIBRE_DEBUG', 'calibre-debug')
ASSIGN_SERIES = os.environ.get('ASSIGN_SERIES', '/app/assign-series.py')
series_busy = threading.Lock()
catalog_busy = threading.Lock()

lock = threading.Lock()
work = threading.Condition(lock)
jobs: dict[str, dict] = {}


def from_nginx(headers) -> bool:
    """Whether the request carries nginx's internal token (none configured: refuse everything)."""
    try:
        with open(INTERNAL_TOKEN_FILE, encoding='ascii') as f:
            token = f.read().strip()
    except OSError:
        return False
    return bool(token) and hmac.compare_digest(token, headers.get('X-Internal-Token', ''))


def queue_dir():
    return os.path.join(STATE_DIR, 'queue')


def jobs_path():
    return os.path.join(STATE_DIR, 'jobs.json')


def save_jobs():
    """Caller holds `lock`."""
    now = time.time()
    for job_id in [i for i, j in jobs.items()
                   if j['state'] in ('added', 'duplicate', 'failed') and now - j['updated'] > KEEP_FINISHED_SECONDS]:
        del jobs[job_id]
    tmp = jobs_path() + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    os.replace(tmp, jobs_path())


def load_jobs():
    try:
        with open(jobs_path(), encoding='utf-8') as f:
            jobs.update(json.load(f))
    except (OSError, ValueError):
        pass
    # A job interrupted by a restart is retried.
    for job in jobs.values():
        if job['state'] == 'adding':
            job['state'] = 'queued'


def clean_name(name: str) -> str:
    """File name without directories or control characters, keeping its extension."""
    name = os.path.basename(name.replace('\\', '/'))
    name = re.sub(r'[\x00-\x1f\x7f]', '', name).strip()
    return name[-200:]


def check_book(path: str, ext: str) -> str:
    """Why the file isn't a usable book, or '' if it is."""
    if os.path.getsize(path) == 0:
        return 'The file is empty'
    if ext in ('epub', 'htmlz', 'cbz'):
        if not zipfile.is_zipfile(path):
            return f'Not a valid {ext.upper()} file'
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
        if ext == 'epub' and 'META-INF/container.xml' not in names:
            return 'Not a valid EPUB file (no META-INF/container.xml)'
        if ext == 'cbz' and not any(n.lower().endswith(PAGE_EXTENSIONS) for n in names):
            return 'Not a manga archive (no images)'
        return ''
    with open(path, 'rb') as f:
        if b'\x00' in f.read(65536):
            return 'Not a text file'
    return ''


def zip_name(info: zipfile.ZipInfo) -> str:
    """A member's path. Japanese archives often hold Shift JIS names without the UTF-8
    flag, which zipfile reads as code page 437."""
    name = info.filename
    if not info.flag_bits & 0x800:
        for encoding in ('utf-8', 'cp932'):
            try:
                name = info.filename.encode('cp437').decode(encoding)
                break
            except UnicodeError:
                pass
    return name.replace('\\', '/')


def vn_root(names: list[str]) -> str | None:
    """The folder holding a game's script ('' or 'Game/'), the shallowest if several."""
    roots = sorted((name[:name.rfind('/') + 1] for name in names
                    if name.rsplit('/', 1)[-1].lower() in VN_SCRIPTS and '__MACOSX/' not in name),
                   key=lambda root: root.count('/'))
    return roots[0] if roots else None


def is_vn_zip(path: str) -> bool:
    try:
        with zipfile.ZipFile(path) as archive:
            return vn_root([zip_name(info) for info in archive.infolist()]) is not None
    except (OSError, zipfile.BadZipFile):
        return False


def vn_title(name: str) -> str:
    """The game's folder name: the uploaded file's name without .zip/.cbz."""
    title = re.sub(r'\.(?:zip|cbz)$', '', name, flags=re.I).strip().lstrip('.')
    return re.sub(r'[/\\:*?"<>|]', '_', title)[:150] or 'game'


def add_vn(job: dict) -> dict:
    """Unpacks a game's folder from a queued ZIP into VN_DIR/<title>."""
    path = os.path.join(queue_dir(), job['file'])
    title = vn_title(job['name'])
    target = os.path.join(VN_DIR, title)
    if os.path.exists(target):
        return {'state': 'duplicate', 'error': 'Already in the visual novel folder'}
    tmp = os.path.join(VN_DIR, f".importing-{job['id']}")
    try:
        with zipfile.ZipFile(path) as archive:
            members = [(zip_name(info), info) for info in archive.infolist() if not info.is_dir()]
            root = vn_root([name for name, _ in members])
            if root is None:
                return {'state': 'failed', 'error': 'No ONScripter game in this ZIP'}
            files = []
            for name, info in members:
                parts = name[len(root):].split('/')
                # Only the game folder; nothing outside it, no macOS metadata.
                if (not name.startswith(root) or '__MACOSX/' in name or parts[-1].startswith('._')
                        or any(part in ('', '.', '..') for part in parts)):
                    continue
                files.append((parts, info))
            needed = sum(info.file_size for _, info in files)
            if needed > shutil.disk_usage(VN_DIR).free - MIN_FREE_BYTES:
                return {'state': 'failed', 'error': 'Not enough free space for this game'}
            for parts, info in files:
                dest = os.path.join(tmp, *parts)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with archive.open(info) as source, open(dest, 'wb') as out:
                    shutil.copyfileobj(source, out, 1 << 20)
        os.rename(tmp, target)
    except (OSError, zipfile.BadZipFile, RuntimeError) as error:
        print(f"unpack {job['name']}: {error}", file=sys.stderr)
        return {'state': 'failed', 'error': 'Could not unpack this game'}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return {'state': 'added', 'title': title}


def parse_added_ids(output: str) -> list[int]:
    """Book ids from `calibredb add` output ("Added book ids: 12, 13")."""
    match = re.search(r'Added book ids?:\s*([\d,\s]+)', output)
    return [int(i) for i in re.findall(r'\d+', match.group(1))] if match else []


def book_title(book_id: int) -> str:
    result = subprocess.run(
        [CALIBREDB, '--library-path', LIBRARY, 'list', '--search', f'id:{book_id}',
         '--fields', 'title', '--for-machine'],
        capture_output=True, text=True, timeout=120, check=False)
    try:
        return json.loads(result.stdout)[0]['title']
    except (ValueError, IndexError, KeyError, TypeError):
        return ''


def add_book(job: dict) -> dict:
    """Runs calibredb add for one queued file; returns the fields to update."""
    path = os.path.join(queue_dir(), job['file'])
    command = [CALIBREDB, '--library-path', LIBRARY, 'add', path]
    if path.endswith('.cbz'):  # Comics rarely carry metadata; the queued name is a job id.
        command += ['--title', job['name'].rsplit('.', 1)[0]]
    with open(WRITE_LOCK, 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        result = subprocess.run(
            command,
            capture_output=True, text=True, timeout=ADD_TIMEOUT_SECONDS, check=False)
    output = f'{result.stdout}\n{result.stderr}'
    ids = parse_added_ids(output)
    if ids:
        return {'state': 'added', 'calibreId': ids[0], 'title': book_title(ids[0])}
    if 'already exist' in output:
        return {'state': 'duplicate', 'error': 'Already in the Calibre library'}
    print(f"calibredb add {job['name']}: {output.strip()[-500:]}", file=sys.stderr)
    return {'state': 'failed', 'error': 'Calibre could not add this file'}


def rebuild_catalog(force=False) -> bool:
    result = subprocess.run([CATALOG_BUILDER, LIBRARY, CATALOG_OUTPUT] + (['--force'] if force else []),
                            capture_output=True, text=True, timeout=1800, check=False)
    if result.returncode:
        print(f'catalog build failed: {result.stderr.strip()[-500:]}', file=sys.stderr)
    return not result.returncode


def run_catalog() -> dict:
    """Admin panel → Tools → Catalog: a full rebuild now, rather than at the next interval."""
    if not catalog_busy.acquire(blocking=False):
        raise ApiError(409, 'The catalog is already being rebuilt')
    try:
        if not rebuild_catalog(force=True):
            raise ApiError(500, 'The catalog build failed; see the import service log')
        with open(CATALOG_OUTPUT, encoding='utf-8') as f:
            books = json.load(f)['books']
    finally:
        catalog_busy.release()
    return {'books': len(books), 'visualNovels': sum(1 for book in books if book.get('vn'))}


def finish_batch():
    """Rebuilds the catalog, then reports books added since the last build as added."""
    rebuild_catalog()
    with lock:
        for job in jobs.values():
            if job['state'] == 'unlisted':
                job.update(state='added', updated=time.time())
        save_jobs()


def worker():
    with lock:
        unlisted = any(j['state'] == 'unlisted' for j in jobs.values())
    if unlisted:
        finish_batch()
    while True:
        with work:
            while not (pending := [j for j in jobs.values() if j['state'] == 'queued']):
                work.wait()
            job = min(pending, key=lambda j: j['created'])
            job.update(state='adding', updated=time.time())
            save_jobs()
        try:
            update = add_vn(job) if job.get('kind') == 'vn' else add_book(job)
        except (OSError, subprocess.SubprocessError) as error:
            print(f"calibredb add {job['name']}: {error}", file=sys.stderr)
            update = {'state': 'failed', 'error': 'Calibre could not add this file'}
        try:
            os.remove(os.path.join(queue_dir(), job['file']))
        except OSError:
            pass
        with lock:
            job.update(update, updated=time.time())
            # Added books stay "unlisted" until the catalog, rebuilt once per batch, lists them.
            if job['state'] == 'added':
                job['state'] = 'unlisted'
            batch_done = not any(j['state'] == 'queued' for j in jobs.values()) and \
                any(j['state'] == 'unlisted' for j in jobs.values())
            save_jobs()
        if batch_done:
            finish_batch()


def run_series(apply: bool) -> dict:
    """Runs assign-series.py through Calibre's Python; it takes the write lock itself."""
    if not series_busy.acquire(blocking=False):
        raise ApiError(409, 'A series check is already running')
    try:
        result = subprocess.run(
            [CALIBRE_DEBUG, '-e', ASSIGN_SERIES, '--', '--json'] + (['--apply'] if apply else []),
            capture_output=True, text=True, timeout=ADD_TIMEOUT_SECONDS, check=False)
    finally:
        series_busy.release()
    try:
        report = json.loads(result.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError) as error:
        print(f'assign-series: {result.stderr.strip()[-500:]}', file=sys.stderr)
        raise ApiError(500, 'The series check failed; see the import service log') from error
    if report.get('written'):
        threading.Thread(target=rebuild_catalog, daemon=True).start()
    return report


def public_job(job: dict) -> dict:
    # Added books count as "adding" until the catalog lists them.
    state = 'adding' if job['state'] == 'unlisted' else job['state']
    return {key: job[key] for key in ('id', 'name', 'calibreId', 'title', 'error') if key in job} | {'state': state}


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


class Handler(BaseHTTPRequestHandler):
    server_version = 'calibre-import'
    sys_version = ''

    def account(self) -> str:
        account = self.headers.get('X-Account-Id', '')
        if not account:
            raise ApiError(401, 'Sign in to add books to Calibre')
        return account

    def require_admin(self):
        self.account()
        if self.headers.get('X-Account-Admin') != '1':
            raise ApiError(403, 'Only admins can do this')

    def send(self, status: int, body: dict):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def handle_api(self, handler):
        try:
            self.send(200, handler())
        except ApiError as error:
            self.send(error.status, {'error': str(error)})

    def do_GET(self):  # noqa: N802
        url = urlparse(self.path)
        if not from_nginx(self.headers):
            return self.send(403, {'error': 'Only nginx may call this service'})
        if url.path != '/jobs':
            return self.send(404, {'error': 'not found'})

        def list_jobs():
            account = self.account()
            ids = set(','.join(parse_qs(url.query).get('ids', [])).split(','))
            with lock:
                return {'jobs': [public_job(j) for i, j in jobs.items() if i in ids and j['account'] == account]}

        self.handle_api(list_jobs)

    def do_POST(self):  # noqa: N802
        url = urlparse(self.path)
        # Not url.path: urlparse drops ';params', so '/series;x' would count as '/series'.
        path = self.path.split('?', 1)[0]
        if not from_nginx(self.headers):
            return self.send(403, {'error': 'Only nginx may call this service'})
        if path == '/add':
            return self.handle_api(lambda: self.add(url))
        if path == '/series':
            return self.handle_api(self.series)
        if path == '/catalog':
            return self.handle_api(self.catalog)
        return self.send(404, {'error': 'not found'})

    def same_origin(self):
        scheme = 'http' if ALLOW_HTTP and self.headers.get('X-Forwarded-Proto') == 'http' else 'https'
        if self.headers.get('Origin') != f"{scheme}://{self.headers.get('Host', '')}":
            raise ApiError(403, 'Request from another site')

    def series(self):
        self.require_admin()
        self.same_origin()
        try:
            body = json.loads(self.rfile.read(min(int(self.headers.get('Content-Length') or 0), 1024)) or b'{}')
        except ValueError as error:
            raise ApiError(400, 'Invalid request') from error
        return run_series(bool(body.get('apply')))

    def catalog(self):
        self.require_admin()
        self.same_origin()
        return run_catalog()

    def add(self, url):
        account = self.account()
        self.same_origin()
        name = clean_name(parse_qs(url.query).get('name', [''])[0])
        ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
        if ext not in FORMATS:
            raise ApiError(400, 'Only EPUB, HTMLZ, TXT, CBZ and ZIP files can be added')
        if ext in MANGA_FORMATS:
            ext = 'cbz'
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError as error:
            raise ApiError(400, 'Invalid request') from error
        if length <= 0:
            raise ApiError(400, 'The file is empty')
        if length > (MAX_VN_BYTES if ext == 'cbz' else MAX_BYTES):
            raise ApiError(413, 'The file is too large')
        with lock:
            pending = sum(1 for j in jobs.values() if j['account'] == account and j['state'] in ('queued', 'adding'))
        if pending >= MAX_PENDING_PER_ACCOUNT:
            raise ApiError(429, 'Too many books waiting to be added; try again later')

        job_id = uuid.uuid4().hex
        file = f'{job_id}.{ext}'
        path = os.path.join(queue_dir(), file)
        remaining = length
        with open(path, 'wb') as f:
            while remaining:
                chunk = self.rfile.read(min(remaining, 1 << 20))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)
        vn = not remaining and ext == 'cbz' and is_vn_zip(path)
        if remaining:
            problem = 'Upload incomplete'
        elif vn:
            problem = '' if os.access(VN_DIR, os.W_OK) else 'There is no visual novel folder (VN_PATH) to add games to'
        else:
            problem = 'The file is too large' if length > MAX_BYTES else check_book(path, ext)
        if problem:
            os.remove(path)
            raise ApiError(400, problem)

        now = time.time()
        job = {'id': job_id, 'account': account, 'name': name, 'file': file,
               'state': 'queued', 'created': now, 'updated': now}
        if vn:
            job['kind'] = 'vn'

        with work:
            jobs[job_id] = job
            save_jobs()
            work.notify()
        return {'job': public_job(job)}

    def log_message(self, fmt, *args):
        sys.stderr.write('%s\n' % (fmt % args))


def main():
    os.makedirs(queue_dir(), exist_ok=True)
    load_jobs()
    # Uploads without a job (interrupted before it was recorded) are removed.
    known = {j['file'] for j in jobs.values()}
    for entry in os.scandir(queue_dir()):
        if entry.name not in known:
            os.remove(entry.path)
    # Games half unpacked when the service stopped.
    if os.path.isdir(VN_DIR) and os.access(VN_DIR, os.W_OK):
        for entry in os.scandir(VN_DIR):
            if entry.name.startswith('.importing-'):
                shutil.rmtree(entry.path, ignore_errors=True)
    threading.Thread(target=worker, daemon=True).start()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == '__main__':
    main()
