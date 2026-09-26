@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias, aguarde um instante ^(so acontece na primeira vez^)...
  call npm install
)
echo.
echo Iniciando o servidor do Gestao de Projetos - AUTOMACAO...
echo Deixe esta janela aberta. Feche-a apenas se quiser parar o servidor.
echo.
node server.js
pause
