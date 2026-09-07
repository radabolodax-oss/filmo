@echo off
setlocal
cd /d "%~dp0\.."

where age >nul 2>&1
if errorlevel 1 (
    echo ERREUR: "age" n'est pas installe ou pas dans le PATH.
    echo Installe-le avec: winget install FiloSottile.age
    pause
    exit /b 1
)

set DEFAULT_KEYFILE=%USERPROFILE%\Desktop\dawger-backups-age-key.txt
if exist "%DEFAULT_KEYFILE%" (
    echo Cle privee trouvee automatiquement: %DEFAULT_KEYFILE%
    set KEYFILE=%DEFAULT_KEYFILE%
) else (
    set /p KEYFILE=Chemin vers la cle privee age ^(ex: C:\Users\toi\dawger-key.txt^):
)
if not exist "%KEYFILE%" (
    echo ERREUR: fichier de cle introuvable: %KEYFILE%
    pause
    exit /b 1
)

echo.
echo Dechiffrement...
echo.

if exist "env-backup\root.age" (
    age -d -i "%KEYFILE%" -o .env env-backup\root.age
    if errorlevel 1 (echo   ECHEC: env-backup\root.age) else (echo   env-backup\root.age        -^> .env)
) else (
    echo   ATTENTION: env-backup\root.age introuvable, ignore.
)

if exist "env-backup\mainapi.age" (
    age -d -i "%KEYFILE%" -o API\Mainapi\.env env-backup\mainapi.age
    if errorlevel 1 (echo   ECHEC: env-backup\mainapi.age) else (echo   env-backup\mainapi.age      -^> API\Mainapi\.env)
) else (
    echo   ATTENTION: env-backup\mainapi.age introuvable, ignore.
)

if exist "env-backup\proxiesembed.age" (
    age -d -i "%KEYFILE%" -o API\proxiesembed\.env env-backup\proxiesembed.age
    if errorlevel 1 (echo   ECHEC: env-backup\proxiesembed.age) else (echo   env-backup\proxiesembed.age -^> API\proxiesembed\.env)
) else (
    echo   ATTENTION: env-backup\proxiesembed.age introuvable, ignore.
)

echo.
echo Termine. Tu peux maintenant lancer start-dawger.bat
echo.
pause
