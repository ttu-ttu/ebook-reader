#!/usr/bin/env python3
"""Accounts for ebook-reader: username/password sign-in and the nginx
auth_request check that gives each account its own WebDAV folder
(/account/sync/) for reading progress, statistics, highlights and settings.
Standard library only.

HTTP API (bound to localhost, proxied by nginx at /account/api/):
  GET  me             the signed-in account, or 401
  GET  config         {"httpAccounts": ...}: whether sign-in works over plain HTTP
  POST login          {"username": ..., "password": ...}
  POST logout
  POST password       {"current": ..., "new": ...}; signs out other sessions
  POST import-shared  copy progress/statistics/highlights saved while signed out
  GET  auth           200 with X-Account-Id, or 401 (nginx auth_request)
  GET  auth/<permission>         the same, 403 without that permission
  GET  auth/<permission>/writes  writes (X-Original-Method) need it; reads need
       an account, a trusted network (X-Trusted-Network: 1, set by nginx) or
       public reads (X-Public-Reads: 1)
       permissions: admin, import, series, difficulty (admins have all), and
       shared: any account, or a signed-out reader on a trusted network
  Writes are refused while the disk has less than MIN_FREE_MB free.
  GET  admin/users    all accounts (admins only)
  POST admin/add      {"username", "password", "admin"}
  POST admin/passwd   {"username", "password"}; signs out that account
  POST admin/set-admin {"username", "admin"}
  POST admin/permissions {"username", "permissions": [...]}
  POST admin/remove   {"username"}; its data folder is kept

There is no self-service sign-up. Admins manage accounts in Settings → Account,
or on the server:
  ebook-account add USERNAME [--admin] | passwd USERNAME | remove USERNAME
  ebook-account admin USERNAME on|off | list
  ebook-account permissions USERNAME import,series,difficulty  ('' for none)

Security notes:
- Passwords: scrypt (N=2^15, r=8, p=3, OWASP minimum), 16-byte salt, parameters
  stored with the hash so they can be raised later (rehashed on next sign-in).
- Unknown usernames are checked against a dummy hash, so timing doesn't reveal
  which accounts exist; errors never say which part was wrong.
- Failed sign-ins are throttled per account and per client IP with
  exponential lockouts. At most two hashes run at once to bound memory.
- Sessions: 256-bit random tokens, stored only as SHA-256. Idle and absolute
  expiry. Cookie: __Host- prefix, Secure, HttpOnly, SameSite=Strict.
- Sign-in only over HTTPS; POSTs must carry this site's Origin.
  ALLOW_HTTP_ACCOUNTS=1 (off by default) also allows plain HTTP, for servers
  without HTTPS: passwords and sessions then cross the network unencrypted.
  HTTP sessions use their own non-Secure cookie, honoured on HTTP requests
  only, so a cookie planted over HTTP can't take over an HTTPS session.
"""
import base64
import getpass
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import sqlite3
import sys
import threading
import time
import urllib.parse
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STATE_DIR = os.environ.get('ACCOUNT_STATE_DIR', '/data/state/account')
# Keep it off disks that other containers mount: whoever can read it can read
# the settings (API keys).
DATA_DIR = os.environ.get('ACCOUNT_DATA_DIR', '/data/accounts')
SHARED_SYNC_DIR = os.environ.get('SHARED_SYNC_DIR', '/data/sync')
ROOT_NAME = os.environ.get('STORAGE_ROOT_NAME', 'ttu-reader-data')
PORT = int(os.environ.get('ACCOUNT_PORT', '8766'))
# 0.0.0.0 in Docker, where nginx runs in another container.
HOST = os.environ.get('ACCOUNT_HOST', '127.0.0.1')
MIN_FREE_BYTES = int(os.environ.get('MIN_FREE_MB', '1024')) * 1024 * 1024

# nginx serves DATA_DIR/<account id> with `root`, so files live under the URI path.
SYNC_PATH = os.path.join('account', 'sync')
# Files that belong to a reader rather than to the book (see calibre-handler.ts).
PERSONAL_PREFIXES = ('progress_', 'statistics_', 'annotations.json', 'recaps.json', 'lorebook.json')
READING_GOALS_PREFIX = 'ttu-user-goals_'

COOKIE = '__Host-ttu_session'
# Over plain HTTP (ALLOW_HTTP_ACCOUNTS): __Host- cookies must be Secure, which
# browsers drop on HTTP pages.
HTTP_COOKIE = 'ttu_session'
ALLOW_HTTP = os.environ.get('ALLOW_HTTP_ACCOUNTS') == '1'
SESSION_IDLE_SECONDS = 30 * 86400
SESSION_MAX_SECONDS = 180 * 86400
LAST_SEEN_WRITE_INTERVAL = 600

USERNAME_PATTERN = re.compile(r'[a-z0-9][a-z0-9_.-]{2,31}')
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 1024
MAX_BODY_BYTES = 16 * 1024

SCRYPT_N, SCRYPT_R, SCRYPT_P = 2 ** 15, 8, 3
SCRYPT_MAXMEM = 64 * 1024 * 1024
hash_slots = threading.BoundedSemaphore(2)

# Lockouts start after this many failures, double each time, and are capped.
# Per username and IP, so a stranger can't lock someone out by guessing; the
# per-username limit only stops guessing spread over many addresses.
THROTTLE_RULES = {'userip': 5, 'ip': 20, 'user': 50}
THROTTLE_BASE_SECONDS = 30
THROTTLE_MAX_SECONDS = 3600
THROTTLE_FORGET_SECONDS = 86400


class ApiError(Exception):
    def __init__(self, status: int, message: str, headers: dict | None = None):
        super().__init__(message)
        self.status = status
        self.headers = headers or {}


# ---------------------------------------------------------------------------
# Passwords


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    with hash_slots:
        return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, maxmem=SCRYPT_MAXMEM, dklen=32)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = scrypt(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
    return f'scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${b64(salt)}${b64(digest)}'


def verify_password(password: str, stored: str) -> tuple[bool, bool]:
    """Returns (matches, should be rehashed with the current parameters)."""
    _, n, r, p, salt, digest = stored.split('$')
    params = (int(n), int(r), int(p))
    matches = hmac.compare_digest(scrypt(password, base64.b64decode(salt), *params), base64.b64decode(digest))
    return matches, params != (SCRYPT_N, SCRYPT_R, SCRYPT_P)


def check_new_password(password: str, username: str):
    if not PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH:
        raise ApiError(400, f'Passwords must be {PASSWORD_MIN_LENGTH} to {PASSWORD_MAX_LENGTH} characters long')
    if password.strip().lower() == username:
        raise ApiError(400, 'The password must not be the username')


def normalize_username(username: str) -> str:
    return username.strip().lower()


# Compared against when the username doesn't exist, so both paths cost the same.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


# ---------------------------------------------------------------------------
# Database

SCHEMA = '''
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created INTEGER NOT NULL,
    password_changed INTEGER NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    permissions TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS login_throttle (
    key TEXT PRIMARY KEY,
    failures INTEGER NOT NULL,
    last_failure REAL NOT NULL,
    locked_until REAL NOT NULL
);
'''


class Database:
    """One connection shared by the request threads, serialized by a lock."""

    def __init__(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        old_umask = os.umask(0o077)
        try:
            self.connection = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        finally:
            os.umask(old_umask)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute('PRAGMA journal_mode = WAL')
        self.connection.execute('PRAGMA foreign_keys = ON')
        self.connection.executescript(SCHEMA)
        # Databases from before admins and permissions existed.
        columns = [row['name'] for row in self.connection.execute('PRAGMA table_info(users)')]
        if 'is_admin' not in columns:
            self.connection.execute('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0')
        if 'permissions' not in columns:
            self.connection.execute("ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT ''")
        self.lock = threading.Lock()

    def query(self, sql: str, params=()) -> list[sqlite3.Row]:
        with self.lock:
            return self.connection.execute(sql, params).fetchall()

    def run(self, *statements: tuple[str, tuple]):
        """Runs statements in one transaction."""
        self.transaction(lambda connection: [connection.execute(sql, params) for sql, params in statements])

    def transaction(self, work):
        """Calls work(connection) in one transaction, so reads and writes can't interleave with other threads."""
        with self.lock:
            self.connection.execute('BEGIN IMMEDIATE')
            try:
                result = work(self.connection)
                self.connection.execute('COMMIT')
                return result
            except BaseException:
                self.connection.execute('ROLLBACK')
                raise


db: Database


def find_user(username: str):
    rows = db.query('SELECT * FROM users WHERE username = ?', (normalize_username(username),))
    return rows[0] if rows else None


# What admins can grant to other accounts (admins have all of them).
PERMISSIONS = ('import', 'series', 'difficulty')


def user_permissions(row) -> list[str]:
    return [name for name in row['permissions'].split(',') if name in PERMISSIONS]


def public_user(row) -> dict:
    return {'id': row['id'], 'username': row['username'], 'admin': bool(row['is_admin']),
            'permissions': user_permissions(row)}


def has_permission(row, permission: str) -> bool:
    return bool(row['is_admin']) or (permission in PERMISSIONS and permission in user_permissions(row))


def set_permissions(user_id: str, permissions) -> None:
    if not isinstance(permissions, list) or any(name not in PERMISSIONS for name in permissions):
        raise ApiError(400, f'Permissions are any of: {", ".join(PERMISSIONS)}')
    db.run(('UPDATE users SET permissions = ? WHERE id = ?',
            (','.join(name for name in PERMISSIONS if name in permissions), user_id)))


def check_username(username: str):
    if not USERNAME_PATTERN.fullmatch(username):
        raise ApiError(400, 'Usernames are 3-32 characters: a-z, 0-9, ".", "_" and "-", starting with a letter or digit')
    if find_user(username):
        raise ApiError(409, f'{username} already exists')


def create_user(username: str, password: str, admin: bool = False) -> str:
    """Validates and adds an account; returns its id."""
    username = normalize_username(username)
    check_username(username)
    check_new_password(password, username)
    user_id = secrets.token_hex(16)
    now = int(time.time())
    db.run(('INSERT INTO users (id, username, password_hash, created, password_changed, is_admin) '
            'VALUES (?, ?, ?, ?, ?, ?)', (user_id, username, hash_password(password), now, now, int(admin))))
    os.makedirs(os.path.join(DATA_DIR, user_id, SYNC_PATH), exist_ok=True)
    return user_id


def set_password(user_id: str, password: str, username: str):
    """Sets a new password and signs out every session of the account."""
    check_new_password(password, username)
    db.run(
        ('UPDATE users SET password_hash = ?, password_changed = ? WHERE id = ?',
         (hash_password(password), int(time.time()), user_id)),
        ('DELETE FROM sessions WHERE user_id = ?', (user_id,)),
    )


def keep_an_admin(user, action: str):
    """Refuses to remove or demote the last admin, which would lock everyone out of the admin panel."""
    admins = db.query('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1')[0]['n']
    if user['is_admin'] and admins <= 1:
        raise ApiError(409, f'Cannot {action} the only admin')


# Methods that only read; nginx sends the original method as X-Original-Method.
READ_METHODS = {'GET', 'HEAD', 'OPTIONS', 'PROPFIND'}


def auth_status(user, permission: str, writes_only: bool, method: str, trusted_network: bool,
                public_reads: bool = False) -> int:
    """nginx auth_request result. permission: '' or 'shared' (any account), 'admin' or one of PERMISSIONS."""
    if writes_only and method in READ_METHODS:
        return 200 if user or trusted_network or public_reads else 401
    # Signed-out readers on the LAN/tailnet still sync to the shared folder, as before accounts.
    if permission == 'shared' and trusted_network:
        return 200
    if not user:
        return 401
    if permission not in ('', 'shared') and not has_permission(user, permission):
        return 403
    return 200


def disk_full(path: str) -> bool:
    """Below MIN_FREE_BYTES free: there are no quotas, so this keeps uploads from filling the disk."""
    try:
        return shutil.disk_usage(path).free < MIN_FREE_BYTES
    except OSError:
        return False


def request_scheme(proto: str | None) -> str | None:
    """'https', 'http' when plain-HTTP accounts are allowed, else None (refused)."""
    if proto == 'https' or (ALLOW_HTTP and proto == 'http'):
        return proto
    return None


def session_cookie_name(proto: str | None) -> str | None:
    """Which cookie holds the session for a request with this X-Forwarded-Proto."""
    if proto == 'https':
        return COOKIE
    return HTTP_COOKIE if request_scheme(proto) == 'http' else None


# ---------------------------------------------------------------------------
# Sign-in throttling


def throttle_keys(username: str, ip: str) -> list[str]:
    username = normalize_username(username)
    return [f'userip:{username}@{ip}', f'ip:{ip}', f'user:{username}']


def check_throttle(keys: list[str]):
    now = time.time()
    rows = db.query(
        f'SELECT locked_until FROM login_throttle WHERE key IN ({",".join("?" * len(keys))})', keys
    )
    wait = max((row['locked_until'] - now for row in rows), default=0)

    if wait > 0:
        minutes = max(1, round(wait / 60))
        raise ApiError(429, f'Too many failed sign-ins. Try again in {minutes} minute{"s" * (minutes != 1)}.',
                       {'Retry-After': str(int(wait) + 1)})


def record_failure(keys: list[str]):
    now = time.time()

    # Read and update in one transaction: parallel guesses must each count.
    def work(connection):
        for key in keys:
            row = connection.execute(
                'SELECT failures, last_failure FROM login_throttle WHERE key = ?', (key,)).fetchone()
            failures = 1

            if row and now - row['last_failure'] < THROTTLE_FORGET_SECONDS:
                failures = row['failures'] + 1

            allowed = THROTTLE_RULES[key.split(':', 1)[0]]
            lock_seconds = 0

            if failures >= allowed:
                lock_seconds = min(THROTTLE_BASE_SECONDS * 2 ** (failures - allowed), THROTTLE_MAX_SECONDS)

            connection.execute('INSERT OR REPLACE INTO login_throttle VALUES (?, ?, ?, ?)',
                               (key, failures, now, now + lock_seconds))

        # Forget old entries, so guessed usernames don't pile up.
        connection.execute('DELETE FROM login_throttle WHERE last_failure < ? AND locked_until < ?',
                           (now - THROTTLE_FORGET_SECONDS, now))

    db.transaction(work)


def clear_failures(keys: list[str]):
    db.run(*[('DELETE FROM login_throttle WHERE key = ?', (key,)) for key in keys])


# ---------------------------------------------------------------------------
# Sessions


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(user_id: str) -> str:
    now = int(time.time())
    token = secrets.token_urlsafe(32)
    db.run(
        ('INSERT INTO sessions VALUES (?, ?, ?, ?)', (token_hash(token), user_id, now, now)),
        ('DELETE FROM sessions WHERE last_seen < ? OR created < ?',
         (now - SESSION_IDLE_SECONDS, now - SESSION_MAX_SECONDS)),
    )
    return token


def session_user(token: str | None):
    """The user of a valid session, or None. Refreshes the idle timer."""
    if not token:
        return None

    now = int(time.time())
    rows = db.query('''
        SELECT users.*, sessions.created AS session_created, sessions.last_seen
        FROM sessions JOIN users ON users.id = sessions.user_id
        WHERE token_hash = ?
    ''', (token_hash(token),))

    if not rows:
        return None

    row = rows[0]

    if row['last_seen'] < now - SESSION_IDLE_SECONDS or row['session_created'] < now - SESSION_MAX_SECONDS:
        delete_session(token)
        return None

    if row['last_seen'] < now - LAST_SEEN_WRITE_INTERVAL:
        db.run(('UPDATE sessions SET last_seen = ? WHERE token_hash = ?', (now, token_hash(token))))

    return row


def delete_session(token: str | None):
    if token:
        db.run(('DELETE FROM sessions WHERE token_hash = ?', (token_hash(token),)))


# ---------------------------------------------------------------------------
# Copying data saved while signed out (shared Calibre sync folder) to an account


def copy_missing_files(source_dir: str, target_dir: str, prefixes: tuple) -> int:
    """Copies files with these prefixes unless the target already has one with the same prefix."""
    existing = os.listdir(target_dir) if os.path.isdir(target_dir) else []
    copied = 0

    for name in sorted(os.listdir(source_dir)):
        prefix = next((p for p in prefixes if name.startswith(p)), None)

        if not prefix or not os.path.isfile(os.path.join(source_dir, name)):
            continue
        if any(other.startswith(prefix) for other in existing):
            continue

        os.makedirs(target_dir, exist_ok=True)
        shutil.copy2(os.path.join(source_dir, name), os.path.join(target_dir, name))
        existing.append(name)
        copied += 1

    return copied


def import_shared(user_id: str) -> dict:
    source_root = os.path.join(SHARED_SYNC_DIR, ROOT_NAME)
    target_root = os.path.join(DATA_DIR, user_id, SYNC_PATH, ROOT_NAME)
    result = {'books': 0, 'files': 0}

    if not os.path.isdir(source_root):
        return result

    result['files'] += copy_missing_files(source_root, target_root, (READING_GOALS_PREFIX,))

    for entry in os.scandir(source_root):
        if entry.is_dir() and not entry.name.startswith('.'):
            copied = copy_missing_files(entry.path, os.path.join(target_root, entry.name), PERSONAL_PREFIXES)
            result['books'] += 1 if copied else 0
            result['files'] += copied

    return result


# ---------------------------------------------------------------------------
# HTTP


class Handler(BaseHTTPRequestHandler):
    server_version = 'ebook-account'
    sys_version = ''

    def log_message(self, fmt, *args):
        if not self.path.startswith('/auth'):
            sys.stderr.write('%s %s\n' % (self.client_ip(), fmt % args))

    # -- request helpers

    def client_ip(self) -> str:
        # Only nginx can reach this service; it sets X-Real-IP.
        return self.headers.get('X-Real-IP') or self.client_address[0]

    def session_token(self) -> str | None:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
        except Exception:  # noqa: BLE001 - malformed cookies count as signed out
            return None
        # Browsers only send the __Host- cookie over HTTPS, so it is always good.
        name = COOKIE if COOKIE in cookie else session_cookie_name(self.headers.get('X-Forwarded-Proto'))
        return cookie[name].value if name and name in cookie else None

    def require_user(self):
        user = session_user(self.session_token())
        if not user:
            raise ApiError(401, 'Not signed in')
        return user

    def require_admin(self):
        user = self.require_user()
        if not user['is_admin']:
            raise ApiError(403, 'Only admins can do this')
        return user

    def target_user(self, body: dict):
        user = find_user(str(body.get('username', '')))
        if not user:
            raise ApiError(404, 'No such account')
        return user

    def require_https_same_origin(self):
        scheme = request_scheme(self.headers.get('X-Forwarded-Proto'))
        if not scheme:
            raise ApiError(403, 'Signing in needs the HTTPS address')
        if self.headers.get('Origin') != f"{scheme}://{self.headers.get('Host', '')}":
            raise ApiError(403, 'Request from another site')

    def read_json(self) -> dict:
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError as error:
            raise ApiError(400, 'Invalid request') from error
        if length < 0:
            raise ApiError(400, 'Invalid request')
        if length > MAX_BODY_BYTES:
            raise ApiError(413, 'Request too large')
        try:
            body = json.loads(self.rfile.read(length) or b'{}')
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ApiError(400, 'Invalid JSON') from error
        if not isinstance(body, dict):
            raise ApiError(400, 'Invalid request')
        return body

    def session_cookie(self, token: str, max_age: int) -> str:
        if session_cookie_name(self.headers.get('X-Forwarded-Proto')) == HTTP_COOKIE:
            return f'{HTTP_COOKIE}={token}; Path=/; Max-Age={max_age}; HttpOnly; SameSite=Strict'
        return f'{COOKIE}={token}; Path=/; Max-Age={max_age}; Secure; HttpOnly; SameSite=Strict'

    def send(self, status: int, body: dict | None = None, headers: dict | None = None):
        data = json.dumps(body).encode() if body is not None else b''
        self.send_response(status)
        if body is not None:
            self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(data)

    # -- routes

    def get_auth(self, permission: str = '', writes_only: bool = False):
        user = session_user(self.session_token())
        method = self.headers.get('X-Original-Method', '')
        status = auth_status(user, permission, writes_only, method,
                             self.headers.get('X-Trusted-Network') == '1', self.headers.get('X-Public-Reads') == '1')
        if status == 200 and method not in READ_METHODS and permission in ('', 'shared') \
                and disk_full(DATA_DIR if permission == '' else SHARED_SYNC_DIR):
            # Not log_message: that skips auth requests.
            sys.stderr.write(f'write refused: less than {MIN_FREE_BYTES // 1024 // 1024} MB free\n')
            status = 403
        return status, None, {'X-Account-Id': user['id']} if user and status == 200 else {}

    def get_admin_users(self):
        self.require_admin()
        rows = db.query('SELECT * FROM users ORDER BY username')
        return 200, {'users': [{**public_user(row), 'created': row['created']} for row in rows]}, {}

    def post_admin_add(self):
        self.require_admin()
        body = self.read_json()
        create_user(str(body.get('username', '')), str(body.get('password', '')), bool(body.get('admin')))
        return 200, {}, {}

    def post_admin_passwd(self):
        self.require_admin()
        body = self.read_json()
        user = self.target_user(body)
        set_password(user['id'], str(body.get('password', '')), user['username'])
        return 200, {}, {}

    def post_admin_set_admin(self):
        self.require_admin()
        body = self.read_json()
        user = self.target_user(body)
        admin = bool(body.get('admin'))
        if not admin:
            keep_an_admin(user, 'demote')
        db.run(('UPDATE users SET is_admin = ? WHERE id = ?', (int(admin), user['id'])))
        return 200, {}, {}

    def post_admin_permissions(self):
        self.require_admin()
        body = self.read_json()
        set_permissions(self.target_user(body)['id'], body.get('permissions'))
        return 200, {}, {}

    def post_admin_remove(self):
        me = self.require_admin()
        user = self.target_user(self.read_json())
        if user['id'] == me['id']:
            raise ApiError(409, 'Cannot remove your own account')
        keep_an_admin(user, 'remove')
        db.run(('DELETE FROM users WHERE id = ?', (user['id'],)))
        return 200, {}, {}

    def get_config(self):
        return 200, {'httpAccounts': ALLOW_HTTP}, {}

    def get_me(self):
        return 200, {'user': public_user(self.require_user())}, {}

    def post_login(self):
        body = self.read_json()
        username, password = str(body.get('username', '')), str(body.get('password', ''))
        keys = throttle_keys(username, self.client_ip())

        check_throttle(keys)

        user = find_user(username) if len(password) <= PASSWORD_MAX_LENGTH else None
        matches, rehash = verify_password(password[:PASSWORD_MAX_LENGTH], user['password_hash'] if user else DUMMY_HASH)

        if not user or not matches:
            record_failure(keys)
            self.log_message('sign-in failed for %r', username[:64])
            raise ApiError(401, 'Incorrect username or password')

        clear_failures(keys)

        if rehash:
            db.run(('UPDATE users SET password_hash = ? WHERE id = ?', (hash_password(password), user['id'])))

        token = create_session(user['id'])
        return 200, {'user': public_user(user)}, {'Set-Cookie': self.session_cookie(token, SESSION_MAX_SECONDS)}

    def post_logout(self):
        delete_session(self.session_token())
        return 200, {}, {'Set-Cookie': self.session_cookie('', 0)}

    def post_password(self):
        user = self.require_user()
        body = self.read_json()
        current, new = str(body.get('current', '')), str(body.get('new', ''))
        keys = throttle_keys(user['username'], self.client_ip())

        check_throttle(keys)

        if not verify_password(current[:PASSWORD_MAX_LENGTH], user['password_hash'])[0]:
            record_failure(keys)
            raise ApiError(403, 'The current password is incorrect')

        check_new_password(new, user['username'])
        db.run(
            ('UPDATE users SET password_hash = ?, password_changed = ? WHERE id = ?',
             (hash_password(new), int(time.time()), user['id'])),
            ('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?',
             (user['id'], token_hash(self.session_token()))),
        )
        return 200, {}, {}

    def post_import_shared(self):
        return 200, import_shared(self.require_user()['id']), {}

    ROUTES = {
        ('GET', 'auth'): get_auth,
        **{('GET', f'auth/{name}'): lambda self, name=name: self.get_auth(name)
           for name in ('admin', 'shared') + PERMISSIONS},
        **{('GET', f'auth/{name}/writes'): lambda self, name=name: self.get_auth(name, True)
           for name in ('admin', 'shared') + PERMISSIONS},
        ('GET', 'admin/users'): get_admin_users,
        ('POST', 'admin/add'): post_admin_add,
        ('POST', 'admin/passwd'): post_admin_passwd,
        ('POST', 'admin/set-admin'): post_admin_set_admin,
        ('POST', 'admin/permissions'): post_admin_permissions,
        ('POST', 'admin/remove'): post_admin_remove,
        ('GET', 'me'): get_me,
        ('GET', 'config'): get_config,
        ('POST', 'login'): post_login,
        ('POST', 'logout'): post_logout,
        ('POST', 'password'): post_password,
        ('POST', 'import-shared'): post_import_shared,
    }

    def dispatch(self, method: str):
        route = self.ROUTES.get((method, self.path.split('?')[0].strip('/')))

        try:
            if not route:
                raise ApiError(404, 'Not found')
            if method == 'POST':
                self.require_https_same_origin()
            status, body, headers = route(self)
            self.send(status, body, headers)
        except ApiError as error:
            self.send(error.status, {'error': str(error)}, error.headers)
        except Exception as error:  # noqa: BLE001 - log it, don't leak details
            self.log_message('error: %s: %s', type(error).__name__, error)
            self.send(500, {'error': 'Internal error'})

    def do_GET(self):
        self.dispatch('GET')

    def do_POST(self):
        self.dispatch('POST')


# ---------------------------------------------------------------------------
# Command line account management


def prompt_new_password(username: str) -> str:
    if not sys.stdin.isatty():
        password = sys.stdin.readline().rstrip('\n')
    else:
        password = getpass.getpass(f'New password for {username}: ')
        if getpass.getpass('Repeat it: ') != password:
            sys.exit('Passwords do not match')
    check_new_password(password, username)
    return password


def cli(command: str, *args: str):
    if command == 'list':
        for row in db.query('SELECT * FROM users ORDER BY username'):
            created = time.strftime('%Y-%m-%d', time.localtime(row['created']))
            rights = 'admin' if row['is_admin'] else ','.join(user_permissions(row))
            print(f"{row['username']}\t{row['id']}\tcreated {created}\t{rights}")
        return

    admin_flag = '--admin' in args
    args = tuple(arg for arg in args if arg != '--admin')

    if command == 'add' and len(args) == 1:
        username = normalize_username(args[0])
        check_username(username)
        create_user(username, prompt_new_password(username), admin_flag)
        print(f"Added {username}{' (admin)' if admin_flag else ''}")
        return

    if command == 'admin' and len(args) == 2 and args[1] in ('on', 'off'):
        args, state = args[:1], args[1]
    elif command == 'permissions' and len(args) == 2:
        args, granted = args[:1], [name for name in args[1].split(',') if name]
    elif len(args) != 1 or admin_flag:
        sys.exit(__doc__)

    username = normalize_username(args[0])
    user = find_user(username)

    if not user:
        sys.exit(f'No account named {username}')
    elif command == 'passwd':
        set_password(user['id'], prompt_new_password(username), username)
        print(f'Changed the password of {username} and signed out its sessions')
    elif command == 'admin':
        if state == 'off':
            keep_an_admin(user, 'demote')
        db.run(('UPDATE users SET is_admin = ? WHERE id = ?', (int(state == 'on'), user['id'])))
        print(f"{username} is {'now' if state == 'on' else 'no longer'} an admin")
    elif command == 'permissions':
        set_permissions(user['id'], granted)
        print(f"{username} may now: {', '.join(granted) or 'nothing extra'}")
    elif command == 'remove':
        keep_an_admin(user, 'remove')
        db.run(('DELETE FROM users WHERE id = ?', (user['id'],)))
        print(f"Removed {username}. Its data is still in {os.path.join(DATA_DIR, user['id'])}")
    else:
        sys.exit(__doc__)


def main():
    global db

    db = Database(os.path.join(STATE_DIR, 'accounts.db'))
    command, *args = sys.argv[1:] or ['serve']

    if command == 'serve':
        os.makedirs(DATA_DIR, exist_ok=True)
        if ALLOW_HTTP:
            print('WARNING: ALLOW_HTTP_ACCOUNTS=1: sign-in works over plain HTTP; passwords and sessions '
                  'are sent unencrypted there. Use HTTPS if anyone else can see the network.', file=sys.stderr)
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    else:
        try:
            cli(command, *args)
        except ApiError as error:
            sys.exit(str(error))


if __name__ == '__main__':
    main()
