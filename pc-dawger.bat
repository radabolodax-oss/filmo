@echo off
setlocal
cd /d "%~dp0"
title Dawger

cd pc-app
call start-pcdawger.bat
exit /b 0
