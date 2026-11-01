@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Dawger - Demarrage

echo =======================================================
echo                 DAWGER - LANCEMENT PC
echo =======================================================
echo.

REM 1. Synchronisation automatique silencieuse de l'horloge Windows
net start w32time >nul 2>&1
w32tm /resync /force >nul 2>&1

REM 2. Verification et lancement automatique de Docker Desktop
echo [1/3] Verification de Docker Desktop...
docker info >nul 2>&1
if not errorlevel 1 goto docker_pret

echo Docker Desktop n'est pas actif, lancement automatique...
set "DOCKER_EXE="
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
) else if exist "%LocalAppData%\Docker\Docker Desktop.exe" (
    set "DOCKER_EXE=%LocalAppData%\Docker\Docker Desktop.exe"
) else if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" (
    set "DOCKER_EXE=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
)

if defined DOCKER_EXE (
    start "" "!DOCKER_EXE!"
    echo Lancement de Docker Desktop en cours...
    echo Attente du demarrage du moteur Docker...
) else (
    echo [AVERTISSEMENT] Docker Desktop n'est pas trouve dans les repertoires standards.
    echo Si Docker est installe dans un autre repertoire, veuillez le lancer manuellement.
)

REM Boucle d'attente active pour que le daemon Docker soit pret (max ~90s)
set /a docker_wait=0
:wait_docker
ping 127.0.0.1 -n 3 >nul
docker info >nul 2>&1
if not errorlevel 1 (
    echo [OK] Docker Desktop est pret !
    goto docker_pret
)
set /a docker_wait+=3
if !docker_wait! GEQ 90 (
    echo [ATTENTION] Le demarrage de Docker prend plus de temps que prevu. Tentative de continuation...
    goto conteneurs_step
)
goto wait_docker

:docker_pret
echo [OK] Moteur Docker operationnel.

:conteneurs_step
REM 3. Lancement des conteneurs (Base MySQL, Redis, APIs et Frontend)
echo.
echo [2/3] Demarrage des services et conteneurs...
docker compose up -d mysql redis api proxiesembed bypass403 frontend >nul 2>&1
if not errorlevel 1 (
    echo [OK] Conteneurs operationnels !
    goto attente_serveur
)

echo Premier lancement ou conteneurs a reconstruire...
docker compose up -d --build mysql redis api proxiesembed bypass403 frontend
if errorlevel 1 (
    echo [INFO] Notification Docker retournee, verification de la disponibilite...
)

:attente_serveur
REM 4. Attente de disponibilite du frontend
echo.
echo [3/3] Synchronisation et ouverture de Dawger...
set /a tries=0

:wait_frontend
curl -s -m 1 -o nul http://localhost:3000 >nul 2>&1
if not errorlevel 1 goto lancer_app

curl -s -m 1 -o nul http://localhost:3001 >nul 2>&1
if not errorlevel 1 goto lancer_app

set /a tries+=1
if !tries! GEQ 30 goto lancer_app
ping 127.0.0.1 -n 2 >nul
goto wait_frontend

:lancer_app
echo.
echo Lancement de la fenetre Dawger PC...
set ELECTRON_RUN_AS_NODE=

REM Priorite 1 : L'executable autonome portable fraichement compile
if exist "pc-app\dist\PCDawger-portable.exe" (
    start "" "pc-app\dist\PCDawger-portable.exe"
    exit /b 0
)

REM Priorite 2 : Electron direct depuis node_modules
if exist "pc-app\node_modules\electron\dist\electron.exe" (
    start "" "pc-app\node_modules\electron\dist\electron.exe" "pc-app"
    exit /b 0
)

REM Priorite 3 : Fallback npm start
if exist "pc-app\package.json" (
    cd pc-app
    start "" npm start
    exit /b 0
)

REM Fallback navigateur si pc-app n'est pas installe
start "" "http://localhost:3000"
exit /b 0
