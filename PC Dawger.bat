@echo off
setlocal
cd /d "%~dp0"
title Dawger

if exist "pc-app\start-pcdawger.bat" (
    cd pc-app
    call start-pcdawger.bat
    exit /b 0
)

if exist "pc-app\dist\PCDawger-portable.exe" (
    start "" "pc-app\dist\PCDawger-portable.exe"
    exit /b 0
)

echo =======================================================
echo ERREUR : Le sous-dossier pc-app est introuvable.
echo =======================================================
pause
exit /b 1
