#!/bin/bash
cd "$(dirname "$0")"

NODE_BIN=""
if [ -x "node-portable/bin/node" ]; then
  NODE_BIN="node-portable/bin/node"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="node"
fi

if [ -z "$NODE_BIN" ]; then
  echo ""
  echo "=========================================================="
  echo " Node.js não foi encontrado neste computador."
  echo " Baixe e instale em https://nodejs.org/ (ou, sem permissão"
  echo " de administrador, baixe o pacote binário .tar.xz e extraia"
  echo " dentro de uma pasta 'node-portable' aqui: $(pwd)/node-portable"
  echo "=========================================================="
  echo ""
  exit 1
fi

echo ""
echo "Iniciando o servidor do Gestão de Projetos - AUTOMAÇÃO..."
echo "Deixe este terminal aberto. Feche-o (ou Ctrl+C) apenas se quiser parar o servidor."
echo ""
"$NODE_BIN" start.js
