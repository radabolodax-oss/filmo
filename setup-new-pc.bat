@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Dawger - installation nouveau PC
echo ============================================
echo Automatise tout sauf Docker Desktop (a installer
echo une fois a la main, voir message ci-dessous si besoin)
echo et la cle privee age (a fournir a la main, jamais
echo stockee dans le repo).

echo.
echo [1/5] Verification de Git...
where git >nul 2>&1
if errorlevel 1 (
    echo ERREUR: Git n'est pas installe.
    echo Installe-le avec: winget install Git.Git
    pause
    exit /b 1
)
echo OK.

echo.
echo [2/5] Verification de Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo Docker Desktop n'est pas installe ou pas lance sur ce PC.
    echo ^(necessite WSL2 + redemarrage Windows, ne peut pas s'installer
    echo tout seul depuis ce script sans risquer de planter en cours de route^).
    echo.
    echo Ouverture du guide d'installation officiel dans ton navigateur...
    start "" "https://docs.docker.com/desktop/setup/install/windows-install/"
    echo.
    echo Une fois Docker Desktop installe, lance et pret ^(icone baleine stable
    echo dans la barre des taches^), relance simplement setup-new-pc.bat.
    pause
    exit /b 1
)
echo OK.

echo.
echo [3/5] Verification de age...
where age >nul 2>&1
if errorlevel 1 (
    echo Installation de age via winget...
    winget install FiloSottile.age -e --silent --accept-package-agreements --accept-source-agreements
    where age >nul 2>&1
    if errorlevel 1 (
        echo ERREUR: installation de age echouee, installe-le a la main.
        pause
        exit /b 1
    )
)
echo OK.

echo.
echo [4/5] Verification de Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo Installation de Node.js via winget...
    winget install OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
    echo.
    echo Node.js vient d'etre installe: ferme cette fenetre, ouvre-en une
    echo nouvelle ^(pour recharger le PATH^), et relance setup-new-pc.bat.
    pause
    exit /b 0
)
echo OK.

echo.
echo [5/5] Restauration des .env et demarrage...
if not exist ".env" (
    call env-backup\restore-env.bat
)
if not exist ".env" (
    echo ERREUR: .env toujours absent, restauration annulee ou echouee.
    pause
    exit /b 1
)
call start-dawger.bat

endlocal
