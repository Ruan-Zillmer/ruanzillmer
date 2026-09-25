'use strict';

/**
 * Sincronização automática com o Google Drive (API oficial), usando o escopo
 * mínimo "drive.file" — o app só enxerga o próprio arquivo de dados que ele
 * cria, nunca o resto do seu Drive. Autônomo em relação a app.js: expõe
 * window.DriveSync e só é acionado quando app.js chama DriveSync.setup(...).
 *
 * Pré-requisito: a página precisa ser aberta via http/https (ex: GitHub
 * Pages), não via file://, porque o login do Google exige uma origem
 * autorizada de verdade.
 */
const DriveSync = (() => {
  const DRIVE_FILE_NAME = 'dados.json';
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const CLIENT_ID_KEY = 'gestao-projetos:google-client-id';
  const SAVE_DEBOUNCE_MS = 800;

  let clientId = localStorage.getItem(CLIENT_ID_KEY) || '';
  let tokenClient = null;
  let accessToken = null;
  let tokenExpiresAt = 0;
  let fileId = null;
  let connected = false;
  let saveTimer = null;
  let callbacks = { onDataLoaded: () => {}, onStatus: () => {}, getCurrentState: () => ({ projects: [] }) };

  let els = {};

  function cacheEls() {
    els = {
      toggleBtn: document.getElementById('btn-drive-toggle'),
      panel: document.getElementById('drive-panel'),
      clientIdInput: document.getElementById('drive-client-id'),
      saveConfigBtn: document.getElementById('btn-drive-save-config'),
      connectBtn: document.getElementById('btn-drive-connect'),
      disconnectBtn: document.getElementById('btn-drive-disconnect'),
      statusLine: document.getElementById('drive-status-line'),
    };
  }

  function gisReady() {
    return typeof window.google !== 'undefined' && window.google.accounts && window.google.accounts.oauth2;
  }

  function updatePanelUI() {
    if (!els.panel) return;
    els.clientIdInput.value = clientId;
    els.connectBtn.hidden = connected;
    els.disconnectBtn.hidden = !connected;
    els.connectBtn.disabled = !clientId;
    els.statusLine.textContent = connected
      ? 'Conectado ao Google Drive. Sincronizando automaticamente.'
      : (clientId ? 'Client ID salvo. Clique em "Conectar" para entrar com sua conta Google.' : 'Cole o Client ID do Google (OAuth) e salve para habilitar.');
    els.toggleBtn.textContent = connected ? 'Google Drive ✓' : 'Google Drive';
  }

  function ensureTokenClient() {
    if (!gisReady()) throw new Error('Biblioteca do Google ainda não carregou. Verifique sua conexão e tente de novo.');
    if (!tokenClient || tokenClient.__clientId !== clientId) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: () => {}, // sobrescrito a cada chamada em requestToken()
      });
      tokenClient.__clientId = clientId;
    }
    return tokenClient;
  }

  function requestToken(interactive) {
    return new Promise((resolve, reject) => {
      try {
        const client = ensureTokenClient();
        client.callback = (resp) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          accessToken = resp.access_token;
          tokenExpiresAt = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
          resolve(accessToken);
        };
        client.error_callback = (err) => reject(new Error(err && err.message ? err.message : 'Falha na autenticação'));
        client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
      } catch (e) {
        reject(e);
      }
    });
  }

  async function ensureAccessToken(interactive) {
    if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
    return requestToken(interactive);
  }

  async function driveFetch(url, options, interactive) {
    const token = await ensureAccessToken(interactive);
    const headers = Object.assign({}, (options && options.headers) || {}, { Authorization: 'Bearer ' + token });
    const res = await fetch(url, Object.assign({}, options, { headers }));
    if (res.status === 401 && !options.__retried) {
      accessToken = null;
      return driveFetch(url, Object.assign({}, options, { __retried: true }), true);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Google Drive (${res.status}): ${text.slice(0, 200)}`);
    }
    return res;
  }

  async function findExistingFile() {
    const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
    const res = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`,
      { method: 'GET' },
      false
    );
    const data = await res.json();
    return (data.files && data.files[0]) || null;
  }

  async function createFile(initialContent) {
    const createRes = await driveFetch(
      'https://www.googleapis.com/drive/v3/files',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: 'application/json' }),
      },
      false
    );
    const created = await createRes.json();
    await writeContent(created.id, initialContent);
    return created.id;
  }

  async function readContent(id) {
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { method: 'GET' }, false);
    return res.json();
  }

  async function writeContent(id, contentObj) {
    await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contentObj) },
      false
    );
  }

  async function connect(interactive) {
    if (!clientId) { callbacks.onStatus('Configure o Client ID do Google Drive primeiro.', 'warn'); return; }
    try {
      await ensureAccessToken(interactive);
      const existing = await findExistingFile();
      if (existing) {
        fileId = existing.id;
        const remoteState = await readContent(fileId);
        if (remoteState && Array.isArray(remoteState.projects)) callbacks.onDataLoaded(remoteState);
        callbacks.onStatus('Dados carregados do Google Drive.', 'ok');
      } else {
        fileId = await createFile(callbacks.getCurrentState());
        callbacks.onStatus('Arquivo criado no Google Drive. Sincronizando automaticamente a partir de agora.', 'ok');
      }
      connected = true;
      updatePanelUI();
    } catch (e) {
      connected = false;
      updatePanelUI();
      if (interactive) callbacks.onStatus('Não foi possível conectar ao Google Drive: ' + e.message, 'error');
    }
  }

  function disconnect() {
    connected = false;
    accessToken = null;
    fileId = null;
    updatePanelUI();
    callbacks.onStatus('Desconectado do Google Drive. As alterações voltam a salvar só localmente.', 'warn');
  }

  function scheduleSave(currentState) {
    if (!connected || !fileId) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await writeContent(fileId, currentState);
      } catch (e) {
        callbacks.onStatus('Erro ao salvar no Google Drive: ' + e.message, 'error');
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function saveConfig() {
    const value = els.clientIdInput.value.trim();
    clientId = value;
    localStorage.setItem(CLIENT_ID_KEY, clientId);
    tokenClient = null;
    updatePanelUI();
    callbacks.onStatus(clientId ? 'Client ID salvo.' : 'Client ID removido.', 'ok');
  }

  function setup(cb) {
    callbacks = Object.assign(callbacks, cb);
    cacheEls();
    if (!els.toggleBtn) return; // markup não presente (ex: prévia antiga)

    els.toggleBtn.addEventListener('click', () => { els.panel.hidden = !els.panel.hidden; });
    els.saveConfigBtn.addEventListener('click', saveConfig);
    els.connectBtn.addEventListener('click', () => connect(true));
    els.disconnectBtn.addEventListener('click', disconnect);

    updatePanelUI();

    // tenta reconectar em silêncio (sem popup) se já havia um Client ID salvo
    if (clientId && gisReady()) {
      connect(false);
    } else if (clientId && !gisReady()) {
      window.addEventListener('load', () => { if (gisReady()) connect(false); });
    }
  }

  return { setup, scheduleSave };
})();

window.DriveSync = DriveSync;
