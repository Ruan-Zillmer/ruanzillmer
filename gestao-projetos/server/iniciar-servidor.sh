#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Instalando dependências, aguarde um instante (só acontece na primeira vez)..."
  npm install
fi
echo ""
echo "Iniciando o servidor do Gestão de Projetos - AUTOMAÇÃO..."
echo "Deixe este terminal aberto. Feche-o (ou Ctrl+C) apenas se quiser parar o servidor."
echo ""
node server.js
