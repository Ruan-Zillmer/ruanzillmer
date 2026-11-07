#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gestao de Projetos - AUTOMACAO  |  servidor (um arquivo so, sem instalar nada)

Como usar: de duplo clique neste arquivo (ou rode:  python servidor.py ).
Ele usa apenas o que ja vem com o Python: nao precisa de pip, npm nem internet.
Ao iniciar, mostra o endereco (IP) para abrir no navegador e o salva em endereco.txt.

Opcoes:  python servidor.py --porta 2523   |   --sem-navegador
"""

import hashlib
import hmac
import html
import json
import mimetypes
import os
import re
import secrets
import smtplib
import socket
import sqlite3
import ssl
import sys
import threading
import time
import traceback
import webbrowser
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlparse

BASE_DIR = os.path.dirname(os.path.realpath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'dados')
FILES_DIR = os.path.join(DATA_DIR, 'files')
DB_PATH = os.path.join(DATA_DIR, 'gestao.db')

DEFAULT_PORT = 2523
MAX_UPLOAD_MB = int(os.environ.get('MAX_UPLOAD_MB') or 1024)
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_JSON_BYTES = 10 * 1024 * 1024
SESSION_SECONDS = 30 * 24 * 3600
INLINE_MIME = {'pdf': 'application/pdf', 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
               'gif': 'image/gif', 'webp': 'image/webp'}
STATIC_MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
               '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml',
               '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'}
BLOCKED_TOP = {'dados', 'server', 'vendor-src', 'servidor.py'}


# ============================================================ banco de dados

def connect():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def q(sql, params=(), one=False, commit=False):
    conn = connect()
    try:
        cur = conn.execute(sql, params)
        rows = cur.fetchone() if one else cur.fetchall()
        if commit:
            conn.commit()
        return rows
    finally:
        conn.close()


def init_db():
    os.makedirs(FILES_DIR, exist_ok=True)
    conn = connect()
    conn.execute('PRAGMA journal_mode = WAL')
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'user')), created_at TEXT NOT NULL,
            email TEXT NOT NULL DEFAULT '');
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY, owner_username TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL,
            uploaded_by TEXT NOT NULL, uploaded_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sent_notifications (key TEXT PRIMARY KEY, sent_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at REAL NOT NULL);
    """)
    conn.commit()
    conn.close()


def uid():
    return secrets.token_hex(8) + format(int(time.time() * 1000), 'x')


def now_iso():
    return datetime.now().isoformat(timespec='seconds')


# ============================================================ senhas e sessoes

def hash_password(password):
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode('utf-8'), salt=salt, n=16384, r=8, p=1, dklen=32)
    return 'scrypt$%s$%s' % (salt.hex(), digest.hex())


def verify_password(password, stored):
    try:
        scheme, salt_hex, digest_hex = stored.split('$')
        if scheme != 'scrypt':
            return False
        digest = hashlib.scrypt(password.encode('utf-8'), salt=bytes.fromhex(salt_hex), n=16384, r=8, p=1, dklen=32)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except Exception:
        return False


def public_user(u):
    return {'id': u['id'], 'username': u['username'], 'role': u['role'], 'email': u['email'] or ''}


def count_users():
    return q('SELECT COUNT(*) AS c FROM users', one=True)['c']


# freio simples contra tentativas de senha em sequencia
_fails = {}
_fails_lock = threading.Lock()


def too_many_fails(ip):
    with _fails_lock:
        n, first = _fails.get(ip, (0, time.time()))
        if time.time() - first > 300:
            _fails.pop(ip, None)
            return False
        return n >= 8


def register_fail(ip):
    with _fails_lock:
        n, first = _fails.get(ip, (0, time.time()))
        if time.time() - first > 300:
            n, first = 0, time.time()
        _fails[ip] = (n + 1, first)


# ============================================================ avisos por e-mail

MAIL_DEFAULTS = {'enabled': False, 'host': '', 'port': 587, 'secure': False, 'user': '', 'password': '',
                 'from': '', 'daysBefore': 2, 'ccOwner': True, 'appUrl': '', 'insecureTls': False}
EMAIL_RE = re.compile(r'^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$')
_mail_lock = threading.Lock()
PUBLIC_URL = ''  # preenchido ao iniciar (endereco de rede), usado se "Endereco do sistema" estiver vazio


def valid_email(e):
    return isinstance(e, str) and bool(EMAIL_RE.match(e.strip()))


def get_mail_settings():
    row = q("SELECT value FROM settings WHERE key = 'email'", one=True)
    saved = {}
    if row:
        try:
            saved = json.loads(row['value'])
        except Exception:
            saved = {}
    s = dict(MAIL_DEFAULTS)
    s.update(saved)
    return s


def save_mail_settings(patch):
    s = get_mail_settings()
    for k in ('host', 'user', 'from', 'appUrl'):
        if isinstance(patch.get(k), str):
            s[k] = patch[k].strip()
    if isinstance(patch.get('password'), str) and patch['password'] != '':
        s['password'] = patch['password']
    if patch.get('clearPassword'):
        s['password'] = ''
    if patch.get('port') is not None:
        try:
            s['port'] = max(1, min(65535, int(patch['port'])))
        except (TypeError, ValueError):
            s['port'] = 587
    if patch.get('daysBefore') is not None:
        try:
            s['daysBefore'] = max(0, min(30, int(round(float(patch['daysBefore'])))))
        except (TypeError, ValueError):
            s['daysBefore'] = 2
    for k in ('enabled', 'secure', 'ccOwner', 'insecureTls'):
        if isinstance(patch.get(k), bool):
            s[k] = patch[k]
    q("INSERT INTO settings (key, value) VALUES ('email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      (json.dumps(s),), commit=True)
    return s


def public_mail_settings(s):
    out = {k: v for k, v in s.items() if k != 'password'}
    out['hasPassword'] = bool(s.get('password'))
    return out


def mail_configured(s):
    return bool(s['host'] and s['from'])


def send_mail(s, to, subject, text, html_body=None, cc=None):
    msg = EmailMessage()
    msg['From'] = s['from']
    msg['To'] = to
    if cc:
        msg['Cc'] = cc
    msg['Subject'] = subject
    msg.set_content(text)
    if html_body:
        msg.add_alternative(html_body, subtype='html')
    if s['insecureTls']:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    else:
        ctx = ssl.create_default_context()
    if s['secure']:
        server = smtplib.SMTP_SSL(s['host'], s['port'], timeout=30, context=ctx)
    else:
        server = smtplib.SMTP(s['host'], s['port'], timeout=30)
    try:
        server.ehlo()
        if not s['secure'] and server.has_extn('starttls'):
            server.starttls(context=ctx)
            server.ehlo()
        if s['user']:
            server.login(s['user'], s['password'])
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass


def task_done(t):
    subs = t.get('subtasks') or []
    if subs:
        return all(x.get('done') for x in subs)
    return bool(t.get('done'))


def email_for(name, explicit, users):
    if valid_email(explicit or ''):
        return explicit.strip()
    n = (name or '').strip().lower()
    if not n:
        return ''
    for u in users:
        if u['username'].lower() == n and valid_email(u['email'] or ''):
            return u['email'].strip()
    return ''


def fmt_br(iso):
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', iso or '')
    return '%s/%s/%s' % (m.group(3), m.group(2), m.group(1)) if m else iso


def days_until(iso, today):
    return (datetime.strptime(iso, '%Y-%m-%d').date() - today).days


def collect_due_items(s, today):
    users = q('SELECT username, email FROM users')
    items = []
    for row in q('SELECT id, owner_username, data FROM projects'):
        try:
            project = json.loads(row['data'])
        except Exception:
            continue
        owner = next((u for u in users if u['username'] == row['owner_username']), None)
        owner_email = owner['email'].strip() if owner and valid_email(owner['email'] or '') else ''
        topics = project.get('topics') or []
        tasks = project.get('tasks') or []
        for topic in topics:
            if not topic.get('deadline'):
                continue
            ts = [t for t in tasks if (t.get('topicId') or '') == topic.get('id')]
            if ts and all(task_done(t) for t in ts):
                continue
            items.append({'kind': 'topic', 'id': topic.get('id'), 'label': topic.get('name') or 'Topico sem nome',
                          'deadline': topic['deadline'], 'responsible': topic.get('responsible') or '',
                          'topicName': '', 'to': email_for(topic.get('responsible'), topic.get('responsibleEmail'), users),
                          'ownerEmail': owner_email, 'project': project, 'projectId': row['id']})
        for task in tasks:
            if not task.get('plannedDate') or task_done(task):
                continue
            topic = next((t for t in topics if t.get('id') == task.get('topicId')), None)
            to = email_for(task.get('responsible'), task.get('responsibleEmail'), users)
            if not to and topic:
                to = email_for(topic.get('responsible'), topic.get('responsibleEmail'), users)
            items.append({'kind': 'task', 'id': task.get('id'), 'label': task.get('text') or 'Etapa sem nome',
                          'deadline': task['plannedDate'],
                          'responsible': task.get('responsible') or (topic.get('responsible') if topic else '') or '',
                          'topicName': topic.get('name') if topic else '', 'to': to,
                          'ownerEmail': owner_email, 'project': project, 'projectId': row['id']})
    out = []
    for it in items:
        try:
            d = days_until(it['deadline'], today)
        except ValueError:
            continue
        if 0 <= d <= s['daysBefore']:
            out.append(it)
    return out


def build_message(it, s, days):
    quando = 'vence HOJE' if days == 0 else 'vence amanha' if days == 1 else 'vence em %d dias' % days
    quando_html = quando.replace('amanha', 'amanhã')
    tipo = 'Tópico' if it['kind'] == 'topic' else 'Etapa'
    pname = it['project'].get('name') or 'Projeto'
    subject = 'Prazo: %s "%s" %s (%s) - %s' % (tipo.lower(), it['label'], quando_html, fmt_br(it['deadline']), pname)
    link = (s['appUrl'] or PUBLIC_URL).rstrip('/')
    lines = ['Olá%s!' % (', ' + it['responsible'] if it['responsible'] else ''), '',
             '%s "%s" %s.' % (tipo, it['label'], quando_html), 'Projeto: %s' % pname]
    if it['topicName']:
        lines.append('Tópico: %s' % it['topicName'])
    lines.append('Prazo: %s' % fmt_br(it['deadline']))
    if link:
        lines += ['', 'Abrir o sistema: %s' % link]
    lines += ['', 'Mensagem automática do sistema Gestão de Projetos - AUTOMAÇÃO.']
    e = html.escape
    topic_row = ('<tr><td style="padding:2px 14px 2px 0;color:#5d6b7c">Tópico</td><td>%s</td></tr>' % e(it['topicName'])) if it['topicName'] else ''
    btn = ('<p style="margin:16px 0"><a href="%s" style="background:#0d385b;color:#fff;padding:8px 16px;border-radius:5px;text-decoration:none">Abrir o sistema</a></p>' % e(link)) if link else ''
    body = ('<div style="font-family:Segoe UI,Arial,sans-serif;color:#16212f;max-width:520px"><div style="border-top:3px solid #0d385b;padding-top:14px">'
            '<p style="margin:0 0 12px">Olá%s!</p>'
            '<p style="margin:0 0 14px;font-size:16px">%s <strong>%s</strong> <strong style="color:#c23a31">%s</strong>.</p>'
            '<table style="border-collapse:collapse;font-size:14px">'
            '<tr><td style="padding:2px 14px 2px 0;color:#5d6b7c">Projeto</td><td>%s</td></tr>%s'
            '<tr><td style="padding:2px 14px 2px 0;color:#5d6b7c">Prazo</td><td><strong>%s</strong></td></tr></table>%s'
            '<p style="margin:18px 0 0;font-size:12px;color:#5d6b7c">Mensagem automática - Gestão de Projetos · AUTOMAÇÃO</p></div></div>') % (
        (', <strong>%s</strong>' % e(it['responsible'])) if it['responsible'] else '',
        tipo, e(it['label']), quando_html, e(pname), topic_row, fmt_br(it['deadline']), btn)
    cc = None
    if s['ccOwner'] and it['ownerEmail'] and it['ownerEmail'].lower() != it['to'].lower():
        cc = it['ownerEmail']
    return subject, '\n'.join(lines), body, cc


def run_mail_check():
    result = {'sent': 0, 'skippedNoRecipient': 0, 'failed': 0, 'errors': [], 'disabled': False}
    s = get_mail_settings()
    if not s['enabled'] or not mail_configured(s):
        result['disabled'] = True
        return result
    if not _mail_lock.acquire(blocking=False):
        result['errors'].append('Ja existe uma verificacao em andamento.')
        return result
    try:
        today = date.today()
        for it in collect_due_items(s, today):
            key = '%s:%s:%s:%s' % (it['kind'], it['projectId'], it['id'], it['deadline'])
            if q('SELECT 1 FROM sent_notifications WHERE key = ?', (key,), one=True):
                continue
            if not it['to']:
                result['skippedNoRecipient'] += 1
                continue
            try:
                subject, text, body, cc = build_message(it, s, days_until(it['deadline'], today))
                send_mail(s, it['to'], subject, text, body, cc)
                q('INSERT OR REPLACE INTO sent_notifications (key, sent_at) VALUES (?, ?)', (key, now_iso()), commit=True)
                result['sent'] += 1
                print('[e-mail] aviso enviado para %s: %s (%s)' % (it['to'], it['label'], it['deadline']))
            except Exception as e:
                result['failed'] += 1
                result['errors'].append('%s: %s' % (it['label'], e))
                print('[e-mail] falha ao enviar para %s: %s' % (it['to'], e))
    finally:
        _mail_lock.release()
    return result


def mail_scheduler():
    time.sleep(20)
    while True:
        try:
            run_mail_check()
        except Exception as e:
            print('[e-mail] erro:', e)
        time.sleep(30 * 60)


# ============================================================ servidor HTTP

def clean_filename(raw):
    try:
        name = unquote(raw or 'arquivo')
    except Exception:
        name = 'arquivo'
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '_', name).strip()[:200]
    return name or 'arquivo'


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'GestaoProjetos'

    def log_message(self, fmt, *args):  # silencioso
        pass

    # ---------- utilitarios de resposta
    def send_bytes(self, status, body, ctype, extra=None, close=False):
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        if close:
            self.send_header('Connection', 'close')
            self.close_connection = True
        for k, v in (extra or []):
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def send_json(self, status, obj, extra=None, close=False):
        self.send_bytes(status, json.dumps(obj).encode('utf-8'), 'application/json; charset=utf-8', extra, close)

    def err(self, status, code, close=False, **more):
        d = {'error': code}
        d.update(more)
        self.send_json(status, d, close=close)

    # ---------- autenticacao
    def session_token(self):
        for part in (self.headers.get('Cookie') or '').split(';'):
            k, _, v = part.strip().partition('=')
            if k == 'gestao_sid':
                return v
        return ''

    def current_user(self):
        tok = self.session_token()
        if not tok:
            return None
        row = q('SELECT user_id, expires_at FROM sessions WHERE token = ?', (tok,), one=True)
        if not row or row['expires_at'] < time.time():
            return None
        return q('SELECT * FROM users WHERE id = ?', (row['user_id'],), one=True)

    def start_session(self, user_id):
        tok = secrets.token_urlsafe(32)
        q('DELETE FROM sessions WHERE expires_at < ?', (time.time(),), commit=True)
        q('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', (tok, user_id, time.time() + SESSION_SECONDS), commit=True)
        return [('Set-Cookie', 'gestao_sid=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d' % (tok, SESSION_SECONDS))]

    # ---------- despacho
    def do_GET(self): self.dispatch()
    def do_HEAD(self): self.dispatch()
    def do_POST(self): self.dispatch()
    def do_PUT(self): self.dispatch()
    def do_DELETE(self): self.dispatch()

    def dispatch(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            if not path.startswith('/api/'):
                if self.command not in ('GET', 'HEAD'):
                    return self.err(405, 'method_not_allowed', close=True)
                return self.serve_static(path)

            # upload: corpo lido em streaming dentro do proprio tratador
            m = re.match(r'^/api/projects/([^/]+)/files$', path)
            if m and self.command == 'POST':
                return self.api_upload(m.group(1))

            length = int(self.headers.get('Content-Length') or 0)
            if length > MAX_JSON_BYTES:
                return self.err(413, 'too_large', close=True)
            raw = self.rfile.read(length) if length else b''
            body = {}
            if raw:
                try:
                    body = json.loads(raw.decode('utf-8'))
                except Exception:
                    return self.err(400, 'invalid_json')
            return self.route_api(path, parse_qs(parsed.query), body)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception:
            traceback.print_exc()
            try:
                self.err(500, 'server_error', close=True)
            except Exception:
                pass

    # ---------- arquivos estaticos (a pagina do app)
    def serve_static(self, path):
        path = unquote(path)
        if path.endswith('/'):
            path += 'index.html'
        parts = [p for p in path.split('/') if p]
        if any(p.startswith('.') or p == '..' for p in parts) or (parts and parts[0].lower() in BLOCKED_TOP):
            return self.err(404, 'not_found')
        full = os.path.realpath(os.path.join(BASE_DIR, *parts))
        if not full.startswith(BASE_DIR + os.sep) or not os.path.isfile(full):
            return self.err(404, 'not_found')
        ext = os.path.splitext(full)[1].lower()
        ctype = STATIC_MIME.get(ext) or mimetypes.guess_type(full)[0] or 'application/octet-stream'
        size = os.path.getsize(full)
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(size))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        if self.command != 'HEAD':
            with open(full, 'rb') as f:
                while True:
                    chunk = f.read(1 << 20)
                    if not chunk:
                        break
                    self.wfile.write(chunk)

    # ---------- API
    def route_api(self, path, query, body):
        method = self.command
        ip = self.client_address[0]

        if path == '/api/session' and method == 'GET':
            u = self.current_user()
            if not u:
                return self.send_json(200, {'user': None, 'needsBootstrap': count_users() == 0})
            return self.send_json(200, {'user': public_user(u), 'needsBootstrap': False})

        if path == '/api/bootstrap' and method == 'POST':
            if count_users() > 0:
                return self.err(409, 'already_initialized')
            username = (body.get('username') or '').strip()
            password = body.get('password') or ''
            if not username or not password:
                return self.err(400, 'missing_fields')
            uid_ = uid()
            q('INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
              (uid_, username, hash_password(password), 'admin', now_iso()), commit=True)
            u = q('SELECT * FROM users WHERE id = ?', (uid_,), one=True)
            return self.send_json(200, {'user': public_user(u)}, extra=self.start_session(uid_))

        if path == '/api/login' and method == 'POST':
            if too_many_fails(ip):
                return self.err(429, 'too_many_attempts')
            u = q('SELECT * FROM users WHERE username = ?', ((body.get('username') or '').strip(),), one=True)
            if not u or not verify_password(body.get('password') or '', u['password_hash']):
                register_fail(ip)
                return self.err(401, 'invalid_credentials')
            return self.send_json(200, {'user': public_user(u)}, extra=self.start_session(u['id']))

        if path == '/api/logout' and method == 'POST':
            tok = self.session_token()
            if tok:
                q('DELETE FROM sessions WHERE token = ?', (tok,), commit=True)
            return self.send_json(200, {'ok': True}, extra=[('Set-Cookie', 'gestao_sid=; Path=/; HttpOnly; Max-Age=0')])

        user = self.current_user()
        if not user:
            return self.err(401, 'not_authenticated')
        is_admin = user['role'] == 'admin'

        # ---- usuarios (admin)
        if path == '/api/users' and method == 'GET':
            if not is_admin:
                return self.err(403, 'forbidden')
            rows = q('SELECT id, username, role, email FROM users ORDER BY username')
            return self.send_json(200, {'users': [dict(r) for r in rows]})

        if path == '/api/users' and method == 'POST':
            if not is_admin:
                return self.err(403, 'forbidden')
            username = (body.get('username') or '').strip()
            password = body.get('password') or ''
            email = (body.get('email') or '').strip()
            if not username or not password:
                return self.err(400, 'missing_fields')
            if email and not valid_email(email):
                return self.err(400, 'invalid_email')
            if q('SELECT 1 FROM users WHERE username = ?', (username,), one=True):
                return self.err(409, 'username_taken')
            role = 'admin' if body.get('role') == 'admin' else 'user'
            new_id = uid()
            q('INSERT INTO users (id, username, password_hash, role, created_at, email) VALUES (?, ?, ?, ?, ?, ?)',
              (new_id, username, hash_password(password), role, now_iso(), email), commit=True)
            return self.send_json(200, {'user': {'id': new_id, 'username': username, 'role': role, 'email': email}})

        m = re.match(r'^/api/users/([^/]+)$', path)
        if m:
            if not is_admin:
                return self.err(403, 'forbidden')
            target = q('SELECT * FROM users WHERE id = ?', (m.group(1),), one=True)
            if not target:
                return self.err(404, 'not_found')
            if method == 'PUT':
                email = (body.get('email') or '').strip()
                if email and not valid_email(email):
                    return self.err(400, 'invalid_email')
                q('UPDATE users SET email = ? WHERE id = ?', (email, target['id']), commit=True)
                return self.send_json(200, {'ok': True, 'email': email})
            if method == 'DELETE':
                if target['id'] == user['id']:
                    return self.err(400, 'cannot_delete_self')
                if target['role'] == 'admin' and q("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'", one=True)['c'] <= 1:
                    return self.err(400, 'last_admin')
                q('DELETE FROM users WHERE id = ?', (target['id'],), commit=True)
                q('DELETE FROM sessions WHERE user_id = ?', (target['id'],), commit=True)
                return self.send_json(200, {'ok': True})

        # ---- avisos por e-mail (admin)
        if path.startswith('/api/settings/email'):
            if not is_admin:
                return self.err(403, 'forbidden')
            if path == '/api/settings/email' and method == 'GET':
                return self.send_json(200, {'settings': public_mail_settings(get_mail_settings())})
            if path == '/api/settings/email' and method == 'PUT':
                return self.send_json(200, {'settings': public_mail_settings(save_mail_settings(body))})
            if path == '/api/settings/email/test' and method == 'POST':
                to = (body.get('to') or '').strip()
                if not valid_email(to):
                    return self.err(400, 'invalid_email')
                s = get_mail_settings()
                if not mail_configured(s):
                    return self.err(400, 'not_configured')
                try:
                    send_mail(s, to, 'Teste - Gestão de Projetos AUTOMAÇÃO',
                              'Se você recebeu esta mensagem, o envio de avisos de prazo está funcionando.')
                    return self.send_json(200, {'ok': True})
                except Exception as e:
                    return self.err(502, 'send_failed', detail=str(e))
            if path == '/api/settings/email/run' and method == 'POST':
                return self.send_json(200, {'result': run_mail_check()})

        # ---- projetos
        if path == '/api/projects' and method == 'GET':
            if is_admin:
                rows = q('SELECT * FROM projects')
            else:
                rows = q('SELECT * FROM projects WHERE owner_username = ?', (user['username'],))
            projects = []
            for r in rows:
                d = json.loads(r['data'])
                d['id'] = r['id']
                d['ownerUsername'] = r['owner_username']
                projects.append(d)
            return self.send_json(200, {'projects': projects})

        if path == '/api/projects' and method == 'POST':
            project = body.get('project')
            if not isinstance(project, dict) or not project.get('id'):
                return self.err(400, 'invalid_project')
            if q('SELECT 1 FROM projects WHERE id = ?', (project['id'],), one=True):
                return self.err(409, 'duplicate_id')
            pid = project.pop('id')
            project.pop('ownerUsername', None)
            q('INSERT INTO projects (id, owner_username, data, updated_at) VALUES (?, ?, ?, ?)',
              (pid, user['username'], json.dumps(project), now_iso()), commit=True)
            return self.send_json(200, {'ok': True, 'ownerUsername': user['username']})

        m = re.match(r'^/api/projects/([^/]+)$', path)
        if m and method in ('PUT', 'DELETE'):
            row = q('SELECT * FROM projects WHERE id = ?', (m.group(1),), one=True)
            if not row:
                return self.err(404, 'not_found')
            if not (is_admin or row['owner_username'] == user['username']):
                return self.err(403, 'forbidden')
            if method == 'PUT':
                project = body.get('project')
                if not isinstance(project, dict):
                    return self.err(400, 'invalid_project')
                project.pop('id', None)
                project.pop('ownerUsername', None)
                q('UPDATE projects SET data = ?, updated_at = ? WHERE id = ?', (json.dumps(project), now_iso(), row['id']), commit=True)
                return self.send_json(200, {'ok': True})
            for f in q('SELECT id FROM files WHERE project_id = ?', (row['id'],)):
                self.remove_disk_file(f['id'])
            q('DELETE FROM files WHERE project_id = ?', (row['id'],), commit=True)
            q('DELETE FROM projects WHERE id = ?', (row['id'],), commit=True)
            return self.send_json(200, {'ok': True})

        # ---- arquivos anexados (download / remover)
        m = re.match(r'^/api/projects/([^/]+)/files/([^/]+)$', path)
        if m and method in ('GET', 'HEAD', 'DELETE'):
            row = q('SELECT * FROM projects WHERE id = ?', (m.group(1),), one=True)
            if not row:
                return self.err(404, 'not_found')
            if not (is_admin or row['owner_username'] == user['username']):
                return self.err(403, 'forbidden')
            f = q('SELECT * FROM files WHERE id = ? AND project_id = ?', (m.group(2), row['id']), one=True)
            disk = os.path.join(FILES_DIR, f['id']) if f else ''
            if not f or not os.path.isfile(disk):
                return self.err(404, 'not_found')
            if method == 'DELETE':
                q('DELETE FROM files WHERE id = ?', (f['id'],), commit=True)
                self.remove_disk_file(f['id'])
                return self.send_json(200, {'ok': True})
            ext = os.path.splitext(f['name'])[1][1:].lower()
            inline = query.get('inline', [''])[0] == '1' and ext in INLINE_MIME
            self.send_response(200)
            self.send_header('Content-Type', INLINE_MIME[ext] if inline else 'application/octet-stream')
            self.send_header('Content-Length', str(os.path.getsize(disk)))
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Disposition', "%s; filename*=UTF-8''%s" % ('inline' if inline else 'attachment', quote(f['name'])))
            self.send_header('Cache-Control', 'private, max-age=0, must-revalidate')
            self.end_headers()
            if self.command != 'HEAD':
                with open(disk, 'rb') as fh:
                    while True:
                        chunk = fh.read(1 << 20)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
            return

        return self.err(404, 'not_found')

    @staticmethod
    def remove_disk_file(file_id):
        try:
            os.remove(os.path.join(FILES_DIR, file_id))
        except OSError:
            pass

    def api_upload(self, project_id):
        user = self.current_user()
        if not user:
            return self.err(401, 'not_authenticated', close=True)
        row = q('SELECT * FROM projects WHERE id = ?', (project_id,), one=True)
        if not row:
            return self.err(404, 'not_found', close=True)
        if not (user['role'] == 'admin' or row['owner_username'] == user['username']):
            return self.err(403, 'forbidden', close=True)
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return self.err(400, 'empty_file', close=True)
        if length > MAX_UPLOAD_BYTES:
            return self.err(413, 'file_too_large', close=True, maxMb=MAX_UPLOAD_MB)
        file_id = uid()
        name = clean_filename(self.headers.get('X-File-Name'))
        target = os.path.join(FILES_DIR, file_id)
        remaining = length
        try:
            with open(target, 'wb') as f:
                while remaining > 0:
                    chunk = self.rfile.read(min(1 << 20, remaining))
                    if not chunk:
                        break
                    f.write(chunk)
                    remaining -= len(chunk)
        except OSError:
            self.remove_disk_file(file_id)
            return self.err(500, 'write_failed', close=True)
        if remaining > 0:
            self.remove_disk_file(file_id)
            self.close_connection = True
            return
        uploaded_at = now_iso()
        q('INSERT INTO files (id, project_id, name, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)',
          (file_id, row['id'], name, length, user['username'], uploaded_at), commit=True)
        self.send_json(200, {'file': {'id': file_id, 'name': name, 'size': length,
                                      'uploadedBy': user['username'], 'uploadedAt': uploaded_at}})


# ============================================================ inicio

def lan_ips():
    ips = []
    try:  # IP da placa usada para sair para a rede (nao envia nenhum dado)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ips.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.append(info[4][0])
    except Exception:
        pass
    out = []
    for ip in ips:
        if ip and not ip.startswith('127.') and not ip.startswith('169.254.') and ip not in out:
            out.append(ip)
    return out


def main():
    global PUBLIC_URL
    try:
        sys.stdout.reconfigure(errors='replace')
        sys.stderr.reconfigure(errors='replace')
    except Exception:
        pass
    port = int(os.environ.get('PORT') or DEFAULT_PORT)
    if '--porta' in sys.argv:
        port = int(sys.argv[sys.argv.index('--porta') + 1])
    init_db()
    try:
        httpd = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    except OSError as e:
        print('\nNao foi possivel abrir a porta %d: %s' % (port, e))
        print('Provavelmente o servidor ja esta aberto em outra janela, ou outro programa usa essa porta.')
        print('Para usar outra porta:  python servidor.py --porta 2524')
        return 1

    ips = lan_ips()
    PUBLIC_URL = 'http://%s:%d' % (ips[0], port) if ips else ''
    print('=' * 60)
    print(' Gestao de Projetos - AUTOMACAO  (servidor rodando)')
    print('=' * 60)
    print(' Neste computador:          http://localhost:%d' % port)
    if ips:
        print(' Nos OUTROS computadores:')
        for ip in ips:
            print('                            http://%s:%d' % (ip, port))
    print('')
    print(' Deixe esta janela aberta. Para parar, feche-a (ou Ctrl+C).')
    print(' Se os outros computadores nao abrirem, o Firewall do Windows')
    print(' provavelmente esta bloqueando a porta %d (peca ao TI para liberar).' % port)
    print('=' * 60)
    try:
        with open(os.path.join(BASE_DIR, 'endereco.txt'), 'w', encoding='utf-8') as f:
            f.write('Neste computador: http://localhost:%d\n' % port)
            for ip in ips:
                f.write('Outros computadores: http://%s:%d\n' % (ip, port))
    except OSError:
        pass

    threading.Thread(target=mail_scheduler, daemon=True).start()
    if '--sem-navegador' not in sys.argv:
        threading.Timer(1.0, lambda: webbrowser.open('http://localhost:%d' % port)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor parado.')
    return 0


if __name__ == '__main__':
    code = 0
    try:
        code = main() or 0
    except Exception:
        traceback.print_exc()
        code = 1
    if code != 0 and sys.stdin and sys.stdin.isatty():
        input('\nPressione Enter para fechar...')
    sys.exit(code)
