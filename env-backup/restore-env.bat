@echo off
setlocal
cd /d "%~dp0\.."
title Dawger - Restauration des cles .env

where age >nul 2>&1
if errorlevel 1 (
    echo ERREUR: L'outil de dechiffrement "age" n'est pas installe ou pas dans le PATH.
    echo Installez-le avec : winget install FiloSottile.age
    pause
    exit /b 1
)

set KEYFILE=
set DEFAULT_KEYFILE=%USERPROFILE%\Desktop\dawger-backups-age-key.txt

if exist "%DEFAULT_KEYFILE%" (
    echo Cle privee trouvee automatiquement sur le Bureau : %DEFAULT_KEYFILE%
    set KEYFILE=%DEFAULT_KEYFILE%
) else if exist "%~dp0..\dawger-backups-age-key.txt" (
    echo Cle privee trouvee dans le dossier racine : %~dp0..\dawger-backups-age-key.txt
    set KEYFILE=%~dp0..\dawger-backups-age-key.txt
) else if exist "%~dp0..\..\dawger-backups-age-key.txt" (
    echo Cle privee trouvee : %~dp0..\..\dawger-backups-age-key.txt
    set KEYFILE=%~dp0..\..\dawger-backups-age-key.txt
) else (
    set /p KEYFILE=Chemin vers le fichier de cle age ^(ex: C:\Users\toi\dawger-key.txt^) : 
)

if "%KEYFILE%"=="" (
    echo ERREUR : Aucun fichier de cle specifie.
    pause
    exit /b 1
)

if not exist "%KEYFILE%" (
    echo ERREUR : Fichier de cle introuvable : %KEYFILE%
    pause
    exit /b 1
)

echo.
echo Dechiffrement des fichiers d'environnement...
echo.

if exist "env-backup\root.age" (
    age -d -i "%KEYFILE%" -o .env env-backup\root.age
    if errorlevel 1 (echo   [ECHEC] env-backup\root.age) else (echo   [OK] env-backup\root.age        -^> .env)
) else (
    echo   [IGNORE] env-backup\root.age introuvable.
)

if exist "env-backup\mainapi.age" (
    age -d -i "%KEYFILE%" -o API\Mainapi\.env env-backup\mainapi.age
    if errorlevel 1 (echo   [ECHEC] env-backup\mainapi.age) else (echo   [OK] env-backup\mainapi.age      -^> API\Mainapi\.env)
) else (
    echo   [IGNORE] env-backup\mainapi.age introuvable.
)

if exist "env-backup\proxiesembed.age" (
    age -d -i "%KEYFILE%" -o API\proxiesembed\.env env-backup\proxiesembed.age
    if errorlevel 1 (echo   [ECHEC] env-backup\proxiesembed.age) else (echo   [OK] env-backup\proxiesembed.age -^> API\proxiesembed\.env)
) else (
    echo   [IGNORE] env-backup\proxiesembed.age introuvable.
)

echo.
echo Restauration terminee avec succes.
echo.
pause
