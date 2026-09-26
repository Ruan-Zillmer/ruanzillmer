'use strict';

const STORAGE_KEY = 'gestao-projetos:data:v1';
const HANDLE_DB = 'gestao-projetos-handles';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'dataFile';
const CURRENT_USER_KEY = 'gestao-projetos:current-user';

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
let fileHandle = null;
let saveToFileTimer = null;
let currentUser = null;

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- persistence: localStorage ----------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.projects)) {
        if (!Array.isArray(parsed.users)) parsed.users = [];
        return parsed;
      }
    }
  } catch (e) {
    console.error('Falha ao carregar dados salvos', e);
  }
  return { projects: [], users: [] };
}

function persistLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Falha ao salvar localmente', e);
  }
}

function saveState() {
  persistLocal();
  scheduleFileSave();
  if (window.DriveSync) window.DriveSync.scheduleSave(state);
}

// ---------- persistence: arquivo em pasta compartilhada (pendrive, Google Drive, etc.) via File System Access API ----------

function fsApiSupported() {
  return typeof window.showOpenFilePicker === 'function';
}

function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(HANDLE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeHandle(handle) {
  try {
    const db = await openHandleDB();
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
  } catch (e) {
    console.warn('Não foi possível lembrar o arquivo vinculado', e);
  }
}

async function loadStoredHandle() {
  try {
    const db = await openHandleDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, 'readonly');
      const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return null;
  }
}

async function tryRestoreHandle() {
  if (!fsApiSupported()) return;
  const handle = await loadStoredHandle();
  if (!handle) return;
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      fileHandle = handle;
      setStatus('Arquivo de dados vinculado: ' + handle.name, 'ok');
      document.getElementById('btn-save-file').disabled = false;
    } else {
      setStatus('Arquivo vinculado anteriormente (' + handle.name + '). Clique em "Salvar no arquivo" para reconceder acesso.', 'warn');
      fileHandle = handle;
      document.getElementById('btn-save-file').disabled = false;
    }
  } catch (e) {
    // handle inválido (arquivo removido, outro dispositivo, etc.)
  }
}

async function openDataFile() {
  if (!fsApiSupported()) {
    setStatus('Seu navegador não suporta abrir arquivos diretamente. Use "Importar backup" no lugar.', 'warn');
    document.getElementById('import-input').click();
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Dados do projeto (JSON)', accept: { 'application/json': ['.json'] } }],
      excludeAcceptAllOption: false,
    });
    const file = await handle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.projects)) throw new Error('Arquivo inválido');
    state = ensureUsersArray(parsed);
    fileHandle = handle;
    await storeHandle(handle);
    document.getElementById('btn-save-file').disabled = false;
    persistLocal();
    syncSessionAfterStateChange();
    render();
    setStatus('Dados carregados de ' + handle.name + '. Este arquivo agora é sua fonte de dados.', 'ok');
  } catch (e) {
    if (e.name !== 'AbortError') setStatus('Não foi possível abrir o arquivo: ' + e.message, 'error');
  }
}

async function saveToFile(showFeedback) {
  if (!fsApiSupported()) {
    setStatus('Seu navegador não suporta salvar direto no arquivo. Use "Exportar backup".', 'warn');
    return;
  }
  if (!fileHandle) {
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: 'dados.json',
        types: [{ description: 'Dados do projeto (JSON)', accept: { 'application/json': ['.json'] } }],
      });
      await storeHandle(fileHandle);
      document.getElementById('btn-save-file').disabled = false;
    } catch (e) {
      if (e.name !== 'AbortError') setStatus('Não foi possível criar o arquivo: ' + e.message, 'error');
      return;
    }
  }
  try {
    const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      setStatus('Permissão negada para salvar no arquivo.', 'error');
      return;
    }
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
    if (showFeedback) setStatus('Salvo em ' + fileHandle.name + ' às ' + new Date().toLocaleTimeString(), 'ok');
  } catch (e) {
    setStatus('Erro ao salvar no arquivo: ' + e.message, 'error');
  }
}

function scheduleFileSave() {
  if (!fileHandle) return;
  clearTimeout(saveToFileTimer);
  saveToFileTimer = setTimeout(() => saveToFile(false), 600);
}

// ---------- export / import manual (funciona em qualquer navegador) ----------

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `projetos-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Backup exportado.', 'ok');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.projects)) throw new Error('Formato inválido');
      state = ensureUsersArray(parsed);
      saveState();
      syncSessionAfterStateChange();
      render();
      setStatus('Backup importado com sucesso.', 'ok');
    } catch (e) {
      setStatus('Não foi possível importar: ' + e.message, 'error');
    }
  };
  reader.readAsText(file);
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

// ---------- autenticação ----------
// Login "de cortesia": separa o que cada pessoa vê no dia a dia, mas não é uma
// barreira de segurança de verdade (não há servidor validando nada — os dados,
// incluindo a lista de usuários, ficam nos mesmos arquivos que o app já usa).

function ensureUsersArray(obj) {
  if (!Array.isArray(obj.users)) obj.users = [];
  return obj;
}

function randomSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + ':' + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function findUser(username) {
  const normalized = (username || '').trim().toLowerCase();
  return state.users.find(u => u.username.toLowerCase() === normalized);
}

async function createFirstAdmin(username, password) {
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = { id: uid(), username: username.trim(), salt, passwordHash, role: 'admin' };
  state.users = [user];
  // projetos criados antes de existir login passam a pertencer ao primeiro administrador,
  // em vez de ficarem "órfãos" e sumirem da lista.
  for (const p of state.projects) {
    if (!p.ownerUsername) p.ownerUsername = user.username;
  }
  saveState();
  return user;
}

async function createUser(username, password, role) {
  const clean = (username || '').trim();
  if (!clean) throw new Error('Informe um nome de usuário.');
  if (findUser(clean)) throw new Error('Já existe um usuário com esse nome.');
  if (!password) throw new Error('Informe uma senha.');
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = { id: uid(), username: clean, salt, passwordHash, role: role === 'admin' ? 'admin' : 'user' };
  state.users.push(user);
  saveState();
  return user;
}

function deleteUser(id) {
  const user = state.users.find(u => u.id === id);
  if (!user) return;
  if (currentUser && user.username === currentUser.username) {
    throw new Error('Você não pode remover o próprio usuário logado.');
  }
  if (user.role === 'admin' && state.users.filter(u => u.role === 'admin').length <= 1) {
    throw new Error('Precisa existir pelo menos um administrador.');
  }
  state.users = state.users.filter(u => u.id !== id);
  saveState();
}

async function attemptLogin(username, password) {
  const user = findUser(username);
  if (!user) return { ok: false, message: 'Usuário não encontrado.' };
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return { ok: false, message: 'Senha incorreta.' };
  return { ok: true, user };
}

function rememberUser(username) {
  try { localStorage.setItem(CURRENT_USER_KEY, username); } catch (e) { /* ignora */ }
}

function forgetRememberedUser() {
  try { localStorage.removeItem(CURRENT_USER_KEY); } catch (e) { /* ignora */ }
}

function visibleProjects() {
  if (!currentUser) return [];
  if (currentUser.role === 'admin') return state.projects;
  return state.projects.filter(p => p.ownerUsername === currentUser.username);
}

function roleLabel(role) {
  return role === 'admin' ? 'Administrador' : 'Usuário';
}

function loginSuccess(user) {
  currentUser = user;
  rememberUser(user.username);
  selectedProjectId = visibleProjects()[0] ? visibleProjects()[0].id : null;
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app-shell').hidden = false;
  updateSessionUI();
  render();
}

function logout() {
  currentUser = null;
  forgetRememberedUser();
  selectedProjectId = null;
  document.getElementById('app-shell').hidden = true;
  document.getElementById('login-screen').hidden = false;
  showLoginOrBootstrap();
}

function updateSessionUI() {
  const label = document.getElementById('current-user-label');
  const usersToggle = document.getElementById('btn-users-toggle');
  if (!currentUser) return;
  label.innerHTML = `<strong>${escapeHtml(currentUser.username)}</strong> <span class="badge ${currentUser.role === 'admin' ? 'status-em-andamento' : 'status-planejamento'}">${roleLabel(currentUser.role)}</span>`;
  usersToggle.hidden = currentUser.role !== 'admin';
}

function syncSessionAfterStateChange() {
  if (!currentUser) return;
  const stillExists = findUser(currentUser.username);
  if (!stillExists) { logout(); return; }
  currentUser = stillExists;
  updateSessionUI();
  if (!visibleProjects().find(p => p.id === selectedProjectId)) {
    selectedProjectId = visibleProjects()[0] ? visibleProjects()[0].id : null;
  }
}

function showLoginOrBootstrap() {
  const hasUsers = state.users.length > 0;
  document.getElementById('login-bootstrap').hidden = hasUsers;
  document.getElementById('login-form-wrap').hidden = !hasUsers;
  document.getElementById('login-error').textContent = '';
}

function renderUsersPanel() {
  const list = document.getElementById('users-list');
  if (!list) return;
  list.innerHTML = state.users.map(u => `
    <div class="user-row">
      <span class="user-name">${escapeHtml(u.username)}</span>
      <span class="badge ${u.role === 'admin' ? 'status-em-andamento' : 'status-planejamento'}">${roleLabel(u.role)}</span>
      <button class="icon-btn user-delete" data-user="${u.id}" title="Remover usuário">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.user-delete').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm('Remover este usuário? Os projetos dele continuam existindo, só deixam de ter alguém logado como dono.')) return;
    try {
      deleteUser(btn.dataset.user);
      renderUsersPanel();
      renderProjectList();
    } catch (e) {
      document.getElementById('users-status-line').textContent = e.message;
    }
  }));
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
    const user = await createFirstAdmin(username, password);
    loginSuccess(user);
  });

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const result = await attemptLogin(username, password);
    const errorEl = document.getElementById('login-error');
    if (!result.ok) { errorEl.textContent = result.message; return; }
    loginSuccess(result.user);
  });

  document.getElementById('btn-logout').addEventListener('click', logout);

  document.getElementById('btn-users-toggle').addEventListener('click', () => {
    const panel = document.getElementById('users-panel');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) renderUsersPanel();
  });

  document.getElementById('btn-create-user').addEventListener('click', async () => {
    const username = document.getElementById('new-user-username').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    const statusEl = document.getElementById('users-status-line');
    try {
      await createUser(username, password, role);
      document.getElementById('new-user-username').value = '';
      document.getElementById('new-user-password').value = '';
      statusEl.textContent = 'Usuário criado.';
      renderUsersPanel();
    } catch (e) {
      statusEl.textContent = e.message;
    }
  });
}

function initAuth() {
  wireAuthEvents();
  showLoginOrBootstrap();

  const remembered = localStorage.getItem(CURRENT_USER_KEY);
  const user = remembered ? findUser(remembered) : null;
  if (user) {
    loginSuccess(user);
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

function createProject() {
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
    tasks: [],
    materials: [],
  };
  state.projects.unshift(project);
  selectedProjectId = project.id;
  saveState();
  render();
  focusProjectName();
}

function deleteProject(id) {
  const project = findProject(id);
  if (!project) return;
  if (!confirm(`Excluir o projeto "${project.name}"? Essa ação não pode ser desfeita.`)) return;
  state.projects = state.projects.filter(p => p.id !== id);
  if (selectedProjectId === id) {
    const remaining = visibleProjects();
    selectedProjectId = remaining[0] ? remaining[0].id : null;
  }
  saveState();
  render();
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

    <section class="block">
      <h3>Avanço do projeto</h3>
      <div class="progress-display">
        <input id="field-progress" type="range" min="0" max="100" step="5" value="${progress}" ${progressLocked ? 'disabled' : ''}>
        <span class="pct">${progress}%</span>
      </div>
      ${progressLocked ? '<p style="font-size:12px;color:var(--text-muted);margin:6px 0 0;">O avanço é calculado automaticamente pelas tarefas concluídas abaixo. Desmarque todas as tarefas para voltar ao controle manual.</p>' : ''}

      <div class="checklist" id="checklist" style="margin-top:12px;"></div>
      <div class="add-row-form">
        <input id="new-task-text" type="text" placeholder="Nova tarefa/etapa" style="flex:1;min-width:200px;">
        <button id="btn-add-task" class="btn">+ Adicionar tarefa</button>
      </div>
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

function taskCardHtml(task) {
  const subtasks = task.subtasks || [];
  const hasSubtasks = subtasks.length > 0;
  const effectiveDone = taskEffectiveDone(task);
  return `
    <div class="task-card${effectiveDone ? ' done' : ''}">
      <div class="task-card-header">
        <input type="checkbox" class="task-check" data-task="${task.id}" ${effectiveDone ? 'checked' : ''} ${hasSubtasks ? 'disabled' : ''}>
        <input type="text" class="task-text" data-task="${task.id}" value="${escapeAttr(task.text)}">
        <button class="icon-btn task-delete" data-task="${task.id}" title="Remover tarefa">✕</button>
      </div>
      <div class="task-meta-row">
        <span>Responsável:</span>
        <input type="text" class="task-responsible" data-task="${task.id}" value="${escapeAttr(task.responsible)}" placeholder="Nome">
      </div>
      <div class="task-meta-row task-dates-row">
        <label>Início<input type="date" class="task-start-date" data-task="${task.id}" value="${escapeAttr(task.startDate)}"></label>
        <label>Planejada<input type="date" class="task-planned-date" data-task="${task.id}" value="${escapeAttr(task.plannedDate)}"></label>
        <label>Entrega real<input type="date" class="task-actual-date" data-task="${task.id}" value="${escapeAttr(task.actualDate)}"></label>
      </div>
      ${hasSubtasks ? '<p class="task-hint">Concluída automaticamente quando todas as subtarefas forem marcadas.</p>' : ''}
      <textarea class="task-description" data-task="${task.id}" placeholder="Descrição do que foi feito nesta tarefa">${escapeHtml(task.description)}</textarea>
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

function renderChecklist(project) {
  const el = document.getElementById('checklist');
  if (!project.tasks || project.tasks.length === 0) {
    el.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Nenhuma tarefa cadastrada. O avanço pode ser ajustado manualmente acima.</p>';
    return;
  }
  el.innerHTML = project.tasks.map(taskCardHtml).join('');

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
  el.querySelectorAll('.task-start-date').forEach(inp => inp.addEventListener('change', () => {
    const task = project.tasks.find(t => t.id === inp.dataset.task);
    task.startDate = inp.value;
    saveState();
    renderMethodologyTools(project);
  }));
  el.querySelectorAll('.task-planned-date').forEach(inp => inp.addEventListener('change', () => {
    const task = project.tasks.find(t => t.id === inp.dataset.task);
    task.plannedDate = inp.value;
    saveState();
    renderMethodologyTools(project);
  }));
  el.querySelectorAll('.task-actual-date').forEach(inp => inp.addEventListener('change', () => {
    const task = project.tasks.find(t => t.id === inp.dataset.task);
    task.actualDate = inp.value;
    saveState();
    renderMethodologyTools(project);
  }));
  el.querySelectorAll('.task-delete').forEach(btn => btn.addEventListener('click', () => {
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

  document.getElementById('btn-add-task').addEventListener('click', () => addTask(project));
  document.getElementById('new-task-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask(project);
  });

  document.getElementById('btn-add-material').addEventListener('click', () => addMaterial(project));
}

function addTask(project) {
  const input = document.getElementById('new-task-text');
  const text = input.value.trim();
  if (!text) return;
  project.tasks = project.tasks || [];
  project.tasks.push({
    id: uid(), text, done: false, description: '', responsible: '', subtasks: [],
    startDate: '', plannedDate: '', actualDate: '',
  });
  saveState();
  renderDetail();
  renderProjectList();
  renderSummary();
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
  state = ensureUsersArray(loadState());

  document.getElementById('btn-new-project').addEventListener('click', createProject);
  document.getElementById('btn-open-file').addEventListener('click', openDataFile);
  document.getElementById('btn-save-file').addEventListener('click', () => saveToFile(true));
  document.getElementById('btn-export').addEventListener('click', exportBackup);
  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-input').click());
  document.getElementById('import-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = '';
  });

  if (!fsApiSupported()) {
    document.getElementById('btn-open-file').title = 'Navegador sem suporte a este recurso; será usado o backup em arquivo .json';
  }

  initAuth();
  tryRestoreHandle();

  if (window.DriveSync) {
    window.DriveSync.setup({
      getCurrentState: () => state,
      onDataLoaded: (remoteState) => {
        state = ensureUsersArray(remoteState);
        persistLocal();
        syncSessionAfterStateChange();
        render();
      },
      onStatus: (msg, kind) => setStatus(msg, kind),
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
