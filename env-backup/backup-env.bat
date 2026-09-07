@echo off
setlocal
cd /d "%~dp0\.."

set PUBKEY=age1ndjrjdazg6prmdwmxmfp0agvfwuuttd7ltldycga3n8h2808hf5skex2v0

where age >nul 2>&1
if errorlevel 1 (
    echo ERREUR: "age" n'est pas installe ou pas dans le PATH.
    echo Installe-le avec: winget install FiloSottile.age
    pause
    exit /b 1
)

echo Chiffrement des .env avec age...
echo.

if exist ".env" (
    age -r %PUBKEY% -o env-backup\root.age .env
    echo   .env                    -^> env-backup\root.age
) else (
    echo   ATTENTION: .env introuvable a la racine, ignore.
)

if exist "API\Mainapi\.env" (
    age -r %PUBKEY% -o env-backup\mainapi.age API\Mainapi\.env
    echo   API\Mainapi\.env        -^> env-backup\mainapi.age
) else (
    echo   ATTENTION: API\Mainapi\.env introuvable, ignore.
)

if exist "API\proxiesembed\.env" (
    age -r %PUBKEY% -o env-backup\proxiesembed.age API\proxiesembed\.env
    echo   API\proxiesembed\.env   -^> env-backup\proxiesembed.age
) else (
    echo   ATTENTION: API\proxiesembed\.env introuvable, ignore.
)

echo.
echo Termine. Pense a committer et pousser :
echo   git add env-backup\*.age
echo   git commit -m "Update encrypted .env backups"
echo   git push
echo.
pause
