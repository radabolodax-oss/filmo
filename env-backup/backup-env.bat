@echo off
setlocal
cd /d "%~dp0\.."
title Dawger - Sauvegarde chiffree des cles .env

set PUBKEY=age1ndjrjdazg6prmdwmxmfp0agvfwuuttd7ltldycga3n8h2808hf5skex2v0

where age >nul 2>&1
if errorlevel 1 (
    echo ERREUR: L'outil de chiffrement "age" n'est pas installe ou pas dans le PATH.
    echo Installez-le avec : winget install FiloSottile.age
    pause
    exit /b 1
)

if not exist "env-backup" (
    mkdir env-backup
)

echo Chiffrement des fichiers .env avec la cle publique...
echo.

if exist ".env" (
    age -r %PUBKEY% -o env-backup\root.age .env
    echo   [OK] .env                    -^> env-backup\root.age
) else (
    echo   [IGNORE] .env introuvable a la racine.
)

if exist "API\Mainapi\.env" (
    age -r %PUBKEY% -o env-backup\mainapi.age API\Mainapi\.env
    echo   [OK] API\Mainapi\.env        -^> env-backup\mainapi.age
) else (
    echo   [IGNORE] API\Mainapi\.env introuvable.
)

if exist "API\proxiesembed\.env" (
    age -r %PUBKEY% -o env-backup\proxiesembed.age API\proxiesembed\.env
    echo   [OK] API\proxiesembed\.env   -^> env-backup\proxiesembed.age
) else (
    echo   [IGNORE] API\proxiesembed\.env introuvable.
)

echo.
echo Sauvegarde terminee. Pour mettre a jour le depot git :
echo   git add env-backup\*.age
echo   git commit -m "chore(env): update encrypted env backup"
echo   git push
echo.
pause
