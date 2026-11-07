'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'gestao.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    owner_username TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
`);

// Migrações simples (bancos criados por versões anteriores)
const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (userCols.indexOf('email') < 0) db.exec("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  -- uma linha por aviso já enviado (evita mandar o mesmo e-mail duas vezes)
  CREATE TABLE IF NOT EXISTS sent_notifications (
    key TEXT PRIMARY KEY,
    sent_at TEXT NOT NULL
  );
`);

// Os arquivos enviados (desenhos 3D, PDFs...) ficam nesta pasta, um por id.
const FILES_DIR = path.join(DATA_DIR, 'files');
fs.mkdirSync(FILES_DIR, { recursive: true });
db.FILES_DIR = FILES_DIR;

module.exports = db;
