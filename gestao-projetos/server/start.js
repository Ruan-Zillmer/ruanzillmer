'use strict';

// Ponto de entrada único: garante que as dependências estão instaladas antes
// de subir o servidor de verdade (server.js). Usado tanto pelo VSCode (F5)
// quanto pelos scripts iniciar-servidor.bat/.sh.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const nodeModulesPath = path.join(__dirname, 'node_modules');

// Usa o npm que vem do MESMO node.exe que está rodando este script (funciona
// tanto com um Node.js instalado normalmente quanto com a versão portátil
// em zip, sem depender do PATH do sistema).
function resolveNpmCommand() {
  const npmName = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const besideNode = path.join(path.dirname(process.execPath), npmName);
  return fs.existsSync(besideNode) ? besideNode : npmName;
}

if (!fs.existsSync(nodeModulesPath)) {
  console.log('Instalando dependências, aguarde um instante (só acontece na primeira vez)...');
  const result = spawnSync(resolveNpmCommand(), ['install'], { cwd: __dirname, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error('Falha ao instalar dependências. Verifique se o Node.js/npm está instalado corretamente.');
    process.exit(result.status || 1);
  }
}

require('./server.js');
