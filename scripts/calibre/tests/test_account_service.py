"""Tests for account/service.py (standard library only). Run from the repo root:
python3 -m unittest discover -s scripts/calibre/tests
"""
import os
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'account'))
import service  # noqa: E402


class AccountServiceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        service.DATA_DIR = os.path.join(self.tmp.name, 'data')
        service.db = service.Database(os.path.join(self.tmp.name, 'accounts.db'))

    def tearDown(self):
        service.db.connection.close()
        self.tmp.cleanup()

    def test_password_round_trip(self):
        stored = service.hash_password('correct horse')
        self.assertEqual(service.verify_password('correct horse', stored), (True, False))
        self.assertFalse(service.verify_password('wrong', stored)[0])

    def test_rehash_on_old_parameters(self):
        old = service.hash_password('pw')
        weaker = old.replace(f'${service.SCRYPT_N}$', '$16384$', 1)
        self.assertTrue(service.verify_password('x', weaker)[1])

    def test_new_password_rules(self):
        with self.assertRaises(service.ApiError):
            service.check_new_password('short', 'user')
        with self.assertRaises(service.ApiError):
            service.check_new_password('username', 'username')
        service.check_new_password('long enough', 'user')

    def test_lockout_after_allowed_failures(self):
        keys = service.throttle_keys('Alice', '10.0.0.1')
        self.assertEqual(keys[0], 'userip:alice@10.0.0.1')
        for _ in range(service.THROTTLE_RULES['userip'] - 1):
            service.record_failure(keys)
        service.check_throttle(keys)  # not locked yet
        service.record_failure(keys)
        with self.assertRaises(service.ApiError) as raised:
            service.check_throttle(keys)
        self.assertEqual(raised.exception.status, 429)
        service.clear_failures(keys)
        service.check_throttle(keys)

    def test_guesses_elsewhere_dont_lock_the_owner_out(self):
        for _ in range(service.THROTTLE_RULES['userip']):
            service.record_failure(service.throttle_keys('alice', '203.0.113.9'))
        with self.assertRaises(service.ApiError):
            service.check_throttle(service.throttle_keys('alice', '203.0.113.9'))
        service.check_throttle(service.throttle_keys('alice', '192.168.1.20'))

    def test_concurrent_failures_are_all_counted(self):
        keys = ['user:race']
        threads = [threading.Thread(target=service.record_failure, args=(keys,)) for _ in range(40)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        failures = service.db.query('SELECT failures FROM login_throttle WHERE key = ?', ('user:race',))
        self.assertEqual(failures[0]['failures'], 40)

    def test_sessions(self):
        user_id = service.create_user('alice', 'long enough')
        token = service.create_session(user_id)
        self.assertEqual(service.session_user(token)['username'], 'alice')
        service.delete_session(token)
        self.assertIsNone(service.session_user(token))

    def test_copy_missing_files_never_overwrites(self):
        source = os.path.join(self.tmp.name, 'src')
        target = os.path.join(self.tmp.name, 'dst')
        os.makedirs(source)
        os.makedirs(target)
        for name in ('progress_1_old.json', 'statistics_x.json', 'bookdata_x.html'):
            open(os.path.join(source, name), 'w').close()
        open(os.path.join(target, 'progress_2_mine.json'), 'w').close()
        copied = service.copy_missing_files(source, target, service.PERSONAL_PREFIXES)
        self.assertEqual(copied, 1)
        self.assertEqual(sorted(os.listdir(target)), ['progress_2_mine.json', 'statistics_x.json'])

    def test_copy_includes_recaps_and_lorebook(self):
        source = os.path.join(self.tmp.name, 'src2')
        target = os.path.join(self.tmp.name, 'dst2')
        os.makedirs(source)
        os.makedirs(target)
        for name in ('recaps.json', 'lorebook.json', 'cover.jpg'):
            open(os.path.join(source, name), 'w').close()
        copied = service.copy_missing_files(source, target, service.PERSONAL_PREFIXES)
        self.assertEqual(copied, 2)
        self.assertEqual(sorted(os.listdir(target)), ['lorebook.json', 'recaps.json'])

    def test_auth_status(self):
        reader = {'is_admin': 0, 'permissions': ''}
        importer = {'is_admin': 0, 'permissions': 'import'}
        admin = {'is_admin': 1, 'permissions': ''}
        status = service.auth_status
        self.assertEqual(status(None, '', False, 'GET', True), 401)
        self.assertEqual(status(reader, '', False, 'PUT', False), 200)
        # Shared data: reads need an account, a trusted network or public reads.
        self.assertEqual(status(None, 'shared', True, 'GET', False), 401)
        self.assertEqual(status(None, 'shared', True, 'GET', False, True), 200)
        self.assertEqual(status(None, 'shared', True, 'GET', True), 200)
        self.assertEqual(status(reader, 'shared', True, 'GET', False), 200)
        # Writes need an account or a trusted network.
        self.assertEqual(status(None, 'shared', True, 'PUT', False, True), 401)
        self.assertEqual(status(None, 'shared', True, 'PUT', False), 401)
        self.assertEqual(status(None, 'shared', True, 'DELETE', True), 200)
        self.assertEqual(status(reader, 'shared', True, 'MOVE', False), 200)
        # Permissions: a trusted network doesn't help, and an unknown method counts as a write.
        self.assertEqual(status(None, 'series', True, 'GET', True), 200)
        self.assertEqual(status(None, 'series', True, 'PUT', True), 401)
        self.assertEqual(status(reader, 'series', True, '', True), 403)
        self.assertEqual(status(importer, 'import', False, 'POST', False), 200)
        self.assertEqual(status(importer, 'series', True, 'PUT', False), 403)
        self.assertEqual(status(importer, 'admin', False, 'GET', False), 403)
        self.assertEqual(status(admin, 'difficulty', True, 'POST', False), 200)
        self.assertEqual(status(admin, 'admin', False, 'GET', False), 200)

    def test_plain_http_is_off_by_default(self):
        self.assertFalse(service.ALLOW_HTTP)
        self.assertEqual(service.request_scheme('https'), 'https')
        self.assertIsNone(service.request_scheme('http'))
        self.assertIsNone(service.request_scheme(None))
        self.assertEqual(service.session_cookie_name('https'), service.COOKIE)
        self.assertIsNone(service.session_cookie_name('http'))

    def test_plain_http_when_allowed(self):
        service.ALLOW_HTTP = True
        try:
            self.assertEqual(service.request_scheme('http'), 'http')
            self.assertIsNone(service.request_scheme('ftp'))
            self.assertIsNone(service.request_scheme(None))
            self.assertEqual(service.session_cookie_name('http'), service.HTTP_COOKIE)
            # The HTTP cookie never counts on HTTPS, where a planted one could fix a session.
            self.assertEqual(service.session_cookie_name('https'), service.COOKIE)
            self.assertIsNone(service.session_cookie_name(None))
        finally:
            service.ALLOW_HTTP = False

    def test_disk_full(self):
        self.assertFalse(service.disk_full(self.tmp.name))
        original = service.MIN_FREE_BYTES
        service.MIN_FREE_BYTES = 1 << 62
        try:
            self.assertTrue(service.disk_full(self.tmp.name))
        finally:
            service.MIN_FREE_BYTES = original

    def test_permissions(self):
        user_id = service.create_user('carol', 'long enough')
        service.set_permissions(user_id, ['series', 'import'])
        carol = service.find_user('carol')
        self.assertEqual(service.public_user(carol)['permissions'], ['import', 'series'])
        self.assertTrue(service.has_permission(carol, 'import'))
        self.assertFalse(service.has_permission(carol, 'difficulty'))
        self.assertFalse(service.has_permission(carol, 'admin'))
        for bad in (['admin'], ['nope'], 'import'):
            with self.assertRaises(service.ApiError):
                service.set_permissions(user_id, bad)
        service.set_permissions(user_id, [])
        self.assertEqual(service.public_user(service.find_user('carol'))['permissions'], [])

    def test_auth_routes(self):
        routes = service.Handler.ROUTES
        for path in ('auth', 'auth/admin', 'auth/import', 'auth/shared/writes', 'auth/series/writes',
                     'auth/difficulty/writes'):
            self.assertIn(('GET', path), routes)
        self.assertNotIn(('GET', 'auth/anything'), routes)

    def test_create_user_and_admin_rules(self):
        service.create_user('Root', 'long enough', admin=True)
        root = service.find_user('root')
        self.assertTrue(service.public_user(root)['admin'])
        self.assertTrue(os.path.isdir(os.path.join(service.DATA_DIR, root['id'], service.SYNC_PATH)))
        with self.assertRaises(service.ApiError) as raised:
            service.create_user('root', 'other password')
        self.assertEqual(raised.exception.status, 409)
        with self.assertRaises(service.ApiError):
            service.create_user('x', 'long enough')
        with self.assertRaises(service.ApiError):
            service.keep_an_admin(root, 'remove')
        service.create_user('second', 'long enough', admin=True)
        service.keep_an_admin(root, 'remove')  # another admin exists
        service.keep_an_admin(service.find_user('second'), 'demote')

    def test_set_password_signs_out(self):
        user_id = service.create_user('bob', 'long enough')
        token = service.create_session(user_id)
        service.set_password(user_id, 'new password', 'bob')
        self.assertIsNone(service.session_user(token))
        self.assertTrue(service.verify_password('new password', service.find_user('bob')['password_hash'])[0])

    def test_old_database_gets_admin_column(self):
        path = os.path.join(self.tmp.name, 'old.db')
        old = service.sqlite3.connect(path)
        old.execute('CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, '
                    'password_hash TEXT NOT NULL, created INTEGER NOT NULL, password_changed INTEGER NOT NULL)')
        old.execute("INSERT INTO users VALUES ('u1', 'alice', 'x', 0, 0)")
        old.commit()
        old.close()
        migrated = service.Database(path)
        row = migrated.query('SELECT is_admin, permissions FROM users')[0]
        self.assertEqual((row['is_admin'], row['permissions']), (0, ''))
        migrated.connection.close()


if __name__ == '__main__':
    unittest.main()
