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

Job states: queued, adding, added (calibreId, title), duplicate, failed (error).
Standard library only. Not part of upstream.
"""
import fcntl
import json
import os
import re
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

FORMATS = ('epub', 'htmlz', 'txt', 'cbz', 'zip')
# Manga: queued as .cbz, since Calibre would unpack a .zip looking for a book inside.
MANGA_FORMATS = ('cbz', 'zip')
PAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')
MAX_BYTES = 300 * 1024 * 1024
MAX_PENDING_PER_ACCOUNT = 100
# Finished jobs are kept this long so the uploader can read the outcome.
KEEP_FINISHED_SECONDS = 7 * 24 * 3600
ADD_TIMEOUT_SECONDS = 600

lock = threading.Lock()
work = threading.Condition(lock)
jobs: dict[str, dict] = {}


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


def rebuild_catalog():
    result = subprocess.run([CATALOG_BUILDER, LIBRARY, CATALOG_OUTPUT],
                            capture_output=True, text=True, timeout=1800, check=False)
    if result.returncode:
        print(f'catalog build failed: {result.stderr.strip()[-500:]}', file=sys.stderr)


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
            update = add_book(job)
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
        if url.path != '/add':
            return self.send(404, {'error': 'not found'})
        self.handle_api(lambda: self.add(url))

    def add(self, url):
        account = self.account()
        scheme = 'http' if ALLOW_HTTP and self.headers.get('X-Forwarded-Proto') == 'http' else 'https'
        if self.headers.get('Origin') != f"{scheme}://{self.headers.get('Host', '')}":
            raise ApiError(403, 'Request from another site')
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
        if length > MAX_BYTES:
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
        problem = 'Upload incomplete' if remaining else check_book(path, ext)
        if problem:
            os.remove(path)
            raise ApiError(400, problem)

        now = time.time()
        job = {'id': job_id, 'account': account, 'name': name, 'file': file,
               'state': 'queued', 'created': now, 'updated': now}
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
    threading.Thread(target=worker, daemon=True).start()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == '__main__':
    main()
