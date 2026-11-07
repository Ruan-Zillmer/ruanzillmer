'use strict';

// Ponto de entrada único: garante que as dependências estão instaladas antes
// de subir o servidor de verdade (server.js). Usado tanto pelo VSCode (F5)
// quanto pelos scripts iniciar-servidor.bat/.sh.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const nodeModulesPath = path.join(__dirname, 'node_modules');
const pkg = require('./package.json');
const missingDependency = Object.keys(pkg.dependencies || {})
  .some((name) => !fs.existsSync(path.join(nodeModulesPath, name)));

// Roda "npm install" usando o npm que vem junto do MESMO node que está executando
// este script (funciona com Node instalado ou portátil, sem depender do PATH).
// Importante: no Windows, o Node 20.12+ recusa abrir arquivos .cmd diretamente
// (erro EINVAL), por isso chamamos o npm-cli.js pelo próprio node.
function runNpmInstall() {
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  let result;
  if (fs.existsSync(npmCli)) {
    result = spawnSync(process.execPath, [npmCli, 'install', '--no-audit', '--no-fund'], { cwd: __dirname, stdio: 'inherit' });
  } else {
    // npm instalado em outro lugar (ex: Linux/Mac): usa o npm do PATH através do shell
    result = spawnSync('npm install --no-audit --no-fund', { cwd: __dirname, stdio: 'inherit', shell: true });
  }
  if (result.error) console.error('Erro ao executar o npm:', result.error.message);
  return result.status === 0;
}

if (missingDependency) {
  console.log('Instalando dependências, aguarde um instante (só acontece na primeira vez ou após uma atualização)...');
  console.log('Isso baixa alguns pacotes da internet e pode levar de 1 a 3 minutos.');
  if (!runNpmInstall()) {
    console.error('');
    console.error('Falha ao instalar dependências. Veja a mensagem de erro acima.');
    console.error('Causas comuns: sem internet, ou a rede da empresa bloqueia registry.npmjs.org / github.com.');
    process.exit(1);
  }
}

require('./server.js');
