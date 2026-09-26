@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ==========================================================
  echo  Node.js nao foi encontrado neste computador.
  echo  Baixe e instale a versao LTS em https://nodejs.org/
  echo  e depois rode este arquivo de novo.
  echo ==========================================================
  echo.
  pause
  exit /b 1
)

echo.
echo Iniciando o servidor do Gestao de Projetos - AUTOMACAO...
echo Deixe esta janela aberta. Feche-a apenas se quiser parar o servidor.
echo.
node start.js
pause
