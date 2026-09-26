@echo off
cd /d "%~dp0"

set "NODE_EXE="

if exist "node-portable\node.exe" (
  set "NODE_EXE=node-portable\node.exe"
) else (
  where node >nul 2>nul
  if not errorlevel 1 set "NODE_EXE=node"
)

if "%NODE_EXE%"=="" (
  echo.
  echo ==========================================================
  echo  Node.js nao foi encontrado neste computador.
  echo.
  echo  SE VOCE TEM permissao de administrador:
  echo    Baixe e instale a versao LTS em https://nodejs.org/
  echo    e rode este arquivo de novo.
  echo.
  echo  SE VOCE NAO TEM permissao de administrador (ex: computador
  echo  da empresa):
  echo    1. Baixe a versao "Windows Binary (.zip)" em
  echo       https://nodejs.org/en/download (nao e o instalador,
  echo       e um arquivo .zip que nao precisa instalar nada)
  echo    2. Extraia o conteudo do zip dentro desta pasta:
  echo       %~dp0node-portable
  echo       (o arquivo node.exe deve ficar direto dentro de
  echo       "node-portable", sem subpastas no meio)
  echo    3. Rode este arquivo de novo.
  echo ==========================================================
  echo.
  pause
  exit /b 1
)

echo.
echo Iniciando o servidor do Gestao de Projetos - AUTOMACAO...
echo Deixe esta janela aberta. Feche-a apenas se quiser parar o servidor.
echo.
"%NODE_EXE%" start.js
pause
