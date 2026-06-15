@echo off
echo === Movix MySQL Fix ===

echo [1] Arret du service MySQL80...
net stop MySQL80
timeout /t 3 /nobreak > nul

echo [2] Lancement mysqld avec init-file...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.0\my.ini" --init-file="C:\Users\PC\Desktop\prowler\MovixOpenSource-main\reset_mysql_root.sql" --console

echo [3] Redemarrage du service MySQL80...
net start MySQL80
timeout /t 4 /nobreak > nul

echo [4] Verification...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u movix -pmovix_pass -h 127.0.0.1 -e "SELECT 'movix user OK' AS result;"

echo === TERMINE - ferme cette fenetre ===
pause
