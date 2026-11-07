'use strict';

// Avisos automáticos por e-mail: quando faltam N dias (padrão 2) para o prazo de um
// tópico ou etapa, o responsável recebe um e-mail. Roda sozinho dentro do servidor.

const nodemailer = require('nodemailer');
const db = require('./db');

const DEFAULTS = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,       // true = SSL direto (porta 465); false = STARTTLS quando disponível (587/25)
  user: '',
  password: '',
  from: '',
  daysBefore: 2,
  ccOwner: true,
  appUrl: '',
};

function getSettings() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'email'").get();
  let saved = {};
  if (row) { try { saved = JSON.parse(row.value); } catch (e) { saved = {}; } }
  return Object.assign({}, DEFAULTS, saved);
}

function saveSettings(patch) {
  const current = getSettings();
  const next = Object.assign({}, current);
  ['host', 'user', 'from', 'appUrl'].forEach((k) => { if (typeof patch[k] === 'string') next[k] = patch[k].trim(); });
  if (typeof patch.password === 'string' && patch.password !== '') next.password = patch.password; // vazio = mantém a atual
  if (patch.clearPassword) next.password = '';
  if (patch.port !== undefined) next.port = Math.max(1, Math.min(65535, Number(patch.port) || 587));
  if (patch.daysBefore !== undefined) next.daysBefore = Math.max(0, Math.min(30, Math.round(Number(patch.daysBefore)) || 0));
  ['enabled', 'secure', 'ccOwner'].forEach((k) => { if (typeof patch[k] === 'boolean') next[k] = patch[k]; });
  db.prepare("INSERT INTO settings (key, value) VALUES ('email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(next));
  return next;
}

function publicSettings(s) {
  const { password, ...rest } = s;
  return Object.assign(rest, { hasPassword: !!password });
}

function makeTransport(s) {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: !!s.secure,
    auth: s.user ? { user: s.user, pass: s.password } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

function configured(s) {
  return !!(s.host && s.from);
}

async function sendMail(s, message) {
  const transport = makeTransport(s);
  try {
    return await transport.sendMail(Object.assign({ from: s.from }, message));
  } finally {
    transport.close();
  }
}

// ---------- datas ----------

function todayLocalISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function daysUntil(iso, todayIso) {
  const a = new Date(iso + 'T00:00:00');
  const b = new Date(todayIso + 'T00:00:00');
  return Math.round((a - b) / 86400000);
}

function formatBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? m[3] + '/' + m[2] + '/' + m[1] : iso;
}

function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- quem recebe ----------

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e.trim());
}

function loadUsers() {
  return db.prepare('SELECT username, email FROM users').all();
}

// e-mail digitado no próprio item; se não houver, procura um usuário do sistema com o
// mesmo nome do responsável (e que tenha e-mail cadastrado).
function emailFor(responsibleName, explicitEmail, users) {
  if (isValidEmail(explicitEmail)) return explicitEmail.trim();
  const name = (responsibleName || '').trim().toLowerCase();
  if (!name) return '';
  const hit = users.find((u) => u.username.toLowerCase() === name && isValidEmail(u.email));
  return hit ? hit.email.trim() : '';
}

// ---------- verificação ----------

function taskDone(task) {
  const subs = task.subtasks || [];
  if (subs.length) return subs.every((s) => s.done);
  return !!task.done;
}

function collectDueItems(settings, todayIso) {
  const users = loadUsers();
  const rows = db.prepare('SELECT id, owner_username, data FROM projects').all();
  const items = [];
  rows.forEach((row) => {
    let project;
    try { project = JSON.parse(row.data); } catch (e) { return; }
    const owner = users.find((u) => u.username === row.owner_username);
    const ownerEmail = owner && isValidEmail(owner.email) ? owner.email.trim() : '';
    const topics = project.topics || [];
    const tasks = project.tasks || [];

    topics.forEach((topic) => {
      if (!topic.deadline) return;
      const ts = tasks.filter((t) => (t.topicId || '') === topic.id);
      const complete = ts.length > 0 && ts.every(taskDone);
      if (complete) return;
      items.push({ kind: 'topic', id: topic.id, label: topic.name || 'Tópico sem nome', deadline: topic.deadline, responsible: topic.responsible || '',
        to: emailFor(topic.responsible, topic.responsibleEmail, users), ownerEmail, project, projectId: row.id });
    });
    tasks.forEach((task) => {
      if (!task.plannedDate || taskDone(task)) return;
      const topic = topics.find((t) => t.id === task.topicId);
      const to = emailFor(task.responsible, task.responsibleEmail, users)
        || (topic ? emailFor(topic.responsible, topic.responsibleEmail, users) : '');
      items.push({ kind: 'task', id: task.id, label: task.text || 'Etapa sem nome', deadline: task.plannedDate, responsible: task.responsible || (topic && topic.responsible) || '',
        topicName: topic ? topic.name : '', to, ownerEmail, project, projectId: row.id });
    });
  });
  return items.filter((it) => {
    const d = daysUntil(it.deadline, todayIso);
    return d >= 0 && d <= settings.daysBefore;
  });
}

function buildMessage(item, settings, days) {
  const quando = days === 0 ? 'vence HOJE' : days === 1 ? 'vence amanhã' : 'vence em ' + days + ' dias';
  const tipo = item.kind === 'topic' ? 'Tópico' : 'Etapa';
  const subject = `Prazo: ${tipo.toLowerCase()} "${item.label}" ${quando} (${formatBR(item.deadline)}) — ${item.project.name || 'Projeto'}`;
  const link = settings.appUrl ? settings.appUrl.replace(/\/+$/, '') : '';
  const lines = [
    `Olá${item.responsible ? ', ' + item.responsible : ''}!`,
    '',
    `${tipo} "${item.label}" ${quando}.`,
    `Projeto: ${item.project.name || '(sem nome)'}`,
    item.topicName ? `Tópico: ${item.topicName}` : null,
    `Prazo: ${formatBR(item.deadline)}`,
    '',
    link ? `Abrir o sistema: ${link}` : null,
    '',
    'Mensagem automática do sistema Gestão de Projetos - AUTOMAÇÃO.',
  ].filter((l) => l !== null);
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#16212f;max-width:520px">
    <div style="border-top:3px solid #0d385b;padding-top:14px">
      <p style="margin:0 0 12px">Olá${item.responsible ? ', <strong>' + esc(item.responsible) + '</strong>' : ''}!</p>
      <p style="margin:0 0 14px;font-size:16px">${tipo} <strong>${esc(item.label)}</strong> <strong style="color:#c23a31">${quando}</strong>.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:2px 14px 2px 0;color:#5d6b7c">Projeto</td><td>${esc(item.project.name || '(sem nome)')}</td></tr>
        ${item.topicName ? `<tr><td style="padding:2px 14px 2px 0;color:#5d6b7c">Tópico</td><td>${esc(item.topicName)}</td></tr>` : ''}
        <tr><td style="padding:2px 14px 2px 0;color:#5d6b7c">Prazo</td><td><strong>${formatBR(item.deadline)}</strong></td></tr>
      </table>
      ${link ? `<p style="margin:16px 0"><a href="${esc(link)}" style="background:#0d385b;color:#fff;padding:8px 16px;border-radius:5px;text-decoration:none">Abrir o sistema</a></p>` : ''}
      <p style="margin:18px 0 0;font-size:12px;color:#5d6b7c">Mensagem automática — Gestão de Projetos · AUTOMAÇÃO</p>
    </div></div>`;
  const message = { to: item.to, subject, text: lines.join('\n'), html };
  if (settings.ccOwner && item.ownerEmail && item.ownerEmail.toLowerCase() !== item.to.toLowerCase()) message.cc = item.ownerEmail;
  return message;
}

let running = false;
async function runCheck() {
  const result = { sent: 0, skippedNoRecipient: 0, failed: 0, errors: [], disabled: false };
  const settings = getSettings();
  if (!settings.enabled || !configured(settings)) { result.disabled = true; return result; }
  if (running) { result.errors.push('Já existe uma verificação em andamento.'); return result; }
  running = true;
  try {
    const todayIso = todayLocalISO();
    const items = collectDueItems(settings, todayIso);
    for (const item of items) {
      const key = `${item.kind}:${item.projectId}:${item.id}:${item.deadline}`;
      if (db.prepare('SELECT 1 FROM sent_notifications WHERE key = ?').get(key)) continue;
      if (!item.to) { result.skippedNoRecipient++; continue; }
      const days = daysUntil(item.deadline, todayIso);
      try {
        await sendMail(settings, buildMessage(item, settings, days));
        db.prepare('INSERT OR REPLACE INTO sent_notifications (key, sent_at) VALUES (?, ?)').run(key, new Date().toISOString());
        result.sent++;
        console.log(`[e-mail] aviso enviado para ${item.to}: ${item.label} (${item.deadline})`);
      } catch (e) {
        result.failed++;
        result.errors.push(`${item.label}: ${e.message}`);
        console.error(`[e-mail] falha ao enviar para ${item.to}:`, e.message);
      }
    }
  } finally {
    running = false;
  }
  return result;
}

function start() {
  // confere logo após iniciar e depois a cada 30 minutos
  setTimeout(() => runCheck().catch((e) => console.error('[e-mail]', e.message)), 20000);
  setInterval(() => runCheck().catch((e) => console.error('[e-mail]', e.message)), 30 * 60 * 1000);
}

module.exports = { getSettings, saveSettings, publicSettings, configured, sendMail, runCheck, start, isValidEmail };
