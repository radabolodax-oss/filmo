@echo off
setlocal
cd /d "%~dp0"
title Dawger - Configuration Nouveau PC

echo ============================================
echo   DAWGER - INSTALLATION NOUVEAU PC
echo ============================================
echo.

REM Synchronisation automatique silencieuse de l'horloge
net start w32time >nul 2>&1
w32tm /resync /force >nul 2>&1

echo.
echo [1/4] Verification de Git...
where git >nul 2>&1
if errorlevel 1 (
    echo ERREUR: Git n'est pas installe.
    echo Installe-le avec: winget install Git.Git
    pause
    exit /b 1
)
echo [OK] Git est present.

echo.
echo [2/4] Verification de Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo Docker Desktop n'est pas lance sur ce PC.
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        echo Demarrage automatique de Docker Desktop...
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
        echo Attente de 10 secondes...
        ping 127.0.0.1 -n 10 >nul
    ) else (
        echo Docker Desktop n'est pas installe.
        echo Ouverture du guide d'installation officiel...
        start "" "https://docs.docker.com/desktop/setup/install/windows-install/"
        echo Une fois installe et lance, relancez ce script.
        pause
        exit /b 1
    )
)
echo [OK] Docker Desktop est pret.

echo.
echo [3/4] Verification de Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo Installation automatique de Node.js via winget...
    winget install OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
    echo.
    echo Node.js vient d'etre installe : ferme cette fenetre, ouvre-en une
    echo nouvelle (pour recharger le PATH), puis relance setup-new-pc.bat.
    pause
    exit /b 0
)
echo [OK] Node.js est present.

echo.
echo [4/4] Verification des fichiers d'environnement (.env)...
if not exist ".env" (
    echo Fichier .env absent, tentative de restauration securisee...
    if exist "env-backup\restore-env.bat" (
        call env-backup\restore-env.bat
    )
)

if not exist ".env" (
    echo.
    echo ATTENTION: Le fichier .env principal est manquant.
    echo Si vous venez de telecharger DAWGER_PACK_NOUVEAU_PC.zip, verifiez que le .env est bien extrait.
    pause
    exit /b 1
)

echo [OK] Configuration prete, lancement de Dawger...
call start-dawger.bat

endlocal
