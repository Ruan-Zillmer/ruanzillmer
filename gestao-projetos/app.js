'use strict';

const STORAGE_KEY = 'gestao-projetos:data:v1';
const HANDLE_DB = 'gestao-projetos-handles';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'dataFile';

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

let state = { projects: [] };
let selectedProjectId = null;
let fileHandle = null;
let saveToFileTimer = null;

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
      if (parsed && Array.isArray(parsed.projects)) return parsed;
    }
  } catch (e) {
    console.error('Falha ao carregar dados salvos', e);
  }
  return { projects: [] };
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
    state = parsed;
    fileHandle = handle;
    await storeHandle(handle);
    document.getElementById('btn-save-file').disabled = false;
    selectedProjectId = state.projects[0] ? state.projects[0].id : null;
    persistLocal();
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
      state = parsed;
      selectedProjectId = state.projects[0] ? state.projects[0].id : null;
      saveState();
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
  if (selectedProjectId === id) selectedProjectId = state.projects[0] ? state.projects[0].id : null;
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
  const total = state.projects.length;
  const emAndamento = state.projects.filter(p => p.status === 'em-andamento').length;
  const concluidos = state.projects.filter(p => p.status === 'concluido').length;
  const gastoTotal = state.projects.reduce((sum, p) => sum + projectTotals(p).gasto, 0);
  el.innerHTML = `
    <div><div class="stat-value">${total}</div><div>Projetos</div></div>
    <div><div class="stat-value">${emAndamento}</div><div>Em andamento</div></div>
    <div><div class="stat-value">${concluidos}</div><div>Concluídos</div></div>
    <div><div class="stat-value">${formatCurrency(gastoTotal)}</div><div>Gasto total</div></div>
  `;
}

function renderProjectList() {
  const list = document.getElementById('project-list');
  const tpl = document.getElementById('tpl-project-card');
  list.innerHTML = '';
  if (state.projects.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Nenhum projeto ainda. Clique em "Novo projeto".</p>';
    return;
  }
  for (const project of state.projects) {
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
    list.appendChild(node);
  }
}

function renderDetail() {
  const detail = document.getElementById('detail');
  const project = findProject(selectedProjectId);
  if (!project) {
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
  renderMaterials(project);
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
  document.getElementById('field-methodology').addEventListener('input', (e) => updateProject(project.id, { methodology: e.target.value }));
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
  project.tasks.push({ id: uid(), text, done: false, description: '', responsible: '', subtasks: [] });
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
  state = loadState();
  if (state.projects.length > 0) selectedProjectId = state.projects[0].id;

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

  render();
  tryRestoreHandle();
}

document.addEventListener('DOMContentLoaded', init);
