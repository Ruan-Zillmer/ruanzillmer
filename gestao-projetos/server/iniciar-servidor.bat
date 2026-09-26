@echo off
cd /d "%~dp0"
echo.
echo Iniciando o servidor do Gestao de Projetos - AUTOMACAO...
echo Deixe esta janela aberta. Feche-a apenas se quiser parar o servidor.
echo.
node start.js
pause
