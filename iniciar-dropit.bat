@echo off
title DropIt - Iniciando servidores...
color 0A

echo.
echo  DropIt Service — Iniciando servidores
echo  ========================================
echo.

:: Iniciar API en nueva ventana
start "DropIt API (puerto 4000)" cmd /k "cd /d %~dp0apps\api && node src/server.js"

:: Esperar 2 segundos y luego iniciar el frontend
timeout /t 2 /nobreak >nul

:: Iniciar Web en nueva ventana
start "DropIt Web (puerto 5173)" cmd /k "cd /d %~dp0apps\web && npx vite --host"

echo  API iniciando en:  http://localhost:4000
echo  Web iniciando en:  http://localhost:5173
echo.
echo  Abre http://localhost:5173 en tu navegador
echo.
pause
