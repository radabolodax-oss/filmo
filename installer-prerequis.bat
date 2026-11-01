@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Dawger - Installation des prerequis

echo =======================================================
echo          DAWGER - INSTALLATION DES PREREQUIS
echo =======================================================
echo.

REM Synchronisation automatique silencieuse de l'horloge Windows
net start w32time >nul 2>&1
w32tm /resync /force >nul 2>&1

echo.
echo =======================================================
echo [1/2] VERIFICATION DE DOCKER DESKTOP...
echo =======================================================
docker info >nul 2>&1
if not errorlevel 1 (
    echo [OK] Docker Desktop est deja installe et actif !
    goto check_node
)

REM Si docker info echoue, verifier si l'executable Docker existe deja
set "DOCKER_INST="
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    set "DOCKER_INST=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
) else if exist "%LocalAppData%\Docker\Docker Desktop.exe" (
    set "DOCKER_INST=%LocalAppData%\Docker\Docker Desktop.exe"
) else if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" (
    set "DOCKER_INST=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
)

if defined DOCKER_INST (
    echo [OK] Docker Desktop est installe. Lancement automatique...
    start "" "!DOCKER_INST!"
    goto check_node
)

where docker >nul 2>&1
if not errorlevel 1 (
    echo [OK] Docker CLI est installe. Pensez a lancer Docker Desktop depuis votre menu Demarrer.
    goto check_node
)

echo Docker Desktop n'a pas ete detecte.
echo Lancement de l'installation automatique via winget...
echo (Une fenetre Windows peut vous demander d'autoriser l'installation)
echo.
winget install --id Docker.DockerDesktop --source winget -e --accept-package-agreements --accept-source-agreements

if errorlevel 1 (
    echo.
    echo ATTENTION: L'installation automatique de Docker a rencontre un probleme.
    echo Vous pouvez telecharger et installer Docker Desktop directement ici :
    echo https://docs.docker.com/desktop/setup/install/windows-install/
    start "" "https://docs.docker.com/desktop/setup/install/windows-install/"
    echo.
) else (
    echo.
    echo [OK] Installation de Docker Desktop terminee !
    echo IMPORTANT : Si Windows vous demande de redemarrer pour activer WSL2, redemarrez votre PC.
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    )
)

:check_node
echo.
echo =======================================================
echo [2/2] VERIFICATION DE NODE.JS...
echo =======================================================
where node >nul 2>&1
if not errorlevel 1 (
    echo [OK] Node.js est deja installe !
    goto fin
)

echo Node.js n'a pas ete detecte.
echo Lancement de l'installation automatique via winget (source officielle)...
winget install --id OpenJS.NodeJS.LTS --source winget -e --accept-package-agreements --accept-source-agreements

if errorlevel 1 (
    echo.
    echo ATTENTION: L'installation automatique de Node.js a echoue.
    echo Vous pouvez telecharger Node.js LTS directement ici :
    echo https://nodejs.org/
    start "" "https://nodejs.org/"
) else (
    echo.
    echo [OK] Installation de Node.js terminee !
)

:fin
echo.
echo =======================================================
echo                 INSTALLATION TERMINEE !
echo =======================================================
echo.
echo PROCHAINES ETAPES :
echo 1. Assurez-vous que Docker Desktop est ouvert (icone baleine dans la barre des taches).
echo 2. Double-cliquez simplement sur "PC Dawger.bat" !
echo.
echo Appuyez sur une touche pour fermer cette fenetre.
pause >nul
endlocal
