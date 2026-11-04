@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Dawger - Setup Nouveau PC

echo =======================================================
echo           DAWGER - SETUP COMPLET NOUVEAU PC
echo =======================================================
echo.

REM Synchronisation automatique silencieuse de l'horloge Windows
net start w32time >nul 2>&1
w32tm /resync /force >nul 2>&1

echo [1/4] Verification de Git...
where git >nul 2>&1
if errorlevel 1 (
    echo Installation automatique de Git via winget...
    winget install --id Git.Git --source winget -e --accept-package-agreements --accept-source-agreements
) else (
    echo [OK] Git est present.
)

echo.
echo [2/4] Verification et installation de Docker Desktop...
docker info >nul 2>&1
if not errorlevel 1 goto docker_setup_ok

set "DOCKER_BIN="
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    set "DOCKER_BIN=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
) else if exist "%LocalAppData%\Docker\Docker Desktop.exe" (
    set "DOCKER_BIN=%LocalAppData%\Docker\Docker Desktop.exe"
) else if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" (
    set "DOCKER_BIN=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
)

if not defined DOCKER_BIN (
    echo Docker Desktop n'est pas detecte. Installation automatique via winget...
    winget install --id Docker.DockerDesktop --source winget -e --accept-package-agreements --accept-source-agreements
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        set "DOCKER_BIN=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LocalAppData%\Docker\Docker Desktop.exe" (
        set "DOCKER_BIN=%LocalAppData%\Docker\Docker Desktop.exe"
    )
)

if defined DOCKER_BIN (
    echo Demarrage automatique de Docker Desktop...
    start "" "!DOCKER_BIN!"
    echo Attente que le moteur Docker soit operationnel...
    set /a wait_d=0
    :wait_docker_setup
    ping 127.0.0.1 -n 3 >nul
    docker info >nul 2>&1
    if not errorlevel 1 goto docker_setup_ok
    set /a wait_d+=3
    if !wait_d! GEQ 90 (
        echo [ATTENTION] Docker met du temps a demarrer, continuation...
        goto docker_setup_ok
    )
    goto wait_docker_setup
) else (
    echo ATTENTION: Impossible d'installer ou de trouver Docker Desktop automatiquement.
    echo Ouverture du guide officiel : https://docs.docker.com/desktop/setup/install/windows-install/
    start "" "https://docs.docker.com/desktop/setup/install/windows-install/"
    pause
    exit /b 1
)

:docker_setup_ok
echo [OK] Docker Desktop est pret.

echo.
echo [3/4] Verification et installation de Node.js LTS...
where node >nul 2>&1
if errorlevel 1 (
    echo Installation automatique de Node.js LTS via winget...
    winget install --id OpenJS.NodeJS.LTS --source winget -e --accept-package-agreements --accept-source-agreements
) else (
    echo [OK] Node.js est present.
)

echo.
echo [4/4] Verification des fichiers d'environnement (.env)...
if not exist ".env" (
    echo Fichier .env absent, tentative de restauration...
    if exist "env-backup\restore-env.bat" (
        call env-backup\restore-env.bat
    )
)

echo.
echo =======================================================
echo        SETUP TERMINE - LANCEMENT DE DAWGER PC
echo =======================================================
call "PC Dawger.bat"
endlocal
