@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Dawger - demarrage automatique
echo ============================================

echo.
echo [1/4] Verification des fichiers .env...
if not exist ".env" goto envmissing
if not exist "API\Mainapi\.env" goto envmissing
if not exist "API\proxiesembed\.env" goto envmissing
goto envok

:envmissing
echo ERREUR: un ou plusieurs fichiers .env sont manquants (nouveau PC ?).
echo Restaure-les d'abord avec: env-backup\restore-env.bat
pause
exit /b 1

:envok
echo OK.

echo.
echo [2/4] Verification de Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERREUR: Docker Desktop n'est pas lance.
    echo Ouvre Docker Desktop, attends qu'il soit pret, puis relance ce script.
    pause
    exit /b 1
)
echo OK.

echo.
echo [3/4] Demarrage des services (mysql, redis, api, proxiesembed, bypass403, frontend)...
echo (Premiere fois: le build peut prendre plusieurs minutes, c'est normal)
docker compose up -d --build mysql redis api proxiesembed bypass403 frontend
if errorlevel 1 (
    echo ERREUR: le demarrage Docker a echoue, regarde le message ci-dessus.
    pause
    exit /b 1
)

echo.
echo Attente que le site reponde sur http://localhost:3001 ...
set /a tries=0
:waitloop
curl -s -o nul http://localhost:3001
if not errorlevel 1 goto ready
set /a tries+=1
if %tries% GEQ 60 (
    echo ERREUR: le site ne repond toujours pas apres 2 minutes.
    echo Regarde les logs avec: docker compose logs frontend
    pause
    exit /b 1
)
timeout /t 2 >nul
goto waitloop

:ready
echo Site pret.

echo.
echo [4/4] Lancement de l'appli PC Dawger (Electron)...

REM Prefere un build deja compile (electron-builder) : autonome, ne demande
REM pas Node.js sur la machine -- utile sur un PC "neuf" qui n'a que Docker.
if exist "pc-app\dist\PCDawger-portable.exe" (
    start "" "pc-app\dist\PCDawger-portable.exe"
    goto launched
)
if exist "pc-app\dist\win-unpacked\PC Dawger.exe" (
    start "" "pc-app\dist\win-unpacked\PC Dawger.exe"
    goto launched
)

REM Aucun build trouve : fallback source (necessite Node.js installe).
cd pc-app
if not exist node_modules (
    echo Aucun build trouve et Node.js requis pour la 1ere installation, patiente...
    call npm install
)
call npm start
cd ..

:launched
endlocal
