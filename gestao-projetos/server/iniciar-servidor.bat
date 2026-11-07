@echo off
setlocal
title Gestao de Projetos - AUTOMACAO (servidor)
cd /d "%~dp0"

set "TRIED_DOWNLOAD="

:search
rem --- procura o Node.js: 1) versao portatil na pasta node-portable, 2) instalado no Windows ---
set "NODE_EXE="
if exist "%~dp0node-portable\node.exe" set "NODE_EXE=%~dp0node-portable\node.exe"
if defined NODE_EXE goto found
rem aceita tambem se o zip foi extraido com uma subpasta (ex: node-portable\node-v22-win-x64\node.exe)
for /d %%D in ("%~dp0node-portable\node-*") do if exist "%%D\node.exe" set "NODE_EXE=%%D\node.exe"
if defined NODE_EXE goto found
where node >nul 2>nul
if not errorlevel 1 set "NODE_EXE=node"
if defined NODE_EXE goto found
if not defined TRIED_DOWNLOAD goto download
goto nonode

:download
set "TRIED_DOWNLOAD=1"
echo.
echo Node.js nao encontrado. Baixando a versao portatil automaticamente
echo (nao precisa de administrador, leva alguns minutos, precisa de internet)...
echo.
if not exist "%~dp0node-portable" mkdir "%~dp0node-portable"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $z=Join-Path $env:TEMP 'node-portable.zip'; Invoke-WebRequest -UseBasicParsing 'https://nodejs.org/dist/v24.22.2/node-v24.22.2-win-x64.zip' -OutFile $z; Expand-Archive -Force -Path $z -DestinationPath '%~dp0node-portable'; Remove-Item $z"
if errorlevel 1 echo Nao foi possivel baixar automaticamente.
goto search

:found
echo.
echo Iniciando o servidor do Gestao de Projetos - AUTOMACAO...
echo Usando Node.js: %NODE_EXE%
echo Deixe esta janela aberta. Feche-a apenas se quiser parar o servidor.
echo.
"%NODE_EXE%" start.js
echo.
echo ==========================================================
echo O servidor parou. Se apareceu uma mensagem de erro acima,
echo copie o texto dela e envie para quem esta ajudando.
echo ==========================================================
pause
exit /b

:nonode
echo.
echo ==========================================================
echo  Node.js NAO foi encontrado e o download automatico falhou
echo  (talvez a rede da empresa bloqueie o site nodejs.org).
echo.
echo  SE VOCE TEM permissao de administrador:
echo    Baixe e instale a versao LTS em https://nodejs.org/
echo    e rode este arquivo de novo.
echo.
echo  SE VOCE NAO TEM permissao de administrador, como no
echo  computador da empresa:
echo    1. Baixe a versao "Windows Binary .zip" em
echo       https://nodejs.org/en/download
echo       Nao e o instalador: e um arquivo .zip que nao
echo       precisa instalar nada.
echo    2. Extraia o conteudo do zip dentro da pasta:
echo       %~dp0node-portable
echo    3. Rode este arquivo de novo.
echo.
echo  IMPORTANTE: se voce abriu este arquivo de dentro do .zip
echo  do projeto, extraia o projeto inteiro primeiro.
echo ==========================================================
echo.
pause
exit /b 1
