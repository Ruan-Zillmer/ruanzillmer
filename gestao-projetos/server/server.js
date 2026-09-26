'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.join(__dirname, '..');

app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
app.use(session({
  name: 'gestao_sid',
  secret: process.env.SESSION_SECRET || 'troque-este-segredo-antes-de-usar-a-serio',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30 }, // 30 dias
}));

// Bloqueia qualquer acesso HTTP direto à pasta do servidor (código-fonte e,
// principalmente, o banco de dados em server/data) antes de servir arquivos estáticos.
app.use('/server', (req, res) => res.status(404).end());

function uid() {
  return crypto.randomBytes(8).toString('hex') + Date.now().toString(36);
}

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role };
}

function countUsers() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
}

function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'not_authenticated' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'not_authenticated' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  next();
}

// ---------- sessão / login ----------

app.get('/api/session', (req, res) => {
  if (!req.session.userId) return res.json({ user: null, needsBootstrap: countUsers() === 0 });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.json({ user: null, needsBootstrap: countUsers() === 0 });
  res.json({ user: publicUser(user), needsBootstrap: false });
});

app.post('/api/bootstrap', (req, res) => {
  if (countUsers() > 0) return res.status(409).json({ error: 'already_initialized' });
  const { username, password } = req.body || {};
  if (!username || !username.trim() || !password) return res.status(400).json({ error: 'missing_fields' });
  const id = uid();
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, username.trim(), passwordHash, 'admin', new Date().toISOString());
  req.session.userId = id;
  res.json({ user: { id, username: username.trim(), role: 'admin' } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = findUserByUsername((username || '').trim());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ---------- usuários (somente admin) ----------

app.get('/api/users', requireLogin, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role FROM users ORDER BY username').all();
  res.json({ users });
});

app.post('/api/users', requireLogin, requireAdmin, (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !username.trim() || !password) return res.status(400).json({ error: 'missing_fields' });
  if (findUserByUsername(username.trim())) return res.status(409).json({ error: 'username_taken' });
  const id = uid();
  const passwordHash = bcrypt.hashSync(password, 10);
  const finalRole = role === 'admin' ? 'admin' : 'user';
  db.prepare('INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, username.trim(), passwordHash, finalRole, new Date().toISOString());
  res.json({ user: { id, username: username.trim(), role: finalRole } });
});

app.delete('/api/users/:id', requireLogin, requireAdmin, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'not_found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'cannot_delete_self' });
  if (target.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
    if (adminCount <= 1) return res.status(400).json({ error: 'last_admin' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- projetos ----------

function rowToProject(row) {
  const data = JSON.parse(row.data);
  data.id = row.id;
  data.ownerUsername = row.owner_username;
  return data;
}

app.get('/api/projects', requireLogin, (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare('SELECT * FROM projects').all()
    : db.prepare('SELECT * FROM projects WHERE owner_username = ?').all(req.user.username);
  res.json({ projects: rows.map(rowToProject) });
});

app.post('/api/projects', requireLogin, (req, res) => {
  const project = req.body && req.body.project;
  if (!project || !project.id) return res.status(400).json({ error: 'invalid_project' });
  if (db.prepare('SELECT id FROM projects WHERE id = ?').get(project.id)) {
    return res.status(409).json({ error: 'duplicate_id' });
  }
  const { id, ownerUsername, ...rest } = project;
  db.prepare('INSERT INTO projects (id, owner_username, data, updated_at) VALUES (?, ?, ?, ?)')
    .run(id, req.user.username, JSON.stringify(rest), new Date().toISOString());
  res.json({ ok: true, ownerUsername: req.user.username });
});

function loadProjectRow(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function canEditProject(req, row) {
  return !!row && (req.user.role === 'admin' || row.owner_username === req.user.username);
}

app.put('/api/projects/:id', requireLogin, (req, res) => {
  const row = loadProjectRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (!canEditProject(req, row)) return res.status(403).json({ error: 'forbidden' });
  const project = req.body && req.body.project;
  if (!project) return res.status(400).json({ error: 'invalid_project' });
  const { id, ownerUsername, ...rest } = project;
  db.prepare('UPDATE projects SET data = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(rest), new Date().toISOString(), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/projects/:id', requireLogin, (req, res) => {
  const row = loadProjectRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (!canEditProject(req, row)) return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- arquivos estáticos (a própria página do app) ----------
app.use(express.static(STATIC_ROOT));

app.listen(PORT, () => {
  console.log(`Gestão de Projetos - AUTOMAÇÃO rodando em http://localhost:${PORT}`);
  console.log('Deixe esta janela aberta (ou rode como serviço) para o app continuar disponível.');
});
