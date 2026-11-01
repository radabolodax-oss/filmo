@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Dawger PC

REM Verification automatique de Docker avant de lancer le client PC
docker info >nul 2>&1
if errorlevel 1 (
    echo Verification de Docker Desktop...
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LocalAppData%\Docker\Docker Desktop.exe" (
        start "" "%LocalAppData%\Docker\Docker Desktop.exe"
    )
    
    set /a wait_cnt=0
    :wait_loop
    ping 127.0.0.1 -n 3 >nul
    docker info >nul 2>&1
    if not errorlevel 1 goto docker_ready
    set /a wait_cnt+=3
    if !wait_cnt! GEQ 60 goto docker_ready
    goto wait_loop
)

:docker_ready
REM S'assurer que les conteneurs du projet parent sont demarres
pushd ..
docker compose up -d mysql redis api proxiesembed bypass403 frontend >nul 2>&1
popd

set ELECTRON_RUN_AS_NODE=

REM Lancement prioritaire de l'executable autonome s'il existe
if exist "dist\PCDawger-portable.exe" (
    start "" "dist\PCDawger-portable.exe"
    exit /b 0
)

REM Fallback npm start
call npm start
