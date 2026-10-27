@echo off
setlocal
cd /d "%~dp0"
title Dawger - Demarrage

echo ============================================
echo         DAWGER - DEMARRAGE
echo ============================================

REM Synchronisation automatique silencieuse de l'horloge
net start w32time >nul 2>&1
w32tm /resync /force >nul 2>&1

echo.
echo [1/3] Verification de Docker Desktop...
docker info >nul 2>&1
if not errorlevel 1 goto docker_pret

echo Docker Desktop n'est pas lance, demarrage automatique...
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    echo Attente que Docker soit pret...
) else (
    echo ERREUR: Docker Desktop n'est pas lance.
    echo Ouvre Docker Desktop depuis ton menu Demarrer, puis relance ce script.
    pause
    exit /b 1
)

:wait_docker
ping 127.0.0.1 -n 3 >nul
docker info >nul 2>&1
if errorlevel 1 goto wait_docker
echo [OK] Docker est pret !

:docker_pret

echo.
echo [2/3] Demarrage des serveurs et conteneurs...
docker compose up -d mysql redis api proxiesembed bypass403 frontend >nul 2>&1
if not errorlevel 1 goto conteneurs_ok

echo Premier demarrage detecte, construction des conteneurs...
docker compose up -d --build mysql redis api proxiesembed bypass403 frontend
if errorlevel 1 (
    echo.
    echo =======================================================
    echo ERREUR : Le demarrage Docker a rencontre un probleme.
    echo =======================================================
    pause
    exit /b 1
)

:conteneurs_ok
echo [OK] Serveurs operationnels !

echo.
echo [3/3] Synchronisation et ouverture de Dawger...
set /a tries=0

:wait_frontend
curl -s -m 1 -o nul http://localhost:3001
if not errorlevel 1 goto lancer_electron

set /a tries+=1
if %tries% GEQ 30 goto lancer_electron
ping 127.0.0.1 -n 2 >nul
goto wait_frontend

:lancer_electron
echo Lancement de Dawger PC...

REM Priorite 1 : L'executable autonome portable tout-en-un
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
cd pc-app
start /b npm start
exit /b 0
