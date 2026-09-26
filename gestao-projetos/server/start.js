'use strict';

// Ponto de entrada único: garante que as dependências estão instaladas antes
// de subir o servidor de verdade (server.js). Usado tanto pelo VSCode (F5)
// quanto pelos scripts iniciar-servidor.bat/.sh.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const nodeModulesPath = path.join(__dirname, 'node_modules');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('Instalando dependências, aguarde um instante (só acontece na primeira vez)...');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['install'], { cwd: __dirname, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error('Falha ao instalar dependências. Verifique se o Node.js/npm está instalado corretamente.');
    process.exit(result.status || 1);
  }
}

require('./server.js');
