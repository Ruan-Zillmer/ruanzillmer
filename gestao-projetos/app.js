'use strict';

const API = '/api';

const STATUS_OPTIONS = [
  { value: 'planejamento', label: 'Planejamento' },
  { value: 'em-andamento', label: 'Em andamento' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];

const PRIORITY_OPTIONS = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

const METHODOLOGY_SUGGESTIONS = ['Kanban', 'Scrum', 'PDCA', '5W2H', 'Cronograma / Gantt', 'PMBOK', 'Ágil', 'Waterfall'];

const MATERIAL_CATEGORY_SUGGESTIONS = ['Elétrica', 'Mecânica', 'Hidráulica', 'Automação', 'Estrutural', 'Outros'];

// Cada metodologia lista suas ferramentas típicas (com explicação) e qual "widget" integrado
// usar as tarefas/dados do próprio projeto para viabilizar aquela ferramenta na prática.
const METHODOLOGY_INFO = {
  kanban: {
    label: 'Kanban',
    summary: 'Gestão visual do fluxo de trabalho, organizando as tarefas por status em colunas.',
    tools: [
      { name: 'Quadro Kanban', description: 'Organiza as tarefas em colunas (A fazer, Em andamento, Concluído) para visualizar o fluxo de trabalho e identificar gargalos rapidamente.' },
    ],
    widget: 'kanban',
  },
  scrum: {
    label: 'Scrum',
    summary: 'Entrega iterativa em ciclos curtos (sprints), com uma lista priorizada de pendências (backlog).',
    tools: [
      { name: 'Backlog e Sprint', description: 'Separa as tarefas pendentes (backlog) das que estão no ciclo de trabalho atual (sprint), para manter o foco no que precisa ser entregue agora.' },
      { name: 'Reunião diária (Daily)', description: 'Alinhamento rápido e diário sobre o que foi feito, o que será feito e quais bloqueios existem — use a descrição de cada tarefa para registrar esse andamento.' },
    ],
    widget: 'sprint',
  },
  pdca: {
    label: 'PDCA',
    summary: 'Ciclo de melhoria contínua em 4 etapas: Planejar, Fazer (Do), Checar (Check) e Agir.',
    tools: [
      { name: 'Ciclo PDCA', description: 'Estrutura o projeto em 4 etapas: planejar a ação, executar (fazer), checar se o resultado foi o esperado e agir para corrigir ou padronizar.' },
    ],
    widget: 'pdca',
  },
  '5w2h': {
    label: '5W2H',
    summary: 'Plano de ação estruturado em 7 perguntas-chave, para não esquecer nenhum detalhe antes de começar.',
    tools: [
      { name: 'Formulário 5W2H', description: 'Responde O quê, Por quê, Onde, Quando, Quem, Como e Quanto custa — garante que o plano de ação está completo antes de sair executando.' },
    ],
    widget: '5w2h',
  },
  gantt: {
    label: 'Cronograma / Gantt',
    summary: 'Visualização do cronograma das tarefas ao longo do tempo, mostrando prazos e sobreposições.',
    tools: [
      { name: 'Gráfico de Gantt', description: 'Mostra a data de início e fim de cada tarefa numa linha do tempo, facilitando enxergar prazos, atrasos e o que pode ser feito em paralelo.' },
    ],
    widget: 'gantt',
  },
  pmbok: {
    label: 'PMBOK',
    summary: 'Guia de boas práticas de gestão de projetos do PMI, organizado em grupos de processos.',
    tools: [
      { name: 'Grupos de processo', description: 'Checklist dos 5 grupos de processo do PMBOK: Iniciação, Planejamento, Execução, Monitoramento e Controle, e Encerramento.' },
    ],
    widget: 'stages',
    stagesKey: 'pmbokStages',
    defaultStages: ['Iniciação', 'Planejamento', 'Execução', 'Monitoramento e Controle', 'Encerramento'],
  },
  agil: {
    label: 'Ágil',
    summary: 'Filosofia de entregas incrementais e adaptação contínua — um guarda-chuva que geralmente usa Kanban ou Scrum na prática.',
    tools: [
      { name: 'Quadro visual (Kanban)', description: 'A forma mais comum de aplicar Ágil no dia a dia: um quadro de tarefas por status, igual ao usado no Kanban.' },
    ],
    widget: 'kanban',
  },
  waterfall: {
    label: 'Waterfall (Cascata)',
    summary: 'Fases sequenciais e bem definidas — cada uma só começa quando a anterior termina.',
    tools: [
      { name: 'Fases sequenciais', description: 'Checklist das fases clássicas do modelo cascata: Requisitos, Projeto, Implementação, Verificação e Manutenção.' },
    ],
    widget: 'stages',
    stagesKey: 'waterfallStages',
    defaultStages: ['Requisitos', 'Projeto', 'Implementação', 'Verificação', 'Manutenção'],
  },
};

function methodologyKey(value) {
  const v = (value || '').trim().toLowerCase();
  if (!v) return null;
  if (v.includes('kanban')) return 'kanban';
  if (v.includes('scrum')) return 'scrum';
  if (v === 'pdca') return 'pdca';
  if (v.includes('5w2h')) return '5w2h';
  if (v.includes('gantt') || v.includes('cronograma')) return 'gantt';
  if (v.includes('pmbok')) return 'pmbok';
  if (v.includes('ágil') || v.includes('agil')) return 'agil';
  if (v.includes('waterfall') || v.includes('cascata')) return 'waterfall';
  return null;
}

let state = { projects: [] };
let selectedProjectId = null;
let currentUser = null;

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- persistência: servidor (API + SQLite em server/) ----------
// Todo o estado "de verdade" vive no servidor Node.js (pasta server/). O
// navegador só mantém uma cópia em memória para desenhar a tela; toda
// alteração é enviada para o servidor automaticamente (com um pequeno atraso
// para agrupar teclas digitadas em sequência).

async function apiFetch(path, options) {
  const res = await fetch(API + path, Object.assign({
    headers: { 'Content-Type': 'application/json' },
  }, options));
  if (res.status === 401) {
    currentUser = null;
    showLoginScreen();
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  return res;
}

async function loadProjectsFromServer() {
  const res = await apiFetch('/projects');
  if (!res.ok) throw new Error('Não foi possível carregar os projetos do servidor.');
  const data = await res.json();
  state.projects = data.projects;
  state.projects.forEach(normalizeProject);
}

// Projetos antigos não têm tópicos, conceito nem anexos: completa com valores vazios.
function normalizeProject(p) {
  p.topics = p.topics || [];
  p.tasks = p.tasks || [];
  p.concept = p.concept || { text: '', files: [] };
  p.concept.files = p.concept.files || [];
  p.concept.text = p.concept.text || '';
  p.tasks.forEach((t) => { t.files = t.files || []; t.topicId = t.topicId || ''; });
  return p;
}

let saveTimer = null;
function saveState() {
  const project = findProject(selectedProjectId);
  if (!project) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const res = await apiFetch(`/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({ project }),
      });
      if (!res.ok) throw new Error('o servidor recusou salvar (código ' + res.status + ')');
      setStatus('Salvo automaticamente às ' + new Date().toLocaleTimeString(), 'ok');
    } catch (e) {
      setStatus('Erro ao salvar no servidor: ' + e.message, 'error');
    }
  }, 500);
}

// ---------- backup manual (cópia extra opcional, o servidor já salva sozinho) ----------

function exportBackup() {
  const blob = new Blob([JSON.stringify({ projects: visibleProjects() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `projetos-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Backup exportado.', 'ok');
}

// ---------- status bar ----------

let statusTimer = null;
function setStatus(msg, kind) {
  const el = document.getElementById('status-bar');
  el.textContent = msg;
  el.className = 'status-bar' + (kind ? ' ' + kind : '');
  clearTimeout(statusTimer);
  if (kind !== 'error') {
    statusTimer = setTimeout(() => { el.textContent = ''; el.className = 'status-bar'; }, 5000);
  }
}

// ---------- autenticação (validada pelo servidor) ----------

function visibleProjects() {
  // o servidor já manda só os projetos que este usuário pode ver
  // (todos, se for admin; só os dele, caso contrário) — não precisa filtrar de novo aqui.
  return state.projects;
}

function roleLabel(role) {
  return role === 'admin' ? 'Administrador' : 'Usuário';
}

function userErrorMessage(code) {
  switch (code) {
    case 'cannot_delete_self': return 'Você não pode remover o próprio usuário logado.';
    case 'last_admin': return 'Precisa existir pelo menos um administrador.';
    case 'username_taken': return 'Já existe um usuário com esse nome.';
    case 'invalid_email': return 'E-mail inválido.';
    case 'missing_fields': return 'Preencha usuário e senha.';
    case 'invalid_credentials': return 'Usuário ou senha incorretos.';
    default: return 'Não foi possível completar a operação.';
  }
}

function showLoginScreen() {
  if (window.FileUI) FileUI.disposeInline();
  document.getElementById('app-shell').hidden = true;
  document.getElementById('login-screen').hidden = false;
}

async function loginSuccess(user) {
  currentUser = user;
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app-shell').hidden = false;
  updateSessionUI();
  try {
    await loadProjectsFromServer();
  } catch (e) {
    setStatus(e.message, 'error');
  }
  selectedProjectId = visibleProjects()[0] ? visibleProjects()[0].id : null;
  render();
}

async function logout() {
  try { await apiFetch('/logout', { method: 'POST' }); } catch (e) { /* segue mesmo se a chamada falhar */ }
  currentUser = null;
  state.projects = [];
  selectedProjectId = null;
  showLoginScreen();
  document.getElementById('login-bootstrap').hidden = true;
  document.getElementById('login-form-wrap').hidden = false;
  document.getElementById('login-error').textContent = '';
}

function updateSessionUI() {
  const label = document.getElementById('current-user-label');
  const usersToggle = document.getElementById('btn-users-toggle');
  if (!currentUser) return;
  label.innerHTML = `<strong>${escapeHtml(currentUser.username)}</strong> <span class="badge ${currentUser.role === 'admin' ? 'status-em-andamento' : 'status-planejamento'}">${roleLabel(currentUser.role)}</span>`;
  usersToggle.hidden = currentUser.role !== 'admin';
  document.getElementById('btn-email-toggle').hidden = currentUser.role !== 'admin';
}

async function renderUsersPanel() {
  const list = document.getElementById('users-list');
  const statusEl = document.getElementById('users-status-line');
  if (!list) return;
  try {
    const res = await apiFetch('/users');
    if (!res.ok) throw new Error('Não foi possível carregar os usuários.');
    const data = await res.json();
    list.innerHTML = data.users.map(u => `
      <div class="user-row">
        <span class="user-name">${escapeHtml(u.username)}<small class="user-email">${u.email ? escapeHtml(u.email) : 'sem e-mail'}</small></span>
        <button class="icon-btn user-email-edit" data-user="${u.id}" data-email="${escapeAttr(u.email || '')}" title="Alterar e-mail">✎</button>
        <span class="badge ${u.role === 'admin' ? 'status-em-andamento' : 'status-planejamento'}">${roleLabel(u.role)}</span>
        <button class="icon-btn user-delete" data-user="${u.id}" title="Remover usuário">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('.user-email-edit').forEach(btn => btn.addEventListener('click', async () => {
      const email = prompt('E-mail deste usuário (deixe vazio para remover):', btn.dataset.email);
      if (email === null) return;
      try {
        const r = await apiFetch(`/users/${btn.dataset.user}`, { method: 'PUT', body: JSON.stringify({ email }) });
        const b = await r.json();
        if (!r.ok) throw new Error(userErrorMessage(b.error));
        renderUsersPanel();
      } catch (e) {
        statusEl.textContent = e.message;
      }
    }));
    list.querySelectorAll('.user-delete').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Remover este usuário? Os projetos dele continuam existindo no servidor.')) return;
      try {
        const delRes = await apiFetch(`/users/${btn.dataset.user}`, { method: 'DELETE' });
        const body = await delRes.json();
        if (!delRes.ok) throw new Error(userErrorMessage(body.error));
        renderUsersPanel();
      } catch (e) {
        statusEl.textContent = e.message;
      }
    }));
  } catch (e) {
    statusEl.textContent = e.message;
  }
}

function wireAuthEvents() {
  document.getElementById('form-bootstrap-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('bootstrap-username').value;
    const password = document.getElementById('bootstrap-password').value;
    const confirmPassword = document.getElementById('bootstrap-password-confirm').value;
    const errorEl = document.getElementById('login-error');
    if (password !== confirmPassword) { errorEl.textContent = 'As senhas não coincidem.'; return; }
    if (!username.trim() || !password) { errorEl.textContent = 'Preencha usuário e senha.'; return; }
    try {
      const res = await fetch(API + '/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(userErrorMessage(body.error));
      await loginSuccess(body.user);
    } catch (e) {
      errorEl.textContent = e.message;
    }
  });

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    try {
      const res = await fetch(API + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(userErrorMessage(body.error));
      await loginSuccess(body.user);
    } catch (e) {
      errorEl.textContent = e.message;
    }
  });

  document.getElementById('btn-logout').addEventListener('click', logout);

  wireEmailPanel();

  document.getElementById('btn-users-toggle').addEventListener('click', () => {
    const panel = document.getElementById('users-panel');
    document.getElementById('email-panel').hidden = true;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) renderUsersPanel();
  });

  document.getElementById('btn-create-user').addEventListener('click', async () => {
    const username = document.getElementById('new-user-username').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    const email = document.getElementById('new-user-email').value;
    const statusEl = document.getElementById('users-status-line');
    try {
      const res = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, role, email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(userErrorMessage(body.error));
      document.getElementById('new-user-username').value = '';
      document.getElementById('new-user-password').value = '';
      document.getElementById('new-user-email').value = '';
      statusEl.textContent = 'Usuário criado.';
      renderUsersPanel();
    } catch (e) {
      statusEl.textContent = e.message;
    }
  });
}

// ---------- avisos de prazo por e-mail (painel do administrador) ----------

function wireEmailPanel() {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('mail-status-line');
  const say = (msg) => { statusEl.textContent = msg; };

  async function load() {
    try {
      const res = await apiFetch('/settings/email');
      if (!res.ok) throw new Error('Não foi possível carregar a configuração.');
      const s = (await res.json()).settings;
      $('mail-enabled').checked = s.enabled;
      $('mail-days').value = s.daysBefore;
      $('mail-host').value = s.host;
      $('mail-port').value = s.port;
      $('mail-provider').value = s.provider || 'google';
      $('google-client-id').value = s.googleClientId || '';
      $('google-client-secret').value = '';
      $('google-client-secret').placeholder = s.hasGoogleSecret ? '(mantida — digite para trocar)' : '';
      $('google-redirect').value = s.redirectUri || '';
      showGoogleState(s);
      showProviderBox();
      $('mail-secure').checked = s.secure;
      $('mail-insecure').checked = !!s.insecureTls;
      $('mail-user').value = s.user;
      $('mail-password').value = '';
      $('mail-password').placeholder = s.hasPassword ? '(mantida — digite para trocar)' : '';
      $('mail-from').value = s.from;
      $('mail-appurl').value = s.appUrl;
      $('mail-ccowner').checked = s.ccOwner;
      say('');
    } catch (e) { say(e.message); }
  }

  async function save() {
    const res = await apiFetch('/settings/email', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: $('mail-enabled').checked,
        daysBefore: Number($('mail-days').value),
        host: $('mail-host').value,
        port: Number($('mail-port').value),
        provider: $('mail-provider').value,
        googleClientId: $('google-client-id').value,
        googleClientSecret: $('google-client-secret').value,
        secure: $('mail-secure').checked,
        insecureTls: $('mail-insecure').checked,
        user: $('mail-user').value,
        password: $('mail-password').value,
        from: $('mail-from').value,
        appUrl: $('mail-appurl').value,
        ccOwner: $('mail-ccowner').checked,
      }),
    });
    if (!res.ok) throw new Error('O servidor recusou salvar a configuração.');
    $('mail-password').value = '';
    $('google-client-secret').value = '';
  }

  function showProviderBox() {
    const google = $('mail-provider').value === 'google';
    $('mail-google-box').hidden = !google;
    $('mail-smtp-box').hidden = google;
  }

  function showGoogleState(s) {
    const el = $('google-status');
    if (s.googleConnected) {
      el.className = 'google-status ok';
      el.textContent = 'Conectado como ' + (s.googleEmail || 'conta Google');
    } else {
      el.className = 'google-status';
      el.textContent = 'Ainda não conectado.';
    }
    $('btn-google-connect').textContent = s.googleConnected ? 'Reconectar' : 'Conectar com Google';
    $('btn-google-disconnect').hidden = !s.googleConnected;
    const local = ['localhost', '127.0.0.1'].indexOf(location.hostname) >= 0;
    $('google-local-warning').hidden = local;
  }

  $('mail-provider').addEventListener('change', showProviderBox);

  let pollTimer = null;
  async function refreshGoogleState() {
    const res = await apiFetch('/settings/email');
    if (!res.ok) return null;
    const s = (await res.json()).settings;
    showGoogleState(s);
    return s;
  }
  $('btn-google-connect').addEventListener('click', async () => {
    if (['localhost', '127.0.0.1'].indexOf(location.hostname) < 0) {
      say('Abra o sistema em http://localhost:' + (location.port || 80) + ' no computador do servidor para conectar.');
      return;
    }
    try {
      await save();
      const s = await refreshGoogleState();
      if (!s || !s.googleClientId || !s.hasGoogleSecret) { say('Preencha o ID do cliente e a chave secreta primeiro.'); return; }
      window.open('/api/google/start', '_blank');
      say('Aguardando a permissão no Google (outra aba)...');
      clearInterval(pollTimer);
      let tries = 0;
      pollTimer = setInterval(async () => {
        tries++;
        const st = await refreshGoogleState().catch(() => null);
        if (st && st.googleConnected) { clearInterval(pollTimer); say('Conta Google conectada! Agora use "Enviar teste".'); }
        else if (tries > 90) { clearInterval(pollTimer); say(''); }
      }, 2000);
    } catch (e) { say(e.message); }
  });
  $('btn-google-disconnect').addEventListener('click', async () => {
    if (!confirm('Desconectar a conta Google? Os avisos param até conectar de novo.')) return;
    await apiFetch('/google/disconnect', { method: 'POST', body: '{}' });
    await refreshGoogleState();
    say('Conta desconectada.');
  });

  $('btn-email-toggle').addEventListener('click', () => {
    const panel = $('email-panel');
    $('users-panel').hidden = true;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) load();
  });
  $('btn-mail-save').addEventListener('click', async () => {
    try { await save(); say('Configuração salva.'); await load(); say('Configuração salva.'); } catch (e) { say(e.message); }
  });
  $('btn-mail-test').addEventListener('click', async () => {
    try {
      await save();
      say('Enviando teste...');
      const res = await apiFetch('/settings/email/test', { method: 'POST', body: JSON.stringify({ to: $('mail-test-to').value }) });
      const b = await res.json();
      if (!res.ok) {
        if (b.error === 'invalid_email') throw new Error('Digite um e-mail válido para o teste.');
        if (b.error === 'not_configured') throw new Error($('mail-provider').value === 'google' ? 'Conecte a conta Google primeiro.' : 'Preencha ao menos o servidor e o remetente.');
        throw new Error('Falhou: ' + (b.detail || 'erro ao enviar'));
      }
      say('Teste enviado! Confira a caixa de entrada (e o spam).');
    } catch (e) { say(e.message); }
  });
  $('btn-mail-run').addEventListener('click', async () => {
    try {
      await save();
      say('Verificando...');
      const res = await apiFetch('/settings/email/run', { method: 'POST', body: '{}' });
      const r = (await res.json()).result;
      if (r.disabled) return say('Ative "Enviar avisos automáticos" e conclua a configuração (conectar o Google ou preencher o servidor).');
      say(`Enviados: ${r.sent}` + (r.skippedNoRecipient ? ` · sem e-mail do responsável: ${r.skippedNoRecipient}` : '') + (r.failed ? ` · falhas: ${r.failed} (${r.errors[0]})` : ''));
    } catch (e) { say(e.message); }
  });
}

async function initAuth() {
  wireAuthEvents();
  try {
    const res = await fetch(API + '/session');
    const data = await res.json();
    document.getElementById('login-bootstrap').hidden = !data.needsBootstrap;
    document.getElementById('login-form-wrap').hidden = data.needsBootstrap;
    if (data.user) await loginSuccess(data.user);
  } catch (e) {
    setStatus('Não foi possível falar com o servidor. Verifique se ele está rodando (veja o README, pasta server/).', 'error');
  }
}

// ---------- lógica de domínio ----------

function taskEffectiveDone(task) {
  if (task.subtasks && task.subtasks.length > 0) {
    return task.subtasks.every(s => s.done);
  }
  return !!task.done;
}

function computeProgress(project) {
  if (project.tasks && project.tasks.length > 0) {
    const done = project.tasks.filter(t => taskEffectiveDone(t)).length;
    return Math.round((done / project.tasks.length) * 100);
  }
  return project.progress || 0;
}

function materialTotal(m) {
  return (Number(m.quantity) || 0) * (Number(m.unitPrice) || 0);
}

function projectTotals(project) {
  let previsto = 0, gasto = 0;
  for (const m of project.materials || []) {
    const total = materialTotal(m);
    previsto += total;
    if (m.purchased) gasto += total;
  }
  return { previsto, gasto };
}

function totalsRowHtml(totals) {
  return `
    <div>Total previsto: <strong>${formatCurrency(totals.previsto)}</strong></div>
    <div>Total já gasto (comprados): <strong>${formatCurrency(totals.gasto)}</strong></div>
  `;
}

function updateTotalsDisplay(project) {
  const el = document.getElementById('totals-row');
  if (el) el.innerHTML = totalsRowHtml(projectTotals(project));
}

function formatCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function statusLabel(value) {
  const found = STATUS_OPTIONS.find(s => s.value === value);
  return found ? found.label : value;
}

function statusClass(value) {
  return 'status-' + (value || 'planejamento');
}

function priorityLabel(value) {
  const found = PRIORITY_OPTIONS.find(p => p.value === value);
  return found ? found.label : 'Média';
}

function priorityClass(value) {
  return 'priority-' + (value || 'media');
}

function findProject(id) {
  return state.projects.find(p => p.id === id);
}

async function createProject() {
  const project = {
    id: uid(),
    ownerUsername: currentUser ? currentUser.username : '',
    name: 'Novo projeto',
    description: '',
    category: '',
    startDate: todayISO(),
    deadline: '',
    status: 'planejamento',
    priority: 'media',
    responsible: '',
    requestedBy: '',
    methodology: '',
    importance: '',
    progress: 0,
    topics: [],
    concept: { text: '', files: [] },
    tasks: [],
    materials: [],
  };
  try {
    const res = await apiFetch('/projects', { method: 'POST', body: JSON.stringify({ project }) });
    if (!res.ok) throw new Error('O servidor recusou criar o projeto.');
    state.projects.unshift(project);
    selectedProjectId = project.id;
    render();
    focusProjectName();
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

async function deleteProject(id) {
  const project = findProject(id);
  if (!project) return;
  if (!confirm(`Excluir o projeto "${project.name}"? Essa ação não pode ser desfeita.`)) return;
  try {
    const res = await apiFetch(`/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('O servidor recusou remover o projeto.');
    state.projects = state.projects.filter(p => p.id !== id);
    if (selectedProjectId === id) {
      const remaining = visibleProjects();
      selectedProjectId = remaining[0] ? remaining[0].id : null;
    }
    render();
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

function updateProject(id, patch) {
  const project = findProject(id);
  if (!project) return;
  Object.assign(project, patch);
  saveState();
}

function focusProjectName() {
  requestAnimationFrame(() => {
    const el = document.getElementById('field-name');
    if (el) { el.focus(); el.select(); }
  });
}

// ---------- render ----------

function render() {
  renderSummary();
  renderProjectList();
  renderDetail();
}

function renderSummary() {
  const el = document.getElementById('summary');
  const projects = visibleProjects();
  const total = projects.length;
  const emAndamento = projects.filter(p => p.status === 'em-andamento').length;
  const concluidos = projects.filter(p => p.status === 'concluido').length;
  const gastoTotal = projects.reduce((sum, p) => sum + projectTotals(p).gasto, 0);
  el.innerHTML = `
    <div><div class="stat-value">${total}</div><div>Projetos</div></div>
    <div><div class="stat-value">${emAndamento}</div><div>Em andamento</div></div>
    <div><div class="stat-value">${concluidos}</div><div>Concluídos</div></div>
    <div><div class="stat-value">${formatCurrency(gastoTotal)}</div><div>Gasto total</div></div>
  `;
}

function projectCardNode(tpl, project) {
  const node = tpl.content.cloneNode(true);
  const card = node.querySelector('.project-card');
  card.dataset.id = project.id;
  if (project.id === selectedProjectId) card.classList.add('selected');
  node.querySelector('.project-card-name').textContent = project.name || '(sem nome)';
  const badge = node.querySelector('.status-badge');
  badge.textContent = statusLabel(project.status);
  badge.classList.add(statusClass(project.status));
  const priorityBadge = node.querySelector('.priority-badge');
  priorityBadge.textContent = priorityLabel(project.priority);
  priorityBadge.classList.add(priorityClass(project.priority));
  const progress = computeProgress(project);
  node.querySelector('.progress-fill').style.width = progress + '%';
  const totals = projectTotals(project);
  node.querySelector('.project-card-meta').innerHTML =
    `<span>${formatDate(project.startDate)}</span><span>${progress}% · ${formatCurrency(totals.gasto)}</span>`;
  if (project.responsible) node.querySelector('.project-card-sub').textContent = 'Responsável: ' + project.responsible;
  card.addEventListener('click', () => { selectedProjectId = project.id; render(); });
  return node;
}

function renderProjectList() {
  const list = document.getElementById('project-list');
  const tpl = document.getElementById('tpl-project-card');
  list.innerHTML = '';
  const projects = visibleProjects();
  if (projects.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Nenhum projeto ainda. Clique em "Novo projeto".</p>';
    return;
  }

  if (currentUser && currentUser.role === 'admin') {
    const groups = new Map();
    for (const project of projects) {
      const owner = project.ownerUsername || 'Sem responsável';
      if (!groups.has(owner)) groups.set(owner, []);
      groups.get(owner).push(project);
    }
    const owners = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    for (const owner of owners) {
      const header = document.createElement('div');
      header.className = 'owner-group-header';
      header.textContent = owner;
      list.appendChild(header);
      for (const project of groups.get(owner)) {
        list.appendChild(projectCardNode(tpl, project));
      }
    }
    return;
  }

  for (const project of projects) {
    list.appendChild(projectCardNode(tpl, project));
  }
}

function renderDetail() {
  const detail = document.getElementById('detail');
  const project = findProject(selectedProjectId);
  const allowed = project && visibleProjects().some(p => p.id === project.id);
  if (!allowed) {
    FileUI.disposeInline();
    detail.innerHTML = '<div class="empty-state"><p>Selecione um projeto na lista ao lado ou crie um novo projeto para começar.</p></div>';
    return;
  }

  const totals = projectTotals(project);
  const progress = computeProgress(project);
  const progressLocked = (project.tasks && project.tasks.length > 0);

  detail.innerHTML = `
    <div class="detail-header">
      <div class="field full" style="max-width:420px;">
        <label for="field-name">Nome do projeto</label>
        <input id="field-name" type="text" value="${escapeAttr(project.name)}">
      </div>
      <button id="btn-delete-project" class="btn btn-danger">Excluir projeto</button>
    </div>

    <div class="field-grid">
      <div class="field">
        <label for="field-status">Status</label>
        <select id="field-status">
          ${STATUS_OPTIONS.map(s => `<option value="${s.value}" ${s.value === project.status ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="field-priority">Prioridade</label>
        <select id="field-priority">
          ${PRIORITY_OPTIONS.map(p => `<option value="${p.value}" ${p.value === project.priority ? 'selected' : ''}>${p.label}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="field-category">Categoria</label>
        <input id="field-category" type="text" value="${escapeAttr(project.category)}" placeholder="Ex: Reforma, Software, Evento...">
      </div>
      <div class="field">
        <label for="field-responsible">Responsável pelo projeto</label>
        <input id="field-responsible" type="text" value="${escapeAttr(project.responsible)}" placeholder="Nome do responsável">
      </div>
      <div class="field">
        <label for="field-requested-by">Solicitado por</label>
        <input id="field-requested-by" type="text" value="${escapeAttr(project.requestedBy)}" placeholder="Quem pediu o projeto">
      </div>
      <div class="field">
        <label for="field-methodology">Metodologia / ferramenta de gestão</label>
        <input id="field-methodology" type="text" list="methodology-options" value="${escapeAttr(project.methodology)}" placeholder="Ex: Kanban, Scrum, PDCA...">
      </div>
      <div class="field">
        <label for="field-start">Data inicial</label>
        <input id="field-start" type="date" value="${escapeAttr(project.startDate)}">
      </div>
      <div class="field">
        <label for="field-deadline">Prazo (opcional)</label>
        <input id="field-deadline" type="date" value="${escapeAttr(project.deadline)}">
      </div>
      <div class="field full">
        <label for="field-description">Descrição</label>
        <textarea id="field-description">${escapeHtml(project.description)}</textarea>
      </div>
      <div class="field full">
        <label for="field-importance">Importância do projeto (por que fazer, que valor agrega à empresa)</label>
        <textarea id="field-importance" placeholder="Ex: reduz retrabalho, aumenta capacidade produtiva, atende exigência de cliente...">${escapeHtml(project.importance)}</textarea>
      </div>
    </div>
    <datalist id="methodology-options">
      ${METHODOLOGY_SUGGESTIONS.map(o => `<option value="${escapeAttr(o)}"></option>`).join('')}
    </datalist>

    <div class="kpis" id="kpis"></div>

    <section class="block" id="concept-block">
      <h3>Conceito do projeto <span class="h3-sub">visualizador da máquina</span></h3>
      <div class="field full">
        <label for="field-concept-text">Descrição do conceito</label>
        <textarea id="field-concept-text" placeholder="Descreva a ideia geral da máquina: princípio de funcionamento, principais conjuntos, premissas...">${escapeHtml(project.concept.text)}</textarea>
      </div>
      <div class="file-box" id="concept-files"></div>
      <div class="concept-viewer" id="concept-viewer"></div>
    </section>

    <section class="block">
      <h3>Prazos por tópico</h3>
      <div id="topic-timeline"></div>
    </section>

    <section class="block">
      <h3>Tópicos e etapas</h3>
      <div class="progress-display">
        <input id="field-progress" type="range" min="0" max="100" step="5" value="${progress}" ${progressLocked ? 'disabled' : ''}>
        <span class="pct">${progress}%</span>
      </div>
      ${progressLocked ? '<p class="hint">O avanço é calculado automaticamente pelas etapas concluídas. Desmarque todas as etapas para voltar ao controle manual.</p>' : ''}

      <div class="add-row-form topic-add-form">
        <input id="new-topic-name" type="text" placeholder="Novo tópico (ex: Projeto mecânico, Elétrica, Montagem)" style="flex:1;min-width:220px;">
        <input id="new-topic-responsible" type="text" placeholder="Responsável" style="width:150px;">
        <label class="inline-label">Prazo <input id="new-topic-deadline" type="date"></label>
        <button id="btn-add-topic" class="btn btn-primary">+ Adicionar tópico</button>
      </div>

      <div class="checklist" id="checklist"></div>
    </section>

    <section class="block">
      <h3>Ferramentas da metodologia</h3>
      <div id="methodology-tools"></div>
    </section>

    <section class="block">
      <h3>Materiais e compras</h3>
      <p style="font-size:12px;color:var(--text-muted);margin:-4px 0 10px;">Os itens são agrupados por categoria (ex: Elétrica, Mecânica) como se fossem pastas — defina a categoria ao adicionar ou edite o campo depois para mover o item.</p>
      <div id="materials-container"></div>
      <div class="add-row-form">
        <input id="new-mat-desc" type="text" placeholder="Descrição do item" style="flex:1;min-width:160px;">
        <input id="new-mat-category" type="text" list="material-category-options" placeholder="Categoria (ex: Elétrica)" style="width:150px;">
        <input id="new-mat-po" type="text" placeholder="Ordem de compra" style="width:140px;">
        <input id="new-mat-location" type="text" placeholder="Onde será usado" style="width:150px;">
        <input id="new-mat-qty" type="number" placeholder="Qtd" min="0" step="0.01" style="width:70px;">
        <input id="new-mat-unit" type="text" placeholder="Unid." style="width:70px;">
        <input id="new-mat-price" type="number" placeholder="Preço unit." min="0" step="0.01" style="width:100px;">
        <input id="new-mat-supplier" type="text" placeholder="Fornecedor" style="width:140px;">
        <button id="btn-add-material" class="btn">+ Adicionar item</button>
      </div>
      <datalist id="material-category-options">
        ${MATERIAL_CATEGORY_SUGGESTIONS.map(o => `<option value="${escapeAttr(o)}"></option>`).join('')}
      </datalist>
      <div class="totals-row" id="totals-row">
        ${totalsRowHtml(totals)}
      </div>
    </section>
  `;

  wireDetailEvents(project);
  renderKpis(project);
  renderConcept(project);
  renderTopicTimeline(project);
  renderChecklist(project);
  renderMethodologyTools(project);
  renderMaterials(project);
}

// ---------- ferramentas integradas por metodologia ----------

function ensureStagesInitialized(project, key, defaultNames) {
  if (!Array.isArray(project[key]) || project[key].length === 0) {
    project[key] = defaultNames.map(name => ({ id: uid(), name, done: false }));
    saveState();
  }
  return project[key];
}

function kanbanBoardHtml(project) {
  const tasks = project.tasks || [];
  if (tasks.length === 0) return '<p class="tool-empty">Adicione tarefas em "Avanço do projeto" acima para elas aparecerem aqui no quadro.</p>';
  const columns = [
    { key: 'todo', label: 'A fazer' },
    { key: 'doing', label: 'Em andamento' },
    { key: 'done', label: 'Concluído' },
  ];
  return `
    <div class="kanban-board">
      ${columns.map(col => `
        <div class="kanban-column">
          <div class="kanban-column-header">${col.label}</div>
          <div class="kanban-column-body">
            ${tasks.filter(t => (t.kanbanColumn || 'todo') === col.key).map(t => `
              <div class="kanban-card">
                <div class="kanban-card-title">${escapeHtml(t.text)}</div>
                ${t.responsible ? `<div class="kanban-card-meta">${escapeHtml(t.responsible)}</div>` : ''}
                <select class="kanban-move" data-task="${t.id}">
                  ${columns.map(c => `<option value="${c.key}" ${c.key === (t.kanbanColumn || 'todo') ? 'selected' : ''}>${c.label}</option>`).join('')}
                </select>
              </div>
            `).join('') || '<p class="kanban-empty">—</p>'}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function sprintBoardHtml(project) {
  const tasks = project.tasks || [];
  if (tasks.length === 0) return '<p class="tool-empty">Adicione tarefas em "Avanço do projeto" acima para elas aparecerem aqui.</p>';
  const backlog = tasks.filter(t => !t.inSprint);
  const sprint = tasks.filter(t => t.inSprint);
  const cardHtml = (t, moveLabel, moveTo) => `
    <div class="kanban-card">
      <div class="kanban-card-title">${escapeHtml(t.text)}</div>
      ${t.responsible ? `<div class="kanban-card-meta">${escapeHtml(t.responsible)}</div>` : ''}
      <button type="button" class="btn sprint-move" data-task="${t.id}" data-to="${moveTo}">${moveLabel}</button>
    </div>
  `;
  return `
    <div class="kanban-board">
      <div class="kanban-column">
        <div class="kanban-column-header">Backlog</div>
        <div class="kanban-column-body">${backlog.map(t => cardHtml(t, 'Mover para sprint →', 'true')).join('') || '<p class="kanban-empty">—</p>'}</div>
      </div>
      <div class="kanban-column">
        <div class="kanban-column-header">Sprint atual</div>
        <div class="kanban-column-body">${sprint.map(t => cardHtml(t, '← Voltar para backlog', 'false')).join('') || '<p class="kanban-empty">—</p>'}</div>
      </div>
    </div>
  `;
}

const PDCA_FIELDS = [
  { key: 'plan', label: 'Planejar (Plan)', placeholder: 'O que precisa ser feito e como?' },
  { key: 'do', label: 'Fazer (Do)', placeholder: 'O que foi executado?' },
  { key: 'check', label: 'Checar (Check)', placeholder: 'Os resultados foram os esperados?' },
  { key: 'act', label: 'Agir (Act)', placeholder: 'O que precisa ser ajustado ou padronizado?' },
];

function pdcaHtml(project) {
  const p = project.pdca || {};
  return `
    <div class="pdca-grid">
      ${PDCA_FIELDS.map(f => `
        <div class="field">
          <label>${f.label}</label>
          <textarea class="pdca-field" data-field="${f.key}" placeholder="${escapeAttr(f.placeholder)}">${escapeHtml(p[f.key])}</textarea>
        </div>
      `).join('')}
    </div>
  `;
}

const FIVE_W2H_FIELDS = [
  { key: 'what', label: 'O quê (What)', placeholder: 'O que será feito?' },
  { key: 'why', label: 'Por quê (Why)', placeholder: 'Por que esse projeto/ação é necessário?' },
  { key: 'where', label: 'Onde (Where)', placeholder: 'Onde será feito?' },
  { key: 'when', label: 'Quando (When)', placeholder: 'Quando será feito?' },
  { key: 'who', label: 'Quem (Who)', placeholder: 'Quem vai fazer?' },
  { key: 'how', label: 'Como (How)', placeholder: 'Como será feito?' },
  { key: 'howMuch', label: 'Quanto custa (How much)', placeholder: 'Qual o custo estimado?' },
];

function fiveW2HHtml(project) {
  const f = project.fiveW2H || {};
  return `
    <div class="pdca-grid">
      ${FIVE_W2H_FIELDS.map(field => `
        <div class="field">
          <label>${field.label}</label>
          <textarea class="fiveW2H-field" data-field="${field.key}" placeholder="${escapeAttr(field.placeholder)}">${escapeHtml(f[field.key])}</textarea>
        </div>
      `).join('')}
    </div>
  `;
}

function ganttHtml(project) {
  const tasks = project.tasks || [];
  if (tasks.length === 0) return '<p class="tool-empty">Adicione tarefas em "Avanço do projeto" acima para defini-las no cronograma.</p>';

  const rangeStartMs = project.startDate ? new Date(project.startDate).getTime() : Date.now();
  const fallbackEndMs = rangeStartMs + 30 * 86400000;
  const rangeEndMs = Math.max(project.deadline ? new Date(project.deadline).getTime() : fallbackEndMs, rangeStartMs + 86400000);
  const totalSpan = rangeEndMs - rangeStartMs;

  const rows = tasks.map(t => {
    const startMs = t.startDate ? new Date(t.startDate).getTime() : rangeStartMs;
    const endMs = t.plannedDate ? new Date(t.plannedDate).getTime() : startMs + Math.max(totalSpan * 0.1, 86400000);
    const leftPct = Math.min(100, Math.max(0, ((startMs - rangeStartMs) / totalSpan) * 100));
    const widthPct = Math.min(100 - leftPct, Math.max(2, ((endMs - startMs) / totalSpan) * 100));

    let actualMarker = '';
    if (t.actualDate) {
      const actualMs = new Date(t.actualDate).getTime();
      const actualPct = Math.min(100, Math.max(0, ((actualMs - rangeStartMs) / totalSpan) * 100));
      const late = t.plannedDate && actualMs > new Date(t.plannedDate).getTime();
      actualMarker = `<div class="gantt-actual-marker${late ? ' late' : ''}" style="left:${actualPct}%;" title="Entrega real: ${formatDate(t.actualDate)}${late ? ' (atrasada)' : ''}"></div>`;
    }

    return `
      <div class="gantt-row">
        <div class="gantt-label">${escapeHtml(t.text)}</div>
        <div class="gantt-track">
          <div class="gantt-bar${taskEffectiveDone(t) ? ' done' : ''}" style="left:${leftPct}%;width:${widthPct}%;"></div>
          ${actualMarker}
        </div>
        <div class="gantt-dates-label">${formatDate(t.startDate)} → ${formatDate(t.plannedDate)}${t.actualDate ? ' · real: ' + formatDate(t.actualDate) : ''}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="gantt-chart">
      <p style="font-size:11px;color:var(--text-muted);margin:0 0 8px;">Linha do tempo entre ${formatDate(project.startDate)} e ${project.deadline ? formatDate(project.deadline) : 'o prazo definido'}. As datas de cada tarefa (início, planejada e entrega real) são as mesmas definidas em "Avanço do projeto" acima; a marca no gráfico fica vermelha quando a entrega real passou da data planejada.</p>
      ${rows}
    </div>
  `;
}

function stagesHtml(project, info) {
  const stages = ensureStagesInitialized(project, info.stagesKey, info.defaultStages);
  return `
    <div class="stage-checklist" data-stages-key="${info.stagesKey}">
      ${stages.map(s => `
        <label class="stage-item${s.done ? ' done' : ''}">
          <input type="checkbox" class="stage-check" data-stage="${s.id}" ${s.done ? 'checked' : ''}>
          <span>${escapeHtml(s.name)}</span>
        </label>
      `).join('')}
    </div>
  `;
}

function methodologyWidgetHtml(project, info) {
  switch (info.widget) {
    case 'kanban': return kanbanBoardHtml(project);
    case 'sprint': return sprintBoardHtml(project);
    case 'pdca': return pdcaHtml(project);
    case '5w2h': return fiveW2HHtml(project);
    case 'gantt': return ganttHtml(project);
    case 'stages': return stagesHtml(project, info);
    default: return '';
  }
}

function renderMethodologyTools(project) {
  const container = document.getElementById('methodology-tools');
  if (!container) return;
  const key = methodologyKey(project.methodology);
  if (!key) {
    container.innerHTML = '<p class="tool-empty">Escolha uma metodologia no campo acima (ex: Kanban, Scrum, PDCA, 5W2H, Cronograma/Gantt, PMBOK, Ágil, Waterfall) para ver aqui as ferramentas prontas para usar, já integradas com as tarefas deste projeto.</p>';
    return;
  }
  const info = METHODOLOGY_INFO[key];
  container.innerHTML = `
    <p class="methodology-summary">${escapeHtml(info.summary)}</p>
    <div class="tool-info-list">
      ${info.tools.map(t => `<div class="tool-info-card"><strong>${escapeHtml(t.name)}</strong><p>${escapeHtml(t.description)}</p></div>`).join('')}
    </div>
    ${methodologyWidgetHtml(project, info)}
  `;
  wireMethodologyToolEvents(project);
}

function wireMethodologyToolEvents(project) {
  const container = document.getElementById('methodology-tools');
  container.querySelectorAll('.kanban-move').forEach(sel => sel.addEventListener('change', () => {
    const t = project.tasks.find(x => x.id === sel.dataset.task);
    t.kanbanColumn = sel.value;
    saveState();
    renderMethodologyTools(project);
  }));
  container.querySelectorAll('.sprint-move').forEach(btn => btn.addEventListener('click', () => {
    const t = project.tasks.find(x => x.id === btn.dataset.task);
    t.inSprint = btn.dataset.to === 'true';
    saveState();
    renderMethodologyTools(project);
  }));
  container.querySelectorAll('.pdca-field').forEach(ta => ta.addEventListener('input', () => {
    project.pdca = project.pdca || {};
    project.pdca[ta.dataset.field] = ta.value;
    saveState();
  }));
  container.querySelectorAll('.fiveW2H-field').forEach(ta => ta.addEventListener('input', () => {
    project.fiveW2H = project.fiveW2H || {};
    project.fiveW2H[ta.dataset.field] = ta.value;
    saveState();
  }));
  container.querySelectorAll('.stage-check').forEach(cb => cb.addEventListener('change', () => {
    const stagesKey = cb.closest('.stage-checklist').dataset.stagesKey;
    const stage = project[stagesKey].find(s => s.id === cb.dataset.stage);
    stage.done = cb.checked;
    saveState();
    renderMethodologyTools(project);
  }));
}

// ---------- prazos, tópicos e conceito ----------

const collapsedTopics = new Set();
const conceptSelection = {}; // projectId -> id do arquivo exibido no visualizador do conceito

function daysUntil(iso) {
  if (!iso) return null;
  const target = new Date(iso + 'T00:00:00');
  const today = new Date(todayISO() + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function tasksOfTopic(project, topicId) {
  return (project.tasks || []).filter(t => (t.topicId || '') === (topicId || ''));
}

function topicStats(project, topic) {
  const tasks = tasksOfTopic(project, topic.id);
  const done = tasks.filter(taskEffectiveDone).length;
  const complete = tasks.length > 0 && done === tasks.length;
  const days = daysUntil(topic.deadline);
  let state = 'none';
  let label = 'Sem prazo';
  if (complete) { state = 'done'; label = 'Concluído'; }
  else if (days !== null && days < 0) { state = 'late'; label = 'Atrasado ' + Math.abs(days) + (Math.abs(days) === 1 ? ' dia' : ' dias'); }
  else if (days !== null && days === 0) { state = 'soon'; label = 'Vence hoje'; }
  else if (days !== null && days <= 7) { state = 'soon'; label = 'Vence em ' + days + (days === 1 ? ' dia' : ' dias'); }
  else if (days !== null) { state = 'ok'; label = 'No prazo · ' + days + ' dias'; }
  return { tasks, done, total: tasks.length, pct: tasks.length ? Math.round(done / tasks.length * 100) : 0, complete, days, state, label };
}

function taskIsLate(task) {
  if (taskEffectiveDone(task) || !task.plannedDate) return false;
  return daysUntil(task.plannedDate) < 0;
}

function renderKpis(project) {
  const el = document.getElementById('kpis');
  if (!el) return;
  const topics = project.topics || [];
  const stats = topics.map(t => ({ topic: t, st: topicStats(project, t) }));
  const doneTopics = stats.filter(x => x.st.complete).length;
  const lateTopics = stats.filter(x => x.st.state === 'late').length;
  const lateTasks = (project.tasks || []).filter(taskIsLate).length;
  const upcoming = stats
    .filter(x => !x.st.complete && x.topic.deadline && x.st.days >= 0)
    .sort((a, b) => a.st.days - b.st.days)[0];
  const totals = projectTotals(project);
  const items = [
    { label: 'Avanço geral', value: computeProgress(project) + '%', cls: '' },
    { label: 'Tópicos concluídos', value: topics.length ? doneTopics + ' / ' + topics.length : '—', cls: '' },
    { label: 'Em atraso', value: (lateTopics + lateTasks) ? lateTopics + ' tópico(s) · ' + lateTasks + ' etapa(s)' : 'Nada atrasado', cls: (lateTopics + lateTasks) ? 'bad' : 'good' },
    { label: 'Próximo prazo', value: upcoming ? escapeHtml(upcoming.topic.name) + ' · ' + formatDate(upcoming.topic.deadline) : (project.deadline ? 'Projeto · ' + formatDate(project.deadline) : '—'), cls: '' },
    { label: 'Compras realizadas', value: formatCurrency(totals.gasto), cls: '' },
  ];
  el.innerHTML = items.map(i => `<div class="kpi ${i.cls}"><span class="kpi-label">${i.label}</span><span class="kpi-value">${i.value}</span></div>`).join('');
}

function renderTopicTimeline(project) {
  const el = document.getElementById('topic-timeline');
  if (!el) return;
  const topics = (project.topics || []).filter(t => t.deadline);
  if (!topics.length) {
    el.innerHTML = '<p class="hint">Cadastre tópicos com prazo (abaixo) para ver aqui o cronograma de entregas.</p>';
    return;
  }
  const toMs = (iso) => new Date(iso + 'T00:00:00').getTime();
  const starts = topics.map(t => toMs(t.startDate || project.startDate || t.deadline));
  const ends = topics.map(t => toMs(t.deadline));
  const today = toMs(todayISO());
  let min = Math.min(...starts, ...ends);
  let max = Math.max(...starts, ...ends);
  if (project.deadline) max = Math.max(max, toMs(project.deadline));
  min = Math.min(min, today);
  max = Math.max(max, today);
  const span = Math.max(max - min, 86400000);
  const pos = (ms) => ((ms - min) / span * 100).toFixed(2);
  const rows = topics.map((t, i) => {
    const st = topicStats(project, t);
    const left = Number(pos(Math.min(starts[i], ends[i])));
    const width = Math.max(Number(pos(ends[i])) - left, 1.2);
    return `<div class="tl-row">
      <div class="tl-label" title="${escapeAttr(t.name)}">${escapeHtml(t.name || 'Sem nome')}</div>
      <div class="tl-track">
        <div class="tl-bar state-${st.state}" style="left:${left}%;width:${width}%"><span class="tl-fill" style="width:${st.pct}%"></span></div>
      </div>
      <div class="tl-date">${formatDate(t.deadline)}</div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="timeline">
    <div class="tl-grid"><div class="tl-today" style="left:calc(var(--tl-label) + (100% - var(--tl-label) - var(--tl-date)) * ${pos(today)} / 100)"><span>Hoje</span></div></div>
    ${rows}
  </div>
  <div class="tl-legend"><span class="dot state-ok"></span>No prazo <span class="dot state-soon"></span>Vence em até 7 dias <span class="dot state-late"></span>Atrasado <span class="dot state-done"></span>Concluído</div>`;
}

function renderConcept(project) {
  const filesBox = document.getElementById('concept-files');
  const host = document.getElementById('concept-viewer');
  if (!filesBox || !host) return;
  const files = project.concept.files;
  const viewable = (f) => FileUI.kindOf(f.name) !== 'other';
  const selected = () => files.find(f => f.id === conceptSelection[project.id] && viewable(f)) || files.find(viewable) || null;

  function refreshViewer() {
    const f = selected();
    if (!f) {
      FileUI.disposeInline();
      host.innerHTML = '<div class="concept-empty"><strong>Nenhum modelo anexado</strong><span>Anexe o desenho 3D da máquina (STEP, STL, OBJ, GLB...) para visualizá-lo aqui, girar, medir e fazer cortes.</span></div>';
    } else {
      FileUI.mountInline(host, project, f);
    }
  }

  FileUI.mountBox(filesBox, project, files, {
    inlineSelect: true,
    selectedId: () => { const f = selected(); return f ? f.id : null; },
    onView: (f) => { conceptSelection[project.id] = f.id; refreshViewer(); renderConcept.rerenderBox(); },
    onUploaded: (f) => { conceptSelection[project.id] = f.id; refreshViewer(); },
    onDelete: () => refreshViewer(),
    onChange: () => saveState(),
  });
  renderConcept.rerenderBox = () => renderConcept(project);
  refreshViewer();
}

function topicOptionsHtml(project, current) {
  return `<option value="">Sem tópico</option>` + (project.topics || [])
    .map(t => `<option value="${escapeAttr(t.id)}" ${t.id === current ? 'selected' : ''}>${escapeHtml(t.name || 'Sem nome')}</option>`).join('');
}

function taskCardHtml(project, task) {
  const subtasks = task.subtasks || [];
  const hasSubtasks = subtasks.length > 0;
  const effectiveDone = taskEffectiveDone(task);
  const topic = (project.topics || []).find(t => t.id === task.topicId);
  const late = taskIsLate(task);
  const overTopic = topic && topic.deadline && task.plannedDate && task.plannedDate > topic.deadline;
  const flags = [
    late ? '<span class="chip state-late">Etapa atrasada</span>' : '',
    overTopic ? '<span class="chip state-soon" title="A data planejada desta etapa é depois do prazo do tópico">Passa do prazo do tópico</span>' : '',
  ].join('');
  return `
    <div class="task-card${effectiveDone ? ' done' : ''}">
      <div class="task-card-header">
        <input type="checkbox" class="task-check" data-task="${task.id}" ${effectiveDone ? 'checked' : ''} ${hasSubtasks ? 'disabled' : ''}>
        <input type="text" class="task-text" data-task="${task.id}" value="${escapeAttr(task.text)}">
        ${flags}
        <button class="icon-btn task-delete" data-task="${task.id}" title="Remover etapa">✕</button>
      </div>
      <div class="task-meta-row">
        <label class="inline-label">Responsável
          <input type="text" class="task-responsible" data-task="${task.id}" value="${escapeAttr(task.responsible)}" placeholder="Nome">
        </label>
        <label class="inline-label">E-mail
          <input type="email" class="task-email" data-task="${task.id}" value="${escapeAttr(task.responsibleEmail || '')}" placeholder="para o aviso de prazo">
        </label>
        ${(project.topics || []).length ? `<label class="inline-label">Tópico
          <select class="task-topic" data-task="${task.id}">${topicOptionsHtml(project, task.topicId)}</select>
        </label>` : ''}
      </div>
      <div class="task-meta-row task-dates-row">
        <label>Início<input type="date" class="task-start-date" data-task="${task.id}" value="${escapeAttr(task.startDate)}"></label>
        <label>Planejada<input type="date" class="task-planned-date" data-task="${task.id}" value="${escapeAttr(task.plannedDate)}"></label>
        <label>Entrega real<input type="date" class="task-actual-date" data-task="${task.id}" value="${escapeAttr(task.actualDate)}"></label>
      </div>
      ${hasSubtasks ? '<p class="task-hint">Concluída automaticamente quando todas as subtarefas forem marcadas.</p>' : ''}
      <textarea class="task-description" data-task="${task.id}" placeholder="Descrição do que foi feito nesta etapa">${escapeHtml(task.description)}</textarea>
      <div class="task-files-label">Arquivos da etapa (desenhos 3D, PDFs, imagens)</div>
      <div class="file-box task-files" data-task="${task.id}"></div>
      ${hasSubtasks ? `<div class="subtask-list">${subtasks.map(s => subtaskHtml(task, s)).join('')}</div>` : ''}
      <div class="add-row-form subtask-add-form">
        <input type="text" class="new-subtask-text" data-task="${task.id}" placeholder="Nova subtarefa">
        <button class="btn add-subtask-btn" data-task="${task.id}">+ Subtarefa</button>
      </div>
    </div>
  `;
}

function subtaskHtml(task, sub) {
  return `
    <div class="checklist-item subtask-item${sub.done ? ' done' : ''}">
      <input type="checkbox" class="subtask-check" data-task="${task.id}" data-subtask="${sub.id}" ${sub.done ? 'checked' : ''}>
      <input type="text" class="subtask-text" data-task="${task.id}" data-subtask="${sub.id}" value="${escapeAttr(sub.text)}">
      <button class="icon-btn subtask-delete" data-task="${task.id}" data-subtask="${sub.id}" title="Remover subtarefa">✕</button>
    </div>
  `;
}

function topicSectionHtml(project, topic) {
  // topic === null -> etapas que ainda não pertencem a nenhum tópico
  const topicId = topic ? topic.id : '';
  const tasks = tasksOfTopic(project, topicId);
  const collapsed = collapsedTopics.has(topicId || '__none__');
  const st = topic ? topicStats(project, topic) : null;
  const header = topic ? `
    <div class="topic-header">
      <button class="topic-toggle" data-topic="${escapeAttr(topicId)}" aria-label="Recolher ou expandir">${collapsed ? '▸' : '▾'}</button>
      <input type="text" class="topic-name" data-topic="${escapeAttr(topicId)}" value="${escapeAttr(topic.name)}" placeholder="Nome do tópico">
      <span class="chip state-${st.state}">${st.label}</span>
      <span class="topic-progress" title="${st.done} de ${st.total} etapas concluídas">
        <span class="progress-bar"><span class="progress-fill" style="width:${st.pct}%"></span></span>
        <span class="topic-progress-text">${st.done}/${st.total}</span>
      </span>
      <button class="icon-btn topic-delete" data-topic="${escapeAttr(topicId)}" title="Remover tópico (as etapas ficam sem tópico)">✕</button>
    </div>
    <div class="topic-meta">
      <label class="inline-label">Responsável <input type="text" class="topic-responsible" data-topic="${escapeAttr(topicId)}" value="${escapeAttr(topic.responsible)}" placeholder="Nome"></label>
      <label class="inline-label">E-mail <input type="email" class="topic-email" data-topic="${escapeAttr(topicId)}" value="${escapeAttr(topic.responsibleEmail || '')}" placeholder="para o aviso de prazo"></label>
      <label class="inline-label">Início <input type="date" class="topic-start" data-topic="${escapeAttr(topicId)}" value="${escapeAttr(topic.startDate)}"></label>
      <label class="inline-label">Prazo <input type="date" class="topic-deadline" data-topic="${escapeAttr(topicId)}" value="${escapeAttr(topic.deadline)}"></label>
    </div>` : `
    <div class="topic-header">
      <button class="topic-toggle" data-topic="" aria-label="Recolher ou expandir">${collapsed ? '▸' : '▾'}</button>
      <span class="topic-name-static">Etapas sem tópico</span>
      <span class="topic-progress-text">${tasks.length}</span>
    </div>`;
  const body = collapsed ? '' : `
    <div class="topic-body">
      ${tasks.map(t => taskCardHtml(project, t)).join('') || '<p class="hint">Nenhuma etapa neste tópico ainda.</p>'}
      <div class="add-row-form">
        <input type="text" class="new-task-text" data-topic="${escapeAttr(topicId)}" placeholder="Nova etapa${topic ? ' neste tópico' : ''}" style="flex:1;min-width:200px;">
        <button class="btn add-task-btn" data-topic="${escapeAttr(topicId)}">+ Adicionar etapa</button>
      </div>
    </div>`;
  return `<div class="topic${topic ? '' : ' topic-none'}${topic ? ' state-border-' + st.state : ''}">${header}${body}</div>`;
}

function renderChecklist(project) {
  const el = document.getElementById('checklist');
  const topics = project.topics || [];
  const orphans = tasksOfTopic(project, '');
  const sections = topics.map(t => topicSectionHtml(project, t));
  if (!topics.length || orphans.length) sections.push(topicSectionHtml(project, null));
  el.innerHTML = sections.join('');

  // ----- tópicos -----
  const topicById = (id) => topics.find(t => t.id === id);
  const refreshTopics = () => { renderKpis(project); renderTopicTimeline(project); renderChecklist(project); };
  el.querySelectorAll('.topic-toggle').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.topic || '__none__';
    if (collapsedTopics.has(key)) collapsedTopics.delete(key); else collapsedTopics.add(key);
    renderChecklist(project);
  }));
  el.querySelectorAll('.topic-name').forEach(inp => inp.addEventListener('input', () => {
    topicById(inp.dataset.topic).name = inp.value;
    saveState();
  }));
  el.querySelectorAll('.topic-name').forEach(inp => inp.addEventListener('change', () => { renderTopicTimeline(project); renderKpis(project); }));
  el.querySelectorAll('.topic-responsible').forEach(inp => inp.addEventListener('input', () => {
    topicById(inp.dataset.topic).responsible = inp.value;
    saveState();
  }));
  el.querySelectorAll('.topic-email').forEach(inp => inp.addEventListener('input', () => {
    topicById(inp.dataset.topic).responsibleEmail = inp.value.trim();
    saveState();
  }));
  el.querySelectorAll('.topic-start').forEach(inp => inp.addEventListener('change', () => {
    topicById(inp.dataset.topic).startDate = inp.value;
    saveState();
    refreshTopics();
  }));
  el.querySelectorAll('.topic-deadline').forEach(inp => inp.addEventListener('change', () => {
    topicById(inp.dataset.topic).deadline = inp.value;
    saveState();
    refreshTopics();
  }));
  el.querySelectorAll('.topic-delete').forEach(btn => btn.addEventListener('click', () => {
    const topic = topicById(btn.dataset.topic);
    if (!confirm('Remover o tópico "' + (topic.name || 'sem nome') + '"? As etapas dele continuam no projeto, só ficam sem tópico.')) return;
    project.topics = topics.filter(t => t.id !== topic.id);
    (project.tasks || []).forEach(t => { if (t.topicId === topic.id) t.topicId = ''; });
    saveState();
    renderDetail();
  }));
  el.querySelectorAll('.add-task-btn').forEach(btn => btn.addEventListener('click', () => {
    const input = el.querySelector(`.new-task-text[data-topic="${btn.dataset.topic}"]`);
    addTask(project, btn.dataset.topic, input.value);
  }));
  el.querySelectorAll('.new-task-text').forEach(inp => inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask(project, inp.dataset.topic, inp.value);
  }));

  // ----- etapas -----
  const taskById = (id) => project.tasks.find(t => t.id === id);
  el.querySelectorAll('.task-files').forEach(box => {
    const task = taskById(box.dataset.task);
    FileUI.mountBox(box, project, task.files, { onChange: () => saveState() });
  });
  el.querySelectorAll('.task-topic').forEach(sel => sel.addEventListener('change', () => {
    taskById(sel.dataset.task).topicId = sel.value;
    saveState();
    renderDetail();
  }));
  el.querySelectorAll('.task-check').forEach(cb => cb.addEventListener('change', () => {
    const task = project.tasks.find(t => t.id === cb.dataset.task);
    task.done = cb.checked;
    saveState();
    renderDetail();
    renderProjectList();
    renderSummary();
  }));
  el.querySelectorAll('.task-text').forEach(inp => inp.addEventListener('input', () => {
    const task = project.tasks.find(t => t.id === inp.dataset.task);
    task.text = inp.value;
    saveState();
    renderMethodologyTools(project);
  }));
  el.querySelectorAll('.task-description').forEach(ta => ta.addEventListener('input', () => {
    const task = project.tasks.find(t => t.id === ta.dataset.task);
    task.description = ta.value;
    saveState();
  }));
  el.querySelectorAll('.task-responsible').forEach(inp => inp.addEventListener('input', () => {
    const task = project.tasks.find(t => t.id === inp.dataset.task);
    task.responsible = inp.value;
    saveState();
    renderMethodologyTools(project);
  }));
  el.querySelectorAll('.task-email').forEach(inp => inp.addEventListener('input', () => {
    taskById(inp.dataset.task).responsibleEmail = inp.value.trim();
    saveState();
  }));
  const dateField = (selector, key) => el.querySelectorAll(selector).forEach(inp => inp.addEventListener('change', () => {
    const task = project.tasks.find(t => t.id === inp.dataset.task);
    task[key] = inp.value;
    saveState();
    renderMethodologyTools(project);
    refreshTopics();
  }));
  dateField('.task-start-date', 'startDate');
  dateField('.task-planned-date', 'plannedDate');
  dateField('.task-actual-date', 'actualDate');
  el.querySelectorAll('.task-delete').forEach(btn => btn.addEventListener('click', () => {
    const task = project.tasks.find(t => t.id === btn.dataset.task);
    if ((task.files || []).length && !confirm('Esta etapa tem ' + task.files.length + ' arquivo(s) anexado(s). Remover a etapa apaga esses arquivos do servidor. Continuar?')) return;
    (task.files || []).forEach(f => fetch(`/api/projects/${encodeURIComponent(project.id)}/files/${encodeURIComponent(f.id)}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {}));
    project.tasks = project.tasks.filter(t => t.id !== btn.dataset.task);
    saveState();
    renderDetail();
    renderProjectList();
    renderSummary();
  }));
  el.querySelectorAll('.subtask-check').forEach(cb => cb.addEventListener('change', () => {
    const task = project.tasks.find(t => t.id === cb.dataset.task);
    const sub = task.subtasks.find(s => s.id === cb.dataset.subtask);
    sub.done = cb.checked;
    saveState();
    renderDetail();
    renderProjectList();
    renderSummary();
  }));
  el.querySelectorAll('.subtask-text').forEach(inp => inp.addEventListener('input', () => {
    const task = project.tasks.find(t => t.id === inp.dataset.task);
    const sub = task.subtasks.find(s => s.id === inp.dataset.subtask);
    sub.text = inp.value;
    saveState();
  }));
  el.querySelectorAll('.subtask-delete').forEach(btn => btn.addEventListener('click', () => {
    const task = project.tasks.find(t => t.id === btn.dataset.task);
    task.subtasks = task.subtasks.filter(s => s.id !== btn.dataset.subtask);
    saveState();
    renderDetail();
    renderProjectList();
    renderSummary();
  }));
  el.querySelectorAll('.add-subtask-btn').forEach(btn => btn.addEventListener('click', () => addSubtask(project, btn.dataset.task)));
  el.querySelectorAll('.new-subtask-text').forEach(inp => inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSubtask(project, inp.dataset.task);
  }));
}

function addSubtask(project, taskId) {
  const task = project.tasks.find(t => t.id === taskId);
  if (!task) return;
  const input = document.querySelector(`.new-subtask-text[data-task="${taskId}"]`);
  const text = input.value.trim();
  if (!text) return;
  task.subtasks = task.subtasks || [];
  task.subtasks.push({ id: uid(), text, done: false });
  saveState();
  renderDetail();
  renderProjectList();
  renderSummary();
}

function groupMaterialsByCategory(materials) {
  const groups = new Map();
  for (const m of materials || []) {
    const cat = (m.category || '').trim() || 'Sem categoria';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(m);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'Sem categoria') return 1;
    if (b === 'Sem categoria') return -1;
    return a.localeCompare(b, 'pt-BR');
  });
  return keys.map(k => ({ category: k, items: groups.get(k) }));
}

function materialRowHtml(m) {
  return `
    <tr>
      <td><input type="text" value="${escapeAttr(m.description)}" data-field="description" data-mat="${m.id}"></td>
      <td><input type="text" value="${escapeAttr(m.category)}" data-field="category" data-mat="${m.id}" list="material-category-options" placeholder="Categoria"></td>
      <td><input type="text" value="${escapeAttr(m.purchaseOrder)}" data-field="purchaseOrder" data-mat="${m.id}" placeholder="Nº/descrição"></td>
      <td><input type="text" value="${escapeAttr(m.usageLocation)}" data-field="usageLocation" data-mat="${m.id}" placeholder="Onde será usado"></td>
      <td><input type="number" min="0" step="0.01" value="${m.quantity}" data-field="quantity" data-mat="${m.id}" style="width:60px;"></td>
      <td><input type="text" value="${escapeAttr(m.unit)}" data-field="unit" data-mat="${m.id}" style="width:60px;"></td>
      <td><input type="number" min="0" step="0.01" value="${m.unitPrice}" data-field="unitPrice" data-mat="${m.id}" style="width:90px;"></td>
      <td>${formatCurrency(materialTotal(m))}</td>
      <td><input type="text" value="${escapeAttr(m.supplier)}" data-field="supplier" data-mat="${m.id}"></td>
      <td><input type="date" value="${escapeAttr(m.date)}" data-field="date" data-mat="${m.id}"></td>
      <td style="text-align:center;"><input type="checkbox" ${m.purchased ? 'checked' : ''} data-field="purchased" data-mat="${m.id}"></td>
      <td class="row-actions"><button class="icon-btn mat-delete" data-mat="${m.id}" title="Remover item">✕</button></td>
    </tr>
  `;
}

function materialGroupHtml(group) {
  const subtotal = group.items.reduce((acc, m) => {
    const total = materialTotal(m);
    acc.previsto += total;
    if (m.purchased) acc.gasto += total;
    return acc;
  }, { previsto: 0, gasto: 0 });

  return `
    <div class="material-group">
      <div class="material-group-header">
        <span class="folder-icon">📁</span>
        <span class="material-group-name">${escapeHtml(group.category)}</span>
        <span class="material-group-subtotal">gasto ${formatCurrency(subtotal.gasto)} de ${formatCurrency(subtotal.previsto)}</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Item</th><th>Categoria</th><th>Ordem de compra</th><th>Onde será usado</th><th>Qtd</th><th>Unid.</th><th>Preço unit.</th><th>Total</th><th>Fornecedor</th><th>Data</th><th>Comprado</th><th></th>
            </tr>
          </thead>
          <tbody>${group.items.map(materialRowHtml).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderMaterials(project) {
  const container = document.getElementById('materials-container');
  const groups = groupMaterialsByCategory(project.materials);
  if (groups.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Nenhum item cadastrado ainda.</p>';
    return;
  }
  container.innerHTML = groups.map(materialGroupHtml).join('');

  container.querySelectorAll('input').forEach(inp => {
    const field = inp.dataset.field;
    const rerenders = field === 'quantity' || field === 'unitPrice' || field === 'purchased' || field === 'category';
    // campos que disparam reagrupamento/recálculo usam "change" (ao sair do campo) em vez de
    // "input" (a cada tecla), senão o re-render destruiria o campo no meio da digitação.
    const evt = inp.type === 'checkbox' || rerenders ? 'change' : 'input';
    inp.addEventListener(evt, () => {
      const m = project.materials.find(x => x.id === inp.dataset.mat);
      m[field] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'number' ? Number(inp.value) : inp.value);
      saveState();
      if (rerenders) {
        renderMaterials(project);
        updateTotalsDisplay(project);
        renderProjectList();
        renderSummary();
      }
    });
  });
  container.querySelectorAll('.mat-delete').forEach(btn => btn.addEventListener('click', () => {
    project.materials = project.materials.filter(x => x.id !== btn.dataset.mat);
    saveState();
    renderDetail();
    renderProjectList();
    renderSummary();
  }));
}

function wireDetailEvents(project) {
  document.getElementById('field-name').addEventListener('input', (e) => {
    updateProject(project.id, { name: e.target.value });
    renderProjectList();
  });
  document.getElementById('field-status').addEventListener('change', (e) => {
    updateProject(project.id, { status: e.target.value });
    renderProjectList();
    renderSummary();
  });
  document.getElementById('field-priority').addEventListener('change', (e) => {
    updateProject(project.id, { priority: e.target.value });
    renderProjectList();
  });
  document.getElementById('field-category').addEventListener('input', (e) => updateProject(project.id, { category: e.target.value }));
  document.getElementById('field-responsible').addEventListener('input', (e) => {
    updateProject(project.id, { responsible: e.target.value });
    renderProjectList();
  });
  document.getElementById('field-requested-by').addEventListener('input', (e) => updateProject(project.id, { requestedBy: e.target.value }));
  document.getElementById('field-methodology').addEventListener('input', (e) => {
    updateProject(project.id, { methodology: e.target.value });
    renderMethodologyTools(project);
  });
  document.getElementById('field-start').addEventListener('change', (e) => {
    updateProject(project.id, { startDate: e.target.value });
    renderProjectList();
  });
  document.getElementById('field-deadline').addEventListener('change', (e) => updateProject(project.id, { deadline: e.target.value }));
  document.getElementById('field-description').addEventListener('input', (e) => updateProject(project.id, { description: e.target.value }));
  document.getElementById('field-importance').addEventListener('input', (e) => updateProject(project.id, { importance: e.target.value }));

  const progressInput = document.getElementById('field-progress');
  progressInput.addEventListener('input', (e) => {
    project.progress = Number(e.target.value);
    document.querySelector('.progress-display .pct').textContent = project.progress + '%';
  });
  progressInput.addEventListener('change', () => {
    saveState();
    renderProjectList();
    renderSummary();
  });

  document.getElementById('btn-delete-project').addEventListener('click', () => deleteProject(project.id));

  document.getElementById('field-concept-text').addEventListener('input', (e) => {
    project.concept.text = e.target.value;
    saveState();
  });
  document.getElementById('btn-add-topic').addEventListener('click', () => addTopic(project));
  document.getElementById('new-topic-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTopic(project);
  });

  document.getElementById('btn-add-material').addEventListener('click', () => addMaterial(project));
}

function addTask(project, topicId, text) {
  text = (text || '').trim();
  if (!text) return;
  project.tasks = project.tasks || [];
  project.tasks.push({
    id: uid(), text, done: false, description: '', responsible: '', subtasks: [],
    startDate: '', plannedDate: '', actualDate: '', topicId: topicId || '', files: [],
  });
  saveState();
  renderDetail();
  renderProjectList();
  renderSummary();
}

function addTopic(project) {
  const name = document.getElementById('new-topic-name').value.trim();
  if (!name) { document.getElementById('new-topic-name').focus(); return; }
  project.topics.push({
    id: uid(), name,
    responsible: document.getElementById('new-topic-responsible').value.trim(),
    startDate: '',
    deadline: document.getElementById('new-topic-deadline').value,
  });
  saveState();
  renderDetail();
}

function addMaterial(project) {
  const desc = document.getElementById('new-mat-desc').value.trim();
  if (!desc) { document.getElementById('new-mat-desc').focus(); return; }
  const category = document.getElementById('new-mat-category').value.trim();
  const purchaseOrder = document.getElementById('new-mat-po').value.trim();
  const usageLocation = document.getElementById('new-mat-location').value.trim();
  const qty = Number(document.getElementById('new-mat-qty').value) || 1;
  const unit = document.getElementById('new-mat-unit').value.trim();
  const price = Number(document.getElementById('new-mat-price').value) || 0;
  const supplier = document.getElementById('new-mat-supplier').value.trim();
  project.materials = project.materials || [];
  project.materials.push({
    id: uid(), description: desc, category, purchaseOrder, usageLocation, quantity: qty, unit, unitPrice: price,
    supplier, date: todayISO(), purchased: false,
  });
  saveState();
  renderDetail();
  renderProjectList();
  renderSummary();
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

// ---------- inicialização ----------

function init() {
  FileUI.onFileChanged = () => saveState();
  document.getElementById('btn-new-project').addEventListener('click', createProject);
  document.getElementById('btn-export').addEventListener('click', exportBackup);

  initAuth();
}

document.addEventListener('DOMContentLoaded', init);
