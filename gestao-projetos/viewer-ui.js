'use strict';

// Anexos de arquivos (por etapa e no conceito do projeto) + visualizador.
// Usa o visualizador 3D de vendor/viewer3d.js (window.Viewer3D).

const FileUI = (() => {
  const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  const FORMATS_HINT = 'STEP, IGES, STL, OBJ, GLB, 3MF, PLY, PDF, imagens...';
  const bufferCache = new Map(); // fileId -> ArrayBuffer (guarda só os últimos para não pesar)
  const MAX_CACHED = 3;
  let persistentViewer = null;   // { key, el, api } — mantém o visualizador do conceito vivo entre re-renders
  let modalState = null;

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function extOf(name) {
    const m = /\.([A-Za-z0-9]+)$/.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }

  function kindOf(name) {
    const ext = extOf(name);
    if (window.Viewer3D && window.Viewer3D.canView(ext)) return '3d';
    if (ext === 'pdf') return 'pdf';
    if (IMAGE_EXTS.indexOf(ext) >= 0) return 'image';
    return 'other';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  function fileUrl(project, file, inline) {
    return `/api/projects/${encodeURIComponent(project.id)}/files/${encodeURIComponent(file.id)}${inline ? '?inline=1' : ''}`;
  }

  // ---------- download com progresso + cache ----------

  async function fetchBuffer(project, file, onProgress) {
    if (bufferCache.has(file.id)) return bufferCache.get(file.id);
    const res = await fetch(fileUrl(project, file), { credentials: 'same-origin' });
    if (!res.ok) throw new Error(res.status === 404 ? 'Arquivo não encontrado no servidor.' : 'Não foi possível baixar o arquivo (código ' + res.status + ').');
    const total = Number(res.headers.get('content-length')) || file.size || 0;
    let buffer;
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (onProgress && total) onProgress(received / total);
      }
      const merged = new Uint8Array(received);
      let offset = 0;
      chunks.forEach((c) => { merged.set(c, offset); offset += c.length; });
      buffer = merged.buffer;
    } else {
      buffer = await res.arrayBuffer();
    }
    bufferCache.set(file.id, buffer);
    while (bufferCache.size > MAX_CACHED) bufferCache.delete(bufferCache.keys().next().value);
    return buffer;
  }

  // ---------- painel do visualizador (usado inline e no modal) ----------

  function viewerShellHtml(opts) {
    return `
      <div class="v3d">
        <div class="v3d-toolbar">
          <div class="v3d-group" data-3d-only>
            <button type="button" class="v3d-btn" data-view="iso" title="Vista isométrica / enquadrar">Iso</button>
            <button type="button" class="v3d-btn" data-view="front">Frente</button>
            <button type="button" class="v3d-btn" data-view="top">Topo</button>
            <button type="button" class="v3d-btn" data-view="right">Direita</button>
          </div>
          <div class="v3d-group" data-3d-only>
            <button type="button" class="v3d-btn active" data-toggle="edges">Arestas</button>
            <button type="button" class="v3d-btn" data-toggle="wireframe">Malha</button>
            <button type="button" class="v3d-btn active" data-toggle="grid">Grade</button>
            <button type="button" class="v3d-btn" data-toggle="ortho">Ortogonal</button>
          </div>
          <div class="v3d-group v3d-clip" data-3d-only>
            <label>Corte
              <select data-clip-axis>
                <option value="">Sem corte</option>
                <option value="x">Eixo X</option>
                <option value="y">Eixo Y</option>
                <option value="z">Eixo Z</option>
              </select>
            </label>
            <input type="range" min="0" max="100" value="100" data-clip-range disabled>
          </div>
          <div class="v3d-group v3d-right">
            <button type="button" class="v3d-btn" data-act="snapshot" data-3d-only title="Salvar uma imagem da vista atual">Capturar imagem</button>
            ${opts.expandable ? '<button type="button" class="v3d-btn" data-act="expand" title="Abrir em tela cheia">Ampliar</button>' : ''}
          </div>
        </div>
        <div class="v3d-stage">
          <div class="v3d-canvas"></div>
          <div class="v3d-overlay v3d-loading"><span class="v3d-spinner"></span><span class="v3d-loading-text">Carregando...</span></div>
          <div class="v3d-info" hidden></div>
          <div class="v3d-help" data-3d-only>Botão esquerdo: girar · Direito: mover · Roda: zoom</div>
        </div>
      </div>`;
  }

  function setLoading(root, text) {
    const o = root.querySelector('.v3d-loading');
    if (!o) return;
    o.hidden = !text;
    if (text) o.querySelector('.v3d-loading-text').textContent = text;
  }

  function showMessage(root, html) {
    const stage = root.querySelector('.v3d-stage');
    let msg = stage.querySelector('.v3d-message');
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'v3d-overlay v3d-message';
      stage.appendChild(msg);
    }
    msg.innerHTML = html;
    setLoading(root, '');
  }

  function formatDim(n) {
    if (n >= 1000) return n.toFixed(0);
    if (n >= 100) return n.toFixed(1);
    return n.toFixed(2);
  }

  // Preenche o painel `root` (já com viewerShellHtml) com o arquivo.
  // Devolve { dispose() }.
  function fillViewer(root, project, file, opts) {
    opts = opts || {};
    const kind = kindOf(file.name);
    const handle = { api: null, disposed: false, dispose() { this.disposed = true; if (this.api) this.api.dispose(); } };

    const only3d = root.querySelectorAll('[data-3d-only]');
    if (kind !== '3d') only3d.forEach((n) => { n.hidden = true; });

    const canvasHost = root.querySelector('.v3d-canvas');

    if (kind === 'pdf') {
      canvasHost.innerHTML = `<iframe class="v3d-frame" title="${esc(file.name)}" src="${fileUrl(project, file, true)}"></iframe>`;
      setLoading(root, '');
      return handle;
    }
    if (kind === 'image') {
      canvasHost.innerHTML = `<img class="v3d-image" alt="${esc(file.name)}" src="${fileUrl(project, file, true)}">`;
      setLoading(root, '');
      return handle;
    }
    if (kind === 'other') {
      showMessage(root, `<p><strong>${esc(file.name)}</strong></p><p>Este formato não tem visualização aqui. Baixe o arquivo para abrir no programa de origem (SolidWorks, AutoCAD...).</p><p><a class="btn btn-primary" href="${fileUrl(project, file)}">Baixar arquivo</a></p>`);
      return handle;
    }

    if (!window.Viewer3D) {
      showMessage(root, '<p>O visualizador 3D não foi carregado (arquivo vendor/viewer3d.js ausente).</p>');
      return handle;
    }

    let api;
    try {
      api = window.Viewer3D.create(canvasHost, { basePath: '/vendor/' });
    } catch (e) {
      showMessage(root, '<p>Este navegador/computador não conseguiu iniciar o gráfico 3D (WebGL). Tente atualizar o navegador ou habilitar a aceleração de hardware.</p>');
      return handle;
    }
    handle.api = api;
    const ext = extOf(file.name);
    const isCad = window.Viewer3D.CAD_EXTS.indexOf(ext) >= 0;

    setLoading(root, 'Baixando arquivo...');
    fetchBuffer(project, file, (p) => setLoading(root, 'Baixando arquivo... ' + Math.round(p * 100) + '%'))
      .then((buffer) => {
        if (handle.disposed) return null;
        setLoading(root, isCad ? 'Processando modelo CAD (pode levar alguns segundos)...' : 'Montando modelo...');
        // dá um respiro para o navegador pintar a mensagem antes do processamento pesado
        return new Promise((r) => setTimeout(r, 30)).then(() => api.loadFromBuffer(ext, buffer));
      })
      .then((info) => {
        if (!info || handle.disposed) return;
        setLoading(root, '');
        const infoEl = root.querySelector('.v3d-info');
        const tris = info.triangles >= 1000 ? (info.triangles / 1000).toFixed(0) + ' mil' : String(info.triangles);
        infoEl.innerHTML = `<strong>${esc(file.name)}</strong><br>` +
          `Dimensões: ${formatDim(info.size.x)} × ${formatDim(info.size.y)} × ${formatDim(info.size.z)}` +
          `${isCad ? ' mm' : ' (unidade do arquivo)'} · ${tris} triângulos`;
        infoEl.hidden = false;
        syncToggles();
      })
      .catch((e) => {
        if (handle.disposed) return;
        showMessage(root, `<p><strong>Não foi possível exibir este arquivo.</strong></p><p>${esc(e.message || e)}</p><p><a class="btn" href="${fileUrl(project, file)}">Baixar arquivo</a></p>`);
      });

    function syncToggles() {
      const st = api.getState();
      root.querySelectorAll('[data-toggle]').forEach((b) => b.classList.toggle('active', !!st[b.dataset.toggle]));
    }

    root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => api.setView(b.dataset.view)));
    root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.toggle;
      const st = api.getState();
      const next = !st[key];
      if (key === 'edges') api.setEdges(next);
      else if (key === 'wireframe') api.setWireframe(next);
      else if (key === 'grid') api.setGrid(next);
      else if (key === 'ortho') api.setOrtho(next);
      syncToggles();
    }));
    const axisSel = root.querySelector('[data-clip-axis]');
    const range = root.querySelector('[data-clip-range]');
    function applyClip() {
      range.disabled = !axisSel.value;
      api.setClip(axisSel.value, Number(range.value) / 100);
    }
    axisSel.addEventListener('change', () => { range.value = 100; applyClip(); });
    range.addEventListener('input', applyClip);

    const snap = root.querySelector('[data-act="snapshot"]');
    if (snap) snap.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = api.snapshot();
      a.download = file.name.replace(/\.[^.]+$/, '') + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    const expand = root.querySelector('[data-act="expand"]');
    if (expand && opts.onExpand) expand.addEventListener('click', opts.onExpand);

    return handle;
  }

  // ---------- modal (tela cheia) ----------

  function closeModal() {
    if (!modalState) return;
    modalState.handle.dispose();
    modalState.overlay.remove();
    document.removeEventListener('keydown', modalState.onKey);
    modalState = null;
  }

  function openModal(project, file) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Visualizador de arquivo">
        <div class="modal-header">
          <div class="modal-title">${esc(file.name)}</div>
          <div class="modal-actions">
            <a class="btn" href="${fileUrl(project, file)}">Baixar</a>
            <button type="button" class="btn btn-primary" data-act="close">Fechar</button>
          </div>
        </div>
        <div class="modal-body">${viewerShellHtml({ expandable: false })}</div>
      </div>`;
    document.body.appendChild(overlay);
    const handle = fillViewer(overlay.querySelector('.modal-body'), project, file, {});
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('[data-act="close"]').addEventListener('click', closeModal);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
    modalState = { overlay, handle, onKey };
  }

  // ---------- visualizador embutido na página (conceito do projeto) ----------

  function disposePersistent() {
    if (!persistentViewer) return;
    persistentViewer.handle.dispose();
    persistentViewer.el.remove();
    persistentViewer = null;
  }

  // Mantém o MESMO painel vivo enquanto projeto+arquivo forem os mesmos, para não
  // reprocessar um modelo pesado a cada pequena alteração de tela.
  function mountInline(container, project, file) {
    if (!file) { disposePersistent(); container.innerHTML = ''; return; }
    const key = project.id + ':' + file.id;
    if (persistentViewer && persistentViewer.key === key) {
      container.innerHTML = '';
      container.appendChild(persistentViewer.el);
      return;
    }
    disposePersistent();
    const el = document.createElement('div');
    el.innerHTML = viewerShellHtml({ expandable: true });
    const panel = el.firstElementChild;
    container.innerHTML = '';
    container.appendChild(panel);
    const handle = fillViewer(panel, project, file, { onExpand: () => openModal(project, file) });
    persistentViewer = { key, el: panel, handle };
  }

  // ---------- caixa de anexos ----------

  function fileIcon(name) {
    const k = kindOf(name);
    if (k === '3d') return '3D';
    if (k === 'pdf') return 'PDF';
    if (k === 'image') return 'IMG';
    return (extOf(name) || 'ARQ').slice(0, 4).toUpperCase();
  }

  function boxInnerHtml(files, opts) {
    const items = (files || []).map((f) => `
      <div class="file-item${opts && opts.selectedId === f.id ? ' selected' : ''}" data-file="${esc(f.id)}">
        <span class="file-icon file-icon-${kindOf(f.name)}">${esc(fileIcon(f.name))}</span>
        <span class="file-meta">
          <span class="file-name" title="${esc(f.name)}">${esc(f.name)}</span>
          <span class="file-sub">${formatSize(f.size || 0)}${f.uploadedBy ? ' · ' + esc(f.uploadedBy) : ''}</span>
        </span>
        <span class="file-actions">
          ${kindOf(f.name) !== 'other' ? `<button type="button" class="btn btn-small" data-act="view">${opts && opts.inlineSelect ? 'Exibir' : 'Visualizar'}</button>` : ''}
          <a class="btn btn-small" href="__DL__${esc(f.id)}" data-act="download">Baixar</a>
          <button type="button" class="icon-btn" data-act="delete" title="Remover arquivo">✕</button>
        </span>
      </div>`).join('');
    return `
      <div class="file-list">${items}</div>
      <div class="file-uploads"></div>
      <div class="file-drop">
        <label class="btn btn-small file-attach">+ Anexar arquivo<input type="file" multiple hidden></label>
        <span class="file-hint">ou arraste aqui — ${FORMATS_HINT}</span>
      </div>`;
  }

  function uploadOne(project, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/projects/${encodeURIComponent(project.id)}/files`);
      xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        let body = {};
        try { body = JSON.parse(xhr.responseText); } catch (e) { /* ignora */ }
        if (xhr.status === 401) return reject(new Error('Sessão expirada. Faça login novamente.'));
        if (xhr.status === 413) return reject(new Error('Arquivo maior que o limite do servidor (' + (body.maxMb || '?') + ' MB).'));
        if (xhr.status >= 200 && xhr.status < 300 && body.file) return resolve(body.file);
        reject(new Error('O servidor recusou o arquivo (código ' + xhr.status + ').'));
      };
      xhr.onerror = () => reject(new Error('Falha de conexão com o servidor durante o envio.'));
      xhr.send(file);
    });
  }

  // Liga uma caixa de anexos. `files` é o array vivo (task.files ou concept.files).
  // opts: { onChange(), onView(file) , onDelete(file), inlineSelect, selectedId() }
  function mountBox(box, project, files, opts) {
    opts = opts || {};
    function render() {
      box.innerHTML = boxInnerHtml(files, { selectedId: opts.selectedId ? opts.selectedId() : null, inlineSelect: opts.inlineSelect })
        .replace(/__DL__([^"]+)/g, (m, id) => fileUrl(project, { id }));
      bind();
    }

    function bind() {
      const fileInput = box.querySelector('input[type="file"]');
      fileInput.addEventListener('change', () => { handleFiles(Array.from(fileInput.files)); fileInput.value = ''; });
      box.querySelectorAll('.file-item').forEach((row) => {
        const file = files.find((f) => f.id === row.dataset.file);
        const view = row.querySelector('[data-act="view"]');
        if (view) view.addEventListener('click', () => (opts.onView ? opts.onView(file) : openModal(project, file)));
        row.querySelector('[data-act="delete"]').addEventListener('click', async () => {
          if (!confirm('Remover o arquivo "' + file.name + '"?')) return;
          try {
            const res = await fetch(fileUrl(project, file), { method: 'DELETE', credentials: 'same-origin' });
            if (!res.ok && res.status !== 404) throw new Error('código ' + res.status);
          } catch (e) {
            alert('Não foi possível remover o arquivo: ' + e.message);
            return;
          }
          bufferCache.delete(file.id);
          files.splice(files.indexOf(file), 1);
          if (opts.onDelete) opts.onDelete(file);
          if (opts.onChange) opts.onChange();
          render();
        });
      });
    }

    async function handleFiles(list) {
      const uploads = box.querySelector('.file-uploads');
      for (const f of list) {
        const row = document.createElement('div');
        row.className = 'file-upload';
        row.innerHTML = `<span class="file-upload-name">${esc(f.name)}</span><span class="file-upload-bar"><span></span></span><span class="file-upload-pct">0%</span>`;
        uploads.appendChild(row);
        try {
          const saved = await uploadOne(project, f, (p) => {
            row.querySelector('.file-upload-bar span').style.width = Math.round(p * 100) + '%';
            row.querySelector('.file-upload-pct').textContent = Math.round(p * 100) + '%';
          });
          files.push(saved);
          if (opts.onChange) opts.onChange();
          if (opts.onUploaded) opts.onUploaded(saved);
        } catch (e) {
          row.classList.add('error');
          row.querySelector('.file-upload-pct').textContent = 'erro';
          row.title = e.message;
          alert('Falha ao enviar "' + f.name + '": ' + e.message);
        }
      }
      render();
    }

    ['dragenter', 'dragover'].forEach((ev) => box.addEventListener(ev, (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0) { e.preventDefault(); box.classList.add('dragging'); }
    }));
    ['dragleave', 'drop'].forEach((ev) => box.addEventListener(ev, (e) => {
      if (ev === 'dragleave' && box.contains(e.relatedTarget)) return;
      box.classList.remove('dragging');
    }));
    box.addEventListener('drop', (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      handleFiles(Array.from(e.dataTransfer.files));
    });

    render();
    return { render };
  }

  return { mountBox, mountInline, openModal, closeModal, disposeInline: disposePersistent, kindOf, extOf, formatSize };
})();
