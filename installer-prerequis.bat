@echo off
setlocal
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

where docker >nul 2>&1
if not errorlevel 1 (
    echo [OK] Docker est installe mais pas encore lance.
    echo Pense a ouvrir "Docker Desktop" depuis ton menu Demarrer.
    goto check_node
)

echo Docker Desktop n'a pas ete detecte.
echo Lancement de l'installation automatique via winget...
echo (Une fenetre Windows peut te demander d'autoriser l'installation)
echo.
winget install --id Docker.DockerDesktop --source winget -e --accept-package-agreements --accept-source-agreements

if errorlevel 1 (
    echo.
    echo ATTENTION: L'installation automatique de Docker a rencontre un probleme.
    echo Tu peux telecharger et installer Docker Desktop directement ici :
    echo https://docs.docker.com/desktop/setup/install/windows-install/
    start "" "https://docs.docker.com/desktop/setup/install/windows-install/"
    echo.
) else (
    echo.
    echo [OK] Installation de Docker Desktop terminee !
    echo IMPORTANT : Si Windows te demande de redemarrer pour activer WSL2, fais-le.
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
    echo Tu peux telecharger Node.js LTS directement ici :
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
echo 1. Ouvre "Docker Desktop" depuis ton menu Demarrer.
echo 2. Attends 1 a 2 minutes que l'icone de la baleine soit prete.
echo 3. Double-clique sur le raccourci "start-dawger" !
echo.
echo Appuie sur une touche pour fermer cette fenetre.
pause >nul
endlocal
