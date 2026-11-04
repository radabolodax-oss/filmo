@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Dawger - Lancement Sans Docker (Mode Leger)

echo =======================================================
echo          DAWGER - LANCEMENT PC SANS DOCKER
echo       (Mode Leger : SQLite + Cache RAM en direct)
echo =======================================================
echo.

REM 1. Verification de Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js n'est pas installe sur cette machine.
    echo Installe Node.js depuis https://nodejs.org pour lancer ce mode.
    pause
    exit /b 1
)

REM 1.1 Verification automatique des modules (1er lancement)
if not exist "API\Mainapi\node_modules" (
    echo [PREMIER LANCEMENT] Installation des modules de l'API en cours, patientez...
    cd "API\Mainapi"
    call npm install
    cd /d "%~dp0"
)

if not exist "node_modules" (
    echo [PREMIER LANCEMENT] Installation des modules du Frontend en cours, patientez...
    call npm install
)

REM 2. Demarrage du Backend leger (server-mobile.js)
echo [1/3] Verification de l'API Backend...
curl -s -m 1 -o nul http://localhost:25565 >nul 2>&1
if not errorlevel 1 (
    echo [OK] L'API Backend tourne deja sur le port 25565.
    goto frontend_step
)

echo Demarrage de l'API Backend legere (server-mobile.js)...
cd "API\Mainapi"
start "Dawger Backend" /min cmd /c "node server-mobile.js"
cd /d "%~dp0"

set /a tries_api=0
:wait_api
curl -s -m 1 -o nul http://localhost:25565 >nul 2>&1
if not errorlevel 1 (
    echo [OK] Backend pret !
    goto frontend_step
)
set /a tries_api+=1
if !tries_api! GEQ 15 (
    echo [ATTENTION] L'API met plus de temps a repondre, continuation...
    goto frontend_step
)
ping 127.0.0.1 -n 2 >nul
goto wait_api

:frontend_step
REM 3. Demarrage du Frontend
echo.
echo [2/3] Verification du Frontend Web...
curl -s -m 1 -o nul http://localhost:3000 >nul 2>&1
if not errorlevel 1 (
    echo [OK] Le Frontend tourne deja sur le port 3000.
    goto launch_app
)
curl -s -m 1 -o nul http://localhost:3001 >nul 2>&1
if not errorlevel 1 (
    echo [OK] Le Frontend tourne deja sur le port 3001.
    goto launch_app
)

echo Demarrage du Frontend Vite...
start "Dawger Frontend" /min cmd /c "npm run dev"

set /a tries_front=0
:wait_front
curl -s -m 1 -o nul http://localhost:3000 >nul 2>&1
if not errorlevel 1 goto launch_app
curl -s -m 1 -o nul http://localhost:3001 >nul 2>&1
if not errorlevel 1 goto launch_app
set /a tries_front+=1
if !tries_front! GEQ 15 (
    echo [ATTENTION] Le frontend met plus de temps a demarrer, tentative d'ouverture...
    goto launch_app
)
ping 127.0.0.1 -n 2 >nul
goto wait_front

:launch_app
REM 4. Ouverture de l'application
echo.
echo [3/3] Ouverture de Dawger...
if exist "pc-app\dist\PCDawger-portable.exe" (
    echo Lancement de la fenetre PC Dawger...
    start "" "pc-app\dist\PCDawger-portable.exe"
    exit /b 0
)

if exist "..\PCDawger-portable.exe" (
    start "" "..\PCDawger-portable.exe"
    exit /b 0
)

echo Ouverture dans le navigateur par defaut...
start "" "http://localhost:3000"
exit /b 0
